// server/commands/gm.ts
import { ServerSocketType, CommandContext, Command } from '../types';

const gmCommand: Command = {
  name: 'gm',
  description: 'Reverts the GM to speaking as their own character.',
  gmOnly: true,
  execute(socket: ServerSocketType, _args: string[], context: CommandContext): void {
    const { gameState, utils, characterId } = context;
    const character = gameState.charactersData.get(characterId);

    if (!character) return;

    const oldPersona = character.speakingAsNPCName;

    if (oldPersona) {
      character.speakingAsNPCName = null;
      gameState.charactersData.set(characterId, character);
      utils.notifyUser(socket, `You are now speaking as yourself (${character.characterName}).`);
      socket.emit('personaUpdate', { speakingAs: null });
    } else {
      utils.notifyUser(socket, 'You are already speaking as yourself.');
    }
  },
};

export default gmCommand;
