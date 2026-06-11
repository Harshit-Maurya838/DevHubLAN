export interface DiscoveryPacket {
  type: 'DISCOVER';
  username: string;
  deviceName: string;
  ip: string;
  tcpPort: number;
  timestamp: number;
}

export interface Peer {
  ip: string;
  username: string;
  deviceName: string;
  tcpPort: number;
  status: 'Online' | 'Offline' | 'Connecting' | 'Disconnected';
  lastSeen: number;
  publicKey?: string;
}

export interface ChatMessage {
  type: 'CHAT';
  messageId: string;
  sender: string;
  timestamp: number;
  content: string;
}

export interface UserIdentity {
  username: string;
  deviceName: string;
  avatar: string;
}
