"use strict";
Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
const electron = require("electron");
const api = {
  // Existing Phase 1 Methods
  sendMessage: (ip, message) => electron.ipcRenderer.invoke("send-message", ip, message),
  getPeers: () => electron.ipcRenderer.invoke("get-peers"),
  getIdentity: () => electron.ipcRenderer.invoke("get-identity"),
  updateIdentity: (identity) => electron.ipcRenderer.invoke("update-identity", identity),
  // Phase 2: Room Methods
  getRooms: () => electron.ipcRenderer.invoke("get-rooms"),
  createRoom: (name, description) => electron.ipcRenderer.invoke("create-room", name, description),
  joinRoom: (roomId, ownerIp) => electron.ipcRenderer.invoke("join-room", roomId, ownerIp),
  sendRoomMessage: (roomId, content) => electron.ipcRenderer.invoke("send-room-message", roomId, content),
  // Existing Listeners
  onPeerAdded: (callback) => electron.ipcRenderer.on("peer-added", (_, peer) => callback(peer)),
  onPeerUpdated: (callback) => electron.ipcRenderer.on("peer-updated", (_, peer) => callback(peer)),
  onMessageReceived: (callback) => electron.ipcRenderer.on("message-received", (_, message) => callback(message)),
  // Phase 2: Room Listeners
  onRoomAdvertised: (callback) => electron.ipcRenderer.on("room-advertised", (_, packet) => callback(packet)),
  onRoomSynced: (callback) => electron.ipcRenderer.on("room-synced", (_, room) => callback(room)),
  onRoomMessage: (callback) => electron.ipcRenderer.on("room-message", (_, message) => callback(message))
};
electron.contextBridge.exposeInMainWorld("api", api);
exports.api = api;
