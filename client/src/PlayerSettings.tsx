// client/src/PlayerSettings.tsx
import React, { useState, useRef, useEffect } from 'react';
import './styles.css';
import { SOCKET_SERVER_URL } from './config';
import { generalCommands, gmOnlyCommands } from './constants';

interface PlayerSettingsProps {
  isOpen: boolean;
  onClose: () => void;
  onAvatarUpdate: (avatarFile: File) => void;
  currentAvatarUrl: string | null | undefined;
  isGM: boolean;
  isHighContrastMode: boolean;
  onToggleHighContrastMode: () => void;
  isDyslexicFont: boolean;
  onToggleDyslexicFont: () => void;
}


function PlayerSettings({ isOpen, onClose, onAvatarUpdate, currentAvatarUrl, isGM, isHighContrastMode, onToggleHighContrastMode, isDyslexicFont, onToggleDyslexicFont }: PlayerSettingsProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (currentAvatarUrl) {
      setPreviewUrl(currentAvatarUrl.startsWith('http') ? currentAvatarUrl : `${SOCKET_SERVER_URL}${currentAvatarUrl}`);
    } else {
      setPreviewUrl(null);
    }
    setSelectedFile(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }, [isOpen, currentAvatarUrl]);


  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (!event.target.files) return;
    const file = event.target.files[0];
    if (file) {
      const maxFileSize = 5 * 1024 * 1024; // 5MB limit
      if (file.size > maxFileSize) {
        alert("Image is too large. Please select a file smaller than 5MB.");
        if (fileInputRef.current) fileInputRef.current.value = "";
        return;
      }
      const allowedTypes = ['image/jpeg', 'image/png', 'image/gif'];
      if (!allowedTypes.includes(file.type)) {
        alert("Invalid file type. Please select a JPG, PNG, or GIF image.");
        if (fileInputRef.current) fileInputRef.current.value = "";
        return;
      }
      setSelectedFile(file);
      setPreviewUrl(URL.createObjectURL(file));
    }
  };

  const handleSubmitAvatar = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (selectedFile) {
      onAvatarUpdate(selectedFile);
    }
  };

  useEffect(() => {
    const currentPreview = previewUrl; // Capture value for cleanup
    return () => {
      if (currentPreview && currentPreview.startsWith('blob:')) {
        URL.revokeObjectURL(currentPreview);
      }
    };
  }, [previewUrl]);

  if (!isOpen) return null;

  return (
    <div className="modal-backdrop" onClick={onClose} role="dialog" aria-modal="true" aria-labelledby="playerSettingsTitle">
      <div className="modal-content player-settings-modal" onClick={(e) => e.stopPropagation()}>
        <h2 id="playerSettingsTitle">Player Settings</h2>

        <div className="player-settings-section avatar-settings-section">
          <h3>Update Avatar</h3>
          <form onSubmit={handleSubmitAvatar}>
            <div className="avatar-update-preview-container">
              {previewUrl ? (
                <img src={previewUrl} alt="Avatar Preview" className="avatar-update-preview" />
              ) : (
                <div className="avatar-update-preview-placeholder">No Image</div>
              )}
            </div>
            <div>
              <label htmlFor="avatar-upload-input">Choose new avatar image (max 5MB, JPG/PNG/GIF):</label>
              <input
                type="file"
                id="avatar-upload-input"
                ref={fileInputRef}
                accept="image/jpeg,image/png,image/gif"
                onChange={handleFileChange}
              />
            </div>
            <div className="modal-actions avatar-actions">
              <button
                type="submit"
                className="button-primary"
                disabled={!selectedFile}
                title={!selectedFile ? "Select a new image file to enable update" : "Update your avatar"}
              >
                Update Avatar
              </button>
            </div>
          </form>
        </div>

       
        <div className="player-settings-section command-list-section">
          <h3>Available Commands</h3>
          <h4>General Commands</h4>
          <ul className="command-list">
            {generalCommands.map(c => (
              <li key={c.cmd}>
                <code>{c.cmd}{c.alias && ` (or ${c.alias})`}</code> - {c.desc} {c.docLink && <a href={c.docLink} target="_blank" rel="noopener noreferrer">More Notation</a>}
              </li>
            ))}
          </ul>
          {isGM && (
            <>
              <h4>GM Only Commands</h4>
              <ul className="command-list">
                {gmOnlyCommands.map(c => (
                  <li key={c.cmd}>
                    <code>{c.cmd}{c.alias && ` (or ${c.alias})`}</code> - {c.desc}
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
 <div className="player-settings-section accessibility-settings-section">
          <h3>Accessibility</h3>
          <div className="gm-checkbox-container">
              <input
              type="checkbox"
              id="highContrastMode"
              checked={isHighContrastMode}
              onChange={onToggleHighContrastMode}
              />
              <label htmlFor="highContrastMode">Enable High Contrast Mode</label>
          </div>
          <div className="gm-checkbox-container">
              <input
              type="checkbox"
              id="dyslexicFont"
              checked={isDyslexicFont}
              onChange={onToggleDyslexicFont}
              />
              <label htmlFor="dyslexicFont">Use OpenDyslexic Font</label>
          </div>
        </div>

        <div className="modal-actions main-modal-actions">
          <button type="button" onClick={onClose} className="button-secondary">
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

export default PlayerSettings;
