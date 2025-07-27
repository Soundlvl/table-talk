// client/src/CharacterCreationForm.tsx
import React, { useState, useEffect, useMemo } from 'react';
import './styles.css';
import { CharacterSubmissionPayload } from '../../shared/types';


interface CharacterCreationFormProps {
  isConnected: boolean;
  availableLanguages: string[];
  isGMActiveFromServer: boolean;
  onCharacterSubmit: (details: Omit<CharacterSubmissionPayload, 'tableId'>) => void;
  defaultLanguage: string;
  isReconnecting: boolean;
  characterName?: string | null; // Name for reconnecting display
  onBack: () => void; // Function to go back to table select
}

function CharacterCreationForm({
  isConnected,
  availableLanguages,
  isGMActiveFromServer,
  onCharacterSubmit,
  defaultLanguage,
  isReconnecting,
  characterName: reconnectingCharName,
  onBack
}: CharacterCreationFormProps) {
  const [characterNameInput, setCharacterNameInput] = useState<string>('');
  const [selectedLanguages, setSelectedLanguages] = useState<string[]>([defaultLanguage]);
  const [requestGMStatus, setRequestGMStatus] = useState<boolean>(false);
  // Avatar state is removed as it's handled in App.tsx or via a different flow now
  // const [avatarFile, setAvatarFile] = useState<File | null>(null);
  // const [avatarPreview, setAvatarPreview] = useState<string | null>(null);


  const displayLanguages = useMemo(() => {
    if (!availableLanguages || availableLanguages.length === 0) {
      return [];
    }
    const sortedLangs = [...availableLanguages];
    sortedLangs.sort((a, b) => {
      const aIsDefault = a.toLowerCase() === defaultLanguage.toLowerCase();
      const bIsDefault = b.toLowerCase() === defaultLanguage.toLowerCase();
      if (aIsDefault && !bIsDefault) return -1;
      if (!aIsDefault && bIsDefault) return 1;
      return a.localeCompare(b);
    });
    return sortedLangs;
  }, [availableLanguages, defaultLanguage]);

  useEffect(() => {
    if (requestGMStatus) {
      setSelectedLanguages([...availableLanguages].sort());
    } else {
      setSelectedLanguages(prev => {
        const newLangs = [defaultLanguage];
        const currentNonDefault = prev.filter(lang => lang.toLowerCase() !== defaultLanguage.toLowerCase());
        return Array.from(new Set([...currentNonDefault, ...newLangs])).sort();
      });
    }
  }, [requestGMStatus, availableLanguages, defaultLanguage]);

  useEffect(() => {
      if (!selectedLanguages.includes(defaultLanguage)) {
          setSelectedLanguages(prev => Array.from(new Set([...prev, defaultLanguage])).sort());
      }
  }, [defaultLanguage, selectedLanguages]);

  const handleLanguageChange = (language: string) => {
    if (language.toLowerCase() === defaultLanguage.toLowerCase()) return;
    setSelectedLanguages(prevSelected => {
      const newSelected = prevSelected.includes(language)
        ? prevSelected.filter(lang => lang !== language)
        : [...prevSelected, language];
      return newSelected.sort();
    });
  };



  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const trimmedName = characterNameInput.trim();
    if (trimmedName) {
      const finalSelectedLanguages = requestGMStatus
        ? [...availableLanguages].sort()
        : Array.from(new Set([...selectedLanguages, defaultLanguage])).sort();

      const submissionPayload: Omit<CharacterSubmissionPayload, 'tableId'> = {
        name: trimmedName,
        languages: finalSelectedLanguages,
        isGM: requestGMStatus,
      };
      onCharacterSubmit(submissionPayload);
    }
  };

  return (
    <div className="character-creation-container">
      <header className="app-header">
        <button onClick={onBack} className="header-back-button" title="Back to Table Selection">Back</button>
        <h1 className="app-title">{isReconnecting ? 'Rejoining Session...' : 'Create Your Character'}</h1>
        <div className="header-right-content">
            <p className="connection-status">Status: {isConnected ? 'Connected' : 'Disconnected'}</p>
        </div>
      </header>

      {isReconnecting && isConnected ? (
        <div className="character-creation-form">
          <p style={{ textAlign: 'center', fontStyle: 'italic', padding: '20px' }}>
            Attempting to reconnect as "{reconnectingCharName || 'your character'}"...
          </p>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="character-creation-form">
            <div>
              <label htmlFor="characterName">Character Name:</label>
              <input
                  type="text"
                  id="characterName"
                  value={characterNameInput}
                  onChange={(e) => setCharacterNameInput(e.target.value)}
                  placeholder="Enter your character's name"
                  disabled={!isConnected}
                  required
                  autoFocus
              />
            </div>


            {displayLanguages.length > 1 && (
              <div className="checkbox-list">
                <label>Languages Known:</label>
                <div className="language-grid">
                  {displayLanguages.map(lang => {
                    const isDefault = lang.toLowerCase() === defaultLanguage.toLowerCase();
                    return (
                      <label key={lang} className="checkbox-list-item">
                        <input
                          type="checkbox"
                          value={lang}
                          checked={selectedLanguages.includes(lang) || isDefault}
                          onChange={() => handleLanguageChange(lang)}
                          disabled={!isConnected || requestGMStatus || isDefault}
                        />
                        <span>{lang}</span>
                      </label>
                    );
                  })}
                </div>
              </div>
            )}

            {!isGMActiveFromServer && (
              <div className="gm-checkbox-container">
                  <input
                  type="checkbox"
                  id="gmStatus"
                  checked={requestGMStatus}
                  onChange={(e) => setRequestGMStatus(e.target.checked)}
                  disabled={!isConnected}
                  />
                  <label htmlFor="gmStatus">I am the Game Master (GM)</label>
              </div>
            )}

            <button type="submit" disabled={!isConnected || !characterNameInput.trim()}>
              Join Chat
            </button>
        </form>
      )}
    </div>
  );
}

export default CharacterCreationForm;