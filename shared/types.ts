// table-talk-app_v0.41/shared/types.ts

// --- Core Data Structures ---

/** Represents a single game table. */
export interface Table {
  id: string;
  name: string;
  playerCount: number;
  lastActivity: string;
  theme?: string;
}

/** Represents the sender of a message or action. Shared between client and server. */
export interface Sender {
  id: string;
  name: string;
  isGM: boolean;
  isNPC: boolean;
  avatarUrl: string | null;
}

/** Represents a target for a whisper. Shared between client and server. */
export interface WhisperTarget {
  id: string;
  name: string;
  avatarUrl?: string | null;
}

/** Data representing a player in a list. Shared between client and server. */
export interface Player {
  id: string;
  name: string;
  languages: string[];
  isGM: boolean;
  avatarUrl: string | null;
}

/** Data representing the local character's state on the client. */
export interface ClientCharacterData {
  characterId: string;
  characterName: string;
  languages: string[];
  isGM: boolean;
  avatarUrl: string | null;
  hasPendingInvites?: boolean;
}

// SessionData now includes the tableId
export interface SessionData {
    tableId: string | null;
    characterId: string | null;
    characterName: string | null;
}


// --- Message & Payload Types ---

interface BaseMessagePayload {
  content?: string;
}

export interface ChatMessagePayload extends BaseMessagePayload {
  content: string;
  language: string;
  // This property is calculated per-recipient on the server and sent to the client for rendering
  isObfuscated?: boolean;
  originalRecipientNameForGMView?: string;
  // This property is added by the server for client-side rendering of whispers
  to?: WhisperTarget[];
}

export interface ImageMessagePayload {
  imageUrl: string;
  caption?: string;
  mimeType: string;
  originalRecipientNameForGMView?: string;
  // This property is added by the server for client-side rendering of whispers
  to?: WhisperTarget[];
}

export interface EmoteMessagePayload extends BaseMessagePayload {
  content: string;
  originalRecipientNameForGMView?: string;
  to?: WhisperTarget[];
}

export interface SystemNotificationPayload extends BaseMessagePayload {
  content: string;
  isError?: boolean;
}

export interface DiceRollMessagePayload extends BaseMessagePayload {
  description: string;
  details: string | null;
  total: number;
  originalRecipientNameForGMView?: string;
  to?: WhisperTarget[];
}

export type MessagePayload =
  | ChatMessagePayload
  | ImageMessagePayload
  | EmoteMessagePayload
  | SystemNotificationPayload
  | DiceRollMessagePayload;

/** The unified structure for any item in the chat log. */
export interface Message {
  itemId: string;
  timestamp: string;
  itemType: 'CHAT_MESSAGE' | 'IMAGE_MESSAGE' | 'CHAT_EMOTE' | 'SYSTEM_NOTIFICATION' | 'DICE_ROLL';
  sender: Sender;
  payload: MessagePayload;
  isWhisper?: boolean;
  
  // A UI hint added by the server for whispers, indicating direction relative to the recipient.
  direction?: 'SENT' | 'RECEIVED' | 'OBSERVED';

  // Server-side only, used for routing
  sentTo?: string[];
}


// --- Event Payloads & Shared Interfaces ---

/** Base interface for payloads that need table context */
interface TableScopedPayload {
  tableId: string;
}

/** The core data for a character that is persisted to disk. */
export interface PersistentCharacterData {
    characterId: string;
    characterName: string;
    languages: string[];
    isGM: boolean;
    avatarUrl: string | null;
}

/** Payload from client to join as a new character. */
export interface CharacterSubmissionPayload extends TableScopedPayload {
  name: string;
  languages?: string[];
  isGM?: boolean;
  // This will be a File on the client and a Buffer on the server.
  avatarFile?: File | Buffer;
  avatarFileName?: string;
  avatarMimeType?: string;
}

/** Payload to reconnect a character. */
export interface ReconnectPayload extends TableScopedPayload {
  characterId: string;
}

/** Payload to update an avatar. */
export interface UpdateAvatarPayload extends TableScopedPayload {
  // This will be a File on the client and a Buffer on the server.
  avatarFile: File | Buffer;
  avatarFileName: string;
  avatarMimeType: string;
}

/** Payload to send a text message. */
export interface SendMessagePayload extends TableScopedPayload {
  content: string;
  language: string;
}

/** Payload to send an image. */
export interface SendImagePayload extends TableScopedPayload {
  // This will be a File on the client and a Buffer on the server.
  imageFile: File | Buffer;
  fileName: string;
  mimeType: string;
  caption?: string;
}

/** Payload to execute a command. */
export interface CommandPayload extends TableScopedPayload {
  command: string;
  args: string[];
}

/** Structure for importing/exporting game state. */
export interface ImportedGameState extends TableScopedPayload {
  name?: string;
  saveVersion: number;
  savedAt?: string;
  charactersData: [string, PersistentCharacterData][];
  chatHistory: Message[];
  npcList?: string[];
  availableLanguages?: string[];
  defaultLanguage?: string;
  theme?: string;
}

/** Structure for GM-initiated language changes. */
export interface PlayerLanguageChange {
  command: 'givelang' | 'takelang';
  playerName: string;
  language: string;
}

// --- Admin Event Payloads ---

export interface AdminDeletePayload {
  tableId: string;
}

export interface AdminImportPayload {
  fileContent: string; // The full string content of the JSON file
}

export interface AdminAuthResultPayload {
    success: boolean;
    message?: string;
}