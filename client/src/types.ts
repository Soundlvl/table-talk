// client/src/types.ts

// Import all shared types from the new central location.
export * from '../../shared/types';

// The types below are specific to the client application's implementation details.
import React from 'react';
import { ClientCharacterData, Message, Player, SessionData, WhisperTarget } from '../../shared/types';

// Type for options passed to the useSocketManager hook
export interface UseSocketManagerOptions {
  sessionData: SessionData | null;
  setSessionData: React.Dispatch<React.SetStateAction<SessionData | null>>;
  setLocalCharacterData: React.Dispatch<React.SetStateAction<ClientCharacterData | null>>;
  setMessages: React.Dispatch<React.SetStateAction<Message[]>>;
  setAvailableLanguages: React.Dispatch<React.SetStateAction<string[]>>;
  setDefaultLanguage: React.Dispatch<React.SetStateAction<string>>;
  setCurrentLanguage: React.Dispatch<React.SetStateAction<string>>;
  setIsGMActiveFromServer: React.Dispatch<React.SetStateAction<boolean>>;
  setPlayerList: React.Dispatch<React.SetStateAction<Player[]>>;
  setSpeakingAs: React.Dispatch<React.SetStateAction<string | null>>;
  setWhisperTargets: React.Dispatch<React.SetStateAction<string[]>>; // UI stores array of names
  setHasPendingInvite: React.Dispatch<React.SetStateAction<boolean>>;
  setTheme: React.Dispatch<React.SetStateAction<string>>;
  currentLanguage: string;
  defaultLanguageProp: string;
}

// Type for the object containing all socket event handlers within useSocketManager
export interface SocketEventHandlers {
  onConnect: () => void;
  onDisconnect: () => void;
  onTableJoined: (data: { tableId: string; tableName: string; availableLanguages: string[]; defaultLanguage: string; isGMActive: boolean; theme: string; }) => void;
  onTableNotFound: () => void;
  onCharacterDetailsConfirmed: (confirmedDetails: ClientCharacterData & { whisperTargets?: WhisperTarget[] }) => void;
  onCharacterNameRejected: () => void;
  onReconnectFailed: () => void;
  onChatHistory: (data: { history: Message[] }) => void;
  onNewMessage: (message: Message) => void;
  onGmStatusUpdate: (data: { isGMActive: boolean; }) => void;
  onLanguageListUpdate: (data: { languages: string[]; defaultLanguage: string; }) => void;
  onPlayerListUpdate: (data: { players: Player[] }) => void;
  onPersonaUpdate: (data: { speakingAs: string | null; }) => void;
  onWhisperModeUpdate: (data: { targets: string[] }) => void; // Server sends array of names
  onGameStateExport: (gameState: unknown) => void;
  onSessionReloading: () => void;
  onImportGameStateSucceeded: () => void;
  onImportGameStateFailed: (data: { error?: string }) => void;
  onPlayerAvatarChanged: (data: { characterId: string; newAvatarUrl: string }) => void;
  onThemeChanged: (data: { theme: string; }) => void;
}