// server/commands/save.ts
import { ServerSocketType, CommandContext, Command, PersistentCharacterData } from '../types';

const saveCommand: Command = {
  name: 'save',
  description: 'Exports the current game state to a downloadable JSON file.',
  gmOnly: true,

  async execute(socket: ServerSocketType, _args: string[], context: CommandContext): Promise<void> {
    const { gameState, utils, characterId } = context;
    const character = gameState.charactersData.get(characterId);

    if (!character) {
      console.warn(`[SAVE] Character not found for ID: ${characterId}`);
      utils.notifyUser(socket, "Error: Could not identify your character for saving.", true);
      return;
    }
    console.log(`[COMMAND] GM ${character.characterName} initiated save for table '${gameState.name}'.`);

    const serializableCharacters: [string, PersistentCharacterData][] = Array.from(gameState.charactersData.entries()).map(([id, char]) => {
        const persistentData: PersistentCharacterData = {
            characterId: char.characterId,
            characterName: char.characterName,
            languages: char.languages,
            isGM: char.isGM,
            avatarUrl: char.avatarUrl
        };
        return [id, persistentData];
    });
    const serializableNpcList: string[] = Array.from(gameState.npcList);

    const exportState = {
      saveVersion: 3,
      id: gameState.id,
      name: gameState.name,
      savedAt: new Date().toISOString(),
      chatHistory: gameState.chatHistory,
      charactersData: serializableCharacters,
      availableLanguages: gameState.availableLanguages,
      defaultLanguage: gameState.defaultLanguage,
      npcList: serializableNpcList,
    };

    // Ensure the latest state is written to disk before sending the export file
    await utils.saveTableState(gameState);

    socket.emit('gameStateExport', exportState);
    utils.notifyUser(socket, `Game state for table '${gameState.name}' exported.`);
  },
};
export default saveCommand;
