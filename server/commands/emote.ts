// server/commands/emote.ts
import { v4 as uuidv4 } from 'uuid';
import { ServerSocketType, CommandContext, Command, Message, EmoteMessagePayload, WhisperTarget } from '../types';

const emoteCommand: Command = {
  name: 'emote',
  description: 'Performs an emote action.',
  aliases: ['me'],
  execute(socket: ServerSocketType, args: string[], context: CommandContext): void {
    const { characterId, io, gameState, utils } = context;

    const actionText = args.join(' ');
    if (!actionText) {
      utils.notifyUser(socket, 'Usage: /emote <action text>', true);
      return;
    }

    const senderData = gameState.charactersData.get(characterId);
    if (!senderData || !senderData.characterName) return;

    const isWhisper = !!(senderData.whisperTargets && senderData.whisperTargets.length > 0);
    let recipientIds: string[];
    let to_targets: WhisperTarget[] | undefined = undefined;

    if (isWhisper) {
      recipientIds = senderData.whisperTargets.map(target => target.id);
      to_targets = [...senderData.whisperTargets];
    } else {
      recipientIds = Array.from(gameState.charactersData.keys());
    }

    const senderPayload = utils.getSenderWithAvatar(characterId, gameState.charactersData);

    const emotePayload: EmoteMessagePayload = {
        content: actionText,
        to: to_targets,
    };

    const emoteObject: Message = {
      itemId: uuidv4(),
      timestamp: new Date().toISOString(),
      itemType: 'CHAT_EMOTE',
      sender: senderPayload,
      isWhisper: isWhisper,
      sentTo: recipientIds,
      payload: emotePayload,
    };
    utils.distributeMessage(emoteObject, io, gameState, null);
  },
};

export default emoteCommand;