import { EventEmitter } from 'events';
import { ChatMessage } from '../../shared/types';
import { reliableSender } from './reliableSender';

class MessageHandler extends EventEmitter {
  constructor() {
    super();
  }

  public handleIncomingMessage(msg: any, remoteIp: string) {
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
