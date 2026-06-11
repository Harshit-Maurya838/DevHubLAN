import { contextBridge, ipcRenderer } from 'electron';
import { Peer, ChatMessage, UserIdentity } from '../shared/types';
import { Room, RoomMessage } from '../shared/roomTypes';
import { RoomAdvertisementPacket } from '../shared/roomPackets';

export const api = {
  // Existing Phase 1 Methods
  sendMessage: (ip: string, message: string) => ipcRenderer.invoke('send-message', ip, message),
  getPeers: () => ipcRenderer.invoke('get-peers'),
  getIdentity: () => ipcRenderer.invoke('get-identity'),
  updateIdentity: (identity: Partial<UserIdentity>) => ipcRenderer.invoke('update-identity', identity),

  // Phase 2: Room Methods
  getRooms: () => ipcRenderer.invoke('get-rooms'),
  createRoom: (name: string, description: string) => ipcRenderer.invoke('create-room', name, description),
  joinRoom: (roomId: string, ownerIp: string) => ipcRenderer.invoke('join-room', roomId, ownerIp),
  sendRoomMessage: (roomId: string, content: string) => ipcRenderer.invoke('send-room-message', roomId, content),

  // Existing Listeners
  onPeerAdded: (callback: (peer: Peer) => void) => ipcRenderer.on('peer-added', (_, peer) => callback(peer)),
  onPeerUpdated: (callback: (peer: Peer) => void) => ipcRenderer.on('peer-updated', (_, peer) => callback(peer)),
  onMessageReceived: (callback: (message: ChatMessage) => void) => ipcRenderer.on('message-received', (_, message) => callback(message)),

  // Phase 2: Room Listeners
  onRoomAdvertised: (callback: (packet: RoomAdvertisementPacket) => void) => ipcRenderer.on('room-advertised', (_, packet) => callback(packet)),
  onRoomSynced: (callback: (room: Room) => void) => ipcRenderer.on('room-synced', (_, room) => callback(room)),
  onRoomMessage: (callback: (message: RoomMessage) => void) => ipcRenderer.on('room-message', (_, message) => callback(message)),
};

contextBridge.exposeInMainWorld('api', api);

declare global {
  interface Window {
    api: typeof api;
  }
}
