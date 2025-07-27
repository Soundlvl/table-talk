// server/commands/reply.ts
import { v4 as uuidv4 } from 'uuid';
import { ServerSocketType, CommandContext, Command, Message, WhisperTarget } from '../types';

const replyCommand: Command = {
  name: 'reply',
  description: 'Accepts a pending whisper invitation and joins the private channel.',
  aliases: ['r'],
  execute(socket: ServerSocketType, _args: string[], context: CommandContext): void {
    const { io, gameState, utils, characterId } = context;
    const character = gameState.charactersData.get(characterId);
    if (!character) return;

    if (!character.pendingWhisperInvites || character.pendingWhisperInvites.length === 0) {
      utils.notifyUser(socket, 'You have no pending whisper invitations to reply to.', true);
      return;
    }
    
    const invite = character.pendingWhisperInvites.pop();
    if(!invite) {
        utils.notifyUser(socket, 'Error processing whisper invitation.', true);
        return;
    }

    // --- Core Validation Step: Check if the invite is still active ---
    const senderData = gameState.charactersData.get(invite.fromId);
    const isChannelActive = senderData && senderData.whisperTargets && senderData.whisperTargets.length > 0;

    if (!isChannelActive) {
      utils.notifyUser(socket, "This whisper invitation has expired because the sender has left the private chat.", true);
      // Clean up any other stale invites from the same sender
      character.pendingWhisperInvites = character.pendingWhisperInvites.filter(
          inv => inv.fromId !== invite.fromId
      );
      gameState.charactersData.set(characterId, character);

      // Update client UI to remove the "reply" button if no other invites are pending.
      const detailsToSend = {
          ...character,
          hasPendingInvites: (character.pendingWhisperInvites?.length ?? 0) > 0,
          whisperTargets: []
      };
      socket.emit('characterDetailsConfirmed', detailsToSend);
      return;
    }
    // --- End Validation ---

    // --- Join Logic ---
    let replierPersonaName = character.characterName;
    if (character.isGM && invite.originalTargetType === 'NPC' && invite.originalTargetName) {
      character.speakingAsNPCName = invite.originalTargetName;
      replierPersonaName = invite.originalTargetName;
      gameState.npcList.add(invite.originalTargetName);
      socket.emit('personaUpdate', { speakingAs: invite.originalTargetName });
      utils.notifyUser(socket, `You will reply as ${invite.originalTargetName}.`);
    } else if (character.isGM && invite.originalTargetType === 'GM' && character.speakingAsNPCName) {
      character.speakingAsNPCName = null;
      replierPersonaName = character.characterName;
      socket.emit('personaUpdate', { speakingAs: null });
      utils.notifyUser(socket, `You will reply as ${character.characterName} (GM).`);
    }

    const replierAvatarForChannel = (character.isGM && character.speakingAsNPCName) ? null : character.avatarUrl;
    const replierAsTarget: WhisperTarget = { id: characterId, name: replierPersonaName, avatarUrl: replierAvatarForChannel };
    
    // The source of truth is the sender's current list of participants.
    const currentChannelParticipants = [...senderData.whisperTargets];

    // Update the replier's state first
    character.whisperTargets = [...currentChannelParticipants, replierAsTarget];
    character.hasSentWhisperInvite = true;
    gameState.charactersData.set(characterId, character);

    const uiTargetNames = currentChannelParticipants.map(p => p.name);
    socket.emit('whisperModeUpdate', { targets: uiTargetNames });
    utils.notifyUser(socket, `You have joined the whisper with: ${uiTargetNames.join(', ')}.`);

    // --- Notify & Update Other Participants ---
    const joinNotification: Message = {
        itemId: uuidv4(),
        timestamp: new Date().toISOString(),
        itemType: "SYSTEM_NOTIFICATION",
        sender: { id: 'SYSTEM', name: 'System', isGM: false, isNPC: false, avatarUrl: null},
        sentTo: [], // Handled per-socket
        payload: { content: `* ${replierPersonaName} has joined the whisper. *` }
    };
    
    for (const participant of currentChannelParticipants) {
        const participantData = gameState.charactersData.get(participant.id);
        if (!participantData) continue;

        // Add the new replier to this participant's target list
        if (!participantData.whisperTargets.some(p => p.id === replierAsTarget.id && p.name === replierAsTarget.name)) {
            participantData.whisperTargets.push(replierAsTarget);
        }
        gameState.charactersData.set(participant.id, participantData);

        // Notify all sockets for this participant
        const participantSocketIds = gameState.characterIdToSocketIds.get(participant.id) || new Set();
        for (const sockId of participantSocketIds) {
            const sockInstance = io.sockets.sockets.get(sockId);
            if (sockInstance) {
                sockInstance.emit('newMessage', joinNotification);
                const theirUiTargets = participantData.whisperTargets
                    .filter(p => p.id !== participant.id) // Exclude self from display list
                    .map(p => p.name);
                sockInstance.emit('whisperModeUpdate', { targets: theirUiTargets });
            }
        }
    }
    
    // Finally, send an update to the replier to clear the pending invite icon
    socket.emit('characterDetailsConfirmed', {
        ...character,
        hasPendingInvites: (character.pendingWhisperInvites?.length ?? 0) > 0,
        whisperTargets: character.whisperTargets.map(t => ({name: t.name, id: t.id}))
    });
  }
};
export default replyCommand;