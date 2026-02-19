# Mercury Remote Agent

Cross-platform desktop agent for Mercury Holdings Remote Desktop Support.

## Features

- **Screen Sharing**: Share your entire screen or specific windows with support staff
- **Remote Control**: Allow support staff to control your mouse and keyboard
- **Clipboard Sync**: Bidirectional clipboard sharing between you and support
- **Secure Connection**: End-to-end encrypted WebRTC peer-to-peer connection
- **Cross-Platform**: Works on Windows, macOS, and Linux

## Requirements

- Node.js 18 or later
- npm or pnpm

### Platform-Specific Requirements

#### Windows
- Visual Studio Build Tools (for native modules)

#### macOS
- Xcode Command Line Tools
- Screen Recording permission (System Preferences > Security & Privacy > Privacy > Screen Recording)
- Accessibility permission for remote control (System Preferences > Security & Privacy > Privacy > Accessibility)

#### Linux
- libx11-dev, libxkbfile-dev (for robotjs)
- Screen sharing permissions may vary by desktop environment

## Installation

```bash
# Install dependencies
npm install

# For native module compilation (robotjs)
npm rebuild
```

## Development

```bash
# Start in development mode
npm run dev
```

## Building

```bash
# Build for current platform
npm run build
npm run package

# Build for specific platforms
npm run package:win    # Windows
npm run package:mac    # macOS
npm run package:linux  # Linux
```

## Distribution

Built packages will be in the `release` directory:

- **Windows**: `.exe` installer and portable version
- **macOS**: `.dmg` disk image
- **Linux**: `.AppImage` and `.deb` packages

## Usage

1. Launch the Mercury Remote Agent
2. Enter the Session ID provided by your support representative
3. Enter the Session Password
4. Optionally enter your name
5. Click "Join Session"
6. Select the screen or window you want to share
7. Click "Start Sharing"

Your support representative will now be able to see your screen and, with your permission, control your mouse and keyboard.

## Security

- All connections are peer-to-peer using WebRTC
- Data is encrypted using DTLS/SRTP
- Session passwords are required to join
- You can end the session at any time
- No data is stored on external servers

## Troubleshooting

### Screen sharing not working
- Ensure you have granted screen recording permissions
- Try selecting a different screen or window
- Restart the application

### Remote control not working
- Ensure you have granted accessibility permissions (macOS)
- The robotjs native module must be properly compiled
- Try running as administrator (Windows)

### Connection issues
- Check your internet connection
- Ensure firewall allows WebRTC connections
- Try using a different network

## License

Copyright © Mercury Holdings. All rights reserved.
