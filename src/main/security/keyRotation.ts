import { EventEmitter } from 'events';
import { cryptoManager } from './cryptoManager';
import { peerManager } from '../discovery/peerManager';
import { settingsManager } from '../storage/settings';
import { KeyRotationPacket } from '../../shared/securityPackets';
import { identityManager } from './identityManager';
import { PORT_TCP } from '../../shared/constants';

export class KeyRotationSystem extends EventEmitter {
  // 30 minutes for sessions, 24 hours for rooms
  private SESSION_KEY_LIFETIME = 30 * 60 * 1000;

  constructor() {
    super();
    // In a real implementation we would start timers.
    // For simplicity, we just provide the methods here.
  }

  public async rotateSessionKey(peerId: string) {
    const peer = peerManager.getPeers().find(p => p.username === peerId);
    if (!peer) return;

    // Generate new key
    const newSessionKey = cryptoManager.generateSessionKey();
    cryptoManager.setSessionKey(peerId, newSessionKey, this.SESSION_KEY_LIFETIME);

    // Send it
    const encryptedKey = cryptoManager.encryptRSA(newSessionKey, peer.publicKey!);
    const packet: KeyRotationPacket & { messageId: string } = {
      type: 'KEY_ROTATION',
      messageId: require('uuid').v4(),
      peerId: settingsManager.getIdentity().username,
      encryptedKey,
      timestamp: Date.now(),
      signature: '' // We will sign it now
    };

    const sigStr = `${packet.type}${packet.peerId}${packet.timestamp}`;
    packet.signature = identityManager.sign(Buffer.from(sigStr));

    // Send directly over TCP without secureWrap because we are changing the key
    const { tcpClient } = require('../networking/tcpClient');
    await tcpClient.sendMessage(peer.ip, PORT_TCP, packet);
  }

  public handleKeyRotation(packet: KeyRotationPacket) {
    // Verify signature
    const peer = peerManager.getPeers().find(p => p.username === packet.peerId);
    if (!peer) return;

    const sigStr = `${packet.type}${packet.peerId}${packet.timestamp}`;
    const isValid = identityManager.verify(Buffer.from(sigStr), packet.signature, peer.publicKey!);
    
    if (!isValid) return;

    // Decrypt key
    try {
      const decryptedKey = identityManager.decryptRSA(packet.encryptedKey);
      if (packet.roomId) {
        // Handle room key rotation
        // Store room key somewhere
      } else {
        // Session key rotation
        cryptoManager.setSessionKey(packet.peerId, decryptedKey, this.SESSION_KEY_LIFETIME);
      }
    } catch (e) {
      console.error('Failed to decrypt rotated key');
    }
  }
}

export const keyRotationSystem = new KeyRotationSystem();
