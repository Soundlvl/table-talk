// server/utils.ts
import fs from 'fs/promises';
import fsSync from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import {
    GameState, ServerSocketType, Character, Sender, Message,
    ServerIoType,
    Utils as UtilsInterface, ChatMessagePayload, GameTables, PersistentCharacterData, WhisperTarget, 
} from './types';

export function sanitizeForFilename(name: string): string {
    if (!name) return 'unnamed-table';
    // Replace characters that are invalid in Windows, macOS, and Linux filenames.
    const sanitized = name.replace(/[<>:"/\\|?*]/g, '_').replace(/[\s\.]+/g, '-');
    // Truncate to a reasonable length and ensure it's not empty.
    const truncated = sanitized.substring(0, 100);
    return truncated || 'sanitized-table';
}


// Determine the base directory for storing tables.
// When packaged, this is next to the .exe. In development, it's the project root.
const getBaseDir = () => {
    // Check if running under Electron
    if (process.env.ELECTRON_MODE === 'true') {
        // In Electron mode, use the user's data directory for persistent storage
        // This ensures we write to a writable location that persists between app launches
        const os = require('os');
        const userDataPath = path.join(os.homedir(), 'Documents', 'TableTalk');
        console.log(`[UTILS] Electron mode detected - using user data directory: ${userDataPath}`);
        return userDataPath;
    }
    
    // `process.pkg` is a special flag set by the pkg tool
    if ((process as any).pkg) {
        // In a packaged app, save data next to the executable
        return path.dirname((process as any).execPath);
    } else {
        // In development, find the project root from the script location.
        const isRunningFromDist = __dirname.replace(/\\/g, '/').includes('/server/dist');
        // If running from dist, go up from /server/dist/server to project root
        // If running from ts-node, go up from /server to project root
        const projectRoot = isRunningFromDist
            ? path.resolve(__dirname, '..', '..', '..')
            : path.resolve(__dirname, '..');
        return projectRoot;
    }
};

const projectRoot = getBaseDir();

// Ensure the base directory exists (especially important for Electron apps)
try {
    if (!fsSync.existsSync(projectRoot)) {
        fsSync.mkdirSync(projectRoot, { recursive: true });
        console.log(`[UTILS] Created base directory: ${projectRoot}`);
    }
} catch (error) {
    console.error(`[UTILS] Failed to create base directory ${projectRoot}:`, error);
}

// All data directories will now correctly resolve based on the environment
export const TABLES_DIR = path.join(projectRoot, 'tables');
export const getAvatarUrl = (tableId: string, filename: string) => `/uploads/${tableId}/avatars/${filename}`;
export const getImageUrl = (tableId: string, filename: string) => `/uploads/${tableId}/${filename}`;


export function notifyUser(socket: ServerSocketType, content: string, isError = false): void {
    if (!socket) return;
    socket.emit('newMessage', {
        itemId: uuidv4(),
        timestamp: new Date().toISOString(),
        itemType: "SYSTEM_NOTIFICATION",
        sender: { id: 'SYSTEM', name: 'System', isGM: false, isNPC: false, avatarUrl: null},
        payload: { content, isError }
    } as Message);
}

export function sortLanguages(availableLanguages: string[], defaultLanguage: string): void {
    availableLanguages.sort((a, b) => {
        if (a.toLowerCase() === defaultLanguage.toLowerCase()) return -1;
        if (b.toLowerCase() === defaultLanguage.toLowerCase()) return 1;
        return a.localeCompare(b);
    });
}

export function broadcastGMStatus(io: ServerIoType, tableId: string, activeGMsocketId: string | null): void {
  io.to(tableId).emit('gmStatusUpdate', { isGMActive: !!activeGMsocketId });
}

export function initializeCharactersFromSave(savedCharacters: [string, PersistentCharacterData][]): Map<string, Character> {
    const charactersMap = new Map<string, Character>();
    if (savedCharacters && Array.isArray(savedCharacters)) {
        for (const [id, persistentData] of savedCharacters) {
            charactersMap.set(id, {
                ...persistentData,
                // Initialize all transient fields
                speakingAsNPCName: null,
                whisperTargets: [],
                pendingWhisperInvites: [],
                hasSentWhisperInvite: false,
                metadataForNextWhisperInvite: null,
            });
        }
    }
    return charactersMap;
}


export async function saveTableState(gameState: GameState): Promise<void> {
  if (!gameState.folderName) {
      console.error(`[PERSISTENCE] Cannot save table '${gameState.name}' (${gameState.id}): missing folderName.`);
      return;
  }
  const tableDir = path.join(TABLES_DIR, gameState.folderName);
  const stateFile = path.join(tableDir, 'gamestate.json');

  try {
    await fs.mkdir(tableDir, { recursive: true });

    const charactersDataToSave: [string, PersistentCharacterData][] = [];
    for (const [charId, char] of gameState.charactersData.entries()) {
        const persistentData: PersistentCharacterData = {
            characterId: char.characterId,
            characterName: char.characterName,
            languages: char.languages,
            isGM: char.isGM,
            avatarUrl: char.avatarUrl,
        };
        charactersDataToSave.push([charId, persistentData]);
    }
    
    // Create a copy to avoid mutating the live gameState object and to remove transient properties
    const gameStateToSave: any = {
      saveVersion: 3,
      id: gameState.id,
      name: gameState.name,
      theme: gameState.theme,
      savedAt: new Date().toISOString(),
      chatHistory: gameState.chatHistory,
      charactersData: charactersDataToSave,
      availableLanguages: gameState.availableLanguages,
      defaultLanguage: gameState.defaultLanguage,
      npcList: Array.from(gameState.npcList),
    };
    
    await fs.writeFile(stateFile, JSON.stringify(gameStateToSave, null, 2));
    console.log(`[PERSISTENCE] Game state for table '${gameState.name}' (${gameState.id}) saved to folder '${gameState.folderName}'.`);
  } catch (error) {
    console.error(`[PERSISTENCE] Failed to save game state for table ${gameState.id}:`, error);
  }
}

export async function loadTableState(tableFolderName: string): Promise<GameState | null> {
    const tableDir = path.join(TABLES_DIR, tableFolderName);
    const stateFile = path.join(tableDir, 'gamestate.json');
    try {
        await fs.access(stateFile); // Check if file exists
        const rawData = await fs.readFile(stateFile, 'utf-8');
        const savedState = JSON.parse(rawData);

        if (savedState && savedState.id) {
             const loadedCharacters = initializeCharactersFromSave(savedState.charactersData || []);
             const gameState: GameState = {
                id: savedState.id,
                name: savedState.name || 'Unnamed Table',
                folderName: tableFolderName, // Add the folderName to the loaded state
                theme: savedState.theme || 'fantasy',
                defaultLanguage: savedState.defaultLanguage || 'Common',
                availableLanguages: savedState.availableLanguages || ['Common'],
                charactersData: loadedCharacters,
                socketIdToCharacterId: new Map(),
                characterIdToSocketIds: new Map(),
                activeGMsocketId: null,
                npcList: new Set<string>(savedState.npcList || []),
                chatHistory: savedState.chatHistory || [],
                lastActivity: savedState.savedAt || new Date().toISOString(),
            };
            console.log(`[PERSISTENCE] Game state for table '${gameState.name}' (${gameState.id}) loaded from folder '${tableFolderName}'.`);
            return gameState;
        }
    } catch (error) {
        console.error(`[PERSISTENCE] Failed to load/parse state from folder ${tableFolderName}:`, error);
    }
    return null;
}

export async function loadAllTables(gameTables: GameTables): Promise<void> {
    if (!fsSync.existsSync(TABLES_DIR)) return;
    const tableDirs = await fs.readdir(TABLES_DIR, { withFileTypes: true });

    const loadPromises = tableDirs
        .filter(dirent => dirent.isDirectory())
        .map(async (dirent) => {
            const folderName = dirent.name;
            const gameState = await loadTableState(folderName);
            if (gameState) {
                // The loaded gameState already has the folderName. We use its internal ID to key the map.
                gameTables.set(gameState.id, gameState);
            }
        });

    await Promise.all(loadPromises);
    console.log(`[PERSISTENCE] Loaded ${gameTables.size} tables.`);
}

export async function createNewTable(name: string, gameTables: GameTables): Promise<GameState | null> {
    const tableId = uuidv4();
    const folderName = sanitizeForFilename(name);
    const tableDir = path.join(TABLES_DIR, folderName);
    
    if (fsSync.existsSync(tableDir)) {
        console.error(`[ERROR] Table folder collision: folder '${folderName}' already exists. A table with a similar name might already exist.`);
        return null;
    }
    await fs.mkdir(tableDir, { recursive: true });

    const newGameState: GameState = {
        id: tableId,
        name: name,
        folderName: folderName,
        theme: 'fantasy',
        defaultLanguage: "Common",
        availableLanguages: ["Common", "Elvish", "Dwarvish", "Orcish", "Celestial", "Infernal", "Draconic", "Abyssal", "Primordial", "Undercommon"],
        charactersData: new Map(),
        socketIdToCharacterId: new Map(),
        characterIdToSocketIds: new Map(),
        activeGMsocketId: null,
        npcList: new Set(),
        chatHistory: [],
        lastActivity: new Date().toISOString()
    };
    sortLanguages(newGameState.availableLanguages, newGameState.defaultLanguage);
    await saveTableState(newGameState);
    gameTables.set(tableId, newGameState);
    console.log(`[TABLES] Created new table '${name}' in folder '${folderName}' with ID ${tableId}`);
    return newGameState;
}

export async function deleteTable(tableId: string, gameTables: GameTables): Promise<void> {
  const gameState = gameTables.get(tableId);
  if (!gameState || !gameState.folderName) {
      console.error(`[PERSISTENCE] Cannot delete table ${tableId}: gameState or folderName not found.`);
      return;
  }
  const tableDir = path.join(TABLES_DIR, gameState.folderName);

  try {
     if (fsSync.existsSync(tableDir)) {
      await fs.rm(tableDir, { recursive: true, force: true });
      console.log(`[PERSISTENCE] Deleted table directory: ${tableDir}`);
    }
  } catch (error) {
    console.error(`[PERSISTENCE] Failed to delete directory for table ${tableId}:`, error);
  }
}


export async function broadcastLanguageUpdate(io: ServerIoType, gameState: GameState, utilsInstance: UtilsInterface): Promise<void> {
    sortLanguages(gameState.availableLanguages, gameState.defaultLanguage);
    io.to(gameState.id).emit('languageListUpdate', { languages: gameState.availableLanguages, defaultLanguage: gameState.defaultLanguage });
    await utilsInstance.saveTableState(gameState);
}

export function getSenderWithAvatar(characterId: string, charactersData: Map<string, Character>): Sender {
    const charData = charactersData.get(characterId);
    if (!charData) return { id: characterId, name: 'Unknown', isGM: false, isNPC: false, avatarUrl: null };

    const isGMAsNPC = charData.isGM && !!charData.speakingAsNPCName;

    if (isGMAsNPC) {
        return {
            id: characterId,
            name: charData.speakingAsNPCName!, // Non-null assertion as it's checked by isGMAsNPC
            isGM: true,
            isNPC: true,
            avatarUrl: null
        };
    } else {
        return {
            id: characterId,
            name: charData.characterName,
            isGM: charData.isGM,
            isNPC: false,
            avatarUrl: charData.avatarUrl
        };
    }
}

function prepareMessageForRecipient(
    originalMessage: Message,
    recipientId: string,
    _isObserving: boolean, // This flag might not be needed if logic is self-contained
    gameState: GameState,
    understoodBy?: string[] | null
): Message | null {
    const recipientCharData = gameState.charactersData.get(recipientId);
    if (!recipientCharData) {
        return null;
    }

    const messageCopy: Message = JSON.parse(JSON.stringify(originalMessage));
    const senderId = messageCopy.sender.id;
    const isDirectRecipient = messageCopy.sentTo?.includes(recipientId);
    const isSender = recipientId === senderId;

    // Gatekeeping: who gets to see the message?
    if (messageCopy.isWhisper) {
        if (!isDirectRecipient) {
            // Not a direct recipient. Only observing GMs can see it.
            if (!recipientCharData.isGM) return null;
            messageCopy.direction = 'OBSERVED';
        } else {
            messageCopy.direction = isSender ? 'SENT' : 'RECEIVED';
        }
    } else {
        // Public message. Everyone in sentTo gets it.
        if (!isDirectRecipient) return null;
    }

    const payload = messageCopy.payload as any; // Use any for easier property access

    // Add whisper-specific context, using the persistent `to` from the payload
    if (messageCopy.isWhisper) {
        const whisperTargetsFromPayload = payload.to as WhisperTarget[] | undefined;
        if (whisperTargetsFromPayload) {
            // The payload.to is already here from persistence, we just need to add the GM view logic.
            if (recipientCharData.isGM && messageCopy.direction !== 'SENT') {
                // Find how the GM was addressed in this whisper channel
                const gmAsTarget = whisperTargetsFromPayload.find(t => t.id === recipientId);
                if (gmAsTarget && gmAsTarget.name !== recipientCharData.characterName) {
                    // GM was targeted as an NPC or with a generic "GM" tag
                    payload.originalRecipientNameForGMView = gmAsTarget.name;
                }
            }
        }
    }

    // Handle language obfuscation
    if (messageCopy.itemType === 'CHAT_MESSAGE') {
        // Check if this specific recipient should understand the language.
        // `understoodBy` is the source of truth; GMs are already included in it.
        const recipientUnderstands = !understoodBy || understoodBy.includes(recipientId);
        (messageCopy.payload as ChatMessagePayload).isObfuscated = !recipientUnderstands;
    }

    return messageCopy;
}

export async function distributeMessage(messageObject: Message, io: ServerIoType, gameState: GameState, understoodBy?: string[] | null): Promise<void> {
    // Add to history first, unless it's a special transient type
    if (messageObject.itemType !== 'SYSTEM_NOTIFICATION') {
        gameState.chatHistory.push(messageObject);
        gameState.lastActivity = new Date().toISOString();
        // No await needed, can save in background
        saveTableState(gameState); 
    }

    const recipients = messageObject.sentTo || [];
    const observerGMs = Array.from(gameState.charactersData.entries())
        .filter(([id, char]) => char.isGM && !recipients.includes(id))
        .map(([id]) => id);

    const allPotentialViewers = [...new Set([...recipients, ...observerGMs])];

    for (const recipientId of allPotentialViewers) {
        const preparedMessage = prepareMessageForRecipient(messageObject, recipientId, false, gameState, understoodBy);
        if (preparedMessage) {
            const recipientSocketIds = gameState.characterIdToSocketIds.get(recipientId);
            if (recipientSocketIds) {
                for (const socketId of recipientSocketIds) {
                    io.to(socketId).emit('newMessage', preparedMessage);
                }
            }
        }
    }
}

export function broadcastTransientMessage(io: ServerIoType, tableId: string, messageObject: Message): void {
  // This message is not saved to history. It's for ephemeral notifications.
  io.to(tableId).emit('newMessage', messageObject);
}

export function sendChatHistory(socket: ServerSocketType, characterId: string, gameState: GameState): void {
    const tailoredHistory: Message[] = [];
    const charData = gameState.charactersData.get(characterId);
    if (!charData) return;

    for (const message of gameState.chatHistory) {
        // Determine if the user could understand the original message
        let understoodBy: string[] | null = null;
        if (message.itemType === 'CHAT_MESSAGE') {
            const msgPayload = message.payload as ChatMessagePayload;
            // Include GMs in understoodBy list even if they weren't direct recipients
            const allPotentialViewers = [...(message.sentTo || [])];
            // Add any GMs who weren't direct recipients
            for (const [id, char] of gameState.charactersData.entries()) {
                if (char.isGM && !allPotentialViewers.includes(id)) {
                    allPotentialViewers.push(id);
                }
            }
            understoodBy = allPotentialViewers.filter(recId => {
                const char = gameState.charactersData.get(recId);
                return char && (char.isGM || msgPayload.language === gameState.defaultLanguage || char.languages.includes(msgPayload.language));
            });
        }
        
        const preparedMessage = prepareMessageForRecipient(message, characterId, false, gameState, understoodBy);
        if (preparedMessage) {
            tailoredHistory.push(preparedMessage);
        }
    }
    socket.emit('chatHistory', { history: tailoredHistory });
}