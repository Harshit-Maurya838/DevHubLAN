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

    this.sendPacket(packet);

    // Also broadcast any rooms where this peer is the owner
    // Since roomManager is new, import it
    const { roomManager } = require('../rooms/roomManager');
    const rooms = roomManager.getRooms();
    
    for (const room of rooms) {
      if (room.ownerId === identity.username) {
        const roomPacket = {
          type: 'ROOM_ADVERTISEMENT',
          roomId: room.id,
          roomName: room.name,
          owner: room.ownerId,
          memberCount: room.members.length,
          timestamp: Date.now()
        };
        this.sendPacket(roomPacket);
      }
    }
  }

  private sendPacket(packet: any) {
    const message = Buffer.from(JSON.stringify(packet));
    this.socket.send(message, 0, message.length, PORT_UDP, '255.255.255.255', (err) => {
      if (err) {
        console.error('Broadcast error:', err);
      }
    });
  }
}

export const udpBroadcaster = new UdpBroadcaster();
