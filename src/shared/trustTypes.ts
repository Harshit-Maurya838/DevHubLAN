export type TrustStatus = 'UNKNOWN' | 'TRUSTED' | 'BLOCKED';

export interface DeviceIdentity {
  peerId: string; // Usually the username or a uuid
  publicKey: string;
  fingerprint: string; // SHA-256 of the public key
  status: TrustStatus;
  firstSeenAt: number;
  lastSeenAt: number;
}

export interface SecurityEventLog {
  id: string;
  timestamp: number;
  type: 'HANDSHAKE_FAILED' | 'INVALID_SIGNATURE' | 'BLOCKED_PEER_ATTEMPT' | 'ROOM_ACCESS_DENIED' | 'KEY_ROTATION';
  details: string;
  peerId?: string;
}
