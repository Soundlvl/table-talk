// server/commands/roll.ts
import { v4 as uuidv4 } from 'uuid';
import { DiceRoll } from '@dice-roller/rpg-dice-roller';
import { ServerSocketType, CommandContext, Command, Message, DiceRollMessagePayload, Sender, WhisperTarget } from '../types';

const rollCommand: Command = {
  name: 'roll',
  description: 'Rolls dice based on standard notation.',
  execute(socket: ServerSocketType, args: string[], context: CommandContext): void {
    const { characterId, io, gameState, utils } = context;

    const notation = args.join(' ');
    if (!notation) {
      utils.notifyUser(socket, 'Usage: /roll <dice notation>', true);
      return;
    }

    const senderData = gameState.charactersData.get(characterId);
    if (!senderData || !senderData.characterName) return;

    try {
      const roll = new DiceRoll(notation);

      const senderPayload: Sender = utils.getSenderWithAvatar(characterId, gameState.charactersData);
      const description = `${senderPayload.name} rolls ${roll.notation}:`;

      // New, more robust method for extracting roll details.
      const fullOutput = roll.toString(); // e.g., "2d6+3: (4, 2)+3 = 9"
      const outputParts = fullOutput.split('=');
      let rollDetails: string | null = null;
      if (outputParts.length > 1) {
          const detailsAndNotation = outputParts[0]; // e.g., "2d6+3: (4, 2)+3 "
          const notationSeparatorIndex = detailsAndNotation.indexOf(':');
          if (notationSeparatorIndex !== -1) {
              // Extract everything after the colon
              rollDetails = detailsAndNotation.substring(notationSeparatorIndex + 1).trim();
          } else {
              // Handle cases where there might not be a colon, just use the whole part before '='
              rollDetails = detailsAndNotation.trim();
          }
      } else {
          // Fallback if there is no '=' in the output string, just show the total.
          rollDetails = roll.total.toString();
      }


      const isWhisper = !!(senderData.whisperTargets && senderData.whisperTargets.length > 0);
      let recipientIds: string[];
      let to_targets: WhisperTarget[] | undefined = undefined;

      if (isWhisper) {
        recipientIds = senderData.whisperTargets.map(target => target.id);
        to_targets = [...senderData.whisperTargets];
      } else {
        recipientIds = Array.from(gameState.charactersData.keys());
      }

      const diceRollPayload: DiceRollMessagePayload = {
          description: description,
          details: rollDetails,
          total: roll.total,
          to: to_targets,
      };

      const diceRollObject: Message = {
        itemId: uuidv4(),
        timestamp: new Date().toISOString(),
        itemType: 'DICE_ROLL',
        sender: senderPayload,
        isWhisper: isWhisper,
        sentTo: recipientIds,
        payload: diceRollPayload
      };
      utils.distributeMessage(diceRollObject, io, gameState, null);
    } catch (error: any) {
      utils.notifyUser(socket, error.message || `Invalid dice notation: "${notation}"`, true);
    }
  },
};
export default rollCommand;