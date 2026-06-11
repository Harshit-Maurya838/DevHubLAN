import { app, BrowserWindow, ipcMain } from 'electron';
import path from 'path';
import { udpBroadcaster } from './discovery/udpBroadcaster';
import { udpListener } from './discovery/udpListener';
import { peerManager } from './discovery/peerManager';
import { tcpServer } from './networking/tcpServer';
import { TcpClient } from './networking/tcpClient';
import { messageHandler } from './networking/messageHandler';
import { settingsManager } from './storage/settings';
import { v4 as uuidv4 } from 'uuid';
import { ChatMessage, Peer, UserIdentity } from '../shared/types';
import { PORT_TCP } from '../shared/constants';

let mainWindow: BrowserWindow | null = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1000,
    height: 700,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
    },
    backgroundColor: '#1E1E2E'
  });

  if (process.env.VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL);
    // mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }
}

app.whenReady().then(() => {
  createWindow();

  // Start Networking
  udpListener.start();
  udpBroadcaster.start();
  peerManager.start();
  tcpServer.start();

  // Forward events to renderer
  peerManager.on('peer-added', (peer: Peer) => {
    if (mainWindow) mainWindow.webContents.send('peer-added', peer);
  });
  
  peerManager.on('peer-updated', (peer: Peer) => {
    if (mainWindow) mainWindow.webContents.send('peer-updated', peer);
  });

  messageHandler.on('message-received', (msg: ChatMessage) => {
    if (mainWindow) mainWindow.webContents.send('message-received', msg);
  });

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('will-quit', () => {
  udpListener.stop();
  udpBroadcaster.stop();
  peerManager.stop();
  tcpServer.stop();
});

// IPC Handlers
ipcMain.handle('get-peers', () => peerManager.getPeers());

ipcMain.handle('get-identity', () => settingsManager.getIdentity());

ipcMain.handle('update-identity', (_, identity: Partial<UserIdentity>) => {
  settingsManager.updateIdentity(identity);
});

ipcMain.handle('send-message', async (_, ip: string, content: string) => {
  const peer = peerManager.getPeer(ip);
  if (!peer) throw new Error('Peer not found');

  const identity = settingsManager.getIdentity();
  
  const msg: ChatMessage = {
    type: 'CHAT',
    messageId: uuidv4(),
    sender: identity.username,
    timestamp: Date.now(),
    content
  };

  await TcpClient.sendMessage(ip, peer.tcpPort || PORT_TCP, msg);
  return msg;
});
