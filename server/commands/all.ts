// server/commands/all.ts
import { v4 as uuidv4 } from 'uuid';
import { ServerSocketType, CommandContext, Command, Message } from '../types';

const allCommand: Command = {
  name: 'all',
  description: 'Returns the user to public chat from a whisper.',
  execute(socket: ServerSocketType, _args: string[], context: CommandContext): void {
    const { io, gameState, utils, characterId } = context;

    const leaverData = gameState.charactersData.get(characterId);
    if (!leaverData) return;

    if (!leaverData.whisperTargets || leaverData.whisperTargets.length === 0 ||
        (leaverData.whisperTargets.length === 1 && leaverData.whisperTargets[0].id === characterId)) {
        utils.notifyUser(socket, "You are already in public chat or alone in a whisper.", true);
        leaverData.whisperTargets = [];
        gameState.charactersData.set(characterId, leaverData);
        socket.emit('whisperModeUpdate', { targets: [] });
        return;
    }

    const originalChannelParticipants = [...leaverData.whisperTargets];
    const leaverName = leaverData.speakingAsNPCName || leaverData.characterName;

    // --- Proactively handle pending invites and active members ---
    const remainingParticipants = originalChannelParticipants.filter(p => p.id !== characterId);
    
    for (const participant of remainingParticipants) {
        const participantData = gameState.charactersData.get(participant.id);
        if (!participantData) continue;

        const participantSockets = gameState.characterIdToSocketIds.get(participant.id) || new Set();
        const hasPendingInviteFromLeaver = participantData.pendingWhisperInvites.some(inv => inv.fromId === characterId);

        if (hasPendingInviteFromLeaver) {
            // Case 1: Participant has NOT joined yet (has a pending invite from the leaver)
            participantData.pendingWhisperInvites = participantData.pendingWhisperInvites.filter(inv => inv.fromId !== characterId);
            const hasOtherInvites = participantData.pendingWhisperInvites.length > 0;
            gameState.charactersData.set(participant.id, participantData);
            
            for (const sockId of participantSockets) {
                const sockInstance = io.sockets.sockets.get(sockId);
                if (sockInstance) {
                    sockInstance.emit('characterDetailsConfirmed', {
                        ...participantData, hasPendingInvites: hasOtherInvites,
                        whisperTargets: participantData.whisperTargets.map(t=>({id: t.id, name: t.name}))
                    });
                    utils.notifyUser(sockInstance, `The whisper invitation from ${leaverName} was cancelled.`);
                }
            }
        } else {
            // Case 2: Participant has ALREADY joined the whisper.
            // This block contains the fix for the state desync bug.
            
            const newChannelParticipants = originalChannelParticipants.filter(p => p.id !== characterId);
            const isNowAlone = newChannelParticipants.length <= 1;

            if (isNowAlone) {
                participantData.whisperTargets = []; // They are alone or the last one.
            } else {
                participantData.whisperTargets = newChannelParticipants; // Update to the smaller group.
            }

            gameState.charactersData.set(participant.id, participantData);

            for (const sockId of participantSockets) {
                const sockInstance = io.sockets.sockets.get(sockId);
                if (sockInstance) {
                    sockInstance.emit('newMessage', {
                        itemId: uuidv4(), timestamp: new Date().toISOString(), itemType: "SYSTEM_NOTIFICATION",
                        sender: { id: 'SYSTEM', name: 'System', isGM: false, isNPC: false, avatarUrl: null },
                        payload: { content: `* ${leaverName} has left the whisper. *` }
                    } as Message);

                    if (isNowAlone) {
                        sockInstance.emit('whisperModeUpdate', { targets: [] });
                        utils.notifyUser(sockInstance, "Everyone has left the whisper. You have returned to public chat.");
                    } else {
                        const updatedTargetNames = participantData.whisperTargets
                            .filter(p => p.id !== participant.id)
                            .map(p => p.name);
                        sockInstance.emit('whisperModeUpdate', { targets: updatedTargetNames });
                    }
                }
            }
        }
    }


    // --- Cleanup for the person who typed /all ---
    leaverData.whisperTargets = [];
    leaverData.hasSentWhisperInvite = false;
    gameState.charactersData.set(characterId, leaverData);

    const leaverSockets = gameState.characterIdToSocketIds.get(characterId) ?? new Set();
    for (const sockId of leaverSockets) {
        const sockInstance = io.sockets.sockets.get(sockId);
        if (sockInstance) {
            sockInstance.emit('whisperModeUpdate', { targets: [] });
            utils.notifyUser(sockInstance, "You have returned to public chat.");
        }
    }
  },
};

export default allCommand;