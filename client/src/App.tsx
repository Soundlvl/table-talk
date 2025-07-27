// client/src/App.tsx

// --- Dependencies ---
import React, { useState, useEffect, useRef, useCallback } from 'react';

import './styles.css';
import ChatItem from './ChatItem';
import CharacterCreationForm from './CharacterCreationForm';
import GMPlayerManager from './GMPlayerManager';
import PlayerSettings from './PlayerSettings';
import Avatar from './Avatar';
import useSocketManager from './hooks/useSocketManager';
import TableSelection from './TableSelection'; // New component
import TableAdmin from './TableAdmin'; // Admin panel component

// --- Import Types ---
import { ClientCharacterData, Message, Player, PlayerLanguageChange, SessionData, CharacterSubmissionPayload } from '../../shared/types';


// --- SVG Icon Components ---
const IconManage = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
    <polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line>
    <line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline>
  </svg>
);
const IconAttach = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"></path>
  </svg>
);
const IconDice = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><path d="M16 8h.01"></path><path d="M12 12h.01"></path><path d="M8 16h.01"></path><path d="M8 8h.01"></path><path d="M16 16h.01"></path></svg>
);
const IconWhisper = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
    </svg>
);
const IconSettings = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="3"></circle>
    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
  </svg>
);
const IconExit = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path><polyline points="16 17 21 12 16 7"></polyline><line x1="21" y1="12" x2="9" y2="12"></line>
  </svg>
);


function App() {
  // --- State Management ---
  const [sessionData, setSessionData] = useState<SessionData | null>(() => {
    try {
      const saved = localStorage.getItem('tableTalkSession');
      if (saved) {
        const parsed = JSON.parse(saved);
        // Basic validation to ensure we have the necessary data
        if (parsed.tableId) { // We can attempt to join a table even without a characterId
          return parsed;
        }
      }
      return null;
    } catch (e) {
      console.error("Failed to parse session from localStorage", e);
      localStorage.removeItem('tableTalkSession');
      return null;
    }
  });

  const [localCharacterData, setLocalCharacterData] = useState<ClientCharacterData | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [availableLanguages, setAvailableLanguages] = useState<string[]>([]);
  const [defaultLanguage, setDefaultLanguage] = useState<string>('Common');
  const [isGMActiveFromServer, setIsGMActiveFromServer] = useState<boolean>(false);
  const [inputValue, setInputValue] = useState<string>('');
  const [currentLanguage, setCurrentLanguage] = useState<string>('Common');
  const [speakingAs, setSpeakingAs] = useState<string | null>(() => {
    try {
      const savedSpeakingAs = localStorage.getItem('tableTalkSpeakingAs');
      return savedSpeakingAs ? JSON.parse(savedSpeakingAs) : null;
    } catch (e) {
      console.error("Failed to parse speakingAs from localStorage", e);
      return null;
    }
  });
  const [whisperTargets, setWhisperTargets] = useState<string[]>([]);
  const [isGmManagerOpen, setIsGmManagerOpen] = useState<boolean>(false);
  const [playerList, setPlayerList] = useState<Player[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const imageUploadInputRef = useRef<HTMLInputElement>(null);
  const focusedElementRef = useRef<HTMLTextAreaElement | null>(null);
  const [isPlayerSettingsOpen, setIsPlayerSettingsOpen] = useState<boolean>(false);
  const [isDraggingOver, setIsDraggingOver] = useState<boolean>(false);
  const [expandedImageUrl, setExpandedImageUrl] = useState<string | null>(null);
  const [isImageModalOpen, setIsImageModalOpen] = useState<boolean>(false);
  const [hasScrolledInitially, setHasScrolledInitially] = useState<boolean>(false);
  const [isAdminView, setIsAdminView] = useState<boolean>(false);
  const [hasPendingInvite, setHasPendingInvite] = useState<boolean>(false);
  const [theme, setTheme] = useState<string>('fantasy');
  const [isHighContrastMode, setIsHighContrastMode] = useState<boolean>(() => {
    try {
        const saved = localStorage.getItem('tableTalkHighContrastMode');
        return saved ? JSON.parse(saved) : false;
    } catch {
        return false;
    }
  });
  const [isDyslexicFont, setIsDyslexicFont] = useState<boolean>(() => {
    try {
        const saved = localStorage.getItem('tableTalkDyslexicFont');
        return saved ? JSON.parse(saved) : false;
    } catch {
        return false;
    }
  });
  
  // --- Bug Fix: Apply theme to body for global styling ---
  useEffect(() => {
    document.body.dataset.theme = theme;
    // Cleanup function to remove the attribute when the component unmounts
    return () => {
      delete document.body.dataset.theme;
    };
  }, [theme]);

  // Apply high contrast mode attribute to body
  useEffect(() => {
    document.body.dataset.highContrast = String(isHighContrastMode);
  }, [isHighContrastMode]);

  // Apply dyslexia-friendly font attribute to body
  useEffect(() => {
    document.body.dataset.dyslexicFont = String(isDyslexicFont);
  }, [isDyslexicFont]);


  const handleToggleHighContrastMode = useCallback(() => {
    setIsHighContrastMode(prev => {
        const newState = !prev;
        localStorage.setItem('tableTalkHighContrastMode', JSON.stringify(newState));
        return newState;
    });
  }, []);

  const handleToggleDyslexicFont = useCallback(() => {
    setIsDyslexicFont(prev => {
        const newState = !prev;
        localStorage.setItem('tableTalkDyslexicFont', JSON.stringify(newState));
        return newState;
    });
  }, []);

  const handleJoinTableRequest = useCallback((tableId: string) => {
    setSessionData({ tableId, characterId: null, characterName: null });
  }, []);

  const handleBackToTableSelect = useCallback(() => {
    setSessionData(null);
    setLocalCharacterData(null);
  }, []);

  const { socket, isConnected } = useSocketManager({
    sessionData,
    setSessionData,
    setLocalCharacterData,
    setMessages,
    setAvailableLanguages,
    setDefaultLanguage,
    setCurrentLanguage,
    setIsGMActiveFromServer,
    setPlayerList,
    setSpeakingAs,
    setWhisperTargets,
    currentLanguage,
    defaultLanguageProp: defaultLanguage,
    setHasPendingInvite,
    setTheme,
  });

  useEffect(() => {
    if (sessionData) {
      localStorage.setItem('tableTalkSession', JSON.stringify(sessionData));
    } else {
      localStorage.removeItem('tableTalkSession');
    }
  }, [sessionData]);

  useEffect(() => {
    if (speakingAs) {
      localStorage.setItem('tableTalkSpeakingAs', JSON.stringify(speakingAs));
    } else {
      localStorage.removeItem('tableTalkSpeakingAs');
    }
  }, [speakingAs]);

  useEffect(() => {
    const handleViewportResize = () => {
      if (window.visualViewport) {
        const newHeight = `${window.visualViewport.height}px`;
        document.documentElement.style.setProperty('--visual-viewport-height', newHeight);
        if (focusedElementRef.current) {
          const isKeyboardLikelyOpen = window.visualViewport.height < window.innerHeight * 0.8;
          if (isKeyboardLikelyOpen) {
            setTimeout(() => {
              if (focusedElementRef.current) {
                focusedElementRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
              }
            }, 100);
          }
        }
      }
    };

    if (window.visualViewport) {
      window.visualViewport.addEventListener('resize', handleViewportResize);
      handleViewportResize();
      return () => {
        window.visualViewport?.removeEventListener('resize', handleViewportResize);
        document.documentElement.style.removeProperty('--visual-viewport-height');
      };
    }
  }, []);

  const handleCharacterSubmit = useCallback((details: Omit<CharacterSubmissionPayload, 'tableId'>) => {
    if (socket && isConnected && sessionData?.tableId) {
      socket.emit('submitCharacterDetails', { ...details, tableId: sessionData.tableId });
    }
  }, [socket, isConnected, sessionData]);

  const handleOpenGmManager = useCallback(() => {
    if (socket && localCharacterData?.isGM && sessionData?.tableId) {
        socket.emit('executeCommand', { command: 'manage', args: [], tableId: sessionData.tableId });
        setIsGmManagerOpen(true);
    }
  }, [socket, localCharacterData, sessionData]);

  const handlePlayerLangChanges = useCallback((changes: PlayerLanguageChange[]) => {
    if (!socket || !localCharacterData?.isGM || !sessionData?.tableId) return;
    changes.forEach(change => {
      socket.emit('executeCommand', {
        command: change.command,
        args: [change.playerName, '/', change.language],
        tableId: sessionData.tableId,
      });
    });
  }, [socket, localCharacterData, sessionData]);

  const handleTriggerImport = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleFileImport = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    if (!socket || !localCharacterData?.isGM || !event.target.files || !sessionData?.tableId) return;
    const file = event.target.files[0];
    if (!file) return;
    if (file.type !== 'application/json') {
      alert('Invalid file type. Please select a JSON file (.json) exported from Table Talk.');
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const fileContent = e.target?.result;
        if (typeof fileContent === 'string') {
            const importedState = JSON.parse(fileContent);
            if (importedState && importedState.saveVersion && importedState.charactersData) { // Basic validation
              socket.emit('importGameStateRequest', { ...importedState, tableId: sessionData.tableId });
            } else {
              alert('Invalid game state file format.');
            }
        } else {
            alert('Could not read file content as text.');
        }
      } catch (parseError) {
        console.error('Error parsing imported JSON file:', parseError);
        alert('Could not parse the selected file. Please ensure it is a valid Table Talk JSON export.');
      } finally {
         if (fileInputRef.current) fileInputRef.current.value = "";
      }
    };
    reader.onerror = () => {
      console.error('Error reading imported file.');
      alert('There was an error reading the selected file.');
      if (fileInputRef.current) fileInputRef.current.value = "";
    };
    reader.readAsText(file);
  }, [socket, localCharacterData, sessionData]);

  const handleExportChat = useCallback(() => {
    if (socket && sessionData?.tableId) {
      socket.emit('executeCommand', { command: 'save', args: [], tableId: sessionData.tableId });
    }
  }, [socket, sessionData]);

  const handleExitTable = useCallback(() => {
    if (socket && sessionData?.tableId) {
        socket.emit('leaveTable', { tableId: sessionData.tableId });
    }
    setLocalCharacterData(null);
    setSessionData(null); // This clears tableId, characterId, and characterName
    setMessages([]);
    setHasScrolledInitially(false);
    console.log("Exited to table selection screen. Local session cleared.");
  }, [socket, sessionData]);

  const handleOpenPlayerSettings = () => setIsPlayerSettingsOpen(true);
  const handleClosePlayerSettings = () => setIsPlayerSettingsOpen(false);

  const handleAvatarUpdate = useCallback((avatarFile: File) => {
    if (socket && avatarFile && localCharacterData && sessionData?.tableId) {
      socket.emit('updateAvatar', {
        avatarFile: avatarFile,
        avatarFileName: avatarFile.name,
        avatarMimeType: avatarFile.type,
        tableId: sessionData.tableId,
      });
      handleClosePlayerSettings();
    }
  }, [socket, localCharacterData, sessionData]);

   const sendImageToServer = useCallback((file: File, caption: string): boolean => {
    if (file && socket && localCharacterData && sessionData?.tableId) {
      const allowedTypes = ['image/jpeg', 'image/png', 'image/gif'];
      const maxFileSize = 5 * 1024 * 1024; // 5MB

      if (!allowedTypes.includes(file.type)) {
        alert('Invalid file type. Please select a JPG, PNG, or GIF image.');
        return false;
      }
      if (file.size > maxFileSize) {
        alert('Image file is too large. Please select a file smaller than 5MB.');
        return false;
      }

      socket.emit('sendImage', {
        imageFile: file,
        fileName: file.name,
        mimeType: file.type,
        caption: caption,
        tableId: sessionData.tableId,
      });
      return true;
    }
    return false;
   }, [socket, localCharacterData, sessionData]);

   const handleImageFileSelected = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (!event.target.files) return;
    const file = event.target.files[0];
    if (sendImageToServer(file, inputValue)) {
        setInputValue('');
    }
    if (imageUploadInputRef.current) {
        imageUploadInputRef.current.value = "";
    }
  };

  const handleAttachImageClick = () => {
    imageUploadInputRef.current?.click();
  };

  const handleDragEnter = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault(); e.stopPropagation(); setIsDraggingOver(true);
  }, []);
  const handleDragOver = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault(); e.stopPropagation();
  }, []);
  const handleDragLeave = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault(); e.stopPropagation();
    if (e.currentTarget.contains(e.relatedTarget as Node)) return;
    setIsDraggingOver(false);
  }, []);
  const handleDrop = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault(); e.stopPropagation(); setIsDraggingOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const file = e.dataTransfer.files[0];
      if (sendImageToServer(file, inputValue)) { setInputValue(''); }
      e.dataTransfer.clearData();
    }
  }, [sendImageToServer, inputValue]);

  const handleOpenImageModal = useCallback((imageUrl: string) => {
    setExpandedImageUrl(imageUrl); setIsImageModalOpen(true);
  }, []);
  const handleCloseImageModal = useCallback(() => {
    setIsImageModalOpen(false); setExpandedImageUrl(null);
  }, []);

  useEffect(() => {
    if (!localCharacterData) {
      setHasScrolledInitially(false);
      setHasPendingInvite(false);
    }
  }, [localCharacterData]);

  useEffect(() => {
    if (messages.length > 0 && messagesEndRef.current) {
      const messagesContainer = messagesEndRef.current.parentNode as HTMLElement;
      if (!messagesContainer) return;

      if (!hasScrolledInitially && localCharacterData) {
        messagesEndRef.current.scrollIntoView({ behavior: "instant", block: "end" });
        setHasScrolledInitially(true);
      } else if (hasScrolledInitially) {
        const threshold = 150;
        const userIsNearBottom = messagesContainer.scrollHeight - messagesContainer.scrollTop - messagesContainer.clientHeight < threshold;
        const lastMessage = messages[messages.length - 1];
        const isOwnLastMessage = lastMessage?.sender?.id === localCharacterData?.characterId;

        if (userIsNearBottom || isOwnLastMessage) {
          messagesEndRef.current.scrollIntoView({ behavior: "smooth", block: "end" });
        }
      }
    }
  }, [messages, localCharacterData, hasScrolledInitially]);

  const inWhisperMode = whisperTargets.length > 0;

  const submitMessage = useCallback(() => {
    if (!inputValue.trim() || !socket || !localCharacterData || !sessionData?.tableId) return;
    const input = inputValue.trim();

    if (input.startsWith('/')) {
      const match = input.match(/^\/(\w+)\s*(.*)/);
      if (!match) { setInputValue(''); return; }
      const [, command, rest] = match;
      const args = rest.split(/\s+/).filter(Boolean);
      
      // Clear speakingAs state when /gm command is used
      if (command.toLowerCase() === 'gm') {
        setSpeakingAs(null);
        localStorage.removeItem('tableTalkSpeakingAs');
      }
      
      socket.emit('executeCommand', { command: command.toLowerCase(), args: args, tableId: sessionData.tableId });
      // UI side-effect for GM manage can remain if it's purely client-driven display change
      if ((command.toLowerCase() === 'manage' || command.toLowerCase() === 'who') && localCharacterData.isGM) {
        handleOpenGmManager();
      }
    } else {
      socket.emit('sendMessage', { content: input, language: currentLanguage, tableId: sessionData.tableId });
    }
    setInputValue('');
  }, [socket, inputValue, localCharacterData, currentLanguage, handleOpenGmManager, sessionData]);

  const handleSendMessageForm = useCallback((e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    submitMessage();
  }, [submitMessage]);

  const triggerEmote = useCallback(() => {
    if (inputValue.trim() && socket && sessionData?.tableId) {
      socket.emit('executeCommand', { command: 'emote', args: [inputValue.trim()], tableId: sessionData.tableId });
      setInputValue('');
    }
  }, [socket, inputValue, sessionData]);
  
  const handleWhisperShortcut = () => {
    setInputValue('/w ');
    focusedElementRef.current?.focus();
  };
  const handleRollShortcut = () => {
    setInputValue('/roll ');
    focusedElementRef.current?.focus();
  };
  const handleReplyClick = useCallback(() => {
      if (socket && sessionData?.tableId) {
          socket.emit('executeCommand', { command: 'r', args: [], tableId: sessionData.tableId });
      }
  }, [socket, sessionData]);

  const handleLeaveWhisperClick = useCallback(() => {
    if (socket && sessionData?.tableId) {
        socket.emit('executeCommand', { command: 'all', args: [], tableId: sessionData.tableId });
    }
  }, [socket, sessionData]);

  const handleKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter') {
      if (event.shiftKey) { return; }
      else { event.preventDefault(); if (inputValue.trim()) submitMessage(); }
    } else if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'e') {
      event.preventDefault(); triggerEmote();
    }
  };

  const handleThemeChange = (newTheme: string) => {
    if (socket && sessionData?.tableId) {
        socket.emit('executeCommand', { command: 'settheme', args: [newTheme], tableId: sessionData.tableId });
    }
  };

  if (isAdminView) {
    return (
      <TableAdmin 
        socket={socket} 
        isConnected={isConnected} 
        onBack={() => setIsAdminView(false)} 
      />
    );
  }
  
  if (!sessionData?.tableId) {
    return (
      <TableSelection 
        socket={socket} 
        isConnected={isConnected} 
        onTableSelected={handleJoinTableRequest}
        onEnterAdmin={() => setIsAdminView(true)}
      />
    );
  }

  if (!localCharacterData) {
    return (
      <CharacterCreationForm
        isConnected={isConnected} availableLanguages={availableLanguages}
        isGMActiveFromServer={isGMActiveFromServer} onCharacterSubmit={handleCharacterSubmit}
        defaultLanguage={defaultLanguage} 
        isReconnecting={!!sessionData?.characterId}
        characterName={sessionData?.characterName}
        onBack={handleBackToTableSelect}
      />
    );
  }

  const headerName = speakingAs ? speakingAs : localCharacterData.characterName;
  const headerAvatarUrl = speakingAs ? null : localCharacterData.avatarUrl;

  return (
    <div className={`App chat-active ${isDraggingOver ? 'drag-active' : ''}`}
        onDragEnter={handleDragEnter} onDragOver={handleDragOver}
        onDragLeave={handleDragLeave} onDrop={handleDrop}
    >
      <input type="file" ref={fileInputRef} onChange={handleFileImport} style={{ display: 'none' }} accept=".json"/>
      <input type="file" ref={imageUploadInputRef} onChange={handleImageFileSelected} style={{ display: 'none' }} accept="image/jpeg,image/png,image/gif"/>

      <GMPlayerManager
        show={isGmManagerOpen} players={playerList} availableLanguages={availableLanguages}
        defaultLanguage={defaultLanguage} onClose={() => setIsGmManagerOpen(false)}
        onSaveChanges={handlePlayerLangChanges}
        onWorldLangAdd={(lang) => socket?.emit('executeCommand', { command: 'addlang', args: [lang], tableId: sessionData.tableId })}
        onWorldLangRemove={(lang) => socket?.emit('executeCommand', { command: 'removelang', args: [lang], tableId: sessionData.tableId })}
        onDefaultLangRename={(name) => socket?.emit('executeCommand', { command: 'renamedefault', args: [name], tableId: sessionData.tableId })}
        onExportChat={handleExportChat} onImportChat={handleTriggerImport}
        theme={theme}
        onThemeChange={handleThemeChange}
      />

      {isPlayerSettingsOpen && (
        <PlayerSettings
          isOpen={isPlayerSettingsOpen} onClose={handleClosePlayerSettings}
          onAvatarUpdate={handleAvatarUpdate} currentAvatarUrl={localCharacterData?.avatarUrl}
          isGM={localCharacterData?.isGM || false}
          isHighContrastMode={isHighContrastMode}
          onToggleHighContrastMode={handleToggleHighContrastMode}
          isDyslexicFont={isDyslexicFont}
          onToggleDyslexicFont={handleToggleDyslexicFont}
        />
      )}

      {isImageModalOpen && expandedImageUrl && (
        <div className="image-expansion-modal" onClick={handleCloseImageModal}>
          <img src={expandedImageUrl} alt="Expanded view" onClick={(e) => e.stopPropagation()} />
          <button className="close-image-modal-button" onClick={handleCloseImageModal} aria-label="Close expanded image">&times;</button>
        </div>
      )}

      <header className="app-header">
        <div className="header-top-row">
          <div className="header-left-content">
            <Avatar name={headerName} avatarUrl={headerAvatarUrl} />
            <div className="user-chat-status">
                 <p className="logged-in-status">
                    {headerName}
                    {localCharacterData.isGM && !speakingAs ? " (GM)" : ""}
                 </p>
                 <p className="chat-mode-status">
                    {inWhisperMode
                      ? `Whispering to: ${whisperTargets.filter(t => t.toLowerCase() !== localCharacterData.characterName.toLowerCase()).join(', ')}`
                      : "Public Chat"}
                 </p>
            </div>
          </div>
          <h1 className="app-title">TABLE TALK</h1>
          <div className="header-right-content">
             <div className="header-action-buttons">
              {localCharacterData.isGM && (
                <button className="header-button" onClick={handleOpenGmManager} title="Manage Game">
                  <IconManage />
                  <span>Manage</span>
                </button>
              )}
       
              <button className="header-button icon-only" onClick={handleOpenPlayerSettings} title="Player Settings" aria-label="Player Settings">
                <IconSettings />
              </button>
              <button className="header-button icon-only" onClick={handleExitTable} title="Exit to Table Selection">
                <IconExit />
                
              </button>
            </div>
          </div>
        </div>
      </header>

      <div className="chat-container">
        <div className="messages-list">
          {messages.map(message => (
            <ChatItem
              key={message.itemId} message={message}
              localCharacterData={localCharacterData} defaultLanguage={defaultLanguage}
              onImageClick={handleOpenImageModal}
            />
          ))}
          <div ref={messagesEndRef} />
        </div>

        {(inWhisperMode || hasPendingInvite) && (
          <div className="contextual-actions-container">
            {inWhisperMode ? (
              <button className="contextual-all-button" onClick={handleLeaveWhisperClick}>
                You are in a private conversation. Click to return to public chat ( /all )
              </button>
            ) : (
              <button className="contextual-reply-button" onClick={handleReplyClick}>
                You have a whisper invite! Click to reply ( /r )
              </button>
            )}
          </div>
        )}

        <form className="message-input-form" onSubmit={handleSendMessageForm}>
          <textarea
            value={inputValue} onChange={(e) => setInputValue(e.target.value)} onKeyDown={handleKeyDown}
            placeholder={ inWhisperMode ? "Send a whisper..." : speakingAs ? `Speak as ${speakingAs}...` : "Type message or command (e.g., /roll d20)"}
            aria-label="Message input" autoFocus rows={2}
            onFocus={(e) => focusedElementRef.current = e.target}
            onBlur={() => focusedElementRef.current = null}
          />
          <div className="input-controls-column">
              <select
                className="language-selector" value={currentLanguage}
                onChange={(e) => setCurrentLanguage(e.target.value)} title="Select language" aria-label="Select language"
              >
                {(localCharacterData?.languages || []).map((lang: string) => ( <option key={lang} value={lang}>{lang}</option>))}
              </select>
            
            <div className="action-buttons-group">
                <button type="button" onClick={handleAttachImageClick} className="icon-button" title="Attach Image" aria-label="Attach Image"><IconAttach /></button>
                <button type="button" onClick={handleRollShortcut} className="icon-button" title="Roll Dice" aria-label="Roll Dice"><IconDice /></button>
                <button type="button" onClick={handleWhisperShortcut} className="icon-button" title="Whisper" aria-label="Whisper"><IconWhisper /></button>
            </div>

            <div className="bottom-action-buttons">
              <button type="button" onClick={triggerEmote} disabled={!inputValue.trim()} className="emote-button" title="Emote (Ctrl+E)">Emote</button>
              <button type="submit" disabled={!inputValue.trim()} title="Send message (Enter)">Send</button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}

export default App;
