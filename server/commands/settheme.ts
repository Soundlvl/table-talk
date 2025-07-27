// server/commands/settheme.ts
import { ServerSocketType, CommandContext, Command } from '../types';

const validThemes = ['fantasy', 'sci-fi'];

const setthemeCommand: Command = {
  name: 'settheme',
  description: 'Sets the visual theme for the table.',
  gmOnly: true,
  async execute(socket: ServerSocketType, args: string[], context: CommandContext): Promise<void> {
    const { io, gameState, utils } = context;
    const themeName = args[0]?.trim().toLowerCase();

    if (!themeName) {
      utils.notifyUser(socket, `Usage: /settheme <theme>. Available: ${validThemes.join(', ')}.`, true);
      return;
    }

    if (!validThemes.includes(themeName)) {
      utils.notifyUser(socket, `Invalid theme "${themeName}". Available themes are: ${validThemes.join(', ')}.`, true);
      return;
    }

    if (gameState.theme === themeName) {
      utils.notifyUser(socket, `The theme is already set to "${themeName}".`);
      return;
    }

    gameState.theme = themeName;
    await utils.saveTableState(gameState);

    io.to(gameState.id).emit('themeChanged', { theme: themeName });
    utils.notifyUser(socket, `Table theme changed to "${themeName}".`);
    console.log(`[THEME] Table '${gameState.name}' theme changed to '${themeName}' by GM.`);
  },
};

export default setthemeCommand;
