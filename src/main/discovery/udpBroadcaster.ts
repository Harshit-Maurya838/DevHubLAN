import dgram from 'dgram';
import { DiscoveryPacket } from '../../shared/types';
import { PORT_UDP, PORT_TCP, DISCOVERY_INTERVAL_MS } from '../../shared/constants';
import { settingsManager } from '../storage/settings';

export class UdpBroadcaster {
  private socket: dgram.Socket;
  private interval: NodeJS.Timeout | null = null;

  constructor() {
    this.socket = dgram.createSocket('udp4');
  }

  public start() {
    this.socket.bind(() => {
      this.socket.setBroadcast(true);
      this.broadcast(); // send immediate
      this.interval = setInterval(() => this.broadcast(), DISCOVERY_INTERVAL_MS);
    });
  }

  public stop() {
    if (this.interval) clearInterval(this.interval);
    this.socket.close();
  }

  private broadcast() {
    const identity = settingsManager.getIdentity();
    const packet: DiscoveryPacket = {
      type: 'DISCOVER',
      username: identity.username,
      deviceName: identity.deviceName,
      ip: '0.0.0.0', // Not used strictly, the receiver gets ip from remoteInfo
      tcpPort: PORT_TCP,
      timestamp: Date.now()
    };

    const message = Buffer.from(JSON.stringify(packet));
    // Broadcast to the whole network 255.255.255.255
    this.socket.send(message, 0, message.length, PORT_UDP, '255.255.255.255', (err) => {
      if (err) {
        console.error('Broadcast error:', err);
      }
    });
  }
}

export const udpBroadcaster = new UdpBroadcaster();
