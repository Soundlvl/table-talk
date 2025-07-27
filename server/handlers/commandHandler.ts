// server/handlers/commandHandler.ts
import * as commandModules from '../commands'; // Imports all commands from index.ts
import { ServerSocketType, CommandContext, Command, Utils, ServerIoType, CommandPayload, GameTables } from '../types';

const commands = new Map<string, Command>();

// Iterate over the imported module (which should be an object of commands)
for (const key in commandModules) {
    const command = (commandModules as any)[key] as Command; // Type assertion
    if (command && command.name) { // Check if command and command.name are defined
        commands.set(command.name.toLowerCase(), command);
        if (command.aliases && command.aliases.length > 0) {
            command.aliases.forEach(alias => commands.set(alias.toLowerCase(), command));
        }
    }
}
console.log('[COMMANDS] Loaded commands in handler:', Array.from(commands.keys()).join(', '));

interface CommandHandlerContext {
  io: ServerIoType;
  gameTables: GameTables;
  utils: Utils;
}

export async function handleCommand(socket: ServerSocketType, payload: CommandPayload, context: CommandHandlerContext): Promise<void> {
    const { io, gameTables, utils } = context;
    const { command, args, tableId } = payload;
    
    if (socket.data.tableId !== tableId) {
      console.warn(`[COMMAND] Socket ${socket.id} sent command for table ${tableId} but is in room ${socket.data.tableId}`);
      return;
    }
    const gameState = gameTables.get(tableId);
    if(!gameState) {
      console.warn(`[COMMAND] No game state found for table ${tableId}`);
      return;
    }
    
    const characterId = gameState.socketIdToCharacterId.get(socket.id);
    if (!characterId) {
        utils.notifyUser(socket, "Cannot execute command: character not identified.", true);
        return;
    }
    const char = gameState.charactersData.get(characterId);

    const cmd = commands.get(command.toLowerCase());

    if (!cmd) {
        utils.notifyUser(socket, `Unknown command: /${command}`, true);
        return;
    }
    if (cmd.gmOnly && (!char || !char.isGM)) {
        utils.notifyUser(socket, `GM only: /${command}.`, true);
        return;
    }

    const commandExecuteContext: CommandContext = {
        io: io,
        gameTables: gameTables,
        gameState: gameState, // Pass the specific table's state
        utils: utils,
        characterId: characterId,
        tableId: tableId,
    };

    try {
        await cmd.execute(socket, args, commandExecuteContext);
    } catch (error) {
        console.error(`Error executing /${command} on table ${tableId}:`, error);
        utils.notifyUser(socket, `An error occurred while executing the command /${command}. Please check server logs.`, true);
    }
}