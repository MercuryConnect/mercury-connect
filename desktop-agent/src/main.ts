import { app, BrowserWindow, ipcMain, desktopCapturer, screen, clipboard, dialog, shell } from 'electron';
import * as path from 'path';
import * as fs from 'fs';

let mainWindow: BrowserWindow | null = null;

// Dynamically import nut.js to handle native module loading
let mouse: any = null;
let keyboard: any = null;
let Button: any = null;
let Key: any = null;

async function initNutJs() {
  try {
    const nutjs = await import('@nut-tree-fork/nut-js');
    mouse = nutjs.mouse;
    keyboard = nutjs.keyboard;
    Button = nutjs.Button;
    Key = nutjs.Key;
    // Configure for faster response
    mouse.config.mouseSpeed = 2000;
    keyboard.config.autoDelayMs = 0;
    console.log('nut.js initialized successfully');
    return true;
  } catch (error) {
    console.error('Failed to initialize nut.js:', error);
    return false;
  }
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 500,
    height: 750,
    minWidth: 400,
    minHeight: 600,
    resizable: true,
    frame: true,
    titleBarStyle: 'default',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, '../preload/index.js'),
    },
    icon: path.join(__dirname, '../../resources/icon.png'),
  });

  // Load the renderer
  if (process.env.NODE_ENV === 'development') {
    mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(async () => {
  await initNutJs();
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// IPC Handlers

// Get available screen sources for sharing
ipcMain.handle('get-sources', async () => {
  try {
    const sources = await desktopCapturer.getSources({
      types: ['screen', 'window'],
      thumbnailSize: { width: 320, height: 180 },
    });
    
    return sources.map(source => ({
      id: source.id,
      name: source.name,
      thumbnail: source.thumbnail.toDataURL(),
      display_id: source.display_id,
    }));
  } catch (error) {
    console.error('Error getting sources:', error);
    return [];
  }
});

// Get screen dimensions
ipcMain.handle('get-screen-size', () => {
  const primaryDisplay = screen.getPrimaryDisplay();
  return {
    width: primaryDisplay.size.width,
    height: primaryDisplay.size.height,
    scaleFactor: primaryDisplay.scaleFactor,
  };
});

// Clipboard operations
ipcMain.handle('clipboard-read-text', () => {
  return clipboard.readText();
});

ipcMain.handle('clipboard-write-text', (_, text: string) => {
  clipboard.writeText(text);
  return true;
});

// Check if clipboard has files
ipcMain.handle('clipboard-has-files', () => {
  if (process.platform === 'win32') {
    const formats = clipboard.availableFormats();
    return formats.includes('FileNameW') || formats.includes('text/uri-list');
  }
  const text = clipboard.readText();
  return text.startsWith('file://');
});

// Read file paths from clipboard
ipcMain.handle('clipboard-read-files', () => {
  if (process.platform === 'win32') {
    const buffer = clipboard.readBuffer('FileNameW');
    if (buffer && buffer.length > 0) {
      const paths = buffer.toString('ucs2').split('\0').filter(p => p.length > 0);
      return paths;
    }
  }
  const text = clipboard.readText();
  if (text.startsWith('file://')) {
    return [text.replace('file://', '')];
  }
  return [];
});

// Mouse control using nut.js
ipcMain.handle('mouse-move', async (_, x: number, y: number) => {
  try {
    if (!mouse) {
      console.error('Mouse control not initialized');
      return false;
    }
    const screenSize = screen.getPrimaryDisplay().size;
    const absoluteX = Math.round(x * screenSize.width);
    const absoluteY = Math.round(y * screenSize.height);
    await mouse.setPosition({ x: absoluteX, y: absoluteY });
    return true;
  } catch (error) {
    console.error('Mouse move error:', error);
    return false;
  }
});

ipcMain.handle('mouse-click', async (_, button: 'left' | 'right' | 'middle', doubleClick: boolean = false) => {
  try {
    if (!mouse || !Button) {
      console.error('Mouse control not initialized');
      return false;
    }
    const btnMap: Record<string, any> = {
      'left': Button.LEFT,
      'right': Button.RIGHT,
      'middle': Button.MIDDLE,
    };
    
    if (doubleClick) {
      await mouse.doubleClick(btnMap[button]);
    } else {
      await mouse.click(btnMap[button]);
    }
    return true;
  } catch (error) {
    console.error('Mouse click error:', error);
    return false;
  }
});

ipcMain.handle('mouse-down', async (_, button: 'left' | 'right' | 'middle') => {
  try {
    if (!mouse || !Button) return false;
    const btnMap: Record<string, any> = {
      'left': Button.LEFT,
      'right': Button.RIGHT,
      'middle': Button.MIDDLE,
    };
    await mouse.pressButton(btnMap[button]);
    return true;
  } catch (error) {
    console.error('Mouse down error:', error);
    return false;
  }
});

ipcMain.handle('mouse-up', async (_, button: 'left' | 'right' | 'middle') => {
  try {
    if (!mouse || !Button) return false;
    const btnMap: Record<string, any> = {
      'left': Button.LEFT,
      'right': Button.RIGHT,
      'middle': Button.MIDDLE,
    };
    await mouse.releaseButton(btnMap[button]);
    return true;
  } catch (error) {
    console.error('Mouse up error:', error);
    return false;
  }
});

ipcMain.handle('mouse-scroll', async (_, deltaX: number, deltaY: number) => {
  try {
    if (!mouse) return false;
    // nut.js scroll - positive is down, negative is up
    if (deltaY !== 0) {
      await mouse.scrollDown(deltaY > 0 ? 3 : -3);
    }
    return true;
  } catch (error) {
    console.error('Mouse scroll error:', error);
    return false;
  }
});

// Keyboard control using nut.js
ipcMain.handle('key-tap', async (_, key: string, modifiers: string[]) => {
  try {
    if (!keyboard || !Key) {
      console.error('Keyboard control not initialized');
      return false;
    }
    
    // Map key names to nut.js Key enum
    const keyMap: Record<string, any> = {
      'enter': Key.Enter,
      'return': Key.Enter,
      'tab': Key.Tab,
      'backspace': Key.Backspace,
      'delete': Key.Delete,
      'escape': Key.Escape,
      'space': Key.Space,
      'up': Key.Up,
      'down': Key.Down,
      'left': Key.Left,
      'right': Key.Right,
      'home': Key.Home,
      'end': Key.End,
      'pageup': Key.PageUp,
      'pagedown': Key.PageDown,
      'f1': Key.F1, 'f2': Key.F2, 'f3': Key.F3, 'f4': Key.F4,
      'f5': Key.F5, 'f6': Key.F6, 'f7': Key.F7, 'f8': Key.F8,
      'f9': Key.F9, 'f10': Key.F10, 'f11': Key.F11, 'f12': Key.F12,
      'control': Key.LeftControl,
      'shift': Key.LeftShift,
      'alt': Key.LeftAlt,
      'meta': Key.LeftSuper,
      'command': Key.LeftSuper,
      'a': Key.A, 'b': Key.B, 'c': Key.C, 'd': Key.D, 'e': Key.E,
      'f': Key.F, 'g': Key.G, 'h': Key.H, 'i': Key.I, 'j': Key.J,
      'k': Key.K, 'l': Key.L, 'm': Key.M, 'n': Key.N, 'o': Key.O,
      'p': Key.P, 'q': Key.Q, 'r': Key.R, 's': Key.S, 't': Key.T,
      'u': Key.U, 'v': Key.V, 'w': Key.W, 'x': Key.X, 'y': Key.Y,
      'z': Key.Z,
      '0': Key.Num0, '1': Key.Num1, '2': Key.Num2, '3': Key.Num3,
      '4': Key.Num4, '5': Key.Num5, '6': Key.Num6, '7': Key.Num7,
      '8': Key.Num8, '9': Key.Num9,
    };
    
    const modifierMap: Record<string, any> = {
      'control': Key.LeftControl,
      'ctrl': Key.LeftControl,
      'shift': Key.LeftShift,
      'alt': Key.LeftAlt,
      'meta': Key.LeftSuper,
      'command': Key.LeftSuper,
    };
    
    const targetKey = keyMap[key.toLowerCase()];
    if (!targetKey) {
      // If key not in map, try to type it as a character
      await keyboard.type(key);
      return true;
    }
    
    // Press modifiers
    for (const mod of modifiers) {
      const modKey = modifierMap[mod.toLowerCase()];
      if (modKey) {
        await keyboard.pressKey(modKey);
      }
    }
    
    // Tap the key
    await keyboard.pressKey(targetKey);
    await keyboard.releaseKey(targetKey);
    
    // Release modifiers
    for (const mod of modifiers) {
      const modKey = modifierMap[mod.toLowerCase()];
      if (modKey) {
        await keyboard.releaseKey(modKey);
      }
    }
    
    return true;
  } catch (error) {
    console.error('Key tap error:', error);
    return false;
  }
});

ipcMain.handle('type-string', async (_, text: string) => {
  try {
    if (!keyboard) {
      console.error('Keyboard control not initialized');
      return false;
    }
    await keyboard.type(text);
    return true;
  } catch (error) {
    console.error('Type string error:', error);
    return false;
  }
});

// File operations
ipcMain.handle('save-file', async (_, fileName: string, data: ArrayBuffer) => {
  try {
    const downloadsPath = app.getPath('downloads');
    const filePath = path.join(downloadsPath, fileName);
    fs.writeFileSync(filePath, Buffer.from(data));
    shell.showItemInFolder(filePath);
    return { success: true, path: filePath };
  } catch (error) {
    console.error('Save file error:', error);
    return { success: false, error: String(error) };
  }
});

ipcMain.handle('read-file', async (_, filePath: string) => {
  try {
    const data = fs.readFileSync(filePath);
    const fileName = path.basename(filePath);
    return {
      success: true,
      fileName,
      data: data.buffer,
      size: data.length,
    };
  } catch (error) {
    console.error('Read file error:', error);
    return { success: false, error: String(error) };
  }
});

// Select files dialog
ipcMain.handle('select-files', async () => {
  try {
    const result = await dialog.showOpenDialog(mainWindow!, {
      properties: ['openFile', 'multiSelections'],
    });
    
    if (result.canceled) {
      return { success: true, files: [] };
    }
    
    const files = await Promise.all(result.filePaths.map(async (filePath) => {
      const stats = fs.statSync(filePath);
      return {
        path: filePath,
        name: path.basename(filePath),
        size: stats.size,
      };
    }));
    
    return { success: true, files };
  } catch (error) {
    console.error('Select files error:', error);
    return { success: false, error: String(error) };
  }
});

// App info
ipcMain.handle('get-app-info', () => {
  return {
    version: app.getVersion(),
    platform: process.platform,
    arch: process.arch,
  };
});

// Open external URL
ipcMain.handle('open-external', async (_, url: string) => {
  await shell.openExternal(url);
  return true;
});
