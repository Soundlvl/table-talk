// client/src/constants.ts




export const generalCommands = [
    { cmd: '/roll <notation>', desc: 'Rolls dice (e.g., /roll 2d6+3)', docLink: "http://dice-roller.github.io/documentation" },
    { cmd: '/w <name>[, <name2>, ...]', desc: 'Enter whisper mode with specified player(s), GM, or NPC. Message is sent on next line.' },
    { cmd: '/r', alias: '/reply', desc: 'Accept the last whisper invitation and join the private chat. ' },
    { cmd: '/all', desc: 'Return to public chat from a whisper.' },
    { cmd: '/emote <action>', alias: '/me <action>', desc: 'Perform an action (e.g., /emote waves hello).' },
];

export const gmOnlyCommands = [
    { cmd: '/as <NPC_name>', desc: 'Speak as the specified NPC.' },
    { cmd: '/gm', desc: 'Revert to speaking as yourself (GM).' },
    { cmd: '/r', alias: '/reply', desc: 'If GM and replying to an NPC whisper, automatically speaks as that NPC.' },
    { cmd: '/manage', alias: '/who', desc: 'Open GM Dashboard for player & language management.' },
    { cmd: '/addlang <name>', desc: 'Add a new language to the world.' },
    { cmd: '/removelang <name>', desc: 'Remove a language from the world.' },
    { cmd: '/givelang <player_name> / <language_name>', desc: 'Grant a language to a player.' },
    { cmd: '/takelang <player_name> / <language_name>', desc: 'Revoke a language from a player.' },
    { cmd: '/renamedefault <new_name>', desc: 'Rename the default world language.' },
];
