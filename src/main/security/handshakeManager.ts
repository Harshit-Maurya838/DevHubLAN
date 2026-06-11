import crypto from 'crypto';
import { tcpClient } from '../networking/tcpClient';
import { identityManager } from './identityManager';
import { cryptoManager } from './cryptoManager';
import { trustManager } from './trustManager';
import { securityLogManager } from './securityLogManager';
import { PORT_TCP } from '../../shared/constants';
import { settingsManager } from '../storage/settings';
import { EventEmitter } from 'events';
import { 
  HandshakeHelloPacket, 
  HandshakeChallengePacket, 
  HandshakeChallengeResponsePacket, 
  HandshakeSessionEstablishedPacket 
} from '../../shared/securityPackets';

export class HandshakeManager extends EventEmitter {
  // Store challenges we've sent out waiting for a response
  private pendingChallenges: Map<string, { expectedNonce: string, peerPublicKey: string }> = new Map();
  // Queue messages while handshake is happening
  private messageQueue: Map<string, any[]> = new Map();

  public async initiateHandshake(peerIp: string, _peerId: string) {
    const myIdentity = settingsManager.getIdentity();
    const packet: HandshakeHelloPacket = {
      type: 'HELLO',
      peerId: myIdentity.username,
      publicKey: identityManager.getPublicKey()
    };
    
    await tcpClient.sendMessage(peerIp, PORT_TCP, packet);
  }

  public async handleHello(packet: HandshakeHelloPacket, remoteIp: string) {
    if (trustManager.isBlocked(identityManager.getFingerprint(packet.publicKey))) {
      securityLogManager.logEvent('BLOCKED_PEER_ATTEMPT', 'Blocked peer sent HELLO', packet.peerId);
      return;
    }

    // Generate a nonce
    const nonce = crypto.randomBytes(32).toString('hex');
    
    // Encrypt nonce with peer's public key
    const encryptedNonce = cryptoManager.encryptRSA(nonce, packet.publicKey);

    this.pendingChallenges.set(packet.peerId, { expectedNonce: nonce, peerPublicKey: packet.publicKey });

    const myIdentity = settingsManager.getIdentity();
    const challenge: HandshakeChallengePacket = {
      type: 'CHALLENGE',
      peerId: myIdentity.username,
      publicKey: identityManager.getPublicKey(),
      encryptedNonce
    };

    await tcpClient.sendMessage(remoteIp, PORT_TCP, challenge);
  }

  public async handleChallenge(packet: HandshakeChallengePacket, remoteIp: string) {
    if (trustManager.isBlocked(identityManager.getFingerprint(packet.publicKey))) return;

    try {
      // Decrypt nonce
      const decryptedNonce = identityManager.decryptRSA(packet.encryptedNonce);
      
      // Sign decrypted nonce
      const nonceSignature = identityManager.sign(Buffer.from(decryptedNonce));

      // Propose an AES Session Key
      const sessionKey = cryptoManager.generateSessionKey();
      cryptoManager.setSessionKey(packet.peerId, sessionKey);

      // Encrypt session key with peer's public key
      const encryptedSessionKey = cryptoManager.encryptRSA(sessionKey, packet.publicKey);

      const myIdentity = settingsManager.getIdentity();
      const response: HandshakeChallengeResponsePacket = {
        type: 'CHALLENGE_RESPONSE',
        peerId: myIdentity.username,
        nonceSignature,
        encryptedSessionKey
      };

      await tcpClient.sendMessage(remoteIp, PORT_TCP, response);
    } catch (e) {
      securityLogManager.logEvent('HANDSHAKE_FAILED', 'Failed to decrypt or respond to challenge', packet.peerId);
    }
  }

  public async handleChallengeResponse(packet: HandshakeChallengeResponsePacket, remoteIp: string) {
    const pending = this.pendingChallenges.get(packet.peerId);
    if (!pending) return;

    const isValid = identityManager.verify(Buffer.from(pending.expectedNonce), packet.nonceSignature, pending.peerPublicKey);
    
    const myIdentity = settingsManager.getIdentity();

    if (!isValid) {
      securityLogManager.logEvent('HANDSHAKE_FAILED', 'Invalid challenge response signature', packet.peerId);
      await tcpClient.sendMessage(remoteIp, PORT_TCP, {
        type: 'SESSION_ESTABLISHED',
        peerId: myIdentity.username,
        status: 'REJECTED'
      } as HandshakeSessionEstablishedPacket);
      this.pendingChallenges.delete(packet.peerId);
      return;
    }

    try {
      // Decrypt session key
      const sessionKey = identityManager.decryptRSA(packet.encryptedSessionKey);
      cryptoManager.setSessionKey(packet.peerId, sessionKey);

      await tcpClient.sendMessage(remoteIp, PORT_TCP, {
        type: 'SESSION_ESTABLISHED',
        peerId: myIdentity.username,
        status: 'ACCEPTED'
      } as HandshakeSessionEstablishedPacket);

      this.pendingChallenges.delete(packet.peerId);
      this.emit('session-established', packet.peerId);
      this.flushQueue(packet.peerId);
    } catch (e) {
      securityLogManager.logEvent('HANDSHAKE_FAILED', 'Failed to decrypt session key', packet.peerId);
    }
  }

  public handleSessionEstablished(packet: HandshakeSessionEstablishedPacket) {
    if (packet.status === 'ACCEPTED') {
      this.emit('session-established', packet.peerId);
      this.flushQueue(packet.peerId);
    } else {
      securityLogManager.logEvent('HANDSHAKE_FAILED', 'Peer rejected session', packet.peerId);
      cryptoManager.removeSession(packet.peerId);
    }
  }

  private flushQueue(peerId: string) {
    const messages = this.getQueuedMessages(peerId);
    for (const msg of messages) {
      const { reliableSender } = require('../networking/reliableSender');
      reliableSender.sendWithRetry(msg.ip, msg.port, msg.packet, msg.maxRetries);
    }
  }

  // Queueing system for messages that are waiting for handshake
  public queueMessage(peerId: string, message: any) {
    const q = this.messageQueue.get(peerId) || [];
    q.push(message);
    this.messageQueue.set(peerId, q);
  }

  public getQueuedMessages(peerId: string): any[] {
    const messages = this.messageQueue.get(peerId) || [];
    this.messageQueue.delete(peerId);
    return messages;
  }
}

export const handshakeManager = new HandshakeManager();
