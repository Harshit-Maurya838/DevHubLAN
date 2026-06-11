import { contextBridge, ipcRenderer } from 'electron';
import { Peer, ChatMessage, UserIdentity } from '../shared/types';

export const api = {
  // Methods
  sendMessage: (ip: string, message: string) => ipcRenderer.invoke('send-message', ip, message),
  getPeers: () => ipcRenderer.invoke('get-peers'),
  getIdentity: () => ipcRenderer.invoke('get-identity'),
  updateIdentity: (identity: Partial<UserIdentity>) => ipcRenderer.invoke('update-identity', identity),

  // Listeners
  onPeerAdded: (callback: (peer: Peer) => void) => {
    ipcRenderer.on('peer-added', (_, peer) => callback(peer));
  },
  onPeerUpdated: (callback: (peer: Peer) => void) => {
    ipcRenderer.on('peer-updated', (_, peer) => callback(peer));
  },
  onMessageReceived: (callback: (message: ChatMessage) => void) => {
    ipcRenderer.on('message-received', (_, message) => callback(message));
  },
};

contextBridge.exposeInMainWorld('api', api);

// Add typings for the global window object
declare global {
  interface Window {
    api: typeof api;
  }
}
