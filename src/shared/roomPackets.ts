import { Room, RoomMessage } from './roomTypes';

export type PacketType = 
  | 'ROOM_ADVERTISEMENT'
  | 'ROOM_JOIN_REQUEST'
  | 'ROOM_JOIN_RESPONSE'
  | 'ROOM_STATE_SYNC'
  | 'ROOM_MESSAGE'
  | 'ACK'
  | 'TYPING'
  | 'READ_RECEIPT';

export interface RoomAdvertisementPacket {
  type: 'ROOM_ADVERTISEMENT';
  roomId: string;
  roomName: string;
  owner: string;
  memberCount: number;
  timestamp: number;
}

export interface RoomJoinRequestPacket {
  type: 'ROOM_JOIN_REQUEST';
  messageId: string; // For ACK mapping
  roomId: string;
  peerId: string; // The joiner's username
  ip: string;
}

export interface RoomJoinResponsePacket {
  type: 'ROOM_JOIN_RESPONSE';
  messageId: string; // Reply to request
  roomId: string;
  accepted: boolean;
  room?: Room; // Full state if accepted
  reason?: string;
}

export interface RoomStateSyncPacket {
  type: 'ROOM_STATE_SYNC';
  messageId: string;
  room: Room;
}

export interface RoomMessagePacket {
  type: 'ROOM_MESSAGE';
  messageId: string;
  message: RoomMessage;
}

export interface AckPacket {
  type: 'ACK';
  messageId: string;
  peerId: string;
  timestamp: number;
}

export interface TypingPacket {
  type: 'TYPING';
  roomId: string;
  peerId: string;
  timestamp: number;
}

export interface ReadReceiptPacket {
  type: 'READ_RECEIPT';
  messageId: string;
  roomId: string;
  peerId: string;
  timestamp: number;
}

export type AnyPacket = 
  | RoomAdvertisementPacket
  | RoomJoinRequestPacket
  | RoomJoinResponsePacket
  | RoomStateSyncPacket
  | RoomMessagePacket
  | AckPacket
  | TypingPacket
  | ReadReceiptPacket;
