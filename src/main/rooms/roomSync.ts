import { messageHandler } from '../networking/messageHandler';
import { AnyPacket, RoomStateSyncPacket, RoomMessagePacket } from '../../shared/roomPackets';
import { roomManager } from './roomManager';
import { EventEmitter } from 'events';
import { settingsManager } from '../storage/settings';

export class RoomSync extends EventEmitter {
  constructor() {
    super();
    messageHandler.on('packet-received', this.handlePacket.bind(this));
  }

  private handlePacket(packet: AnyPacket, _remoteIp: string) {
    if (packet.type === 'ROOM_STATE_SYNC') {
      this.handleStateSync(packet as RoomStateSyncPacket);
    } else if (packet.type === 'ROOM_MESSAGE') {
      this.handleRoomMessage(packet as RoomMessagePacket);
    }
  }

  private handleStateSync(packet: RoomStateSyncPacket) {
    // Only accept sync if we are NOT the owner (the owner is the source of truth)
    const myUsername = settingsManager.getIdentity().username;
    if (packet.room.ownerId === myUsername) return;

    roomManager.addOrUpdateRoom(packet.room);
    this.emit('room-synced', packet.room);
  }

  private handleRoomMessage(packet: RoomMessagePacket) {
    const myUsername = settingsManager.getIdentity().username;
    const room = roomManager.getRoom(packet.message.roomId);
    
    // If we are the owner, RoomCoordinator handles it. If not, RoomSync handles receiving it.
    if (!room || room.ownerId === myUsername) return;

    // Received a message from Coordinator, emit locally
    this.emit('room-message', packet.message);
  }
}

export const roomSync = new RoomSync();
