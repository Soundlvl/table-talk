// server/commands/manage.ts
import { ServerSocketType, CommandContext, Command, Character, Player } from '../types';

const manageCommand: Command = {
  name: 'manage',
  description: 'Gets the list of all players for the GM management modal.',
  aliases: ['who'],
  gmOnly: true,
  execute(socket: ServerSocketType, _args: string[], context: CommandContext): void {
    const { gameState } = context;
    const fullPlayerList: Player[] = Array.from(gameState.charactersData.values())
      .filter(char => !!char.characterName)
      .map((char: Character) => ({ // Explicitly type char here
        id: char.characterId,
        name: char.characterName,
        languages: char.languages,
        isGM: char.isGM,
        avatarUrl: char.avatarUrl
      }));
    socket.emit('playerListUpdate', { players: fullPlayerList });
  },
};

export default manageCommand;
