import net from 'net';
import { ChatMessage } from '../../shared/types';

export class TcpClient {
  public static async sendMessage(ip: string, port: number, message: ChatMessage): Promise<void> {
    return new Promise((resolve, reject) => {
      const client = new net.Socket();

      client.connect(port, ip, () => {
        // Send JSON delimited by newline
        client.write(JSON.stringify(message) + '\n');
        client.end();
        resolve();
      });

      client.on('error', (err) => {
        reject(err);
      });
    });
  }
}
