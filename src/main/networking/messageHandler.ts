import { EventEmitter } from 'events';
import { ChatMessage } from '../../shared/types';
import { reliableSender } from './reliableSender';

class MessageHandler extends EventEmitter {
  constructor() {
    super();
  }

  public handleIncomingMessage(msg: any, remoteIp: string) {
    // If it's a handshake packet, route it
    if (msg.type === 'HELLO') {
      const { handshakeManager } = require('../security/handshakeManager');
      handshakeManager.handleHello(msg, remoteIp);
      return;
    } else if (msg.type === 'CHALLENGE') {
      const { handshakeManager } = require('../security/handshakeManager');
      handshakeManager.handleChallenge(msg, remoteIp);
      return;
    } else if (msg.type === 'CHALLENGE_RESPONSE') {
      const { handshakeManager } = require('../security/handshakeManager');
      handshakeManager.handleChallengeResponse(msg, remoteIp);
      return;
    } else if (msg.type === 'SESSION_ESTABLISHED') {
      const { handshakeManager } = require('../security/handshakeManager');
      handshakeManager.handleSessionEstablished(msg);
      return;
    } else if (msg.type === 'KEY_ROTATION') {
      const { keyRotationSystem } = require('../security/keyRotation');
      keyRotationSystem.handleKeyRotation(msg);
      return;
    }

    // Is it an encrypted payload? (signed message)
    if (msg.signature && msg.payload) {
      const { identityManager } = require('../security/identityManager');
      const { cryptoManager } = require('../security/cryptoManager');
      const { peerManager } = require('../discovery/peerManager');
      const { securityLogManager } = require('../security/securityLogManager');

      const peer = peerManager.getPeers().find((p: any) => p.username === msg.senderId);
      if (!peer) return;

      // 1. Verify signature of the encrypted payload JSON
      const payloadStr = typeof msg.payload === 'string' ? msg.payload : JSON.stringify(msg.payload);
      const isValid = identityManager.verify(Buffer.from(payloadStr), msg.signature, peer.publicKey);
      
      if (!isValid) {
        securityLogManager.logEvent('INVALID_SIGNATURE', 'Invalid signature on encrypted message', msg.senderId);
        return;
      }

      // 2. Decrypt payload
      let decryptionKey: string | null = null;

      if (msg.roomId) {
        // Use Room Key
        decryptionKey = cryptoManager.getRoomKey(msg.roomId);
        if (!decryptionKey) {
          console.warn('Received encrypted room message but no room key exists for', msg.roomId);
          return;
        }
      } else {
        // Use Session Key
        decryptionKey = cryptoManager.getSessionKey(msg.senderId);
        if (!decryptionKey) {
          console.warn('Received encrypted message but no session key exists for', msg.senderId);
          return;
        }
      }

      try {
        const decryptedStr = cryptoManager.decryptAES(msg.payload, decryptionKey);
        msg = JSON.parse(decryptedStr);
      } catch (e) {
        securityLogManager.logEvent('INVALID_SIGNATURE', 'Failed to decrypt AES payload', msg.senderId);
        return;
      }
    }

    if (msg.type === 'ACK') {
      reliableSender.handleAck(msg.messageId);
      return;
    }

    // Emit event for other systems to pick up
    this.emit('packet-received', msg, remoteIp);

    if (msg.type === 'CHAT') {
      this.emit('message-received', msg as ChatMessage);
    }
  }
}

export const messageHandler = new MessageHandler();
