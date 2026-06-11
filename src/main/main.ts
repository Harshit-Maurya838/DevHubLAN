import { app, BrowserWindow, ipcMain } from 'electron';
import path from 'path';
import { udpBroadcaster } from './discovery/udpBroadcaster';
import { udpListener } from './discovery/udpListener';
import { peerManager } from './discovery/peerManager';
import { tcpServer } from './networking/tcpServer';
import { TcpClient } from './networking/tcpClient';
import { reliableSender } from './networking/reliableSender';
import { messageHandler } from './networking/messageHandler';
import { settingsManager } from './storage/settings';
import { roomManager } from './rooms/roomManager';
import { roomCoordinator } from './rooms/roomCoordinator';
import { roomSync } from './rooms/roomSync';
import { electionManager } from './rooms/election';
import { v4 as uuidv4 } from 'uuid';
import { ChatMessage, Peer, UserIdentity } from '../shared/types';
import { PORT_TCP } from '../shared/constants';
import { Room, RoomMember, RoomMessage } from '../shared/roomTypes';
import os from 'os';

let mainWindow: BrowserWindow | null = null;

function getLocalIp(): string {
  const interfaces = os.networkInterfaces();
  for (const devName in interfaces) {
    const iface = interfaces[devName];
    if (iface) {
      for (let i = 0; i < iface.length; i++) {
        const alias = iface[i];
        if (alias.family === 'IPv4' && !alias.internal) return alias.address;
      }
    }
  }
  return '127.0.0.1';
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
    },
    backgroundColor: '#1E1E2E'
  });

  if (process.env.VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL);
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }
}

app.whenReady().then(() => {
  createWindow();

  // Initialize Election (it registers its own events)
  electionManager; // Just accessing it initializes the singleton listener

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

  // Phase 2: Forward Room Events
  udpListener.on('room-advertised', (packet) => {
    if (mainWindow) mainWindow.webContents.send('room-advertised', packet);
  });

  roomSync.on('room-synced', (room: Room) => {
    if (mainWindow) mainWindow.webContents.send('room-synced', room);
  });

  roomCoordinator.on('room-message', (msg: RoomMessage) => {
    if (mainWindow) mainWindow.webContents.send('room-message', msg);
  });

  roomSync.on('room-message', (msg: RoomMessage) => {
    if (mainWindow) mainWindow.webContents.send('room-message', msg);
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

// Phase 1 IPC Handlers
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

  const packet = { ...msg }; 
  // We can use direct tcpClient for basic CHAT since it doesn't need reliable ACK logic if we want to keep Phase 1 simple
  // But let's use the standard tcpClient.
  await new TcpClient().sendMessage(ip, peer.tcpPort || PORT_TCP, packet);
  return msg;
});

// Phase 2 IPC Handlers
ipcMain.handle('get-rooms', () => roomManager.getRooms());

ipcMain.handle('create-room', async (_, name: string, description: string) => {
  const identity = settingsManager.getIdentity();
  const owner: RoomMember = {
    peerId: identity.username,
    ip: getLocalIp(),
    role: 'Owner',
    joinedAt: Date.now()
  };

  const newRoom: Room = {
    id: uuidv4(),
    name,
    description,
    ownerId: identity.username,
    createdAt: Date.now(),
    members: [owner],
    settings: { private: false, allowFileTransfer: true }
  };

  roomManager.addOrUpdateRoom(newRoom);
  return newRoom;
});

ipcMain.handle('join-room', async (_, roomId: string, ownerIp: string) => {
  const identity = settingsManager.getIdentity();
  const msgId = uuidv4();
  
  // Send request to owner
  await reliableSender.sendWithRetry(ownerIp, PORT_TCP, {
    type: 'ROOM_JOIN_REQUEST',
    messageId: msgId,
    roomId,
    peerId: identity.username,
    ip: getLocalIp()
  });

  return { status: 'requested' };
});

ipcMain.handle('send-room-message', async (_, roomId: string, content: string) => {
  const identity = settingsManager.getIdentity();
  const room = roomManager.getRoom(roomId);
  if (!room) throw new Error('Room not found');

  const msgId = uuidv4();
  const msg: RoomMessage = {
    id: msgId,
    roomId,
    senderId: identity.username,
    content,
    timestamp: Date.now(),
    status: 'Sending'
  };

  const packet = {
    type: 'ROOM_MESSAGE' as const,
    messageId: msgId,
    message: msg
  };

  if (room.ownerId === identity.username) {
    // I am the coordinator, handle immediately
    roomCoordinator['handleRoomMessage'](packet); // Bypass access modifier for local emit
    msg.status = 'Sent';
    return msg;
  } else {
    // Send to Coordinator
    const ownerMember = room.members.find(m => m.peerId === room.ownerId);
    if (!ownerMember) throw new Error('Owner not found in room');

    await reliableSender.sendWithRetry(ownerMember.ip, PORT_TCP, packet);
    msg.status = 'Sent';
    return msg;
  }
});
