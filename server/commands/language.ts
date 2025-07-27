// server/commands/language.ts
import { v4 as uuidv4 } from 'uuid';
import { ServerSocketType, CommandContext, Command, Character, Message } from '../types';

async function addlangExecute(socket: ServerSocketType, args: string[], context: CommandContext): Promise<void> {
    const { io, gameState, utils, characterId, tableId } = context;
    const langToAdd = args[0]?.trim();
    if (!langToAdd) {
        utils.notifyUser(socket, `Usage: /addlang <LanguageName>`, true);
        return;
    }

    if (gameState.availableLanguages.find(l => l.toLowerCase() === langToAdd.toLowerCase())) {
        utils.notifyUser(socket, `The language "${langToAdd}" already exists.`, true);
        return;
    }

    gameState.availableLanguages.push(langToAdd);
    await utils.broadcastLanguageUpdate(io, gameState, utils);

    const gmData = gameState.charactersData.get(characterId);
    if (gmData && gmData.isGM) {
        gmData.languages = [...gameState.availableLanguages];
        gameState.charactersData.set(characterId, gmData);
        socket.emit('characterDetailsConfirmed', gmData);
    }

    const notification: Message = {
        itemId: uuidv4(),
        timestamp: new Date().toISOString(),
        itemType: "SYSTEM_NOTIFICATION",
        sender: { id: 'SYSTEM', name: 'System', isGM: false, isNPC: false, avatarUrl: null},
        sentTo: [],
        payload: { content: `The language "${langToAdd}" has been added to the world.` }
    };
    utils.broadcastTransientMessage(io, tableId, notification);
}

async function removelangExecute(socket: ServerSocketType, args: string[], context: CommandContext): Promise<void> {
    const { io, gameState, utils, tableId } = context;
    const langToRemove = args[0]?.trim();
    if (!langToRemove) {
        utils.notifyUser(socket, `Usage: /removelang <LanguageName>`, true);
        return;
    }

    const langToRemoveLower = langToRemove.toLowerCase();

    if (langToRemoveLower === gameState.defaultLanguage.toLowerCase()) {
        utils.notifyUser(socket, `Cannot remove the default language "${gameState.defaultLanguage}".`, true);
        return;
    }

    const langIndex = gameState.availableLanguages.findIndex(l => l.toLowerCase() === langToRemoveLower);
    if (langIndex === -1) {
        utils.notifyUser(socket, `Language "${langToRemove}" not found.`, true);
        return;
    }

    const actualLangName = gameState.availableLanguages.splice(langIndex, 1)[0];
    await utils.broadcastLanguageUpdate(io, gameState, utils);

    for (const [charId, charData] of gameState.charactersData.entries()) {
        const langIndexInChar = charData.languages.findIndex(l => l.toLowerCase() === langToRemoveLower);
        if (langIndexInChar > -1) {
            charData.languages.splice(langIndexInChar, 1);
            gameState.charactersData.set(charId, charData);

            const targetSocketIds = gameState.characterIdToSocketIds.get(charId) || new Set();
            for (const targetSocketId of targetSocketIds) {
                 io.to(targetSocketId).emit('characterDetailsConfirmed', charData);
            }
        }
    }

    const notification: Message = {
        itemId: uuidv4(),
        timestamp: new Date().toISOString(),
        itemType: "SYSTEM_NOTIFICATION",
        sender: { id: 'SYSTEM', name: 'System', isGM: false, isNPC: false, avatarUrl: null},
        sentTo: [],
        payload: { content: `The language "${actualLangName}" has been removed from the world.` }
    };
    utils.broadcastTransientMessage(io, tableId, notification);
}

function findCharacterByName(name: string, charactersData: Map<string, Character>): { targetId: string; targetData: Character } | null {
    const nameLower = name.toLowerCase();
    for (const [id, charData] of charactersData.entries()) {
        if (charData.characterName && charData.characterName.toLowerCase() === nameLower) {
            return { targetId: id, targetData: charData };
        }
    }
    return null;
}

async function givelangExecute(socket: ServerSocketType, args: string[], context: CommandContext): Promise<void> {
    const { io, gameState, utils } = context;
    const rawArgs = args.join(' ');
    const parts = rawArgs.split(/\s*\/\s*/);

    if (parts.length < 2 || !parts[0] || !parts[1]) {
        utils.notifyUser(socket, "Usage: /givelang <Character Name> / <Language Name>", true);
        return;
    }

    const targetName = parts[0].trim();
    const langName = parts[1].trim();

    const targetLang = gameState.availableLanguages.find(l => l.toLowerCase() === langName.toLowerCase());
    if (!targetLang) {
        utils.notifyUser(socket, `Language "${langName}" is not an available world language.`, true);
        return;
    }

    const result = findCharacterByName(targetName, gameState.charactersData);
    if (!result) {
        utils.notifyUser(socket, `Character "${targetName}" not found.`, true);
        return;
    }
    const { targetId, targetData } = result;

    if (targetData.languages.some(l => l.toLowerCase() === targetLang.toLowerCase())) {
        utils.notifyUser(socket, `${targetData.characterName} already knows ${targetLang}.`, true);
        return;
    }

    targetData.languages.push(targetLang);
    targetData.languages.sort();
    gameState.charactersData.set(targetId, targetData);
    await utils.saveTableState(gameState);

    const targetSocketIds = gameState.characterIdToSocketIds.get(targetId) || new Set();
    for (const targetSocketId of targetSocketIds) {
        const targetSocketInstance = io.sockets.sockets.get(targetSocketId);
        if (targetSocketInstance) {
            targetSocketInstance.emit('characterDetailsConfirmed', targetData);
            utils.notifyUser(targetSocketInstance, `You have learned ${targetLang}!`);
        }
    }
    utils.notifyUser(socket, `You taught ${targetLang} to ${targetData.characterName}.`);
}

async function takelangExecute(socket: ServerSocketType, args: string[], context: CommandContext): Promise<void> {
    const { io, gameState, utils } = context;
    const rawArgs = args.join(' ');
    const parts = rawArgs.split(/\s*\/\s*/);
    if (parts.length < 2 || !parts[0] || !parts[1]) {
        utils.notifyUser(socket, "Usage: /takelang <Character Name> / <Language Name>", true);
        return;
    }
    const targetName = parts[0].trim();
    const langName = parts[1].trim();
    const langNameLower = langName.toLowerCase();

    if (langNameLower === gameState.defaultLanguage.toLowerCase()) {
        utils.notifyUser(socket, `You cannot remove the default language "${gameState.defaultLanguage}".`, true);
        return;
    }

    const result = findCharacterByName(targetName, gameState.charactersData);
    if (!result) {
        utils.notifyUser(socket, `Character "${targetName}" not found.`, true);
        return;
    }
    const { targetId, targetData } = result;

    const langIndex = targetData.languages.findIndex(l => l.toLowerCase() === langNameLower);
    if (langIndex === -1) {
        utils.notifyUser(socket, `${targetData.characterName} does not know ${langName}.`, true);
        return;
    }

    const actualLangName = targetData.languages.splice(langIndex, 1)[0];
    gameState.charactersData.set(targetId, targetData);
    await utils.saveTableState(gameState);

    const targetSocketIds = gameState.characterIdToSocketIds.get(targetId) || new Set();
    for (const targetSocketId of targetSocketIds) {
        const targetSocketInstance = io.sockets.sockets.get(targetSocketId);
        if (targetSocketInstance) {
            targetSocketInstance.emit('characterDetailsConfirmed', targetData);
            utils.notifyUser(targetSocketInstance, `You have forgotten ${actualLangName}!`);
        }
    }
    utils.notifyUser(socket, `You made ${targetData.characterName} forget ${actualLangName}.`);
}

async function renamedefaultExecute(socket: ServerSocketType, args: string[], context: CommandContext): Promise<void> {
    const { io, gameState, utils, tableId } = context;
    const newName = args[0]?.trim();
    if (!newName) {
        utils.notifyUser(socket, "Usage: /renamedefault <NewLanguageName>", true);
        return;
    }

    if (gameState.availableLanguages.find(l => l.toLowerCase() === newName.toLowerCase())) {
        utils.notifyUser(socket, `Cannot rename default language to "${newName}" as that language already exists.`, true);
        return;
    }

    const oldName = gameState.defaultLanguage;
    gameState.defaultLanguage = newName;
    const langIndex = gameState.availableLanguages.findIndex(l => l.toLowerCase() === oldName.toLowerCase());
    if (langIndex > -1) {
        gameState.availableLanguages[langIndex] = newName;
    } else {
        gameState.availableLanguages.push(newName);
    }
    await utils.broadcastLanguageUpdate(io, gameState, utils);

    for (const [charId, charData] of gameState.charactersData.entries()) {
        charData.languages = charData.languages.map(lang => (lang.toLowerCase() === oldName.toLowerCase() ? newName : lang)).sort();
        gameState.charactersData.set(charId, charData);

        const targetSocketIds = gameState.characterIdToSocketIds.get(charId) || new Set();
        for (const targetSocketId of targetSocketIds) {
            io.to(targetSocketId).emit('characterDetailsConfirmed', charData);
        }
    }

    const notification: Message = {
        itemId: uuidv4(),
        timestamp: new Date().toISOString(),
        itemType: "SYSTEM_NOTIFICATION",
        sender: { id: 'SYSTEM', name: 'System', isGM: false, isNPC: false, avatarUrl: null},
        sentTo: [],
        payload: { content: `The default language "${oldName}" has been renamed to "${newName}".` }
    };
    utils.broadcastTransientMessage(io, tableId, notification);
}

export const addlang: Command = { name: 'addlang', description: 'Adds a new language to the world.', gmOnly: true, execute: addlangExecute };
export const removelang: Command = { name: 'removelang', description: 'Removes a language from the world.', gmOnly: true, execute: removelangExecute };
export const givelang: Command = { name: 'givelang', description: 'Gives a language to a player.', gmOnly: true, execute: givelangExecute };
export const takelang: Command = { name: 'takelang', description: 'Takes a language from a player.', gmOnly: true, execute: takelangExecute };
export const renamedefault: Command = { name: 'renamedefault', description: 'Renames the default language.', gmOnly: true, execute: renamedefaultExecute };