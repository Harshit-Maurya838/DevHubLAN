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
        const { identityManager } = require('../security/identityManager');
        const { trustManager } = require('../security/trustManager');
        const { securityLogManager } = require('../security/securityLogManager');

        if (!packet.publicKey || !packet.signature) return;

        const fingerprint = identityManager.getFingerprint(packet.publicKey);

        // Check if blocked
        if (trustManager.isBlocked(fingerprint)) {
          securityLogManager.logEvent('BLOCKED_PEER_ATTEMPT', 'Blocked peer attempted UDP broadcast', packet.username || packet.owner);
          return;
        }

        // Verify Signature
        let sigStr = '';
        if (packet.type === 'DISCOVER') {
          sigStr = `${packet.type}${packet.username}${packet.timestamp}`;
        } else if (packet.type === 'ROOM_ADVERTISEMENT') {
          sigStr = `${packet.type}${packet.roomId}${packet.timestamp}`;
        } else {
          return;
        }

        const isValid = identityManager.verify(Buffer.from(sigStr), packet.signature, packet.publicKey);
        if (!isValid) {
          securityLogManager.logEvent('INVALID_SIGNATURE', `Invalid UDP signature for ${packet.type}`, packet.username || packet.owner);
          return;
        }

        // Register device in trust manager
        trustManager.registerDevice(packet.username || packet.owner, packet.publicKey, fingerprint);

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
