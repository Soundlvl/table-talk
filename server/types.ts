// server/types.ts

import { Server as SocketIOServer, Socket } from 'socket.io';
import { DefaultEventsMap } from 'socket.io/dist/typed-events';
// Import all shared types from the new central location.
export * from '../shared/types';
import { Message, Sender, WhisperTarget, PersistentCharacterData } from '../shared/types';

// --- Server-Specific Types ---
// These types are only used by the server and are not needed by the client.

// Add tableId and isAdmin to the socket data for context
export interface SocketData {
  tableId: string;
  isAdmin?: boolean;
}

export type ServerIoType = SocketIOServer<DefaultEventsMap, DefaultEventsMap, DefaultEventsMap, SocketData>;
export type ServerSocketType = Socket<DefaultEventsMap, DefaultEventsMap, DefaultEventsMap, SocketData>;

export interface PendingWhisperInvite {
  fromId: string;
  participantIds: WhisperTarget[];
  fromName: string;
  originalTargetName?: string;
  originalTargetType?: 'NPC' | 'GM' | 'Player';
}

export interface MetadataForNextWhisperInvite {
  originalTargetName: string;
  originalTargetType: 'NPC' | 'GM' | 'Player';
}

/** Complete server-side representation of a character's state, extending the persistent base. */
export interface Character extends PersistentCharacterData {
  // Server-only transient state
  speakingAsNPCName: string | null;
  whisperTargets: WhisperTarget[];
  pendingWhisperInvites: PendingWhisperInvite[];
  hasSentWhisperInvite: boolean;
  metadataForNextWhisperInvite: MetadataForNextWhisperInvite | null;
}

export interface GameState {
  id: string; // tableId
  name: string; // tableName
  theme: string;
  defaultLanguage: string;
  availableLanguages: string[];
  charactersData: Map<string, Character>;
  socketIdToCharacterId: Map<string, string>;
  characterIdToSocketIds: Map<string, Set<string>>; // New mapping for character -> sockets
  activeGMsocketId: string | null;
  npcList: Set<string>;
  chatHistory: Message[]; // Using the unified Message type
  lastActivity: string;
  // This is a transient property used by the server to know the folder name on disk.
  folderName?: string;
  [key: string]: any;
}

export type GameTables = Map<string, GameState>;


export interface Utils {
  notifyUser: (socket: ServerSocketType, content: string, isError?: boolean) => void;
  sortLanguages: (availableLanguages: string[], defaultLanguage: string) => void;
  broadcastGMStatus: (io: ServerIoType, tableId: string, activeGMsocketId: string | null) => void;
  saveTableState: (gameState: GameState) => Promise<void>;
  loadTableState: (tableFolderName: string) => Promise<GameState | null>;
  loadAllTables: (gameTables: GameTables) => Promise<void>;
  createNewTable: (name: string, gameTables: GameTables) => Promise<GameState | null>;
  deleteTable: (tableId: string, gameTables: GameTables) => Promise<void>;
  broadcastLanguageUpdate: (io: ServerIoType, gameState: GameState, utils: Utils) => Promise<void>;
  getSenderWithAvatar: (characterId: string, charactersData: Map<string, Character>) => Sender;
  distributeMessage: (messageObject: Message, io: ServerIoType, gameState: GameState, understoodBy?: string[] | null) => Promise<void>;
  broadcastTransientMessage: (io: ServerIoType, tableId: string, messageObject: Message) => void;
  sendChatHistory: (socket: ServerSocketType, characterId: string, gameState: GameState) => void;
  sanitizeForFilename: (name: string) => string;
  getAvatarUrl: (tableId: string, filename: string) => string;
  getImageUrl: (tableId: string, filename: string) => string;
  initializeCharactersFromSave(savedCharacters: [string, PersistentCharacterData][]): Map<string, Character>;
  TABLES_DIR: string;
}

export interface CommandContext {
  io: ServerIoType;
  gameTables: GameTables;
  gameState: GameState; // The state for the specific table
  utils: Utils;
  characterId: string;
  tableId: string;
}

export interface Command {
  name: string;
  description: string;
  gmOnly?: boolean;
  aliases?: string[];
  execute: (socket: ServerSocketType, args: string[], context: CommandContext) => void | Promise<void>;
}