// server/handlers/messageHandler.ts
import fs from 'fs/promises';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import {
    ServerSocketType, GameState, Utils, ServerIoType,
    Message, ChatMessagePayload, ImageMessagePayload,
    WhisperTarget, SendMessagePayload, SendImagePayload, Character, GameTables
} from '../types';

interface MessageHandlerContext {
  io: ServerIoType;
  gameTables: GameTables;
  gameState: GameState;
  utils: Utils;
}

export async function handleSendMessage(socket: ServerSocketType, payload: SendMessagePayload, context: MessageHandlerContext): Promise<void> {
    const { io, gameState, utils } = context;
    const { content, language, tableId } = payload;
    
    if (socket.data.tableId !== tableId) return;

    const characterId = gameState.socketIdToCharacterId.get(socket.id);
    if (!characterId) return;

    const senderData = gameState.charactersData.get(characterId);
    if (!content || !senderData) return;

    const senderForMessage = utils.getSenderWithAvatar(characterId, gameState.charactersData);
    const isWhisper = senderData.whisperTargets && senderData.whisperTargets.length > 0;

    let sentTo: string[];
    let to_targets: WhisperTarget[] | undefined = undefined;
    if (isWhisper) {
        sentTo = [...new Set(senderData.whisperTargets.map(target => target.id))];
        to_targets = [...senderData.whisperTargets];
    } else {
        sentTo = Array.from(gameState.charactersData.keys());
    }

    // Determine who can understand the message's language
    const understoodByIds = new Set<string>();
    
    // Add direct recipients who know the language
    sentTo.forEach(recId => {
        const char = gameState.charactersData.get(recId);
        if (char && (language === gameState.defaultLanguage || char.languages.includes(language))) {
            understoodByIds.add(recId);
        }
    });

    // Always add all GMs on the table, as they understand all languages
    for (const [id, char] of gameState.charactersData.entries()) {
        if (char.isGM) {
            understoodByIds.add(id);
        }
    }

    const chatMessagePayload: ChatMessagePayload = { 
        content, 
        language,
        to: to_targets,
    };

    const messageObject: Message = {
        itemId: uuidv4(),
        timestamp: new Date().toISOString(),
        itemType: "CHAT_MESSAGE",
        sender: senderForMessage,
        isWhisper: isWhisper,
        sentTo: sentTo,
        payload: chatMessagePayload,
    };

    if (isWhisper && !senderData.hasSentWhisperInvite) {
        handleFirstWhisperInvite(senderData, characterId, context);
    }
    
    await utils.distributeMessage(messageObject, io, gameState, Array.from(understoodByIds));
}

export async function handleSendImage(socket: ServerSocketType, payload: SendImagePayload, context: MessageHandlerContext): Promise<void> {
    const { io, gameState, utils } = context;
    const { imageFile, fileName, mimeType, caption, tableId } = payload;
    
    if (socket.data.tableId !== tableId) return;
    
    const characterId = gameState.socketIdToCharacterId.get(socket.id);
    if (!characterId) return;
    
    const senderData = gameState.charactersData.get(characterId);
    if (!senderData) return;

    console.log(`[IMAGE] Received 'sendImage' from ${senderData.characterName} (${characterId}) for table ${tableId}`);

    if (!imageFile) {
        console.error(`[IMAGE] Upload failed for ${characterId}: No imageFile data received.`);
        utils.notifyUser(socket, 'Invalid image data received.', true); return;
    }

    if (!(imageFile instanceof Uint8Array)) {
        console.error(`[IMAGE] Upload failed for ${characterId}: imageFile is not a Buffer. Type is: ${typeof imageFile}`);
        utils.notifyUser(socket, 'Invalid image data received.', true); return;
    }
    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif'];
    if (!allowedTypes.includes(mimeType)) {
        utils.notifyUser(socket, 'Invalid image type. Only JPG, PNG, or GIF are allowed.', true); return;
    }
    const maxFileSize = 5 * 1024 * 1024; // 5MB
    if (imageFile.length > maxFileSize) {
        utils.notifyUser(socket, 'Image file is too large. The maximum size is 5MB.', true); return;
    }

    if (!gameState.folderName) {
        console.error(`[IMAGE] Upload failed for ${characterId}: gameState.folderName is missing.`);
        utils.notifyUser(socket, 'Image upload failed: Server configuration error (no folder).', true);
        return;
    }
    const tableUploadsDir = path.join(utils.TABLES_DIR, gameState.folderName, 'uploads');
    await fs.mkdir(tableUploadsDir, { recursive: true });

    const extension = path.extname(fileName) || `.${mimeType.split('/')[1]}`;
    const uniqueFilename = `${uuidv4()}${extension}`;
    const imagePath = path.join(tableUploadsDir, uniqueFilename);

    try {
        await fs.writeFile(imagePath, imageFile);
        console.log(`[IMAGE] Successfully wrote image for ${characterId} to ${imagePath}`);
        const imageUrl = utils.getImageUrl(tableId, uniqueFilename);

        const senderForMessage = utils.getSenderWithAvatar(characterId, gameState.charactersData);
        const isWhisper = senderData.whisperTargets && senderData.whisperTargets.length > 0;
        let sentTo: string[];
        let to_targets: WhisperTarget[] | undefined = undefined;

        if (isWhisper) {
            sentTo = [...new Set(senderData.whisperTargets.map(target => target.id))];
            to_targets = [...senderData.whisperTargets];
             if (!senderData.hasSentWhisperInvite) {
                handleFirstWhisperInvite(senderData, characterId, context);
            }
        } else {
            sentTo = Array.from(gameState.charactersData.keys());
        }

        const imagePayload: ImageMessagePayload = { 
            imageUrl, 
            caption, 
            mimeType,
            to: to_targets,
        };

        const imageMessage: Message = {
            itemId: uuidv4(),
            timestamp: new Date().toISOString(),
            itemType: 'IMAGE_MESSAGE',
            sender: senderForMessage,
            isWhisper: isWhisper,
            sentTo: sentTo,
            payload: imagePayload
        };
        await utils.distributeMessage(imageMessage, io, gameState, null);
    } catch (err) {
        console.error(`[IMAGE UPLOAD] Error saving image for ${characterId}:`, err);
        utils.notifyUser(socket, 'Error saving image on server.', true);
    }
}

function handleFirstWhisperInvite(senderData: Character, characterId: string, context: MessageHandlerContext) {
    const { io, gameState, utils } = context;
    senderData.hasSentWhisperInvite = true;

    const inviteFromName = utils.getSenderWithAvatar(characterId, gameState.charactersData).name;
    const inviteMetadata = senderData.metadataForNextWhisperInvite;

    const invite = {
        fromId: characterId,
        participantIds: senderData.whisperTargets,
        fromName: inviteFromName,
        originalTargetName: inviteMetadata?.originalTargetName,
        originalTargetType: inviteMetadata?.originalTargetType
    };

    senderData.metadataForNextWhisperInvite = null;
    gameState.charactersData.set(characterId, senderData);

    senderData.whisperTargets.forEach((target: WhisperTarget) => {
        if (target.id === characterId) return;

        const recipientData = gameState.charactersData.get(target.id);
        if (!recipientData) return;

        recipientData.pendingWhisperInvites.push(invite);
        gameState.charactersData.set(target.id, recipientData);

        const recipientSocketIds = gameState.characterIdToSocketIds.get(target.id) || new Set();

        for (const recipientSocketId of recipientSocketIds) {
            const recipientSocket = io.sockets.sockets.get(recipientSocketId);
            if (recipientSocket) {
                let notificationMessage = `Whisper invite from ${inviteFromName}. Use /reply or /r to join.`;
                if (recipientData.isGM && invite.originalTargetType === 'NPC' && invite.originalTargetName && target.name !== recipientData.characterName) {
                    notificationMessage = `${inviteFromName} invites you (as ${invite.originalTargetName}) to whisper. Use /reply or /r to join.`;
                }
                utils.notifyUser(recipientSocket, notificationMessage);
                
                // Emit characterDetailsConfirmed to update the recipient's UI state, including the reply button.
                const detailsToSend = {
                  ...recipientData,
                  hasPendingInvites: true, // Explicitly set to true since we just added one
                  whisperTargets: recipientData.whisperTargets.map(t => ({id: t.id, name: t.name}))
                };
                recipientSocket.emit('characterDetailsConfirmed', detailsToSend);
            }
        }
    });
}