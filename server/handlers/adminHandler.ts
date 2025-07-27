// server/handlers/adminHandler.ts



import { ServerSocketType, Utils, ServerIoType, GameTables, Table, ImportedGameState, AdminDeletePayload, PersistentCharacterData } from '../types';

interface AdminHandlerContext {
  io: ServerIoType;
  gameTables: GameTables;
  utils: Utils;
}

export function handleGetTables(socket: ServerSocketType, context: AdminHandlerContext): void {
  if (!socket.data.isAdmin) {
    socket.emit('admin:unauthorized', { message: 'Authentication required.' });
    console.warn(`[AUTH] Unauthorized 'admin:getTables' attempt by socket ${socket.id}`);
    return;
  }
  const { gameTables } = context;
  const tableList: Table[] = Array.from(gameTables.values()).map(g => ({
    id: g.id,
    name: g.name,
    playerCount: Array.from(g.characterIdToSocketIds.values()).filter(sockets => sockets.size > 0).length,
    lastActivity: g.lastActivity,
  })).sort((a,b) => b.lastActivity.localeCompare(a.lastActivity));
  
  socket.emit('admin:tableList', tableList);
}

export async function handleDeleteTable(socket: ServerSocketType, payload: { tableId: string }, context: AdminHandlerContext): Promise<void> {
  if (!socket.data.isAdmin) {
    socket.emit('admin:unauthorized', { message: 'Authentication required.' });
    console.warn(`[AUTH] Unauthorized 'admin:deleteTable' attempt by socket ${socket.id}`);
    return;
  }
  const { io, gameTables, utils } = context;
  const { tableId } = payload;

  const gameState = gameTables.get(tableId);
  if (gameState) {
    const tableName = gameState.name || 'Unknown Table';
    // First, delete the files from the disk using the folderName from the live state.
    await utils.deleteTable(tableId, gameTables);
    // THEN, remove the table from the live in-memory map.
    gameTables.delete(tableId);

    console.log(`[ADMIN] Deleted table '${tableName}' (${tableId}) by admin ${socket.id}`);
    
    // Notify all clients (including those on the table selection screen) that the tables have changed.
    io.emit('admin:tablesUpdated');
    io.emit('tableList', Array.from(gameTables.values()).map(g => ({
        id: g.id, name: g.name, playerCount: Array.from(g.characterIdToSocketIds.values()).filter(sockets => sockets.size > 0).length, lastActivity: g.lastActivity,
    })));
  } else {
    utils.notifyUser(socket, 'Delete failed: Table not found in live session.', true);
  }
}

export async function handleImportTable(socket: ServerSocketType, payload: { fileContent: string }, context: AdminHandlerContext): Promise<void> {
    if (!socket.data.isAdmin) {
      socket.emit('admin:unauthorized', { message: 'Authentication required.' });
      console.warn(`[AUTH] Unauthorized 'admin:importTable' attempt by socket ${socket.id}`);
      return;
    }
    const { io, gameTables, utils } = context;

    try {
        const importedData = JSON.parse(payload.fileContent) as Omit<ImportedGameState, 'tableId'>;
        
        if (!importedData || !importedData.saveVersion || !Array.isArray(importedData.charactersData)) {
            utils.notifyUser(socket, 'Import failed: Invalid file format.', true);
            return;
        }

        const newTable = await utils.createNewTable(importedData.name || 'Imported Table', gameTables);
        if (!newTable) {
            utils.notifyUser(socket, 'Import failed: Could not create new table on server.', true);
            return;
        }

        console.log(`[ADMIN] Importing data into new table '${newTable.name}' (${newTable.id}) by admin ${socket.id}`);

        // Apply imported data to the newly created table state
        newTable.chatHistory = importedData.chatHistory || [];
        newTable.charactersData = utils.initializeCharactersFromSave(importedData.charactersData);
        newTable.npcList = new Set(importedData.npcList || []);
        newTable.availableLanguages = importedData.availableLanguages || ['Common'];
        newTable.defaultLanguage = importedData.defaultLanguage || 'Common';
        newTable.lastActivity = new Date().toISOString();

        await utils.saveTableState(newTable);
        
        console.log(`[ADMIN] Successfully imported table '${newTable.name}'.`);
        
        io.emit('admin:tablesUpdated');
        io.emit('tableList', Array.from(gameTables.values()).map(g => ({
            id: g.id, name: g.name, playerCount: Array.from(g.characterIdToSocketIds.values()).filter(sockets => sockets.size > 0).length, lastActivity: g.lastActivity,
        })));
        utils.notifyUser(socket, `Successfully imported as new table: "${newTable.name}".`);

    } catch (error) {
        console.error('[ADMIN] Error during table import:', error);
        utils.notifyUser(socket, 'Import failed: Could not parse JSON file.', true);
    }
}

export function handleExportTable(socket: ServerSocketType, payload: AdminDeletePayload, context: AdminHandlerContext): void {
  if (!socket.data.isAdmin) {
    socket.emit('admin:unauthorized', { message: 'Authentication required.' });
    console.warn(`[AUTH] Unauthorized 'admin:exportTable' attempt by socket ${socket.id}`);
    return;
  }
  const { gameTables, utils } = context;
  const { tableId } = payload;
  
  const gameState = gameTables.get(tableId);

  if (!gameState) {
    utils.notifyUser(socket, 'Export failed: Table not found.', true);
    return;
  }

  console.log(`[ADMIN] Export initiated for table '${gameState.name}' (${tableId}) by admin ${socket.id}`);

    const serializableCharacters: [string, PersistentCharacterData][] = Array.from(gameState.charactersData.entries()).map(([id, char]) => {
        const persistentData: PersistentCharacterData = {
            characterId: char.characterId,
            characterName: char.characterName,
            languages: char.languages,
            isGM: char.isGM,
            avatarUrl: char.avatarUrl
        };
        return [id, persistentData];
    });

  const serializableNpcList: string[] = Array.from(gameState.npcList);

  const exportState: ImportedGameState = {
    saveVersion: 3,
    tableId: gameState.id,
    name: gameState.name,
    savedAt: new Date().toISOString(),
    chatHistory: gameState.chatHistory,
    charactersData: serializableCharacters,
    availableLanguages: gameState.availableLanguages,
    defaultLanguage: gameState.defaultLanguage,
    npcList: serializableNpcList,
  };

  socket.emit('admin:tableExported', exportState);
  utils.notifyUser(socket, `Export data for table '${gameState.name}' has been sent.`);
}