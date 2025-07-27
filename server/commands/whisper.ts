// server/commands/whisper.ts
import { ServerSocketType, CommandContext, Command, WhisperTarget } from '../types';

const whisperCommand: Command = {
  name: 'whisper',
  description: 'Enters whisper mode with one or more target characters, the GM, or NPCs.',
  aliases: ['w'],
  execute(socket: ServerSocketType, args: string[], context: CommandContext): void {
    const { gameState, utils, characterId } = context;

    const senderData = gameState.charactersData.get(characterId);
    if (!senderData || !senderData.characterName) {
      return;
    }

    if (args.length === 0) {
      utils.notifyUser(socket, "Usage: /w <target1>[, <target2>, ..., gm, NPCName]", true);
      return;
    }

    const targetNameInputs = args.join(' ').split(',').map(name => name.trim()).filter(Boolean);
    const resolvedTargetsForChannel: WhisperTarget[] = [];
    const invalidNames: string[] = [];
    let gmCharId = gameState.activeGMsocketId ? gameState.socketIdToCharacterId.get(gameState.activeGMsocketId) : null;
    const gmData = gmCharId ? gameState.charactersData.get(gmCharId) : null;

    let firstOriginalTargetForInvite: { name: string | null; type: 'NPC' | 'GM' | 'Player' | null } = { name: null, type: null };

    for (const targetNameInput of targetNameInputs) {
      const targetNameLower = targetNameInput.toLowerCase();
      let foundTarget = false;

      if (targetNameLower === senderData.characterName.toLowerCase()) {
        if (targetNameInputs.length === 1) { // Only add self if explicitly targeted alone
             resolvedTargetsForChannel.push({ id: characterId, name: senderData.characterName, avatarUrl: senderData.avatarUrl });
             foundTarget = true;
        }
        continue;
      }

      if (targetNameLower === 'gm') {
        if (gmData && gmCharId) { // gmData and gmCharId must exist
          resolvedTargetsForChannel.push({ id: gmCharId, name: gmData.characterName, avatarUrl: gmData.avatarUrl });
          foundTarget = true;
          if (!firstOriginalTargetForInvite.name) {
            firstOriginalTargetForInvite = { name: gmData.characterName, type: 'GM' };
          }
        } else {
          invalidNames.push(`${targetNameInput} (GM not active)`);
        }
        continue;
      }

      let originalNpcName = targetNameInput;
      let matchedNpc = false;
      for (const npc of gameState.npcList) {
          if (npc.toLowerCase() === targetNameLower) {
              originalNpcName = npc;
              matchedNpc = true;
              break;
          }
      }

      if (matchedNpc) {
        if (gmData && gmCharId) { // gmData and gmCharId must exist for NPC targeting
          resolvedTargetsForChannel.push({ id: gmCharId, name: originalNpcName, avatarUrl: null }); // NPCs don't have avatar URLs in this context
          foundTarget = true;
          if (!firstOriginalTargetForInvite.name) {
            firstOriginalTargetForInvite = { name: originalNpcName, type: 'NPC' };
          }
        } else {
          invalidNames.push(`${targetNameInput} (NPC, but no GM active)`);
        }
        continue;
      }

      for (const [id, char] of gameState.charactersData.entries()) {
        if (char.characterName && char.characterName.toLowerCase() === targetNameLower) {
          resolvedTargetsForChannel.push({ id: id, name: char.characterName, avatarUrl: char.avatarUrl });
          foundTarget = true;
          if (!firstOriginalTargetForInvite.name && id === gmCharId) {
            firstOriginalTargetForInvite = { name: char.characterName, type: 'GM' };
          }
          break;
        }
      }

      if (!foundTarget) {
        invalidNames.push(targetNameInput);
      }
    }

    if (invalidNames.length > 0) {
      utils.notifyUser(socket, `Could not find or target: ${invalidNames.join(', ')}.`, true);
    }

    const uniqueResolvedTargets: WhisperTarget[] = [];
    const seenTargetKeys = new Set<string>();
    for (const target of resolvedTargetsForChannel) {
        const key = `${target.id}-${target.name.toLowerCase()}`;
        if (!seenTargetKeys.has(key)) {
            uniqueResolvedTargets.push(target);
            seenTargetKeys.add(key);
        }
    }

    if (uniqueResolvedTargets.length === 0) {
        const selfExplicitlyTargeted = targetNameInputs.length === 1 && targetNameInputs[0].toLowerCase() === senderData.characterName.toLowerCase();
        if (!selfExplicitlyTargeted || (selfExplicitlyTargeted && !uniqueResolvedTargets.some(t => t.id === characterId))) {
             utils.notifyUser(socket, "You must specify at least one valid character, GM, or NPC to whisper to.", true);
             return;
        }
    }

    const channelParticipants: WhisperTarget[] = [];
    const finalParticipantKeys = new Set<string>();

    const senderPersonaName = senderData.speakingAsNPCName || senderData.characterName;
    const senderChannelKey = `${characterId}-${senderPersonaName.toLowerCase()}`;
    channelParticipants.push({ id: characterId, name: senderPersonaName, avatarUrl: senderData.avatarUrl });
    finalParticipantKeys.add(senderChannelKey);

    for (const target of uniqueResolvedTargets) {
      if (target.id === characterId && target.name.toLowerCase() === senderPersonaName.toLowerCase()) {
          continue;
      }
      const targetKey = `${target.id}-${target.name.toLowerCase()}`;
      if (!finalParticipantKeys.has(targetKey)) {
        channelParticipants.push(target);
        finalParticipantKeys.add(targetKey);
      }
    }

    senderData.whisperTargets = channelParticipants;
    senderData.hasSentWhisperInvite = false;

    if (firstOriginalTargetForInvite.name && firstOriginalTargetForInvite.type) {
        senderData.metadataForNextWhisperInvite = {
            originalTargetName: firstOriginalTargetForInvite.name,
            originalTargetType: firstOriginalTargetForInvite.type
        };
    } else {
        senderData.metadataForNextWhisperInvite = null;
    }

    gameState.charactersData.set(characterId, senderData);

    const uiTargetNames = channelParticipants
      .filter(p => !(p.id === characterId && p.name.toLowerCase() === senderPersonaName.toLowerCase()))
      .map(t => t.name);

    socket.emit('whisperModeUpdate', { targets: uiTargetNames });

    if (uiTargetNames.length > 0) {
      utils.notifyUser(socket, `You are now in whisper mode with ${uiTargetNames.join(' & ')}. Type a message to send it privately.`);
    } else if (channelParticipants.length === 1 && channelParticipants[0].id === characterId && channelParticipants[0].name.toLowerCase() === senderPersonaName.toLowerCase()) {
      utils.notifyUser(socket, `You are now in whisper mode with yourself (as ${senderPersonaName}). Type a message to send it privately.`);
    } else {
      // This case might be redundant due to earlier checks, but kept for safety
      utils.notifyUser(socket, "Entered whisper mode. No other valid recipients specified or found.", true);
    }
  },
};
export default whisperCommand;
