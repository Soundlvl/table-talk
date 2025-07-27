// server/handlers/characterHandler.ts
import fs from 'fs/promises';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { ServerSocketType, Character, GameState, Utils, ServerIoType, CharacterSubmissionPayload, ReconnectPayload, UpdateAvatarPayload, GameTables } from '../types'; // Adjust path as necessary

interface CharacterHandlerContext {
  io: ServerIoType;
  gameTables: GameTables;
  gameState: GameState; // This is the state for the specific table
  utils: Utils;
}


export async function handleCharacterSubmission(socket: ServerSocketType, details: CharacterSubmissionPayload, context: CharacterHandlerContext): Promise<void> {
  const { io, gameState, utils } = context;
  const { tableId } = details;
  console.log(`[EVENT] Handling 'submitCharacterDetails' for socket ${socket.id} on table ${tableId}`);

  if (!details || typeof details.name !== 'string' || details.name.trim().length === 0) {
    utils.notifyUser(socket, 'Invalid submission. Provide name.', true);
    socket.emit('characterNameRejected'); return;
  }

  const submittedName = details.name.trim();
  const submittedNameLower = submittedName.toLowerCase();

  // Find if a character with this name already exists on the table.
  const existingCharEntry = Array.from(gameState.charactersData.entries())
    .find(([_id, char]) => char.characterName.toLowerCase() === submittedNameLower);

  if (existingCharEntry) {
    const [existingId, existingData] = existingCharEntry;
    
    // Check if this existing character is currently online (has active sockets).
    const connectedSockets = gameState.characterIdToSocketIds.get(existingId);
    const isOnline = connectedSockets && connectedSockets.size > 0;

    if (isOnline) {
      // The character is active. This is an invalid request. Reject it.
      console.warn(`[NEW CHAR REJECTED] Name "${submittedName}" is already in use and online. Rejecting request from socket ${socket.id}.`);
      utils.notifyUser(socket, `The character "${submittedName}" is already in this session. Please choose another name or ask the other player to exit.`, true);
      socket.emit('characterNameRejected'); // Inform client about rejection
      return;
    } else {
      // The character is offline. This is a legitimate rejoin.
      console.log(`[REJOIN] Offline character "${existingData.characterName}" (${existingId}) rejoining on new socket ${socket.id}`);
      
      gameState.socketIdToCharacterId.set(socket.id, existingId);
      // Ensure a clean set for the new connection
      gameState.characterIdToSocketIds.set(existingId, new Set([socket.id]));

      // Clean up any stale whisper/invite states on rejoin.
      existingData.metadataForNextWhisperInvite = null;
      
      if (existingData.isGM) {
        gameState.activeGMsocketId = socket.id;
        utils.broadcastGMStatus(io, tableId, gameState.activeGMsocketId);
      }
      
      const detailsToSend = {
        ...existingData,
        hasPendingInvites: (existingData.pendingWhisperInvites?.length ?? 0) > 0,
        whisperTargets: existingData.whisperTargets.map(t => ({id: t.id, name: t.name}))
      };

      socket.emit('characterDetailsConfirmed', detailsToSend);
      utils.sendChatHistory(socket, existingId, gameState);
      await utils.saveTableState(gameState);
      return;
    }
  }

  // If we reach here, no character with that name exists. Create a new one.
  console.log(`[NEW CHAR] Creating "${submittedName}" for ${socket.id} on table ${tableId}`);
  let selectedLangs = Array.isArray(details.languages) ? details.languages.filter(lang => typeof lang === 'string') : [];
  if (!selectedLangs.includes(gameState.defaultLanguage)) selectedLangs.push(gameState.defaultLanguage);

  const newCharId = uuidv4();
  let avatarUrl: string | null = null;
  
  if (!gameState.folderName) {
      console.error(`[AVATAR] Cannot save avatar for new character on table ${tableId}. Gamestate is missing folderName.`);
      utils.notifyUser(socket, 'Server configuration error, cannot save avatar.', true);
  } else {
    const tableAvatarsDir = path.join(utils.TABLES_DIR, gameState.folderName, 'uploads', 'avatars');
    await fs.mkdir(tableAvatarsDir, { recursive: true });

    if (details.avatarFile && details.avatarFileName && details.avatarMimeType) {
        const allowedTypes = ['image/jpeg', 'image/png', 'image/gif'];
        if (allowedTypes.includes(details.avatarMimeType) && details.avatarFile instanceof Buffer) {
            const extension = path.extname(details.avatarFileName) || `.${details.avatarMimeType.split('/')[1]}`;
            const avatarFilename = `${newCharId}_avatar${extension}`;
            const avatarPath = path.join(tableAvatarsDir, avatarFilename);
            try {
                await fs.writeFile(avatarPath, details.avatarFile);
                avatarUrl = utils.getAvatarUrl(tableId, avatarFilename);
                console.log(`[AVATAR] Saved for ${newCharId} to ${avatarPath}`);
            } catch (err) {
                console.error(`[AVATAR] Error saving avatar for ${newCharId}:`, err);
            }
        } else {
            console.warn(`[AVATAR] Invalid mime type for ${newCharId}: ${details.avatarMimeType}`);
        }
    }
  }


  const charEntry: Character = {
    characterId: newCharId, characterName: submittedName, languages: selectedLangs.sort(),
    isGM: false, speakingAsNPCName: null, whisperTargets: [], pendingWhisperInvites: [],
    hasSentWhisperInvite: false, avatarUrl: avatarUrl,
    metadataForNextWhisperInvite: null
  };

  if (details.isGM) {
    if (!gameState.activeGMsocketId) {
      charEntry.isGM = true;
      gameState.activeGMsocketId = socket.id;
      charEntry.languages = [...gameState.availableLanguages].sort();
      utils.broadcastGMStatus(io, tableId, gameState.activeGMsocketId);
    } else {
      utils.notifyUser(socket, "GM active. Joined as player.", true);
    }
  }
  gameState.charactersData.set(newCharId, charEntry);
  gameState.socketIdToCharacterId.set(socket.id, newCharId);
  gameState.characterIdToSocketIds.set(newCharId, new Set([socket.id]));

  const detailsToSend = {
    ...charEntry,
    hasPendingInvites: false, // new character has no pending invites
    whisperTargets: []
  };
  socket.emit('characterDetailsConfirmed', detailsToSend);
  utils.sendChatHistory(socket, newCharId, gameState);
  await utils.saveTableState(gameState);
}

export function handleCharacterReconnect(socket: ServerSocketType, payload: ReconnectPayload, context: CharacterHandlerContext): void {
    const { io, gameState, utils } = context;
    const { characterId, tableId } = payload;
    
    // Safety check: ensure the socket is in the right room for this request
    if (socket.data.tableId !== tableId) {
        console.warn(`[RECONNECT] Socket ${socket.id} attempted to reconnect to table ${tableId} but is in room ${socket.data.tableId}`);
        socket.emit('reconnectFailed');
        return;
    }
    
    if (characterId && gameState.charactersData.has(characterId)) {
        const charEntry = gameState.charactersData.get(characterId)!;

        // If other sockets are associated with this character, disconnect them.
        const oldSocketIds = gameState.characterIdToSocketIds.get(characterId);
        if (oldSocketIds && oldSocketIds.size > 0) {
            console.log(`[RECONNECT] Character "${charEntry.characterName}" taking over session. Disconnecting old socket(s).`);
            for (const oldSocketId of oldSocketIds) {
                // **FIX**: Prevent the new socket from disconnecting itself if it sends a duplicate reconnect event.
                if (oldSocketId === socket.id) {
                    console.warn(`[RECONNECT] Received duplicate reconnect request from socket ${socket.id}. Ignoring self-disconnect.`);
                    continue;
                }

                const oldSocket = io.sockets.sockets.get(oldSocketId);
                if (oldSocket) {
                    oldSocket.emit('sessionReloading');
                    oldSocket.disconnect(true);
                }
            }
        }
        
        console.log(`[RECONNECT] Re-linking "${charEntry.characterName}" (${characterId}) to new socket ${socket.id}`);
        gameState.socketIdToCharacterId.set(socket.id, characterId);
        // Ensure a clean set for the new connection
        gameState.characterIdToSocketIds.set(characterId, new Set([socket.id]));

        charEntry.metadataForNextWhisperInvite = null;
        if (charEntry.isGM) {
          gameState.activeGMsocketId = socket.id;
          utils.broadcastGMStatus(io, tableId, gameState.activeGMsocketId);
        }
        
        const detailsToSend = {
          ...charEntry,
          hasPendingInvites: (charEntry.pendingWhisperInvites?.length ?? 0) > 0,
          whisperTargets: charEntry.whisperTargets.map(t => ({id: t.id, name: t.name}))
        };

        socket.emit('characterDetailsConfirmed', detailsToSend);
        utils.sendChatHistory(socket, characterId, gameState);
    } else {
        console.warn(`[RECONNECT] Failed. ID ${characterId} not found.`);
        socket.emit('reconnectFailed');
    }
}

export async function handleUpdateAvatar(socket: ServerSocketType, payload: UpdateAvatarPayload, context: CharacterHandlerContext): Promise<void> {
    const { io, gameState, utils } = context;
    const { avatarFile, avatarFileName, avatarMimeType, tableId } = payload;
    const characterId = gameState.socketIdToCharacterId.get(socket.id);

    if (!characterId) {
        utils.notifyUser(socket, 'Avatar update failed: Character not found.', true); return;
    }
    const character = gameState.charactersData.get(characterId);

    if (!character || !avatarFile || !avatarFileName || !avatarMimeType) {
        utils.notifyUser(socket, 'Avatar update failed: Missing data.', true); return;
    }
    if (!(avatarFile instanceof Buffer)) {
        utils.notifyUser(socket, 'Avatar update failed: Invalid file data received.', true); return;
    }
    if (!gameState.folderName) {
        utils.notifyUser(socket, 'Avatar update failed: Server configuration error (no folder).', true); return;
    }
    const tableAvatarsDir = path.join(utils.TABLES_DIR, gameState.folderName, 'uploads', 'avatars');
    await fs.mkdir(tableAvatarsDir, { recursive: true });

    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif'];
    if (!allowedTypes.includes(avatarMimeType)) {
        utils.notifyUser(socket, 'Invalid image type. Only JPG, PNG, or GIF.', true); return;
    }
    if (avatarFile.length > 5 * 1024 * 1024) {
        utils.notifyUser(socket, 'Avatar image is too large (max 5MB).', true); return;
    }

    if (character.avatarUrl) {
        const oldAvatarFilename = path.basename(character.avatarUrl);
        const oldAvatarPath = path.join(tableAvatarsDir, oldAvatarFilename);
        try {
            await fs.access(oldAvatarPath);
            await fs.unlink(oldAvatarPath);
            console.log(`[AVATAR] Deleted old avatar: ${oldAvatarPath}`);
        } catch (err) {
            // Ignore errors if file doesn't exist, log others
            if ((err as NodeJS.ErrnoException).code !== 'ENOENT') {
                console.error(`[AVATAR] Error deleting old avatar ${oldAvatarPath}:`, err);
            }
        }
    }

    const extension = path.extname(avatarFileName) || `.${avatarMimeType.split('/')[1]}`;
    const newAvatarFilename = `${characterId}_avatar${extension}`;
    const newAvatarPath = path.join(tableAvatarsDir, newAvatarFilename);

    try {
        await fs.writeFile(newAvatarPath, avatarFile);
        const newAvatarUrl = utils.getAvatarUrl(tableId, newAvatarFilename);
        character.avatarUrl = newAvatarUrl;
        gameState.charactersData.set(characterId, character);
        await utils.saveTableState(gameState);

        console.log(`[AVATAR] Updated avatar for ${character.characterName} to ${newAvatarUrl}`);
        
        const detailsToSend = {
          ...character,
          hasPendingInvites: (character.pendingWhisperInvites?.length ?? 0) > 0,
          whisperTargets: character.whisperTargets.map(t => ({id: t.id, name: t.name}))
        };

        socket.emit('characterDetailsConfirmed', detailsToSend);

        io.to(tableId).emit('playerAvatarChanged', { characterId: characterId, newAvatarUrl: newAvatarUrl });

    } catch (err) {
        console.error(`[AVATAR] Error saving updated avatar for ${characterId}:`, err);
        utils.notifyUser(socket, 'Server error updating avatar.', true);
    }
}