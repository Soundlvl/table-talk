// server/commands/index.ts
// This file acts as a central hub for exporting all command modules.
// Using this pattern makes it easier to import all commands in one go
// within the command handler.

export { default as all } from './all';
export { default as as } from './as';
export { default as emote } from './emote';
export { default as gm } from './gm';
export { addlang, givelang, removelang, renamedefault, takelang } from './language';
export { default as manage } from './manage';
export { default as reply } from './reply';
export { default as roll } from './roll';
export { default as save } from './save';
export { default as whisper } from './whisper';
export { default as settheme } from './settheme';