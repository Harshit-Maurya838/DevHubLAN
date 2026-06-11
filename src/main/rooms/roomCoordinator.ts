import { Room, RoomMember } from '../../shared/roomTypes';
import { AnyPacket, RoomJoinRequestPacket, RoomMessagePacket } from '../../shared/roomPackets';
import { roomManager } from './roomManager';
import { messageHandler } from '../networking/messageHandler';
import { reliableSender } from '../networking/reliableSender';
import { peerManager } from '../discovery/peerManager';
import { settingsManager } from '../storage/settings';
import { EventEmitter } from 'events';
import { PORT_TCP } from '../../shared/constants';
import { v4 as uuidv4 } from 'uuid';

export class RoomCoordinator extends EventEmitter {
  constructor() {
    super();
    messageHandler.on('packet-received', this.handlePacket.bind(this));
  }

  private handlePacket(packet: AnyPacket, remoteIp: string) {
    if (packet.type === 'ROOM_JOIN_REQUEST') {
      this.handleJoinRequest(packet as RoomJoinRequestPacket, remoteIp);
    } else if (packet.type === 'ROOM_MESSAGE') {
      this.handleRoomMessage(packet as RoomMessagePacket);
    }
  }

  private async handleJoinRequest(packet: RoomJoinRequestPacket, remoteIp: string) {
    const room = roomManager.getRoom(packet.roomId);
    if (!room) return;

    // Only handle if we are the owner/coordinator
    if (room.ownerId !== settingsManager.getIdentity().username) return;

    // Auto-accept logic
    const member: RoomMember = {
      peerId: packet.peerId,
      ip: remoteIp, // from TCP socket or packet
      role: 'Member',
      joinedAt: Date.now()
    };

    if (!room.members.find(m => m.peerId === packet.peerId)) {
      room.members.push(member);
      roomManager.addOrUpdateRoom(room);
    }

    // Send Join Response back to requester
    const peer = peerManager.getPeer(remoteIp);
    if (peer) {
      await reliableSender.sendWithRetry(peer.ip, peer.tcpPort || PORT_TCP, {
        type: 'ROOM_JOIN_RESPONSE',
        messageId: uuidv4(),
        roomId: room.id,
        accepted: true,
        room: room
      });

      // Send Room Key to the new member securely via KEY_ROTATION packet
      const { cryptoManager } = require('../security/cryptoManager');
      let roomKey = cryptoManager.getRoomKey(room.id);
      if (!roomKey) {
        roomKey = cryptoManager.generateSessionKey();
        cryptoManager.setRoomKey(room.id, roomKey);
      }
      
      const { identityManager } = require('../security/identityManager');
      const encryptedKey = cryptoManager.encryptRSA(roomKey, peer.publicKey); // Assumes we saved their publicKey in peerManager during UDP
      const keyPacket = {
        type: 'KEY_ROTATION' as const,
        messageId: uuidv4(),
        peerId: settingsManager.getIdentity().username,
        roomId: room.id,
        encryptedKey,
        timestamp: Date.now(),
        signature: ''
      };
      const sigStr = `${keyPacket.type}${keyPacket.peerId}${keyPacket.timestamp}`;
      keyPacket.signature = identityManager.sign(Buffer.from(sigStr));
      
      await reliableSender.sendWithRetry(peer.ip, peer.tcpPort || PORT_TCP, keyPacket);
    }

    // Broadcast updated state to all members
    this.broadcastStateSync(room);
  }

  private handleRoomMessage(packet: RoomMessagePacket) {
    const room = roomManager.getRoom(packet.message.roomId);
    if (!room || room.ownerId !== settingsManager.getIdentity().username) return;

    // Distribute to all other members
    this.broadcastToMembers(room, packet, [packet.message.senderId]);
    
    // Also emit locally for UI
    this.emit('room-message', packet.message);
  }

  public broadcastStateSync(room: Room) {
    const syncPacket = {
      type: 'ROOM_STATE_SYNC' as const,
      messageId: uuidv4(),
      room
    };
    this.broadcastToMembers(room, syncPacket);
  }

  private broadcastToMembers(room: Room, packet: AnyPacket & { messageId: string }, excludePeerIds: string[] = []) {
    const myUsername = settingsManager.getIdentity().username;
    const { cryptoManager } = require('../security/cryptoManager');
    
    for (const member of room.members) {
      if (member.peerId === myUsername || excludePeerIds.includes(member.peerId)) continue;

      const peer = peerManager.getPeer(member.ip);
      if (peer) {
        try {
          let securePacket = packet;
          if (packet.type === 'ROOM_MESSAGE' || packet.type === 'ROOM_STATE_SYNC') {
            securePacket = cryptoManager.secureRoomWrap(packet, room.id);
          } else {
            securePacket = cryptoManager.secureWrap(packet, peer.username);
          }
          reliableSender.sendWithRetry(peer.ip, peer.tcpPort || PORT_TCP, securePacket).catch(console.error);
        } catch (e) {
          console.error('Failed to securely wrap and send packet to', peer.username, e);
        }
      }
    }
  }
}

export const roomCoordinator = new RoomCoordinator();
