import { peerManager } from '../discovery/peerManager';
import { roomManager } from './roomManager';
import { settingsManager } from '../storage/settings';
import { Peer } from '../../shared/types';

import { roomCoordinator } from './roomCoordinator';

export class ElectionManager {
  constructor() {
    peerManager.on('peer-updated', this.handlePeerUpdate.bind(this));
  }

  private handlePeerUpdate(peer: Peer) {
    if (peer.status === 'Offline') {
      this.checkAndElectNewOwner(peer.username);
    }
  }

  private checkAndElectNewOwner(offlineUsername: string) {
    const rooms = roomManager.getRooms();
    const myUsername = settingsManager.getIdentity().username;

    for (const room of rooms) {
      if (room.ownerId === offlineUsername) {
        // The owner went offline. We need a new owner.
        // Rule: Longest connected member (lowest joinedAt), fallback to lowest peerId alphabetically.
        const activeMembers = room.members.filter(m => {
          if (m.peerId === myUsername) return true; // I am active
          const p = peerManager.getPeer(m.ip);
          return p && p.status === 'Online';
        });

        if (activeMembers.length === 0) continue; // Room is dead

        activeMembers.sort((a, b) => {
          if (a.joinedAt !== b.joinedAt) {
            return a.joinedAt - b.joinedAt;
          }
          return a.peerId.localeCompare(b.peerId);
        });

        const newOwner = activeMembers[0];

        // If I am the new owner, take over
        if (newOwner.peerId === myUsername) {
          console.log(`Elected as new owner for room: ${room.name}`);
          
          room.ownerId = myUsername;
          // Promote myself to Owner role
          const me = room.members.find(m => m.peerId === myUsername);
          if (me) me.role = 'Owner';

          roomManager.addOrUpdateRoom(room);

          // Force broadcast immediately to claim ownership
          // Any other online member will see my ROOM_ADVERTISEMENT or ROOM_STATE_SYNC and accept it.
          // Since we use require dynamically in udpBroadcaster to avoid circular dependency,
          // the regular broadcast loop will pick this up. Let's also do a manual state sync.
          roomCoordinator.broadcastStateSync(room);
        }
      }
    }
  }
}

export const electionManager = new ElectionManager();
