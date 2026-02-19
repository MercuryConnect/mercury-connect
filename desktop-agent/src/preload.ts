import { contextBridge, ipcRenderer } from 'electron';

// Expose protected methods that allow the renderer process to use
// ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electronAPI', {
  // Screen capture
  getSources: () => ipcRenderer.invoke('get-sources'),
  getScreenSize: () => ipcRenderer.invoke('get-screen-size'),
  
  // Clipboard - text
  clipboardReadText: () => ipcRenderer.invoke('clipboard-read-text'),
  clipboardWriteText: (text: string) => ipcRenderer.invoke('clipboard-write-text', text),
  
  // Clipboard - files
  clipboardHasFiles: () => ipcRenderer.invoke('clipboard-has-files'),
  clipboardReadFiles: () => ipcRenderer.invoke('clipboard-read-files'),
  
  // Mouse control
  mouseMove: (x: number, y: number) => ipcRenderer.invoke('mouse-move', x, y),
  mouseClick: (button: 'left' | 'right' | 'middle', doubleClick?: boolean) => 
    ipcRenderer.invoke('mouse-click', button, doubleClick),
  mouseDown: (button: 'left' | 'right' | 'middle') => ipcRenderer.invoke('mouse-down', button),
  mouseUp: (button: 'left' | 'right' | 'middle') => ipcRenderer.invoke('mouse-up', button),
  mouseScroll: (deltaX: number, deltaY: number) => ipcRenderer.invoke('mouse-scroll', deltaX, deltaY),
  
  // Keyboard control
  keyTap: (key: string, modifiers: string[]) => ipcRenderer.invoke('key-tap', key, modifiers),
  typeString: (text: string) => ipcRenderer.invoke('type-string', text),
  
  // File operations
  saveFile: (fileName: string, data: ArrayBuffer) => ipcRenderer.invoke('save-file', fileName, data),
  readFile: (filePath: string) => ipcRenderer.invoke('read-file', filePath),
  selectFiles: () => ipcRenderer.invoke('select-files'),
  
  // App info
  getAppInfo: () => ipcRenderer.invoke('get-app-info'),
  
  // External
  openExternal: (url: string) => ipcRenderer.invoke('open-external', url),
});

// Type definitions for the exposed API
declare global {
  interface Window {
    electronAPI: {
      // Screen capture
      getSources: () => Promise<Array<{
        id: string;
        name: string;
        thumbnail: string;
        display_id: string;
      }>>;
      getScreenSize: () => Promise<{
        width: number;
        height: number;
        scaleFactor: number;
      }>;
      
      // Clipboard - text
      clipboardReadText: () => Promise<string>;
      clipboardWriteText: (text: string) => Promise<boolean>;
      
      // Clipboard - files
      clipboardHasFiles: () => Promise<boolean>;
      clipboardReadFiles: () => Promise<string[]>;
      
      // Mouse control
      mouseMove: (x: number, y: number) => Promise<boolean>;
      mouseClick: (button: 'left' | 'right' | 'middle', doubleClick?: boolean) => Promise<boolean>;
      mouseDown: (button: 'left' | 'right' | 'middle') => Promise<boolean>;
      mouseUp: (button: 'left' | 'right' | 'middle') => Promise<boolean>;
      mouseScroll: (deltaX: number, deltaY: number) => Promise<boolean>;
      
      // Keyboard control
      keyTap: (key: string, modifiers: string[]) => Promise<boolean>;
      typeString: (text: string) => Promise<boolean>;
      
      // File operations
      saveFile: (fileName: string, data: ArrayBuffer) => Promise<{ success: boolean; path?: string; error?: string }>;
      readFile: (filePath: string) => Promise<{ success: boolean; fileName?: string; data?: ArrayBuffer; size?: number; error?: string }>;
      selectFiles: () => Promise<{ success: boolean; files?: Array<{ path: string; name: string; size: number }>; error?: string }>;
      
      // App info
      getAppInfo: () => Promise<{
        version: string;
        platform: string;
        arch: string;
      }>;
      
      // External
      openExternal: (url: string) => Promise<boolean>;
    };
  }
}
