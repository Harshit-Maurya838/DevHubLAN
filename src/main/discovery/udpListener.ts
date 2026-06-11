import dgram from 'dgram';
import { PORT_UDP } from '../../shared/constants';
import { peerManager } from './peerManager';
import { DiscoveryPacket } from '../../shared/types';

export class UdpListener {
  private socket: dgram.Socket;

  constructor() {
    this.socket = dgram.createSocket('udp4');
  }

  public start() {
    this.socket.on('message', (msg, rinfo) => {
      try {
        const packet: DiscoveryPacket = JSON.parse(msg.toString());
        if (packet.type === 'DISCOVER') {
          peerManager.handleDiscovery(packet, rinfo);
        }
      } catch (e) {
        // Ignore invalid packets
      }
    });

    this.socket.on('error', (err) => {
      console.error('UDP Listener error:', err);
      this.socket.close();
    });

    this.socket.bind(PORT_UDP, () => {
      console.log(`UDP Listener bound to port ${PORT_UDP}`);
    });
  }

  public stop() {
    this.socket.close();
  }
}

export const udpListener = new UdpListener();
