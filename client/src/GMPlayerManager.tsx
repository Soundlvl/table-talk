// client/src/GMPlayerManager.tsx
import React, { useState, useEffect, useMemo } from 'react';
import './styles.css';
import { Player, PlayerLanguageChange } from '../../shared/types'; // Import shared types

interface GMPlayerManagerProps {
  players: Player[];
  availableLanguages: string[];
  defaultLanguage: string;
  onClose: () => void;
  onSaveChanges: (changes: PlayerLanguageChange[]) => void;
  show: boolean;
  onWorldLangAdd: (lang: string) => void;
  onWorldLangRemove: (lang: string) => void;
  onDefaultLangRename: (name: string) => void;
  onExportChat: () => void;
  onImportChat: () => void;
  theme: string;
  onThemeChange: (theme: string) => void;
}

interface InitialStateType {
  players: Player[];
  availableLanguages: string[];
  defaultLanguage: string;
}

const deepCopy = <T extends object>(item: T): T => JSON.parse(JSON.stringify(item));

function GMPlayerManager({
  players,
  availableLanguages,
  defaultLanguage,
  onClose,
  onSaveChanges,
  show,
  onWorldLangAdd,
  onWorldLangRemove,
  onDefaultLangRename,
  onExportChat,
  onImportChat,
  theme,
  onThemeChange,
}: GMPlayerManagerProps) {
  const [stagedPlayers, setStagedPlayers] = useState<Player[]>([]);
  const [stagedWorldLanguages, setStagedWorldLanguages] = useState<string[]>([]);
  const [stagedDefaultLanguage, setStagedDefaultLanguage] = useState<string>('');
  const [stagedNewLanguageInput, setStagedNewLanguageInput] = useState<string>('');
  const [stagedRenameDefaultInput, setStagedRenameDefaultInput] = useState<string>('');
  const [initialState, setInitialState] = useState<InitialStateType | null>(null);

  useEffect(() => {
    if (show) {
      const initial: InitialStateType = {
        players: deepCopy(players),
        availableLanguages: deepCopy(availableLanguages),
        defaultLanguage: defaultLanguage,
      };
      setInitialState(initial);
      setStagedPlayers(deepCopy(initial.players));
      setStagedWorldLanguages(deepCopy(initial.availableLanguages));
      setStagedDefaultLanguage(initial.defaultLanguage);
      setStagedRenameDefaultInput(initial.defaultLanguage);
      setStagedNewLanguageInput('');
    } else {
      setInitialState(null);
    }
  }, [show, players, availableLanguages, defaultLanguage]);

  const handleStageRenameDefaultSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const newNameTrimmed = stagedRenameDefaultInput.trim();
    if (!newNameTrimmed) {
      alert("Default language name cannot be empty.");
      setStagedRenameDefaultInput(stagedDefaultLanguage);
      return;
    }
    if (newNameTrimmed.toLowerCase() === stagedDefaultLanguage.toLowerCase()) return;

    const oldDefaultLowerCase = stagedDefaultLanguage.toLowerCase();
    if (stagedWorldLanguages.some(lang => lang.toLowerCase() === newNameTrimmed.toLowerCase() && lang.toLowerCase() !== oldDefaultLowerCase)) {
      alert(`Language "${newNameTrimmed}" already exists. Choose a different name.`);
      setStagedRenameDefaultInput(stagedDefaultLanguage);
      return;
    }

    setStagedWorldLanguages(prevLangs =>
      prevLangs.map(lang => lang.toLowerCase() === oldDefaultLowerCase ? newNameTrimmed : lang)
    );
    setStagedDefaultLanguage(newNameTrimmed);
  };

  const handleStageAddLanguageSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const langToAddTrimmed = stagedNewLanguageInput.trim();
    if (!langToAddTrimmed) {
      alert("Language name cannot be empty.");
      return;
    }
    if (stagedWorldLanguages.some(l => l.toLowerCase() === langToAddTrimmed.toLowerCase())) {
      alert(`Language "${langToAddTrimmed}" already exists or is staged for addition.`);
      return;
    }
    setStagedWorldLanguages(prev => [...prev, langToAddTrimmed]);
    setStagedNewLanguageInput('');
  };

  const handleStageRemoveLanguage = (langToRemove: string) => {
    if (langToRemove.toLowerCase() === stagedDefaultLanguage.toLowerCase()) {
      alert(`Cannot remove the current default language "${stagedDefaultLanguage}". Rename it first if necessary.`);
      return;
    }
    setStagedWorldLanguages(prev => prev.filter(l => l.toLowerCase() !== langToRemove.toLowerCase()));
  };

  const handlePlayerLanguageChange = (playerId: string, language: string, isKnown: boolean) => {
    setStagedPlayers(currentStagedPlayers => currentStagedPlayers.map(player => {
        if (player.id === playerId) {
            const languagesSet = new Set(player.languages);
            if (isKnown) {
                languagesSet.add(language);
            } else {
                if (language.toLowerCase() !== stagedDefaultLanguage.toLowerCase()) {
                    languagesSet.delete(language);
                }
            }
            return { ...player, languages: [...languagesSet].sort() };
        }
        return player;
    }));
  };

  const areChangesStaged = useMemo(() => {
    if (!initialState) return false;
    if (stagedDefaultLanguage.toLowerCase() !== initialState.defaultLanguage.toLowerCase()) return true;

    const initialWorldLangsSet = new Set(initialState.availableLanguages.map(l => l.toLowerCase()));
    const stagedWorldLangsSet = new Set(stagedWorldLanguages.map(l => l.toLowerCase()));
    if (initialWorldLangsSet.size !== stagedWorldLangsSet.size ||
        ![...initialWorldLangsSet].every(lang => stagedWorldLangsSet.has(lang)) ||
        ![...stagedWorldLangsSet].every(lang => initialWorldLangsSet.has(lang))) return true;

    const initialPlayerLangs = initialState.players
        .map(p => ({ id: p.id, languages: [...new Set(p.languages.map(l => l.toLowerCase()))].sort() }))
        .sort((a,b) => a.id.localeCompare(b.id));
    const stagedPlayerLangs = stagedPlayers
        .map(p => ({ id: p.id, languages: [...new Set(p.languages.map(l => l.toLowerCase()))].sort() }))
        .sort((a,b) => a.id.localeCompare(b.id));
    if (JSON.stringify(stagedPlayerLangs) !== JSON.stringify(initialPlayerLangs)) return true;

    return false;
  }, [initialState, stagedPlayers, stagedWorldLanguages, stagedDefaultLanguage]);

  const handleCommitAllChanges = () => {
    if (!initialState) return;

    if (stagedDefaultLanguage.toLowerCase() !== initialState.defaultLanguage.toLowerCase()) {
      onDefaultLangRename(stagedDefaultLanguage);
    }

    const initialLangsLower = initialState.availableLanguages.map(l => l.toLowerCase());
    stagedWorldLanguages.forEach(lang => {
        if (!initialLangsLower.includes(lang.toLowerCase())) onWorldLangAdd(lang);
    });
    initialState.availableLanguages.forEach(lang => {
      const wasOldDefaultAndRenamed = lang.toLowerCase() === initialState.defaultLanguage.toLowerCase() &&
                                      stagedDefaultLanguage.toLowerCase() !== initialState.defaultLanguage.toLowerCase();
      if (!wasOldDefaultAndRenamed && !stagedWorldLanguages.some(sl => sl.toLowerCase() === lang.toLowerCase())) {
        onWorldLangRemove(lang);
      }
    });

    const playerChangesToCommit: PlayerLanguageChange[] = [];
    initialState.players.forEach(originalPlayer => {
      const stagedPlayer = stagedPlayers.find(p => p.id === originalPlayer.id);
      if (!stagedPlayer) return;
      const originalLangs = new Set(originalPlayer.languages.map(l => l.toLowerCase()));
      stagedPlayer.languages.forEach(lang => {
        if (!originalLangs.has(lang.toLowerCase())) {
          playerChangesToCommit.push({ playerName: stagedPlayer.name, command: 'givelang', language: lang });
        }
      });
      originalPlayer.languages.forEach(lang => {
        if (lang.toLowerCase() !== stagedDefaultLanguage.toLowerCase() &&
            !stagedPlayer.languages.some(sl => sl.toLowerCase() === lang.toLowerCase())) {
          playerChangesToCommit.push({ playerName: originalPlayer.name, command: 'takelang', language: lang });
        }
      });
    });
    if (playerChangesToCommit.length > 0) onSaveChanges(playerChangesToCommit);

    onClose();
  };

  if (!show || !initialState) return null;

  const sortedDisplayLanguages = [...stagedWorldLanguages].sort((a, b) => {
    const aIsDefault = a.toLowerCase() === stagedDefaultLanguage.toLowerCase();
    const bIsDefault = b.toLowerCase() === stagedDefaultLanguage.toLowerCase();
    if (aIsDefault && !bIsDefault) return -1;
    if (!aIsDefault && bIsDefault) return 1;
    return a.localeCompare(b);
  });

  return (
    <div className="modal-backdrop" onClick={onClose} role="dialog" aria-modal="true" aria-labelledby="gmDashboardTitle">
      <div className="modal-content gm-player-manager-modal" onClick={(e) => e.stopPropagation()}>
        <h2 id="gmDashboardTitle">Game Master Dashboard</h2>

        <div className="gm-dashboard-section world-language-manager">
          <h3>Manage World Languages</h3>
          <form onSubmit={handleStageRenameDefaultSubmit} className="gm-form rename-default-lang-form">
            <label htmlFor="renameDefaultInput" className="form-label">Default Language:</label>
            <div className="form-input-group">
              <input id="renameDefaultInput" type="text" value={stagedRenameDefaultInput} onChange={(e) => setStagedRenameDefaultInput(e.target.value)} />
              <button type="submit" title="Stage rename of default language">Rename</button>
            </div>
            {stagedDefaultLanguage.toLowerCase() !== stagedRenameDefaultInput.trim().toLowerCase() && stagedRenameDefaultInput.trim() && <p className="staging-note">Staged rename to: "{stagedRenameDefaultInput.trim()}"</p>}
          </form>
          <form onSubmit={handleStageAddLanguageSubmit} className="gm-form add-language-form">
            <label htmlFor="newLanguageInput" className="form-label">Add New Language:</label>
            <div className="form-input-group">
              <input id="newLanguageInput" type="text" value={stagedNewLanguageInput} onChange={(e) => setStagedNewLanguageInput(e.target.value)} placeholder="Enter new language name" />
              <button type="submit" title="Stage addition of new language">Add</button>
            </div>
          </form>
          <label className="form-label">Available Languages:</label>
          <ul className="world-language-list">
            {sortedDisplayLanguages.map(lang => {
              const isDefault = lang.toLowerCase() === stagedDefaultLanguage.toLowerCase();
              return (
                <li key={lang} className={isDefault ? 'default-language-item' : ''}>
                  <span>{lang} {isDefault && '(Default)'}</span>
                  {!isDefault && (<button onClick={() => handleStageRemoveLanguage(lang)} className="remove-lang-button" title={`Stage removal of ${lang}`} aria-label={`Stage removal of ${lang} from world languages`}>&times;</button>)}
                </li>
              );
            })}
          </ul>
        </div>
        
        <div className="gm-dashboard-section theme-manager">
          <h3>Table Theme</h3>
          <div className="gm-form">
              <label htmlFor="themeSelector" className="form-label">Select a visual theme for all players:</label>
              <select 
                  id="themeSelector"
                  className="theme-selector-dropdown"
                  value={theme}
                  onChange={(e) => onThemeChange(e.target.value)}
              >
                  <option value="fantasy">Fantasy</option>
                  <option value="sci-fi">Sci-Fi</option>
              </select>
          </div>
        </div>

        <div className="gm-dashboard-section player-language-manager">
            <h3>Manage Player Languages</h3>
            {stagedPlayers.filter(player => !player.isGM).length > 0 ? (
              <div className="player-list">
                {stagedPlayers.map(player => (
                  !player.isGM && (
                    <div key={player.id} className="player-manage-card">
                      <h4>{player.name}</h4>
                      <div className="language-grid">
                        {sortedDisplayLanguages.map(lang => {
                          if (lang.toLowerCase() === stagedDefaultLanguage.toLowerCase()) return null;
                          return (
                            <label key={lang} className="gm-language-checkbox">
                              <input type="checkbox" checked={player.languages.some(l => l.toLowerCase() === lang.toLowerCase())} onChange={(e) => handlePlayerLanguageChange(player.id, lang, e.target.checked)} aria-labelledby={`lang-label-${player.id}-${lang.replace(/\s+/g, '-')}`}/>
                              <span id={`lang-label-${player.id}-${lang.replace(/\s+/g, '-')}`}>{lang}</span>
                            </label>
                          );
                        })}
                      </div>
                    </div>
                  )
                ))}
              </div>
            ) : <p>No players to manage yet.</p>}
        </div>

        <div className="modal-actions">
          <button onClick={onImportChat} className="button-secondary" title="Import a previously exported chat log">Import Chat</button>
          <button onClick={onExportChat} className="button-secondary" title="Export the current chat log and game state">Export Chat</button>
          <button onClick={handleCommitAllChanges} className="button-primary save-player-changes-button" disabled={!areChangesStaged} title={areChangesStaged ? "Commit all staged changes to server" : "No changes staged"}>Save All GM Changes</button>
          <button onClick={onClose} className="button-primary">Close</button>
        </div>
      </div>
    </div>
  );
}

export default GMPlayerManager;