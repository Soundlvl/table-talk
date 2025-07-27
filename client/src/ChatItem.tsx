// client/src/ChatItem.tsx

import React from 'react';
import Avatar from './Avatar';
import { getScrambledRunicText, nameToHslColor } from './utils';
import { SOCKET_SERVER_URL } from './config';
import { Message, ClientCharacterData, ImageMessagePayload, ChatMessagePayload, EmoteMessagePayload, SystemNotificationPayload, DiceRollMessagePayload, WhisperTarget } from '../../shared/types';

interface ChatItemProps {
  message: Message;
  localCharacterData: ClientCharacterData | null; // Can be null if data hasn't loaded
  defaultLanguage: string;
  onImageClick: (imageUrl: string) => void;
}

// Helper to format a list of names grammatically.
const formatNameList = (names: string[]): string => {
    if (!names || names.length === 0) return '';
    if (names.length === 1) return names[0];
    if (names.length === 2) return names.join(' and ');
    return `${names.slice(0, -1).join(', ')}, and ${names[names.length - 1]}`;
};

/**
 * Generates a string describing the recipients of a whisper, from the perspective of a recipient or observer.
 * @param to The array of all whisper targets in the channel.
 * @param localCharacterId The ID of the local user.
 * @param senderId The ID of the message sender.
 * @returns A formatted string like "you", "you and Bob", or "Alice and Bob".
 */
const getWhisperRecipientString = (to: WhisperTarget[], localCharacterId: string, senderId: string): string => {
  // Get all recipients, excluding the sender.
  const actualRecipients = (to || []).filter(t => t.id !== senderId);

  // Check if the local user is a recipient.
  const isLocalUserRecipient = actualRecipients.some(t => t.id === localCharacterId);

  let displayNames: string[];

  if (isLocalUserRecipient) {
    // User is a recipient: create list with "you".
    const otherRecipientNames = actualRecipients
        .filter(t => t.id !== localCharacterId)
        .map(t => t.name)
        .filter(Boolean); // filter out potential null/undefined names
    displayNames = ['you', ...otherRecipientNames];
  } else {
    // User is an observer: list all actual recipients.
    displayNames = actualRecipients.map(t => t.name).filter(Boolean);
  }

  // Handle case where someone whispers to themselves and an observer sees it.
  if (displayNames.length === 0) {
      const selfRecipient = to.find(t => t.id === senderId);
      // Observer sees the recipient's name.
      return selfRecipient ? selfRecipient.name : "themselves";
  }

  return formatNameList(displayNames);
};


const ChatItem: React.FC<ChatItemProps> = ({ message, localCharacterData, defaultLanguage, onImageClick }) => {
  const { itemType, sender, payload, timestamp, isWhisper, direction } = message;

  if (!localCharacterData) {
     return <div className="message-item message-system">Loading message...</div>;
  }
  const isOwnMessage = !!(sender && localCharacterData && sender.id === localCharacterData.characterId);
  const time = new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const senderDisplayName = sender.name || 'Unknown';


  switch (itemType) {
    case 'CHAT_MESSAGE': {
      const chatPayload = payload as ChatMessagePayload;
      const { to = [], originalRecipientNameForGMView, isObfuscated, content, language } = chatPayload;

      if (isWhisper) {
          let prefix = '';
          let wrapperClass = 'center-message-wrapper';
          let showAvatarForOther = false;

          switch (direction) {
            case 'SENT': {
              const recipientNames = (to || []).filter(t => t.id !== localCharacterData.characterId).map(t => t.name);
              const displayRecipients = formatNameList(recipientNames);
              prefix = `You whisper to ${displayRecipients || 'yourself'}:`;
              wrapperClass = 'own-message-wrapper';
              break;
            }
            case 'RECEIVED': {
              const recipientString = getWhisperRecipientString(to, localCharacterData.characterId, sender.id);
              if (localCharacterData.isGM && originalRecipientNameForGMView) {
                prefix = `${sender.name} whispers to ${originalRecipientNameForGMView} (you):`;
              } else {
                prefix = `${sender.name} whispers to ${recipientString}:`;
              }
              wrapperClass = 'other-message-wrapper';
              showAvatarForOther = !sender.isNPC && !!sender.name;
              break;
            }
            case 'OBSERVED': {
              const recipientString = getWhisperRecipientString(to, localCharacterData.characterId, sender.id);
              prefix = `(Observed) ${sender.name} whispers to ${recipientString}:`;
              wrapperClass = 'center-message-wrapper';
              showAvatarForOther = false; // Never show avatar for observed messages
              break;
            }
          }

          return (
            <div className={`message-wrapper new-message-animation ${wrapperClass}`}>
              {showAvatarForOther && <Avatar name={sender.name || ''} avatarUrl={sender.avatarUrl} />}
              <div className="message-item message-whisper">
                  <span className="whisper-prefix">{prefix}</span>
                  <p className="message-content">
                    {isObfuscated ? <span className="fantasy-obfuscated-text">{getScrambledRunicText(content)}</span> : content}
                  </p>
                  <div className="message-tags">
                      {!isObfuscated && language && language !== defaultLanguage && (
                          <span className="language-indicator">[{language}]</span>
                      )}
                      <span className="message-timestamp">{time}</span>
                  </div>
              </div>
            </div>
          );
      } else { // Public Chat
          const wrapperClass = isOwnMessage ? 'own-message-wrapper' : 'other-message-wrapper';
          let itemClasses = "message-item";
          let inlineStyle: React.CSSProperties = {};

          itemClasses += isOwnMessage ? " message-own" : " message-other";
          if (sender.isNPC) itemClasses += " message-npc";
          else if (sender.isGM) itemClasses += " message-gm";
          else if (!isOwnMessage && sender.name) {
            const borderColor = nameToHslColor(sender.name);
            inlineStyle = { borderLeftColor: borderColor };
          }
          return (
            <div className={`message-wrapper new-message-animation ${wrapperClass}`}>
              {!isOwnMessage && <Avatar name={senderDisplayName} avatarUrl={sender.avatarUrl} />}
              <div className={itemClasses} style={inlineStyle}>
                  <p className="message-content">
                    {isObfuscated ? <span className="fantasy-obfuscated-text">{getScrambledRunicText(content)}</span> : content}
                  </p>
                  <div className="message-tags">
                    {!isObfuscated && language && language !== defaultLanguage && (
                        <span className="language-indicator">[{language}]</span>
                    )}
                    {(!isOwnMessage || (isOwnMessage && sender.isNPC)) && <span className="message-sender">{senderDisplayName}</span>}
                      <span className="message-timestamp">{time}</span>
                  </div>
              </div>
            </div>
          );
      }
    }

    case 'IMAGE_MESSAGE': {
      const imagePayload = payload as ImageMessagePayload;
      const { imageUrl, caption, to = [], originalRecipientNameForGMView } = imagePayload;
      const fullImageUrl = imageUrl.startsWith('http') ? imageUrl : `${SOCKET_SERVER_URL}${imageUrl}`;

      if (isWhisper) {
        let prefix = '';
        let wrapperClass = 'center-message-wrapper';
        let showAvatarForOther = false;
        
        switch (direction) {
          case 'SENT': {
            const recipientNames = (to || []).filter(t => t.id !== localCharacterData.characterId).map(t => t.name);
            const displayImageRecipients = formatNameList(recipientNames);
            prefix = `You whisper an image to ${displayImageRecipients || 'yourself'}:`;
            wrapperClass = 'own-message-wrapper';
            break;
          }
          case 'RECEIVED': {
            const recipientString = getWhisperRecipientString(to, localCharacterData.characterId, sender.id);
            if (localCharacterData.isGM && originalRecipientNameForGMView) {
                 prefix = `${sender.name} whispers an image to ${originalRecipientNameForGMView} (you):`;
            } else {
                prefix = `${sender.name} whispers an image to ${recipientString}:`;
            }
            wrapperClass = 'other-message-wrapper';
            showAvatarForOther = !sender.isNPC && !!sender.name;
            break;
          }
          case 'OBSERVED': {
            const recipientString = getWhisperRecipientString(to, localCharacterData.characterId, sender.id);
            prefix = `(Observed) ${sender.name} whispers an image to ${recipientString}:`;
            wrapperClass = 'center-message-wrapper';
            showAvatarForOther = !sender.isNPC && !!sender.name;
            break;
          }
          default:
             prefix = `Whispered image:`;
        }

         return (
            <div className={`message-wrapper new-message-animation ${wrapperClass}`}>
              {showAvatarForOther && <Avatar name={sender.name || ''} avatarUrl={sender.avatarUrl} />}
              <div className="message-item message-whisper">
                <span className="whisper-prefix">{prefix}</span>
                <div className="image-message-content" onClick={() => onImageClick && onImageClick(fullImageUrl)} role="button" tabIndex={0} aria-label={`View image: ${caption || 'shared image'}`}>
                  <img src={fullImageUrl} alt={caption || 'Shared image'} />
                  {caption && <p className="image-caption">{caption}</p>}
                </div>
                <div className="message-tags">
                    <span className="message-timestamp">{time}</span>
                </div>
              </div>
            </div>
          );

      } else { // Public image
        const outerWrapperClass = isOwnMessage ? 'own-message-wrapper' : 'other-message-wrapper';
        const itemWrapperClass = isOwnMessage ? "message-item message-own" : "message-item message-other";

        return (
          <div className={`message-wrapper new-message-animation ${outerWrapperClass}`}>
            {!isOwnMessage && <Avatar name={sender.name || ''} avatarUrl={sender.avatarUrl} />}
            <div className={itemWrapperClass}>
              <div className="image-message-content" onClick={() => onImageClick && onImageClick(fullImageUrl)} role="button" tabIndex={0} aria-label={`View image: ${caption || 'shared image'}`}>
                <img src={fullImageUrl} alt={caption || 'Shared image'} />
                {caption && <p className="image-caption">{caption}</p>}
              </div>
              <div className="message-tags">
                <span className="message-sender">{sender.name || 'Unknown'}</span>
                <span className="message-timestamp">{time}</span>
              </div>
            </div>
          </div>
        );
      }
    }

    case 'CHAT_EMOTE': {
        const emotePayload = payload as EmoteMessagePayload;
        const emoteContent = `* ${senderDisplayName} ${emotePayload.content} *`;
        if (isWhisper) {
            let prefix = '';
            let wrapperClass = 'center-message-wrapper';
            let showAvatarForOther = false;
            const to = emotePayload.to || [];

            switch (direction) {
                case 'SENT': {
                    const recipientNames = to.filter(t => t.id !== localCharacterData.characterId).map(t => t.name);
                    const sentRecipients = formatNameList(recipientNames);
                    prefix = `You emote to ${sentRecipients || 'yourself'}:`;
                    wrapperClass = 'own-message-wrapper';
                    break;
                }
                case 'RECEIVED': {
                    const recipientString = getWhisperRecipientString(to, localCharacterData.characterId, sender.id);
                    if (localCharacterData.isGM && emotePayload.originalRecipientNameForGMView) {
                        prefix = `${sender.name} emotes to ${emotePayload.originalRecipientNameForGMView} (you):`;
                    } else {
                        prefix = `${sender.name} emotes to ${recipientString}:`;
                    }
                    wrapperClass = 'other-message-wrapper';
                    showAvatarForOther = !sender.isNPC && !!sender.name;
                    break;
                }
                case 'OBSERVED': {
                    const recipientString = getWhisperRecipientString(to, localCharacterData.characterId, sender.id);
                    prefix = `(Observed) ${sender.name} emotes to ${recipientString}:`;
                    wrapperClass = 'center-message-wrapper';
                    showAvatarForOther = !sender.isNPC && !!sender.name;
                    break;
                }
            }
             return (
                <div className={`message-wrapper new-message-animation ${wrapperClass}`}>
                    {showAvatarForOther && <Avatar name={sender.name || ''} avatarUrl={sender.avatarUrl} />}
                    <div className="message-item message-whisper">
                        <span className="whisper-prefix">{prefix}</span>
                        <p className="message-content message-emote">{emoteContent}</p>
                        <div className="message-tags"><span className="message-timestamp">{time}</span></div>
                    </div>
                </div>
            );
        }
        return (
            <div className="message-wrapper new-message-animation center-message-wrapper emote-wrapper">
                <div className="message-item message-emote">{emoteContent}</div>
            </div>
        );
    }

    case 'SYSTEM_NOTIFICATION': {
        const systemPayload = payload as SystemNotificationPayload;
        let itemClasses = "message-item message-system";
        if (systemPayload.isError) itemClasses += " message-system-error";
        return (
             <div className="message-wrapper new-message-animation center-message-wrapper">
                <div className={itemClasses}>{systemPayload.content}</div>
             </div>
        );
    }

    case 'DICE_ROLL': {
      const dicePayload = payload as DiceRollMessagePayload;
      const { description, details, total } = dicePayload;
      const diceContent = (
          <>
              <span>{description} </span>
              {details && <span className="dice-details">{details} </span>}
              <span>= <span className="dice-total">{total}</span></span>
          </>
      );

       if (isWhisper) {
            let prefix = '';
            let wrapperClass = 'center-message-wrapper';
            let showAvatarForOther = false;
            const to = dicePayload.to || [];

            switch (direction) {
                case 'SENT': {
                    const recipientNames = to.filter(t => t.id !== localCharacterData.characterId).map(t => t.name);
                    const sentRecipients = formatNameList(recipientNames);
                    prefix = `You roll privately for ${sentRecipients || 'yourself'}:`;
                    wrapperClass = 'own-message-wrapper';
                    break;
                }
                case 'RECEIVED': {
                    const recipientString = getWhisperRecipientString(to, localCharacterData.characterId, sender.id);
                    if (localCharacterData.isGM && dicePayload.originalRecipientNameForGMView) {
                        prefix = `${sender.name} rolls privately for ${dicePayload.originalRecipientNameForGMView} (you):`;
                    } else {
                        prefix = `${sender.name} rolls privately for ${recipientString}:`;
                    }
                    wrapperClass = 'other-message-wrapper';
                    showAvatarForOther = !sender.isNPC && !!sender.name;
                    break;
                }
                case 'OBSERVED': {
                    const recipientString = getWhisperRecipientString(to, localCharacterData.characterId, sender.id);
                    prefix = `(Observed) ${sender.name} rolls privately for ${recipientString}:`;
                    wrapperClass = 'center-message-wrapper';
                    showAvatarForOther = !sender.isNPC && !!sender.name;
                    break;
                }
            }

            return (
                <div className={`message-wrapper new-message-animation ${wrapperClass}`}>
                    {showAvatarForOther && <Avatar name={sender.name || ''} avatarUrl={sender.avatarUrl} />}
                    <div className="message-item message-whisper">
                        <span className="whisper-prefix">{prefix}</span>
                        <div className="message-content message-dice">{diceContent}</div>
                        <div className="message-tags"><span className="message-timestamp">{time}</span></div>
                    </div>
                </div>
            );
        }

      return (
        <div className="message-wrapper new-message-animation center-message-wrapper dice-wrapper">
            <div className="message-item message-dice">{diceContent}</div>
        </div>
      );
    }

    default: {
      console.warn("Received unknown or malformed message type:", itemType, message);
      return (
        <div className="message-wrapper new-message-animation center-message-wrapper">
          <div className="message-item unknown">
            <em>An unknown message was received from the server.</em>
          </div>
        </div>
      );
    }
  }
}

export default React.memo(ChatItem);