export type RoomRole = 'Owner' | 'Admin' | 'Member';

export type DeliveryStatus = 'Sending' | 'Sent' | 'Delivered' | 'Failed';

export interface RoomSettings {
  private: boolean;
  allowFileTransfer: boolean;
}

export interface RoomMember {
  peerId: string; // The username or unique identifier
  ip: string;
  role: RoomRole;
  joinedAt: number;
}

export interface Room {
  id: string;
  name: string;
  description: string;
  ownerId: string;
  createdAt: number;
  members: RoomMember[];
  settings: RoomSettings;
}

export interface RoomMessage {
  id: string;
  roomId: string;
  senderId: string;
  content: string;
  timestamp: number;
  status?: DeliveryStatus; // Used locally by sender
  seenBy?: string[]; // Array of peerIds who have read the message
}

export interface RoomNotification {
  id: string;
  type: 'INVITE' | 'MEMBER_JOIN' | 'MEMBER_LEAVE' | 'MENTION' | 'ROLE_CHANGE' | 'OWNERSHIP_TRANSFER';
  roomId: string;
  message: string;
  timestamp: number;
  read: boolean;
}
