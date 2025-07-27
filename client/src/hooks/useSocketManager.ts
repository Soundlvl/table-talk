// client/src/hooks/useSocketManager.ts
import { useState, useEffect, useRef } from 'react';
import io, { Socket } from 'socket.io-client';
import { SOCKET_SERVER_URL } from '../config';
import { UseSocketManagerOptions, SocketEventHandlers } from '../types'; // Import client-specific types
import { ClientCharacterData, WhisperTarget } from '../../../shared/types'; // Import shared types


function useSocketManager(props: UseSocketManagerOptions): { socket: Socket | null; isConnected: boolean } {
  const { sessionData } = props;
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState<boolean>(false);

  // Use a ref to hold all props. This allows event handlers to access the
  // latest props without needing to be re-defined, which would cause the socket
  // to be recreated on every prop change.
  const propsRef = useRef(props);
  useEffect(() => {
    propsRef.current = props;
  });

  // This effect runs only once on mount to create the socket and set up all event listeners.
  // This is the core of the refactor: listeners are set up once and for all.
  useEffect(() => {
    const newSocket: Socket = io(SOCKET_SERVER_URL, {
      reconnectionAttempts: 5,
    });
    setSocket(newSocket);

    // All event handlers are defined here. They use propsRef.current to get the latest
    // state and setters, avoiding stale closure problems.
    const eventHandlers: SocketEventHandlers = {
      onConnect: () => {
        setIsConnected(true);
        console.log(`[Socket] Connected: ${newSocket.id}`);
        // The joinTable event is now handled exclusively by the useEffect hook below
        // to prevent a race condition on reconnects where it might be emitted twice.
      },
      onDisconnect: () => setIsConnected(false),
      onTableJoined: (data) => {
        const { setAvailableLanguages, setDefaultLanguage, setCurrentLanguage, currentLanguage, setIsGMActiveFromServer, sessionData, setTheme } = propsRef.current;
        console.log(`[Socket] Successfully joined table '${data.tableId}'`);
        if (data.theme) setTheme(data.theme);
        if (data.availableLanguages) setAvailableLanguages(data.availableLanguages);
        if (data.defaultLanguage) {
          setDefaultLanguage(data.defaultLanguage);
          if (!currentLanguage || !data.availableLanguages?.includes(currentLanguage)) {
               setCurrentLanguage(data.defaultLanguage);
          }
        }
        if (typeof data.isGMActive === 'boolean') setIsGMActiveFromServer(data.isGMActive);
        
        if (sessionData?.characterId) {
            console.log(`[Socket] Attempting to reconnect character '${sessionData.characterId}' to table '${data.tableId}'`);
            newSocket.emit('reconnectCharacter', { 
                tableId: data.tableId, 
                characterId: sessionData.characterId 
            });
        }
      },
      onTableNotFound: () => {
          alert('The requested table was not found. It may have been deleted or never existed.');
          propsRef.current.setSessionData(null);
      },
      onCharacterDetailsConfirmed: (confirmedDetails) => {
        const { setWhisperTargets, setLocalCharacterData, setSessionData, setCurrentLanguage, defaultLanguageProp, currentLanguage, sessionData, setHasPendingInvite } = propsRef.current;
        let uiWhisperTargets: string[] = [];
        if (confirmedDetails.whisperTargets && Array.isArray(confirmedDetails.whisperTargets)) {
            const selfId = confirmedDetails.characterId;
            uiWhisperTargets = confirmedDetails.whisperTargets
                .filter((target: WhisperTarget) => target.id !== selfId)
                .map((target: WhisperTarget) => target.name);
        }
        setWhisperTargets(uiWhisperTargets);

        const localData: ClientCharacterData = {
            characterId: confirmedDetails.characterId,
            characterName: confirmedDetails.characterName,
            languages: confirmedDetails.languages,
            isGM: confirmedDetails.isGM,
            avatarUrl: confirmedDetails.avatarUrl,
            hasPendingInvites: confirmedDetails.hasPendingInvites
        };
        setLocalCharacterData(localData);
        setHasPendingInvite(confirmedDetails.hasPendingInvites || false);
        
        const currentTableId = sessionData?.tableId;
        if (currentTableId) {
            setSessionData(prev => {
                if (prev && prev.tableId === currentTableId && prev.characterId === confirmedDetails.characterId && prev.characterName === confirmedDetails.characterName) {
                    return prev;
                }
                return {
                    tableId: currentTableId,
                    characterId: confirmedDetails.characterId,
                    characterName: confirmedDetails.characterName,
                };
            });
        }

        if (!confirmedDetails.languages.includes(currentLanguage)) {
          setCurrentLanguage(confirmedDetails.languages.includes(defaultLanguageProp) ? defaultLanguageProp : (confirmedDetails.languages[0] || ''));
        }
      },
      onCharacterNameRejected: () => {
        const { setSessionData, setLocalCharacterData } = propsRef.current;
        alert(`The chosen name is already in use on this table. Please choose a different name.`);
        setSessionData(prev => prev ? ({ ...prev, characterId: null, characterName: null }) : null);
        setLocalCharacterData(null);
      },
      onReconnectFailed: () => {
        const { setSessionData, setLocalCharacterData } = propsRef.current;
        alert("Your previous session could not be found. Please create a new character.");
        setSessionData(prev => prev ? ({ ...prev, characterId: null, characterName: null }) : null);
        setLocalCharacterData(null);
      },
      onChatHistory: (data) => {
        if (data.history) propsRef.current.setMessages(data.history);
      },
      onNewMessage: (message) => {
        propsRef.current.setMessages(prev => [...prev, message]);
      },
      onGmStatusUpdate: (data) => {
        propsRef.current.setIsGMActiveFromServer(data.isGMActive);
      },
      onLanguageListUpdate: (data) => {
        const { setAvailableLanguages, setDefaultLanguage } = propsRef.current;
        if (data.languages) setAvailableLanguages(data.languages);
        if (data.defaultLanguage) setDefaultLanguage(data.defaultLanguage);
      },
      onPlayerListUpdate: (data) => {
        propsRef.current.setPlayerList(data.players);
      },
      onPersonaUpdate: (data) => {
        propsRef.current.setSpeakingAs(data.speakingAs);
      },
      onWhisperModeUpdate: (data) => {
        propsRef.current.setWhisperTargets(data.targets || []);
      },
      onGameStateExport: (gameState) => {
        if (!gameState) {
          console.error('No game state received for export.');
          alert('Error: No game state received for export.');
          return;
        }
        try {
          const jsonString = JSON.stringify(gameState, null, 2);
          const blob = new Blob([jsonString], { type: 'application/json' });
          const href = URL.createObjectURL(blob);
          const link = document.createElement('a');
          link.href = href;
          link.download = `table-talk-session-${Date.now()}.json`;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          URL.revokeObjectURL(href);
        } catch (error) {
          console.error('Error exporting game state:', error);
          alert('Error exporting game state.');
        }
      },
      onSessionReloading: () => {
        const { setSessionData, setLocalCharacterData, setMessages } = propsRef.current;
        alert("The game session is being reloaded by the GM. You will be returned to character creation.");
        setSessionData(prev => prev ? ({ ...prev, characterId: null, characterName: null }) : null);
        setLocalCharacterData(null);
        setMessages([]);
      },
      onImportGameStateSucceeded: () => {
        alert("Game state imported successfully! All players will need to rejoin.");
      },
      onImportGameStateFailed: (data) => {
        alert(`Game state import failed: ${data.error || 'Unknown error.'}`);
      },
      onPlayerAvatarChanged: ({ characterId, newAvatarUrl }) => {
        const { setMessages, setPlayerList, setLocalCharacterData } = propsRef.current;
        setMessages(prevMessages =>
          prevMessages.map(msg => (msg.sender && msg.sender.id === characterId) ? { ...msg, sender: { ...msg.sender, avatarUrl: newAvatarUrl } } : msg)
        );
        setPlayerList(prevList =>
          prevList.map(player => (player.id === characterId) ? { ...player, avatarUrl: newAvatarUrl } : player)
        );
        setLocalCharacterData(prev => {
          if (prev && prev.characterId === characterId) {
            return { ...prev, avatarUrl: newAvatarUrl };
          }
          return prev;
        });
      },
      onThemeChanged: (data) => {
        propsRef.current.setTheme(data.theme);
      }
    };

    // Register all listeners with the new socket instance.
    newSocket.on('connect', eventHandlers.onConnect);
    newSocket.on('disconnect', eventHandlers.onDisconnect);
    newSocket.on('tableJoined', eventHandlers.onTableJoined);
    newSocket.on('tableNotFound', eventHandlers.onTableNotFound);
    newSocket.on('characterDetailsConfirmed', eventHandlers.onCharacterDetailsConfirmed);
    newSocket.on('characterNameRejected', eventHandlers.onCharacterNameRejected);
    newSocket.on('reconnectFailed', eventHandlers.onReconnectFailed);
    newSocket.on('chatHistory', eventHandlers.onChatHistory);
    newSocket.on('newMessage', eventHandlers.onNewMessage);
    newSocket.on('gmStatusUpdate', eventHandlers.onGmStatusUpdate);
    newSocket.on('languageListUpdate', eventHandlers.onLanguageListUpdate);
    newSocket.on('playerListUpdate', eventHandlers.onPlayerListUpdate);
    newSocket.on('personaUpdate', eventHandlers.onPersonaUpdate);
    newSocket.on('whisperModeUpdate', eventHandlers.onWhisperModeUpdate);
    newSocket.on('gameStateExport', eventHandlers.onGameStateExport);
    newSocket.on('sessionReloading', eventHandlers.onSessionReloading);
    newSocket.on('importGameStateSucceeded', eventHandlers.onImportGameStateSucceeded);
    newSocket.on('importGameStateFailed', eventHandlers.onImportGameStateFailed);
    newSocket.on('playerAvatarChanged', eventHandlers.onPlayerAvatarChanged);
    newSocket.on('themeChanged', eventHandlers.onThemeChanged);

    // This is the cleanup function that runs when the component unmounts.
    return () => {
      console.log("[Socket] Cleaning up socket connection.");
      // It's good practice to remove all listeners to prevent memory leaks.
      newSocket.off('connect', eventHandlers.onConnect);
      newSocket.off('disconnect', eventHandlers.onDisconnect);
      newSocket.off('tableJoined', eventHandlers.onTableJoined);
      newSocket.off('tableNotFound', eventHandlers.onTableNotFound);
      newSocket.off('characterDetailsConfirmed', eventHandlers.onCharacterDetailsConfirmed);
      newSocket.off('characterNameRejected', eventHandlers.onCharacterNameRejected);
      newSocket.off('reconnectFailed', eventHandlers.onReconnectFailed);
      newSocket.off('chatHistory', eventHandlers.onChatHistory);
      newSocket.off('newMessage', eventHandlers.onNewMessage);
      newSocket.off('gmStatusUpdate', eventHandlers.onGmStatusUpdate);
      newSocket.off('languageListUpdate', eventHandlers.onLanguageListUpdate);
      newSocket.off('playerListUpdate', eventHandlers.onPlayerListUpdate);
      newSocket.off('personaUpdate', eventHandlers.onPersonaUpdate);
      newSocket.off('whisperModeUpdate', eventHandlers.onWhisperModeUpdate);
      newSocket.off('gameStateExport', eventHandlers.onGameStateExport);
      newSocket.off('sessionReloading', eventHandlers.onSessionReloading);
      newSocket.off('importGameStateSucceeded', eventHandlers.onImportGameStateSucceeded);
      newSocket.off('importGameStateFailed', eventHandlers.onImportGameStateFailed);
      newSocket.off('playerAvatarChanged', eventHandlers.onPlayerAvatarChanged);
      newSocket.off('themeChanged', eventHandlers.onThemeChanged);
      
      newSocket.disconnect();
    };
  }, []); // <-- Empty dependency array ensures this effect runs only once on mount.

  // This separate effect handles emitting the 'joinTable' event when the tableId changes.
  // It is now the single source of truth for joining a table.
  useEffect(() => {
    if (socket && sessionData?.tableId) {
      console.log(`[Socket] 'sessionData.tableId' changed, emitting 'joinTable' for ${sessionData.tableId}`);
      socket.emit('joinTable', { tableId: sessionData.tableId });
    }
  }, [socket, sessionData?.tableId]); // This effect runs only when socket or tableId changes.

  return { socket, isConnected };
}

export default useSocketManager;