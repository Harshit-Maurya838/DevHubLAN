"use strict";
var __defProp = Object.defineProperty;
var __defNormalProp = (obj, key, value) => key in obj ? __defProp(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
var __publicField = (obj, key, value) => __defNormalProp(obj, typeof key !== "symbol" ? key + "" : key, value);
const electron = require("electron");
const path = require("path");
const dgram = require("dgram");
const fs = require("fs");
const os = require("os");
const crypto = require("crypto");
const util = require("util");
const events = require("events");
const net = require("net");
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
const generateKeyPairAsync = util.promisify(crypto.generateKeyPair);
class IdentityManager {
  constructor() {
    __publicField(this, "keyPath");
    __publicField(this, "keyPair", null);
    __publicField(this, "fingerprint", null);
    this.keyPath = path.join(electron.app.getPath("userData"), "identity_keys.json");
  }
  async initialize() {
    if (fs.existsSync(this.keyPath)) {
      this.loadKeys();
    } else {
      await this.generateKeys();
    }
  }
  async generateKeys() {
    console.log("Generating RSA-4096 Keypair. This might take a few seconds...");
    const { publicKey, privateKey } = await generateKeyPairAsync("rsa", {
      modulusLength: 4096,
      publicKeyEncoding: {
        type: "spki",
        format: "pem"
      },
      privateKeyEncoding: {
        type: "pkcs8",
        format: "pem"
      }
    });
    this.keyPair = { publicKey, privateKey };
    this.calculateFingerprint();
    this.saveKeys();
  }
  calculateFingerprint() {
    if (!this.keyPair) return;
    const hash = crypto.createHash("sha256");
    hash.update(this.keyPair.publicKey);
    this.fingerprint = hash.digest("hex");
  }
  saveKeys() {
    if (!this.keyPair) return;
    let privateKeyToSave = this.keyPair.privateKey;
    let isEncrypted = false;
    if (electron.safeStorage.isEncryptionAvailable()) {
      try {
        const encryptedBuffer = electron.safeStorage.encryptString(this.keyPair.privateKey);
        privateKeyToSave = encryptedBuffer.toString("base64");
        isEncrypted = true;
      } catch (err) {
        console.warn("Failed to encrypt private key with safeStorage, saving in plaintext.", err);
      }
    } else {
      console.warn("safeStorage is not available on this OS, saving private key in plaintext.");
    }
    const data = {
      publicKey: this.keyPair.publicKey,
      privateKey: privateKeyToSave,
      isEncrypted
    };
    fs.writeFileSync(this.keyPath, JSON.stringify(data, null, 2));
  }
  loadKeys() {
    try {
      const dataStr = fs.readFileSync(this.keyPath, "utf-8");
      const data = JSON.parse(dataStr);
      let privateKey = data.privateKey;
      if (data.isEncrypted) {
        if (electron.safeStorage.isEncryptionAvailable()) {
          try {
            const buffer = Buffer.from(privateKey, "base64");
            privateKey = electron.safeStorage.decryptString(buffer);
          } catch (err) {
            console.error("Failed to decrypt private key!", err);
            throw new Error("Failed to decrypt private key. Device identity compromised.");
          }
        } else {
          throw new Error("Key is encrypted but safeStorage is not available.");
        }
      }
      this.keyPair = {
        publicKey: data.publicKey,
        privateKey
      };
      this.calculateFingerprint();
    } catch (e) {
      console.error("Error loading identity keys:", e);
    }
  }
  getPublicKey() {
    if (!this.keyPair) throw new Error("IdentityManager not initialized");
    return this.keyPair.publicKey;
  }
  sign(data) {
    if (!this.keyPair) throw new Error("IdentityManager not initialized");
    const sign = crypto.createSign("SHA256");
    sign.update(data);
    sign.end();
    return sign.sign(this.keyPair.privateKey, "base64");
  }
  verify(data, signature, publicKey) {
    const verify = crypto.createVerify("SHA256");
    verify.update(data);
    verify.end();
    return verify.verify(publicKey, signature, "base64");
  }
  getFingerprint(publicKey) {
    const hash = crypto.createHash("sha256");
    hash.update(publicKey);
    return hash.digest("hex");
  }
  decryptRSA(encryptedBase64) {
    if (!this.keyPair) throw new Error("IdentityManager not initialized");
    const buffer = Buffer.from(encryptedBase64, "base64");
    const decrypted = crypto.privateDecrypt(
      {
        key: this.keyPair.privateKey,
        padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
        oaepHash: "sha256"
      },
      buffer
    );
    return decrypted.toString("utf8");
  }
}
const identityManager = new IdentityManager();
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
    const basePacket = {
      type: "DISCOVER",
      username: identity.username,
      deviceName: identity.deviceName,
      ip: "0.0.0.0",
      // Not used strictly, the receiver gets ip from remoteInfo
      tcpPort: PORT_TCP,
      timestamp: Date.now()
    };
    const signatureStr = `${basePacket.type}${basePacket.username}${basePacket.timestamp}`;
    const signature = identityManager.sign(Buffer.from(signatureStr));
    const packet = {
      ...basePacket,
      publicKey: identityManager.getPublicKey(),
      signature
    };
    this.sendPacket(packet);
    const rooms = roomManager.getRooms();
    for (const room of rooms) {
      if (room.ownerId === identity.username) {
        const roomBase = {
          type: "ROOM_ADVERTISEMENT",
          roomId: room.id,
          roomName: room.name,
          owner: room.ownerId,
          memberCount: room.members.length,
          timestamp: Date.now()
        };
        const roomSigStr = `${roomBase.type}${roomBase.roomId}${roomBase.timestamp}`;
        const roomSignature = identityManager.sign(Buffer.from(roomSigStr));
        const roomPacket = {
          ...roomBase,
          publicKey: identityManager.getPublicKey(),
          signature: roomSignature
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
class TrustManager extends events.EventEmitter {
  // fingerprint -> Identity
  constructor() {
    super();
    __publicField(this, "trustPath");
    __publicField(this, "identities", /* @__PURE__ */ new Map());
    this.trustPath = path.join(electron.app.getPath("userData"), "trusted_devices.json");
    this.loadTrusts();
  }
  loadTrusts() {
    if (fs.existsSync(this.trustPath)) {
      try {
        const data = fs.readFileSync(this.trustPath, "utf-8");
        const parsed = JSON.parse(data);
        parsed.forEach((dev) => this.identities.set(dev.fingerprint, dev));
      } catch (e) {
        console.error("Failed to load trust database", e);
      }
    }
  }
  saveTrusts() {
    try {
      const data = Array.from(this.identities.values());
      fs.writeFileSync(this.trustPath, JSON.stringify(data, null, 2));
    } catch (e) {
      console.error("Failed to save trust database", e);
    }
  }
  registerDevice(peerId, publicKey, fingerprint) {
    if (!this.identities.has(fingerprint)) {
      this.identities.set(fingerprint, {
        peerId,
        publicKey,
        fingerprint,
        status: "UNKNOWN",
        firstSeenAt: Date.now(),
        lastSeenAt: Date.now()
      });
      this.saveTrusts();
      this.emit("device-discovered", this.identities.get(fingerprint));
    } else {
      const dev = this.identities.get(fingerprint);
      dev.lastSeenAt = Date.now();
      if (dev.peerId !== peerId) dev.peerId = peerId;
      this.saveTrusts();
    }
  }
  getTrustStatus(fingerprint) {
    var _a;
    return ((_a = this.identities.get(fingerprint)) == null ? void 0 : _a.status) || "UNKNOWN";
  }
  setTrustStatus(fingerprint, status) {
    const dev = this.identities.get(fingerprint);
    if (dev) {
      dev.status = status;
      this.saveTrusts();
      this.emit("trust-updated", dev);
    }
  }
  isBlocked(fingerprint) {
    return this.getTrustStatus(fingerprint) === "BLOCKED";
  }
  getAllDevices() {
    return Array.from(this.identities.values());
  }
}
const trustManager = new TrustManager();
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
class SecurityLogManager extends events.EventEmitter {
  constructor() {
    super();
    __publicField(this, "logPath");
    __publicField(this, "logs", []);
    this.logPath = path.join(electron.app.getPath("userData"), "security_logs.json");
    this.loadLogs();
  }
  loadLogs() {
    if (fs.existsSync(this.logPath)) {
      try {
        const data = fs.readFileSync(this.logPath, "utf-8");
        this.logs = JSON.parse(data);
      } catch (e) {
        console.error("Failed to load security logs", e);
      }
    }
  }
  saveLogs() {
    try {
      if (this.logs.length > 1e3) {
        this.logs = this.logs.slice(this.logs.length - 1e3);
      }
      fs.writeFileSync(this.logPath, JSON.stringify(this.logs, null, 2));
    } catch (e) {
      console.error("Failed to save security logs", e);
    }
  }
  logEvent(type, details, peerId) {
    const log = {
      id: v4(),
      timestamp: Date.now(),
      type,
      details,
      peerId
    };
    this.logs.push(log);
    this.saveLogs();
    console.warn(`[SECURITY] ${type}: ${details}`);
    this.emit("new-log", log);
  }
  getLogs() {
    return this.logs;
  }
}
const securityLogManager = new SecurityLogManager();
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
        if (!packet.publicKey || !packet.signature) return;
        const fingerprint = identityManager.getFingerprint(packet.publicKey);
        if (trustManager.isBlocked(fingerprint)) {
          securityLogManager.logEvent("BLOCKED_PEER_ATTEMPT", "Blocked peer attempted UDP broadcast", packet.username || packet.owner);
          return;
        }
        let sigStr = "";
        if (packet.type === "DISCOVER") {
          sigStr = `${packet.type}${packet.username}${packet.timestamp}`;
        } else if (packet.type === "ROOM_ADVERTISEMENT") {
          sigStr = `${packet.type}${packet.roomId}${packet.timestamp}`;
        } else {
          return;
        }
        const isValid = identityManager.verify(Buffer.from(sigStr), packet.signature, packet.publicKey);
        if (!isValid) {
          securityLogManager.logEvent("INVALID_SIGNATURE", `Invalid UDP signature for ${packet.type}`, packet.username || packet.owner);
          return;
        }
        trustManager.registerDevice(packet.username || packet.owner, packet.publicKey, fingerprint);
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
class CryptoManager {
  constructor() {
    __publicField(this, "activeSessions", /* @__PURE__ */ new Map());
    // Room Key Management
    __publicField(this, "activeRoomKeys", /* @__PURE__ */ new Map());
  }
  // peerId -> SessionKey
  /**
   * Generates a random AES-256 key
   */
  generateSessionKey() {
    return crypto.randomBytes(32).toString("hex");
  }
  /**
   * Encrypts a payload using AES-256-GCM
   */
  encryptAES(payload, hexKey) {
    const key = Buffer.from(hexKey, "hex");
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
    let encrypted = cipher.update(payload, "utf8", "hex");
    encrypted += cipher.final("hex");
    const authTag = cipher.getAuthTag().toString("hex");
    return {
      iv: iv.toString("hex"),
      data: encrypted,
      authTag
    };
  }
  /**
   * Decrypts a payload using AES-256-GCM
   */
  decryptAES(payload, hexKey) {
    const key = Buffer.from(hexKey, "hex");
    const iv = Buffer.from(payload.iv, "hex");
    const authTag = Buffer.from(payload.authTag, "hex");
    const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
    decipher.setAuthTag(authTag);
    let decrypted = decipher.update(payload.data, "hex", "utf8");
    decrypted += decipher.final("utf8");
    return decrypted;
  }
  /**
   * Encrypts an AES key (or any short string) using a receiver's RSA Public Key
   */
  encryptRSA(data, recipientPublicKeyPem) {
    const buffer = Buffer.from(data, "utf8");
    const encrypted = crypto.publicEncrypt(
      {
        key: recipientPublicKeyPem,
        padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
        oaepHash: "sha256"
      },
      buffer
    );
    return encrypted.toString("base64");
  }
  /**
   * Decrypts an AES key (or any short string) using our local RSA Private Key
   */
  decryptRSA(_encryptedBase64) {
    throw new Error("decryptRSA implemented in IdentityManager to protect private key");
  }
  // Session Management
  setSessionKey(peerId, keyHex, expiresInMs = 30 * 60 * 1e3) {
    this.activeSessions.set(peerId, {
      key: keyHex,
      expiresAt: Date.now() + expiresInMs
    });
  }
  getSessionKey(peerId) {
    const session = this.activeSessions.get(peerId);
    if (!session) return null;
    if (Date.now() > session.expiresAt) {
      this.activeSessions.delete(peerId);
      return null;
    }
    return session.key;
  }
  hasActiveSession(peerId) {
    return this.getSessionKey(peerId) !== null;
  }
  removeSession(peerId) {
    this.activeSessions.delete(peerId);
  }
  /**
   * Wraps a plaintext packet into a SignedMessage (AES Encrypted + RSA Signed)
   */
  secureWrap(packet, peerId) {
    const sessionKey = this.getSessionKey(peerId);
    if (!sessionKey) throw new Error("No active session key for peer");
    const plaintext = JSON.stringify(packet);
    const encryptedPayload = this.encryptAES(plaintext, sessionKey);
    const payloadStr = JSON.stringify(encryptedPayload);
    const signature = identityManager.sign(Buffer.from(payloadStr));
    const myIdentity = settingsManager.getIdentity();
    return {
      payload: encryptedPayload,
      signature,
      senderId: myIdentity.username
    };
  }
  setRoomKey(roomId, keyHex) {
    this.activeRoomKeys.set(roomId, keyHex);
  }
  getRoomKey(roomId) {
    return this.activeRoomKeys.get(roomId) || null;
  }
  secureRoomWrap(packet, roomId) {
    const roomKey = this.getRoomKey(roomId);
    if (!roomKey) throw new Error("No active room key for " + roomId);
    const plaintext = JSON.stringify(packet);
    const encryptedPayload = this.encryptAES(plaintext, roomKey);
    const payloadStr = JSON.stringify(encryptedPayload);
    const signature = identityManager.sign(Buffer.from(payloadStr));
    const myIdentity = settingsManager.getIdentity();
    return {
      payload: encryptedPayload,
      signature,
      senderId: myIdentity.username,
      roomId
      // Attach roomId so receiver knows which key to use
    };
  }
}
const cryptoManager = new CryptoManager();
class HandshakeManager extends events.EventEmitter {
  constructor() {
    super(...arguments);
    // Store challenges we've sent out waiting for a response
    __publicField(this, "pendingChallenges", /* @__PURE__ */ new Map());
    // Queue messages while handshake is happening
    __publicField(this, "messageQueue", /* @__PURE__ */ new Map());
  }
  async initiateHandshake(peerIp, _peerId) {
    const myIdentity = settingsManager.getIdentity();
    const packet = {
      type: "HELLO",
      peerId: myIdentity.username,
      publicKey: identityManager.getPublicKey()
    };
    await tcpClient.sendMessage(peerIp, PORT_TCP, packet);
  }
  async handleHello(packet, remoteIp) {
    if (trustManager.isBlocked(identityManager.getFingerprint(packet.publicKey))) {
      securityLogManager.logEvent("BLOCKED_PEER_ATTEMPT", "Blocked peer sent HELLO", packet.peerId);
      return;
    }
    const nonce = crypto.randomBytes(32).toString("hex");
    const encryptedNonce = cryptoManager.encryptRSA(nonce, packet.publicKey);
    this.pendingChallenges.set(packet.peerId, { expectedNonce: nonce, peerPublicKey: packet.publicKey });
    const myIdentity = settingsManager.getIdentity();
    const challenge = {
      type: "CHALLENGE",
      peerId: myIdentity.username,
      publicKey: identityManager.getPublicKey(),
      encryptedNonce
    };
    await tcpClient.sendMessage(remoteIp, PORT_TCP, challenge);
  }
  async handleChallenge(packet, remoteIp) {
    if (trustManager.isBlocked(identityManager.getFingerprint(packet.publicKey))) return;
    try {
      const decryptedNonce = identityManager.decryptRSA(packet.encryptedNonce);
      const nonceSignature = identityManager.sign(Buffer.from(decryptedNonce));
      const sessionKey = cryptoManager.generateSessionKey();
      cryptoManager.setSessionKey(packet.peerId, sessionKey);
      const encryptedSessionKey = cryptoManager.encryptRSA(sessionKey, packet.publicKey);
      const myIdentity = settingsManager.getIdentity();
      const response = {
        type: "CHALLENGE_RESPONSE",
        peerId: myIdentity.username,
        nonceSignature,
        encryptedSessionKey
      };
      await tcpClient.sendMessage(remoteIp, PORT_TCP, response);
    } catch (e) {
      securityLogManager.logEvent("HANDSHAKE_FAILED", "Failed to decrypt or respond to challenge", packet.peerId);
    }
  }
  async handleChallengeResponse(packet, remoteIp) {
    const pending = this.pendingChallenges.get(packet.peerId);
    if (!pending) return;
    const isValid = identityManager.verify(Buffer.from(pending.expectedNonce), packet.nonceSignature, pending.peerPublicKey);
    const myIdentity = settingsManager.getIdentity();
    if (!isValid) {
      securityLogManager.logEvent("HANDSHAKE_FAILED", "Invalid challenge response signature", packet.peerId);
      await tcpClient.sendMessage(remoteIp, PORT_TCP, {
        type: "SESSION_ESTABLISHED",
        peerId: myIdentity.username,
        status: "REJECTED"
      });
      this.pendingChallenges.delete(packet.peerId);
      return;
    }
    try {
      const sessionKey = identityManager.decryptRSA(packet.encryptedSessionKey);
      cryptoManager.setSessionKey(packet.peerId, sessionKey);
      await tcpClient.sendMessage(remoteIp, PORT_TCP, {
        type: "SESSION_ESTABLISHED",
        peerId: myIdentity.username,
        status: "ACCEPTED"
      });
      this.pendingChallenges.delete(packet.peerId);
      this.emit("session-established", packet.peerId);
      this.flushQueue(packet.peerId);
    } catch (e) {
      securityLogManager.logEvent("HANDSHAKE_FAILED", "Failed to decrypt session key", packet.peerId);
    }
  }
  handleSessionEstablished(packet) {
    if (packet.status === "ACCEPTED") {
      this.emit("session-established", packet.peerId);
      this.flushQueue(packet.peerId);
    } else {
      securityLogManager.logEvent("HANDSHAKE_FAILED", "Peer rejected session", packet.peerId);
      cryptoManager.removeSession(packet.peerId);
    }
  }
  flushQueue(peerId) {
    const messages = this.getQueuedMessages(peerId);
    for (const msg of messages) {
      reliableSender.sendWithRetry(msg.ip, msg.port, msg.packet, msg.maxRetries);
    }
  }
  // Queueing system for messages that are waiting for handshake
  queueMessage(peerId, message) {
    const q = this.messageQueue.get(peerId) || [];
    q.push(message);
    this.messageQueue.set(peerId, q);
  }
  getQueuedMessages(peerId) {
    const messages = this.messageQueue.get(peerId) || [];
    this.messageQueue.delete(peerId);
    return messages;
  }
}
const handshakeManager = new HandshakeManager();
class ReliableSender extends events.EventEmitter {
  constructor() {
    super();
    __publicField(this, "pendingAcks", /* @__PURE__ */ new Map());
  }
  async sendWithRetry(ip, port, packet, maxRetries = 3) {
    const attempt = async (retriesLeft) => {
      try {
        const peer = peerManager.getPeer(ip);
        if (!peer) throw new Error("Cannot send reliable message, peer unknown");
        if (!cryptoManager.hasActiveSession(peer.username)) {
          console.log("No active session for", peer.username, "Initiating handshake...");
          handshakeManager.queueMessage(peer.username, { ip, port, packet, maxRetries });
          await handshakeManager.initiateHandshake(ip, peer.username);
          return;
        }
        const securePacket = cryptoManager.secureWrap(packet, peer.username);
        await tcpClient.sendMessage(ip, port, securePacket);
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
class KeyRotationSystem extends events.EventEmitter {
  constructor() {
    super();
    // 30 minutes for sessions, 24 hours for rooms
    __publicField(this, "SESSION_KEY_LIFETIME", 30 * 60 * 1e3);
  }
  async rotateSessionKey(peerId) {
    const peer = peerManager.getPeers().find((p) => p.username === peerId);
    if (!peer) return;
    const newSessionKey = cryptoManager.generateSessionKey();
    cryptoManager.setSessionKey(peerId, newSessionKey, this.SESSION_KEY_LIFETIME);
    const encryptedKey = cryptoManager.encryptRSA(newSessionKey, peer.publicKey);
    const packet = {
      type: "KEY_ROTATION",
      messageId: v4(),
      peerId: settingsManager.getIdentity().username,
      encryptedKey,
      timestamp: Date.now(),
      signature: ""
      // We will sign it now
    };
    const sigStr = `${packet.type}${packet.peerId}${packet.timestamp}`;
    packet.signature = identityManager.sign(Buffer.from(sigStr));
    await tcpClient.sendMessage(peer.ip, PORT_TCP, packet);
  }
  handleKeyRotation(packet) {
    const peer = peerManager.getPeers().find((p) => p.username === packet.peerId);
    if (!peer) return;
    const sigStr = `${packet.type}${packet.peerId}${packet.timestamp}`;
    const isValid = identityManager.verify(Buffer.from(sigStr), packet.signature, peer.publicKey);
    if (!isValid) return;
    try {
      const decryptedKey = identityManager.decryptRSA(packet.encryptedKey);
      if (packet.roomId) {
      } else {
        cryptoManager.setSessionKey(packet.peerId, decryptedKey, this.SESSION_KEY_LIFETIME);
      }
    } catch (e) {
      console.error("Failed to decrypt rotated key");
    }
  }
}
const keyRotationSystem = new KeyRotationSystem();
class MessageHandler extends events.EventEmitter {
  constructor() {
    super();
  }
  handleIncomingMessage(msg, remoteIp) {
    if (msg.type === "HELLO") {
      handshakeManager.handleHello(msg, remoteIp);
      return;
    } else if (msg.type === "CHALLENGE") {
      handshakeManager.handleChallenge(msg, remoteIp);
      return;
    } else if (msg.type === "CHALLENGE_RESPONSE") {
      handshakeManager.handleChallengeResponse(msg, remoteIp);
      return;
    } else if (msg.type === "SESSION_ESTABLISHED") {
      handshakeManager.handleSessionEstablished(msg);
      return;
    } else if (msg.type === "KEY_ROTATION") {
      keyRotationSystem.handleKeyRotation(msg);
      return;
    }
    if (msg.signature && msg.payload) {
      const peer = peerManager.getPeers().find((p) => p.username === msg.senderId);
      if (!peer) return;
      if (!peer || !peer.publicKey) return;
      const payloadStr = typeof msg.payload === "string" ? msg.payload : JSON.stringify(msg.payload);
      const isValid = identityManager.verify(Buffer.from(payloadStr), msg.signature, peer.publicKey);
      if (!isValid) {
        securityLogManager.logEvent("INVALID_SIGNATURE", "Invalid signature on encrypted message", msg.senderId);
        return;
      }
      let decryptionKey = null;
      if (msg.roomId) {
        decryptionKey = cryptoManager.getRoomKey(msg.roomId);
        if (!decryptionKey) {
          console.warn("Received encrypted room message but no room key exists for", msg.roomId);
          return;
        }
      } else {
        decryptionKey = cryptoManager.getSessionKey(msg.senderId);
        if (!decryptionKey) {
          console.warn("Received encrypted message but no session key exists for", msg.senderId);
          return;
        }
      }
      try {
        const decryptedStr = cryptoManager.decryptAES(msg.payload, decryptionKey);
        msg = JSON.parse(decryptedStr);
      } catch (e) {
        securityLogManager.logEvent("INVALID_SIGNATURE", "Failed to decrypt AES payload", msg.senderId);
        return;
      }
    }
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
      let roomKey = cryptoManager.getRoomKey(room.id);
      if (!roomKey) {
        roomKey = cryptoManager.generateSessionKey();
        cryptoManager.setRoomKey(room.id, roomKey);
      }
      if (!peer || !peer.publicKey) return;
      const encryptedKey = cryptoManager.encryptRSA(roomKey, peer.publicKey);
      const keyPacket = {
        type: "KEY_ROTATION",
        messageId: v4(),
        peerId: settingsManager.getIdentity().username,
        roomId: room.id,
        encryptedKey,
        timestamp: Date.now(),
        signature: ""
      };
      const sigStr = `${keyPacket.type}${keyPacket.peerId}${keyPacket.timestamp}`;
      keyPacket.signature = identityManager.sign(Buffer.from(sigStr));
      await reliableSender.sendWithRetry(peer.ip, peer.tcpPort || PORT_TCP, keyPacket);
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
        try {
          let securePacket = packet;
          if (packet.type === "ROOM_MESSAGE" || packet.type === "ROOM_STATE_SYNC") {
            securePacket = cryptoManager.secureRoomWrap(packet, room.id);
          } else {
            securePacket = cryptoManager.secureWrap(packet, peer.username);
          }
          reliableSender.sendWithRetry(peer.ip, peer.tcpPort || PORT_TCP, securePacket).catch(console.error);
        } catch (e) {
          console.error("Failed to securely wrap and send packet to", peer.username, e);
        }
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
          roomCoordinator.broadcastStateSync(room);
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
electron.app.whenReady().then(async () => {
  createWindow();
  await identityManager.initialize();
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
  await reliableSender.sendWithRetry(ip, peer.tcpPort || PORT_TCP, packet);
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
  const roomKey = cryptoManager.generateSessionKey();
  cryptoManager.setRoomKey(newRoom.id, roomKey);
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
electron.ipcMain.handle("get-security-dashboard-data", () => {
  return {
    publicKey: identityManager.getPublicKey(),
    fingerprint: identityManager.fingerprint,
    trustedDevices: trustManager.getAllDevices(),
    logs: securityLogManager.getLogs()
  };
});
electron.ipcMain.handle("set-trust-status", (_, fingerprint, status) => {
  trustManager.setTrustStatus(fingerprint, status);
  return trustManager.getAllDevices();
});
