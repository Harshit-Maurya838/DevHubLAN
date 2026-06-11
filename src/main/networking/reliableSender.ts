import { tcpClient } from './tcpClient';
import { EventEmitter } from 'events';

export class ReliableSender extends EventEmitter {
  private pendingAcks: Map<string, { timer: NodeJS.Timeout, retries: number }> = new Map();

  constructor() {
    super();
  }

  public async sendWithRetry(ip: string, port: number, packet: any, maxRetries = 3): Promise<void> {
    const attempt = async (retriesLeft: number) => {
      try {
        const { cryptoManager } = require('../security/cryptoManager');
        const { handshakeManager } = require('../security/handshakeManager');
        const { peerManager } = require('../discovery/peerManager');

        // We need to know who we are sending to for the session key.
        // Assuming packet has a recipient peerId, or we can look it up by IP.
        const peer = peerManager.getPeer(ip);
        if (!peer) throw new Error('Cannot send reliable message, peer unknown');

        if (!cryptoManager.hasActiveSession(peer.username)) {
          console.log('No active session for', peer.username, 'Initiating handshake...');
          handshakeManager.queueMessage(peer.username, { ip, port, packet, maxRetries });
          await handshakeManager.initiateHandshake(ip, peer.username);
          return; // The queue will handle sending it once established
        }

        const securePacket = cryptoManager.secureWrap(packet, peer.username);

        await tcpClient.sendMessage(ip, port, securePacket);
        
        return new Promise<void>((resolve, reject) => {
          const timer = setTimeout(() => {
            this.pendingAcks.delete(packet.messageId);
            if (retriesLeft > 0) {
              console.log(`Timeout waiting for ACK, retrying ${packet.messageId}...`);
              attempt(retriesLeft - 1).then(resolve).catch(reject);
            } else {
              reject(new Error(`Failed to deliver message ${packet.messageId} after max retries`));
            }
          }, 2000); // 2 second timeout for ACK

          this.pendingAcks.set(packet.messageId, { timer, retries: retriesLeft });
        });
      } catch (err) {
        if (retriesLeft > 0) {
          await new Promise(r => setTimeout(r, 1000));
          return attempt(retriesLeft - 1);
        }
        throw err;
      }
    };

    return attempt(maxRetries);
  }

  public handleAck(messageId: string) {
    const pending = this.pendingAcks.get(messageId);
    if (pending) {
      clearTimeout(pending.timer);
      this.pendingAcks.delete(messageId);
    }
  }
}

export const reliableSender = new ReliableSender();
