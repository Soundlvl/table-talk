// server/commands/as.ts
import { ServerSocketType, CommandContext, Command } from '../types';

const asCommand: Command = {
  name: 'as',
  description: 'Allows the GM to speak as an NPC.',
  gmOnly: true,
  execute(socket: ServerSocketType, args: string[], context: CommandContext): void {
    const { gameState, utils, characterId } = context;
    const character = gameState.charactersData.get(characterId);

    if (!character) return; // Should not happen if characterId is valid

    const npcNameInput = args.join(' ').trim();

    if (!npcNameInput) {
      utils.notifyUser(socket, 'Usage: /as <NPC Name>', true);
      return;
    }

    const nameIsTakenByPlayer = Array.from(gameState.charactersData.values()).some(
      (char) => char.characterName && char.characterName.toLowerCase() === npcNameInput.toLowerCase() && !char.isGM
    );

    if (nameIsTakenByPlayer) {
      utils.notifyUser(socket, `The name "${npcNameInput}" is already in use by a player.`, true);
      return;
    }

    gameState.npcList.add(npcNameInput);
    character.speakingAsNPCName = npcNameInput;

    gameState.charactersData.set(characterId, character);
    utils.notifyUser(socket, `You are now speaking as ${npcNameInput}. Use /gm to speak as yourself again.`);
    socket.emit('personaUpdate', { speakingAs: npcNameInput });
  },
};

export default asCommand;
