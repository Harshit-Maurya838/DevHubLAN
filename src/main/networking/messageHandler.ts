import { EventEmitter } from 'events';
import { ChatMessage } from '../../shared/types';

class MessageHandler extends EventEmitter {
  constructor() {
    super();
  }

  public handleIncomingMessage(msg: ChatMessage) {
    // Forward to renderer via IPC
    this.emit('message-received', msg);
  }
}

export const messageHandler = new MessageHandler();
