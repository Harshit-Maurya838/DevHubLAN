import { EventEmitter } from 'events';
import { ChatMessage } from '../../shared/types';
import { reliableSender } from './reliableSender';

import { handshakeManager } from '../security/handshakeManager';
import { keyRotationSystem } from '../security/keyRotation';
import { identityManager } from '../security/identityManager';
import { cryptoManager } from '../security/cryptoManager';
import { peerManager } from '../discovery/peerManager';
import { securityLogManager } from '../security/securityLogManager';

class MessageHandler extends EventEmitter {
  constructor() {
    super();
  }

  public handleIncomingMessage(msg: any, remoteIp: string) {
    // If it's a handshake packet, route it
    if (msg.type === 'HELLO') {
      handshakeManager.handleHello(msg, remoteIp);
      return;
    } else if (msg.type === 'CHALLENGE') {
      handshakeManager.handleChallenge(msg, remoteIp);
      return;
    } else if (msg.type === 'CHALLENGE_RESPONSE') {
      handshakeManager.handleChallengeResponse(msg, remoteIp);
      return;
    } else if (msg.type === 'SESSION_ESTABLISHED') {
      handshakeManager.handleSessionEstablished(msg);
      return;
    } else if (msg.type === 'KEY_ROTATION') {
      keyRotationSystem.handleKeyRotation(msg);
      return;
    }

    // Is it an encrypted payload? (signed message)
    if (msg.signature && msg.payload) {

      const peer = peerManager.getPeers().find((p: any) => p.username === msg.senderId);
      if (!peer) return;

      // 1. Verify signature of the encrypted payload JSON
      if (!peer || !peer.publicKey) return; // Cannot verify without public key

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
