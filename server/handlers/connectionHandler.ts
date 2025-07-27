// server/handlers/connectionHandler.ts
import * as characterHandler from './characterHandler';
import * as messageHandler from './messageHandler';
import * as commandHandler from './commandHandler';
import * as gameStateHandler from './gameStateHandler';
import * as adminHandler from './adminHandler'; // Import admin handler
import { ServerSocketType, Utils, ServerIoType, GameTables, CharacterSubmissionPayload, ReconnectPayload, UpdateAvatarPayload, SendMessagePayload, SendImagePayload, CommandPayload, ImportedGameState, Table, AdminDeletePayload, GameState } from '../types';

interface ConnectionHandlerContext {
  io: ServerIoType;
  gameTables: GameTables;
  utils: Utils;
  ADMIN_PASSWORD: string; // Password is now passed in context
}

// Helper function to handle session cleanup for a character.
// This is used for both intentional leaves and unexpected disconnects.
function cleanupCharacterConnection(socket: ServerSocketType, context: ConnectionHandlerContext, eventType: 'disconnect' | 'leave') {
  const { gameTables, io, utils } = context;
  const tableId = socket.data.tableId;

  if (!tableId || !gameTables.has(tableId)) {
      if (eventType === 'disconnect') {
        console.log(`[DISCONNECT] Client ${socket.id} disconnected without a table.`);
      }
      return;
  }
  const gameState = gameTables.get(tableId)!;
  const charId = gameState.socketIdToCharacterId.get(socket.id);

  if (charId && gameState.charactersData.has(charId)) {
    const char = gameState.charactersData.get(charId)!;
    console.log(`[${eventType.toUpperCase()}] ${char.characterName} (${charId}) from ${socket.id} on table '${gameState.name}'.`);

    const connectedSockets = gameState.characterIdToSocketIds.get(charId);
    if (connectedSockets) {
        connectedSockets.delete(socket.id);
        if (connectedSockets.size === 0) {
            console.log(`[STATUS] ${char.characterName} is now fully offline.`);
            // If the character was the GM, update the status for the table
            if (char.isGM && socket.id === gameState.activeGMsocketId) {
                gameState.activeGMsocketId = null;
                utils.broadcastGMStatus(io, tableId, null);
                console.log(`[STATUS] Active GM for table '${gameState.name}' has left.`);
            }
        }
    }
  } else {
    console.log(`[${eventType.toUpperCase()}] Unidentified socket ${socket.id} from table '${gameState.name}'.`);
  }
  gameState.socketIdToCharacterId.delete(socket.id);
  // Leave the socket room on the server
  socket.leave(tableId);
}


export function onNewConnection(socket: ServerSocketType, context: ConnectionHandlerContext): void {
  const { io, gameTables, utils, ADMIN_PASSWORD } = context;
  console.log(`[CONNECTION] A client connected: ${socket.id}`);
  
  // ---
  // --- LEVEL 1: Pre-Table Listeners
  // --- These listeners are available immediately on connection, before joining a table.
  // ---
  
  socket.on('requestTableList', () => {
    const tableList: Table[] = Array.from(gameTables.values()).map(g => ({
      id: g.id,
      name: g.name,
      playerCount: Array.from(g.characterIdToSocketIds.values()).filter(sockets => sockets.size > 0).length,
      lastActivity: g.lastActivity,
    })).sort((a,b) => b.lastActivity.localeCompare(a.lastActivity));
    socket.emit('tableList', tableList);
  });

  socket.on('createTable', async (payload: { name: string }) => {
      const { name } = payload;
      if (!name || name.trim().length < 3 || name.trim().length > 50) {
        socket.emit('tableNameInvalid', { message: 'Name must be between 3 and 50 characters.' });
        return;
      }
      const trimmedName = name.trim();
      const nameTaken = Array.from(gameTables.values()).some(g => g.name.toLowerCase() === trimmedName.toLowerCase());
      if(nameTaken) {
          socket.emit('tableNameTaken', { name: trimmedName });
          return;
      }
      const newTableState = await utils.createNewTable(trimmedName, gameTables);
      if (newTableState) {
          socket.emit('tableCreated', { id: newTableState.id, name: newTableState.name, playerCount: 0, lastActivity: newTableState.lastActivity });
          // Also broadcast the updated list to all clients on the table selection screen
          const tableList: Table[] = Array.from(gameTables.values()).map(g => ({
            id: g.id, name: g.name, playerCount: 0, lastActivity: g.lastActivity,
          })).sort((a,b) => b.lastActivity.localeCompare(a.lastActivity));
          io.emit('tableList', tableList);
      }
  });

  const adminContext = { io, gameTables, utils };
  
  socket.on('admin:authenticate', (password: string) => {
    if (ADMIN_PASSWORD && password === ADMIN_PASSWORD) {
        console.log(`[AUTH] Admin access granted to socket ${socket.id}`);
        socket.data.isAdmin = true;
        socket.emit('admin:authResult', { success: true });
        // After successful auth, immediately fetch the tables for the admin.
        adminHandler.handleGetTables(socket, adminContext);
    } else {
        console.warn(`[AUTH] Failed admin login attempt from socket ${socket.id}`);
        socket.data.isAdmin = false;
        socket.emit('admin:authResult', { success: false, message: 'Invalid password.' });
    }
  });
  
  socket.on('admin:getTables', () => adminHandler.handleGetTables(socket, adminContext));
  socket.on('admin:deleteTable', (payload: AdminDeletePayload) => adminHandler.handleDeleteTable(socket, payload, adminContext));
  socket.on('admin:importTable', (payload: { fileContent: string }) => adminHandler.handleImportTable(socket, payload, adminContext));
  socket.on('admin:exportTable', (payload: AdminDeletePayload) => adminHandler.handleExportTable(socket, payload, adminContext));


  // ---
  // --- LEVEL 2: Table-Scoped Listeners
  // --- These listeners are also available immediately, but they contain guard clauses
  // --- to ensure the user has joined a specific table before executing logic.
  // ---

  socket.on('joinTable', (payload: { tableId: string }) => {
    const { tableId } = payload;
    if (gameTables.has(tableId)) {
        // Leave previous table room if any
        if (socket.data.tableId && socket.data.tableId !== tableId) {
            socket.leave(socket.data.tableId);
            console.log(`[JOIN] Socket ${socket.id} left old table room '${socket.data.tableId}'`);
        }
        
        const gameState = gameTables.get(tableId)!;
        socket.join(tableId);
        socket.data.tableId = tableId; // Store tableId in socket data for context
        console.log(`[JOIN] Socket ${socket.id} joined table room '${gameState.name}' (${tableId})`);

        socket.emit('tableJoined', {
            tableId: gameState.id,
            tableName: gameState.name,
            availableLanguages: gameState.availableLanguages,
            isGMActive: !!gameState.activeGMsocketId,
            defaultLanguage: gameState.defaultLanguage,
            theme: gameState.theme,
        });
    } else {
        socket.emit('tableNotFound');
    }
  });

  // A helper function to get the verified context for a table-scoped event
  const getVerifiedTableContext = (tableId: string | undefined): { gameState: GameState, tableContext: any } | null => {
      if (!tableId || socket.data.tableId !== tableId || !gameTables.has(tableId)) {
          console.warn(`[EVENT REJECTED] Socket ${socket.id} sent event for table ${tableId} but is not properly joined to it.`);
          return null;
      }
      const gameState = gameTables.get(tableId)!;
      const tableContext = { io, gameState, utils, gameTables };
      return { gameState, tableContext };
  };

  socket.on('submitCharacterDetails', async (details: CharacterSubmissionPayload) => {
    const context = getVerifiedTableContext(details.tableId);
    if(context) await characterHandler.handleCharacterSubmission(socket, details, context.tableContext);
  });
  
  socket.on('reconnectCharacter', (payload: ReconnectPayload) => {
    const context = getVerifiedTableContext(payload.tableId);
    if(context) characterHandler.handleCharacterReconnect(socket, payload, context.tableContext);
  });
  
  socket.on('updateAvatar', async (payload: UpdateAvatarPayload) => {
    const context = getVerifiedTableContext(payload.tableId);
    if(context) await characterHandler.handleUpdateAvatar(socket, payload, context.tableContext);
  });
  
  socket.on('sendMessage', async (payload: SendMessagePayload) => {
    const context = getVerifiedTableContext(payload.tableId);
    if(context) await messageHandler.handleSendMessage(socket, payload, context.tableContext);
  });
  
  socket.on('sendImage', async (payload: SendImagePayload) => {
    const context = getVerifiedTableContext(payload.tableId);
    if(context) await messageHandler.handleSendImage(socket, payload, context.tableContext);
  });
  
  socket.on('executeCommand', async (payload: CommandPayload) => {
    const context = getVerifiedTableContext(payload.tableId);
    if(context) await commandHandler.handleCommand(socket, payload, context.tableContext);
  });
  
  socket.on('importGameStateRequest', async (importedState: ImportedGameState) => {
    const context = getVerifiedTableContext(importedState.tableId);
    if(context) await gameStateHandler.handleImportGameStateRequest(socket, importedState, context.tableContext);
  });
  
  socket.on('leaveTable', () => {
    cleanupCharacterConnection(socket, context, 'leave')
  });

  socket.on('disconnect', () => {
    cleanupCharacterConnection(socket, context, 'disconnect')
  });
}
