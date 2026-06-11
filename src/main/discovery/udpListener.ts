import dgram from 'dgram';
import { PORT_UDP } from '../../shared/constants';
import { peerManager } from './peerManager';

import { EventEmitter } from 'events';

export class UdpListener extends EventEmitter {
  private socket: dgram.Socket;

  constructor() {
    super();
    this.socket = dgram.createSocket('udp4');
  }

  public start() {
    this.socket.on('message', (msg, rinfo) => {
      try {
        const packet = JSON.parse(msg.toString());
        if (packet.type === 'DISCOVER') {
          peerManager.handleDiscovery(packet, rinfo);
        } else if (packet.type === 'ROOM_ADVERTISEMENT') {
          this.emit('room-advertised', packet);
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
