# 🎲 TableTalk

<div align="center">
  <img src="client/public/TT.png" alt="TableTalk Logo" width="200"/>
  
  **A TTRPG chat app for running in person games.**
  
  [![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
  [![Electron](https://img.shields.io/badge/Electron-28.0.0-9feaf9.svg)](https://electronjs.org/)
  [![React](https://img.shields.io/badge/React-19.1.0-61dafb.svg)](https://reactjs.org/)
  [![TypeScript](https://img.shields.io/badge/TypeScript-5.4.5-blue.svg)](https://www.typescriptlang.org/)
</div>

## ✨ Features

### 🎮 **Immersive Gaming Experience**
- **Language System**: Speak in different in-game languages with automatic obfuscation for unknown languages
- **Empowered Table Talk**: Send messages to the GM while other players are speaking to eachother 
- **Private & Secure Chat**: Your game's chat history is stored locally and securely
- **Fantasy & Sci-Fi Themes**: Choose themes that match your campaign's aesthetic
- **Accessibility Options**: High-contrast mode and dyslexia-friendly fonts

### 🎲 **Rich Chat Features**
- **Integrated Dice Roller**: Roll dice directly in chat using standard notation (`/roll 2d6+5`)
- **Whisper Mode**: Send private messages to specific players or the GM
- **Emotes**: Express character actions with `/emote` commands
- **Image Sharing**: Share character art, maps, and visual aids
- **Real-time Communication**: Powered by Socket.IO for instant messaging


### 🧙‍♂️ **Game Master Tools**
- **NPC Management**: Speak as different NPCs with the `/as` command
- **Player Language Control**: Grant or remove character languages
- **Chat Export**: Save entire game sessions as JSON files
- **Player Management Dashboard**: Comprehensive GM controls

### 🌐 **Cross-Platform Desktop App**
- **No Installation Required**: Portable executable files
- **Windows, macOS, Linux**: Built with Electron for universal compatibility
- **QR Code Sharing**: Quick mobile device connections
- **Network Discovery**: Automatic local network connection URLs

## 📥 Download & Installation

### For Players

1. **Connect with a browser** Get the url or scan the QR code from your Game Master
2. **Join your table** and create your character
3. **Start gaming!**

### For Game Masters

1. **Download the latest release** from the [Releases page](../../releases)
2. **Launch TableTalk** to automatically start the server
3. **Share connection info** with your players via the built-in QR code or URLs
4. **Create your table** and manage your campaign

## 🎯 Quick Start

### Creating a Game (GM)
1. Launch TableTalk
2. Create a new table with your campaign name
3. Set up world languages and themes from the GM menue
4. Share the connection URL or QR code with players
5. Start your adventure!

### Joining a Game (Player)
1. Navigate to the GM's server URL
2. Select your campain's table from the list
3. Create your character:
   - Choose a character name
   - Select known languages
   - TIP :enter the name of a previously created character to rejoin without selecting languages again
4. Jump into the chat!
  - Optionally upload an avatar from settings
## 💬 Chat Commands

### General Commands
```
/roll <dice>        Roll dice (e.g., /roll 2d20+5, /roll 1d100)
/w <player>         Whisper to a player (/w Aragorn Hello!)
/r or /reply        Reply to the last whisper
/all                Return to public chat from whisper
/emote <action>     Perform an action (/emote draws sword)
/me <action>        Same as /emote
```

### GM-Only Commands
```
/as <NPC>           Speak as an NPC (/as Shopkeeper)
/gm                 Return to GM mode
/manage             Open GM dashboard
/givelang <player>/<lang>   Grant language to player
/takelang <player>/<lang>   Remove language from player
/save               Export chat log and game state
/settheme <theme>   Change table theme (fantasy/sci-fi)
```

## 🛠️ Development Setup

### Prerequisites
- Node.js 18+ 
- npm or yarn

### Installation
```bash
# Clone the repository
git clone https://github.com/yourusername/table-talk-app.git
cd table-talk-app

# Install dependencies for all components
cd client && npm install && cd ..
cd server && npm install && cd ..
cd electron && npm install && cd ..
```

### Development Workflow
```bash
# Build the client
cd client
npm run build

# Build the server
cd ../server
npm run build

# Run in development mode
cd ../electron
npm run dev
```

### Building Releases
```bash
# Prepare and build for current platform
cd electron
npm run build

# Build for specific platforms
npm run build:win    # Windows
npm run build:mac    # macOS
npm run build:linux  # Linux
```

## 🏗️ Architecture

TableTalk is built with a modern, modular architecture:

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│                 │    │                 │    │                 │
│   React Client  │◄──►│  Socket.IO      │◄──►│ Electron Main   │
│   (Frontend)    │    │  Server         │    │ Process         │
│                 │    │  (Backend)      │    │                 │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                       │
         ▼                       ▼                       ▼
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Vite Build    │    │  TypeScript     │    │   Electron      │
│   System        │    │  Node.js        │    │   Builder       │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

### Tech Stack
- **Frontend**: React 19, TypeScript, Vite
- **Backend**: Node.js, Socket.IO, TypeScript  
- **Desktop**: Electron 28
- **Dice System**: @dice-roller/rpg-dice-roller
- **Styling**: CSS Custom Properties with theme system

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request. For major changes, please open an issue first to discuss what you would like to change.

### Development Guidelines
1. Follow the existing code style and TypeScript patterns
2. Add appropriate type definitions for new features
3. Test your changes across different platforms when possible
4. Update documentation for new features

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](license) file for details.

## 🙏 Acknowledgments

- **@dice-roller/rpg-dice-roller** - Excellent dice rolling library
- **Socket.IO** - Real-time communication framework
- **Electron** - Cross-platform desktop app framework
- **React** - UI framework
- **TTRPG Community** - For inspiration and feedback

## 📞 Support

- **Issues**: [GitHub Issues](../../issues)
- **Discussions**: [GitHub Discussions](../../discussions)

---

<div align="center">
  <strong>Built with ❤️ for the TTRPG community</strong>
  
  <br>
  
  *Happy Gaming! 🎲*
</div>