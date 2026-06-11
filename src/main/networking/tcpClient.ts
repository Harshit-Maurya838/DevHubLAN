import net from 'net';

export class TcpClient {
  public async sendMessage(ip: string, port: number, message: any): Promise<void> {
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

export const tcpClient = new TcpClient();
