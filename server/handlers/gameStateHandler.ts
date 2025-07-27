// server/handlers/gameStateHandler.ts
import { ServerSocketType, GameState, Utils, ServerIoType, ImportedGameState, GameTables } from '../types';

interface GameStateHandlerContext {
  io: ServerIoType;
  gameTables: GameTables;
  gameState: GameState;
  utils: Utils;
}

export async function handleImportGameStateRequest(socket: ServerSocketType, importedState: ImportedGameState, context: GameStateHandlerContext): Promise<void> {
    const { io, gameState, utils } = context;
    const { tableId } = importedState;
    const reqCharId = gameState.socketIdToCharacterId.get(socket.id);

    if (socket.data.tableId !== tableId) return;

    if (!reqCharId) {
      socket.emit('importGameStateFailed', { error: 'Requesting character not found.' });
      return;
    }
    const reqChar = gameState.charactersData.get(reqCharId);

    if (!reqChar || !reqChar.isGM) {
        socket.emit('importGameStateFailed', { error: 'GM only.' });
        return;
    }
    if (!importedState || !Array.isArray(importedState.charactersData) || !Array.isArray(importedState.chatHistory)) {
        socket.emit('importGameStateFailed', { error: 'Invalid file format.' });
        return;
    }

    console.log(`[IMPORT] GM ${reqChar.characterName} initiated for table '${gameState.name}'.`);
    io.to(tableId).emit('sessionReloading');

    // Introduce a delay to allow clients to receive the 'sessionReloading' event before the server state changes drastically.
    await new Promise(resolve => setTimeout(resolve, 1000));

    try {
        console.log(`[IMPORT] Applying to table '${gameState.name}'...`);
        gameState.chatHistory = importedState.chatHistory || [];
        gameState.charactersData = utils.initializeCharactersFromSave(importedState.charactersData);
        gameState.npcList = new Set(importedState.npcList || []);
        gameState.availableLanguages = importedState.availableLanguages || ['Common'];
        gameState.defaultLanguage = importedState.defaultLanguage || 'Common';

        gameState.socketIdToCharacterId.clear();
        gameState.characterIdToSocketIds.clear();
        gameState.activeGMsocketId = null;

        await utils.saveTableState(gameState);
        console.log('[IMPORT] Success. Clients must rejoin.');
        socket.emit('importGameStateSucceeded');
    } catch (error) {
        console.error(`[IMPORT] Error applying to table '${gameState.name}':`, error);
        socket.emit('importGameStateFailed', { error: 'Server error during import.' });
    }
}
