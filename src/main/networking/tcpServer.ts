import net from 'net';
import { PORT_TCP } from '../../shared/constants';
import { messageHandler } from './messageHandler';

export class TcpServer {
  private server: net.Server;

  constructor() {
    this.server = net.createServer((socket) => {
      let buffer = '';
      
      socket.on('data', (data) => {
        buffer += data.toString();
        // Packets might be fragmented or multiple, simple newline delimited JSON is better
        // For simplicity, assuming complete JSON objects for now, or split by newline if we delimit
        let boundary = buffer.indexOf('\n');
        while (boundary !== -1) {
          const packetStr = buffer.substring(0, boundary);
          buffer = buffer.substring(boundary + 1);
          try {
            const msg = JSON.parse(packetStr);
            messageHandler.handleIncomingMessage(msg, socket.remoteAddress || '');
          } catch (e) {
            console.error('Invalid TCP packet', packetStr);
          }
          boundary = buffer.indexOf('\n');
        }
      });

      socket.on('error', (err) => {
        console.error('TCP Server socket error', err);
      });
    });
  }

  public start() {
    this.server.listen(PORT_TCP, '0.0.0.0', () => {
      console.log(`TCP Server listening on port ${PORT_TCP}`);
    });
  }

  public stop() {
    this.server.close();
  }
}

export const tcpServer = new TcpServer();
