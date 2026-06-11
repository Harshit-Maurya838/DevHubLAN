import { Peer, DiscoveryPacket } from '../../shared/types';
import { PEER_TIMEOUT_MS } from '../../shared/constants';
import { EventEmitter } from 'events';
import os from 'os';

export class PeerManager extends EventEmitter {
  private peers: Map<string, Peer> = new Map();
  private timeoutCheckInterval: NodeJS.Timeout | null = null;

  constructor() {
    super();
  }

  public start() {
    this.timeoutCheckInterval = setInterval(() => this.checkTimeouts(), 5000);
  }

  public stop() {
    if (this.timeoutCheckInterval) {
      clearInterval(this.timeoutCheckInterval);
    }
  }

  public handleDiscovery(packet: DiscoveryPacket, remoteInfo: { address: string }) {
    // Ignore self packets
    if (this.isLocalIp(remoteInfo.address)) {
      return;
    }

    const now = Date.now();
    const existingPeer = this.peers.get(remoteInfo.address);

    if (existingPeer) {
      // Update existing
      existingPeer.lastSeen = now;
      existingPeer.username = packet.username;
      existingPeer.deviceName = packet.deviceName;
      existingPeer.tcpPort = packet.tcpPort;
      if (existingPeer.status === 'Offline') {
        existingPeer.status = 'Online';
        this.emit('peer-updated', existingPeer);
      }
    } else {
      // Add new
      const newPeer: Peer = {
        ip: remoteInfo.address,
        username: packet.username,
        deviceName: packet.deviceName,
        tcpPort: packet.tcpPort,
        status: 'Online',
        lastSeen: now
      };
      this.peers.set(remoteInfo.address, newPeer);
      this.emit('peer-added', newPeer);
    }
  }

  private checkTimeouts() {
    const now = Date.now();

    for (const peer of this.peers.values()) {
      if (peer.status === 'Online' && now - peer.lastSeen > PEER_TIMEOUT_MS) {
        peer.status = 'Offline';
        this.emit('peer-updated', peer);
      }
    }
  }

  public getPeers(): Peer[] {
    return Array.from(this.peers.values());
  }

  public getPeer(ip: string): Peer | undefined {
    return this.peers.get(ip);
  }

  private isLocalIp(ip: string): boolean {
    const interfaces = os.networkInterfaces();
    for (const devName in interfaces) {
      const iface = interfaces[devName];
      if (iface) {
        for (let i = 0; i < iface.length; i++) {
          const alias = iface[i];
          if (alias.address === ip) {
            return true;
          }
        }
      }
    }
    return false;
  }
}

export const peerManager = new PeerManager();
