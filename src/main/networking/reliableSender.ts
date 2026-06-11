import { AnyPacket } from '../../shared/roomPackets';
import { tcpClient } from './tcpClient';
import { EventEmitter } from 'events';

export class ReliableSender extends EventEmitter {
  private pendingAcks: Map<string, { timer: NodeJS.Timeout, retries: number }> = new Map();

  constructor() {
    super();
  }

  public async sendWithRetry(ip: string, port: number, packet: AnyPacket & { messageId: string }, maxRetries = 3): Promise<void> {
    const attempt = async (retriesLeft: number) => {
      try {
        await tcpClient.sendMessage(ip, port, packet);
        
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
