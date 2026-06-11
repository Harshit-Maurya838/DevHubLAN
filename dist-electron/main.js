"use strict";
var __defProp = Object.defineProperty;
var __defNormalProp = (obj, key, value) => key in obj ? __defProp(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
var __publicField = (obj, key, value) => __defNormalProp(obj, typeof key !== "symbol" ? key + "" : key, value);
const electron = require("electron");
const path = require("path");
const dgram = require("dgram");
const fs = require("fs");
const os = require("os");
const events = require("events");
const net = require("net");
const crypto = require("crypto");
const PORT_UDP = 5e3;
const PORT_TCP = 6e3;
const DISCOVERY_INTERVAL_MS = 5e3;
const PEER_TIMEOUT_MS = 15e3;
class SettingsManager {
  constructor() {
    __publicField(this, "settingsPath");
    __publicField(this, "identity");
    this.settingsPath = path.join(electron.app.getPath("userData"), "settings.json");
    this.identity = this.loadSettings();
  }
  loadSettings() {
    if (fs.existsSync(this.settingsPath)) {
      try {
        const data = fs.readFileSync(this.settingsPath, "utf-8");
        return JSON.parse(data);
      } catch (e) {
        console.error("Failed to load settings", e);
      }
    }
    return {
      username: "Anonymous Dev",
      deviceName: os.hostname(),
      avatar: ""
    };
  }
  getIdentity() {
    return this.identity;
  }
  updateIdentity(identity) {
    this.identity = { ...this.identity, ...identity };
    try {
      fs.writeFileSync(this.settingsPath, JSON.stringify(this.identity, null, 2));
    } catch (e) {
      console.error("Failed to save settings", e);
    }
  }
}
const settingsManager = new SettingsManager();
class UdpBroadcaster {
  constructor() {
    __publicField(this, "socket");
    __publicField(this, "interval", null);
    this.socket = dgram.createSocket("udp4");
  }
  start() {
    this.socket.bind(() => {
      this.socket.setBroadcast(true);
      this.broadcast();
      this.interval = setInterval(() => this.broadcast(), DISCOVERY_INTERVAL_MS);
    });
  }
  stop() {
    if (this.interval) clearInterval(this.interval);
    this.socket.close();
  }
  broadcast() {
    const identity = settingsManager.getIdentity();
    const packet = {
      type: "DISCOVER",
      username: identity.username,
      deviceName: identity.deviceName,
      ip: "0.0.0.0",
      // Not used strictly, the receiver gets ip from remoteInfo
      tcpPort: PORT_TCP,
      timestamp: Date.now()
    };
    this.sendPacket(packet);
    const { roomManager: roomManager2 } = require("../rooms/roomManager");
    const rooms = roomManager2.getRooms();
    for (const room of rooms) {
      if (room.ownerId === identity.username) {
        const roomPacket = {
          type: "ROOM_ADVERTISEMENT",
          roomId: room.id,
          roomName: room.name,
          owner: room.ownerId,
          memberCount: room.members.length,
          timestamp: Date.now()
        };
        this.sendPacket(roomPacket);
      }
    }
  }
  sendPacket(packet) {
    const message = Buffer.from(JSON.stringify(packet));
    this.socket.send(message, 0, message.length, PORT_UDP, "255.255.255.255", (err) => {
      if (err) {
        console.error("Broadcast error:", err);
      }
    });
  }
}
const udpBroadcaster = new UdpBroadcaster();
class PeerManager extends events.EventEmitter {
  constructor() {
    super();
    __publicField(this, "peers", /* @__PURE__ */ new Map());
    __publicField(this, "timeoutCheckInterval", null);
  }
  start() {
    this.timeoutCheckInterval = setInterval(() => this.checkTimeouts(), 5e3);
  }
  stop() {
    if (this.timeoutCheckInterval) {
      clearInterval(this.timeoutCheckInterval);
    }
  }
  handleDiscovery(packet, remoteInfo) {
    if (this.isLocalIp(remoteInfo.address)) {
      return;
    }
    const now = Date.now();
    const existingPeer = this.peers.get(remoteInfo.address);
    if (existingPeer) {
      existingPeer.lastSeen = now;
      existingPeer.username = packet.username;
      existingPeer.deviceName = packet.deviceName;
      existingPeer.tcpPort = packet.tcpPort;
      if (existingPeer.status === "Offline") {
        existingPeer.status = "Online";
        this.emit("peer-updated", existingPeer);
      }
    } else {
      const newPeer = {
        ip: remoteInfo.address,
        username: packet.username,
        deviceName: packet.deviceName,
        tcpPort: packet.tcpPort,
        status: "Online",
        lastSeen: now
      };
      this.peers.set(remoteInfo.address, newPeer);
      this.emit("peer-added", newPeer);
    }
  }
  checkTimeouts() {
    const now = Date.now();
    for (const peer of this.peers.values()) {
      if (peer.status === "Online" && now - peer.lastSeen > PEER_TIMEOUT_MS) {
        peer.status = "Offline";
        this.emit("peer-updated", peer);
      }
    }
  }
  getPeers() {
    return Array.from(this.peers.values());
  }
  getPeer(ip) {
    return this.peers.get(ip);
  }
  isLocalIp(ip) {
    const interfaces = os.networkInterfaces();
    for (const devName in interfaces) {
      const iface = interfaces[devName];
      if (iface) {
        for (let i = 0; i < iface.length; i++) {
          const alias = iface[i];
          if (alias.address === ip) {
            return true;
          }
        }
      }
    }
    return false;
  }
}
const peerManager = new PeerManager();
class UdpListener extends events.EventEmitter {
  constructor() {
    super();
    __publicField(this, "socket");
    this.socket = dgram.createSocket("udp4");
  }
  start() {
    this.socket.on("message", (msg, rinfo) => {
      try {
        const packet = JSON.parse(msg.toString());
        if (packet.type === "DISCOVER") {
          peerManager.handleDiscovery(packet, rinfo);
        } else if (packet.type === "ROOM_ADVERTISEMENT") {
          this.emit("room-advertised", packet);
        }
      } catch (e) {
      }
    });
    this.socket.on("error", (err) => {
      console.error("UDP Listener error:", err);
      this.socket.close();
    });
    this.socket.bind(PORT_UDP, () => {
      console.log(`UDP Listener bound to port ${PORT_UDP}`);
    });
  }
  stop() {
    this.socket.close();
  }
}
const udpListener = new UdpListener();
class TcpClient {
  async sendMessage(ip, port, message) {
    return new Promise((resolve, reject) => {
      const client = new net.Socket();
      client.connect(port, ip, () => {
        client.write(JSON.stringify(message) + "\n");
        client.end();
        resolve();
      });
      client.on("error", (err) => {
        reject(err);
      });
    });
  }
}
const tcpClient = new TcpClient();
class ReliableSender extends events.EventEmitter {
  constructor() {
    super();
    __publicField(this, "pendingAcks", /* @__PURE__ */ new Map());
  }
  async sendWithRetry(ip, port, packet, maxRetries = 3) {
    const attempt = async (retriesLeft) => {
      try {
        await tcpClient.sendMessage(ip, port, packet);
        return new Promise((resolve, reject) => {
          const timer = setTimeout(() => {
            this.pendingAcks.delete(packet.messageId);
            if (retriesLeft > 0) {
              console.log(`Timeout waiting for ACK, retrying ${packet.messageId}...`);
              attempt(retriesLeft - 1).then(resolve).catch(reject);
            } else {
              reject(new Error(`Failed to deliver message ${packet.messageId} after max retries`));
            }
          }, 2e3);
          this.pendingAcks.set(packet.messageId, { timer, retries: retriesLeft });
        });
      } catch (err) {
        if (retriesLeft > 0) {
          await new Promise((r) => setTimeout(r, 1e3));
          return attempt(retriesLeft - 1);
        }
        throw err;
      }
    };
    return attempt(maxRetries);
  }
  handleAck(messageId) {
    const pending = this.pendingAcks.get(messageId);
    if (pending) {
      clearTimeout(pending.timer);
      this.pendingAcks.delete(messageId);
    }
  }
}
const reliableSender = new ReliableSender();
class MessageHandler extends events.EventEmitter {
  constructor() {
    super();
  }
  handleIncomingMessage(msg, remoteIp) {
    if (msg.type === "ACK") {
      reliableSender.handleAck(msg.messageId);
      return;
    }
    this.emit("packet-received", msg, remoteIp);
    if (msg.type === "CHAT") {
      this.emit("message-received", msg);
    }
  }
}
const messageHandler = new MessageHandler();
class TcpServer {
  constructor() {
    __publicField(this, "server");
    this.server = net.createServer((socket) => {
      let buffer = "";
      socket.on("data", (data) => {
        buffer += data.toString();
        let boundary = buffer.indexOf("\n");
        while (boundary !== -1) {
          const packetStr = buffer.substring(0, boundary);
          buffer = buffer.substring(boundary + 1);
          try {
            const msg = JSON.parse(packetStr);
            messageHandler.handleIncomingMessage(msg, socket.remoteAddress || "");
          } catch (e) {
            console.error("Invalid TCP packet", packetStr);
          }
          boundary = buffer.indexOf("\n");
        }
      });
      socket.on("error", (err) => {
        console.error("TCP Server socket error", err);
      });
    });
  }
  start() {
    this.server.listen(PORT_TCP, "0.0.0.0", () => {
      console.log(`TCP Server listening on port ${PORT_TCP}`);
    });
  }
  stop() {
    this.server.close();
  }
}
const tcpServer = new TcpServer();
class RoomManager {
  constructor() {
    __publicField(this, "storagePath");
    __publicField(this, "rooms", /* @__PURE__ */ new Map());
    this.storagePath = path.join(electron.app.getPath("userData"), "rooms.json");
    this.loadRooms();
  }
  loadRooms() {
    if (fs.existsSync(this.storagePath)) {
      try {
        const data = fs.readFileSync(this.storagePath, "utf-8");
        const parsed = JSON.parse(data);
        parsed.forEach((room) => this.rooms.set(room.id, room));
      } catch (e) {
        console.error("Failed to load rooms storage", e);
      }
    }
  }
  saveRooms() {
    try {
      const data = Array.from(this.rooms.values());
      fs.writeFileSync(this.storagePath, JSON.stringify(data, null, 2));
    } catch (e) {
      console.error("Failed to save rooms storage", e);
    }
  }
  getRooms() {
    return Array.from(this.rooms.values());
  }
  getRoom(roomId) {
    return this.rooms.get(roomId);
  }
  addOrUpdateRoom(room) {
    this.rooms.set(room.id, room);
    this.saveRooms();
  }
  deleteRoom(roomId) {
    this.rooms.delete(roomId);
    this.saveRooms();
  }
}
const roomManager = new RoomManager();
const rnds8Pool = new Uint8Array(256);
let poolPtr = rnds8Pool.length;
function rng() {
  if (poolPtr > rnds8Pool.length - 16) {
    crypto.randomFillSync(rnds8Pool);
    poolPtr = 0;
  }
  return rnds8Pool.slice(poolPtr, poolPtr += 16);
}
const byteToHex = [];
for (let i = 0; i < 256; ++i) {
  byteToHex.push((i + 256).toString(16).slice(1));
}
function unsafeStringify(arr, offset = 0) {
  return byteToHex[arr[offset + 0]] + byteToHex[arr[offset + 1]] + byteToHex[arr[offset + 2]] + byteToHex[arr[offset + 3]] + "-" + byteToHex[arr[offset + 4]] + byteToHex[arr[offset + 5]] + "-" + byteToHex[arr[offset + 6]] + byteToHex[arr[offset + 7]] + "-" + byteToHex[arr[offset + 8]] + byteToHex[arr[offset + 9]] + "-" + byteToHex[arr[offset + 10]] + byteToHex[arr[offset + 11]] + byteToHex[arr[offset + 12]] + byteToHex[arr[offset + 13]] + byteToHex[arr[offset + 14]] + byteToHex[arr[offset + 15]];
}
const native = {
  randomUUID: crypto.randomUUID
};
function v4(options, buf, offset) {
  if (native.randomUUID && true && !options) {
    return native.randomUUID();
  }
  options = options || {};
  const rnds = options.random || (options.rng || rng)();
  rnds[6] = rnds[6] & 15 | 64;
  rnds[8] = rnds[8] & 63 | 128;
  return unsafeStringify(rnds);
}
class RoomCoordinator extends events.EventEmitter {
  constructor() {
    super();
    messageHandler.on("packet-received", this.handlePacket.bind(this));
  }
  handlePacket(packet, remoteIp) {
    if (packet.type === "ROOM_JOIN_REQUEST") {
      this.handleJoinRequest(packet, remoteIp);
    } else if (packet.type === "ROOM_MESSAGE") {
      this.handleRoomMessage(packet);
    }
  }
  async handleJoinRequest(packet, remoteIp) {
    const room = roomManager.getRoom(packet.roomId);
    if (!room) return;
    if (room.ownerId !== settingsManager.getIdentity().username) return;
    const member = {
      peerId: packet.peerId,
      ip: remoteIp,
      // from TCP socket or packet
      role: "Member",
      joinedAt: Date.now()
    };
    if (!room.members.find((m) => m.peerId === packet.peerId)) {
      room.members.push(member);
      roomManager.addOrUpdateRoom(room);
    }
    const peer = peerManager.getPeer(remoteIp);
    if (peer) {
      await reliableSender.sendWithRetry(peer.ip, peer.tcpPort || PORT_TCP, {
        type: "ROOM_JOIN_RESPONSE",
        messageId: v4(),
        roomId: room.id,
        accepted: true,
        room
      });
    }
    this.broadcastStateSync(room);
  }
  handleRoomMessage(packet) {
    const room = roomManager.getRoom(packet.message.roomId);
    if (!room || room.ownerId !== settingsManager.getIdentity().username) return;
    this.broadcastToMembers(room, packet, [packet.message.senderId]);
    this.emit("room-message", packet.message);
  }
  broadcastStateSync(room) {
    const syncPacket = {
      type: "ROOM_STATE_SYNC",
      messageId: v4(),
      room
    };
    this.broadcastToMembers(room, syncPacket);
  }
  broadcastToMembers(room, packet, excludePeerIds = []) {
    const myUsername = settingsManager.getIdentity().username;
    for (const member of room.members) {
      if (member.peerId === myUsername || excludePeerIds.includes(member.peerId)) continue;
      const peer = peerManager.getPeer(member.ip);
      if (peer) {
        reliableSender.sendWithRetry(peer.ip, peer.tcpPort || PORT_TCP, packet).catch(console.error);
      }
    }
  }
}
const roomCoordinator = new RoomCoordinator();
class RoomSync extends events.EventEmitter {
  constructor() {
    super();
    messageHandler.on("packet-received", this.handlePacket.bind(this));
  }
  handlePacket(packet, _remoteIp) {
    if (packet.type === "ROOM_STATE_SYNC") {
      this.handleStateSync(packet);
    } else if (packet.type === "ROOM_MESSAGE") {
      this.handleRoomMessage(packet);
    }
  }
  handleStateSync(packet) {
    const myUsername = settingsManager.getIdentity().username;
    if (packet.room.ownerId === myUsername) return;
    roomManager.addOrUpdateRoom(packet.room);
    this.emit("room-synced", packet.room);
  }
  handleRoomMessage(packet) {
    const myUsername = settingsManager.getIdentity().username;
    const room = roomManager.getRoom(packet.message.roomId);
    if (!room || room.ownerId === myUsername) return;
    this.emit("room-message", packet.message);
  }
}
const roomSync = new RoomSync();
class ElectionManager {
  constructor() {
    peerManager.on("peer-updated", this.handlePeerUpdate.bind(this));
  }
  handlePeerUpdate(peer) {
    if (peer.status === "Offline") {
      this.checkAndElectNewOwner(peer.username);
    }
  }
  checkAndElectNewOwner(offlineUsername) {
    const rooms = roomManager.getRooms();
    const myUsername = settingsManager.getIdentity().username;
    for (const room of rooms) {
      if (room.ownerId === offlineUsername) {
        const activeMembers = room.members.filter((m) => {
          if (m.peerId === myUsername) return true;
          const p = peerManager.getPeer(m.ip);
          return p && p.status === "Online";
        });
        if (activeMembers.length === 0) continue;
        activeMembers.sort((a, b) => {
          if (a.joinedAt !== b.joinedAt) {
            return a.joinedAt - b.joinedAt;
          }
          return a.peerId.localeCompare(b.peerId);
        });
        const newOwner = activeMembers[0];
        if (newOwner.peerId === myUsername) {
          console.log(`Elected as new owner for room: ${room.name}`);
          room.ownerId = myUsername;
          const me = room.members.find((m) => m.peerId === myUsername);
          if (me) me.role = "Owner";
          roomManager.addOrUpdateRoom(room);
          const { roomCoordinator: roomCoordinator2 } = require("./roomCoordinator");
          roomCoordinator2.broadcastStateSync(room);
        }
      }
    }
  }
}
new ElectionManager();
let mainWindow = null;
function getLocalIp() {
  const interfaces = os.networkInterfaces();
  for (const devName in interfaces) {
    const iface = interfaces[devName];
    if (iface) {
      for (let i = 0; i < iface.length; i++) {
        const alias = iface[i];
        if (alias.family === "IPv4" && !alias.internal) return alias.address;
      }
    }
  }
  return "127.0.0.1";
}
function createWindow() {
  mainWindow = new electron.BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      nodeIntegration: false,
      contextIsolation: true
    },
    backgroundColor: "#1E1E2E"
  });
  if (process.env.VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL);
  } else {
    mainWindow.loadFile(path.join(__dirname, "../dist/index.html"));
  }
}
electron.app.whenReady().then(() => {
  createWindow();
  udpListener.start();
  udpBroadcaster.start();
  peerManager.start();
  tcpServer.start();
  peerManager.on("peer-added", (peer) => {
    if (mainWindow) mainWindow.webContents.send("peer-added", peer);
  });
  peerManager.on("peer-updated", (peer) => {
    if (mainWindow) mainWindow.webContents.send("peer-updated", peer);
  });
  messageHandler.on("message-received", (msg) => {
    if (mainWindow) mainWindow.webContents.send("message-received", msg);
  });
  udpListener.on("room-advertised", (packet) => {
    if (mainWindow) mainWindow.webContents.send("room-advertised", packet);
  });
  roomSync.on("room-synced", (room) => {
    if (mainWindow) mainWindow.webContents.send("room-synced", room);
  });
  roomCoordinator.on("room-message", (msg) => {
    if (mainWindow) mainWindow.webContents.send("room-message", msg);
  });
  roomSync.on("room-message", (msg) => {
    if (mainWindow) mainWindow.webContents.send("room-message", msg);
  });
  electron.app.on("activate", () => {
    if (electron.BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});
electron.app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    electron.app.quit();
  }
});
electron.app.on("will-quit", () => {
  udpListener.stop();
  udpBroadcaster.stop();
  peerManager.stop();
  tcpServer.stop();
});
electron.ipcMain.handle("get-peers", () => peerManager.getPeers());
electron.ipcMain.handle("get-identity", () => settingsManager.getIdentity());
electron.ipcMain.handle("update-identity", (_, identity) => {
  settingsManager.updateIdentity(identity);
});
electron.ipcMain.handle("send-message", async (_, ip, content) => {
  const peer = peerManager.getPeer(ip);
  if (!peer) throw new Error("Peer not found");
  const identity = settingsManager.getIdentity();
  const msg = {
    type: "CHAT",
    messageId: v4(),
    sender: identity.username,
    timestamp: Date.now(),
    content
  };
  const packet = { ...msg };
  await new TcpClient().sendMessage(ip, peer.tcpPort || PORT_TCP, packet);
  return msg;
});
electron.ipcMain.handle("get-rooms", () => roomManager.getRooms());
electron.ipcMain.handle("create-room", async (_, name, description) => {
  const identity = settingsManager.getIdentity();
  const owner = {
    peerId: identity.username,
    ip: getLocalIp(),
    role: "Owner",
    joinedAt: Date.now()
  };
  const newRoom = {
    id: v4(),
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
electron.ipcMain.handle("join-room", async (_, roomId, ownerIp) => {
  const identity = settingsManager.getIdentity();
  const msgId = v4();
  await reliableSender.sendWithRetry(ownerIp, PORT_TCP, {
    type: "ROOM_JOIN_REQUEST",
    messageId: msgId,
    roomId,
    peerId: identity.username,
    ip: getLocalIp()
  });
  return { status: "requested" };
});
electron.ipcMain.handle("send-room-message", async (_, roomId, content) => {
  const identity = settingsManager.getIdentity();
  const room = roomManager.getRoom(roomId);
  if (!room) throw new Error("Room not found");
  const msgId = v4();
  const msg = {
    id: msgId,
    roomId,
    senderId: identity.username,
    content,
    timestamp: Date.now(),
    status: "Sending"
  };
  const packet = {
    type: "ROOM_MESSAGE",
    messageId: msgId,
    message: msg
  };
  if (room.ownerId === identity.username) {
    roomCoordinator["handleRoomMessage"](packet);
    msg.status = "Sent";
    return msg;
  } else {
    const ownerMember = room.members.find((m) => m.peerId === room.ownerId);
    if (!ownerMember) throw new Error("Owner not found in room");
    await reliableSender.sendWithRetry(ownerMember.ip, PORT_TCP, packet);
    msg.status = "Sent";
    return msg;
  }
});
