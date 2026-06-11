export type SecurityPacketType = 
  | 'HELLO'
  | 'CHALLENGE'
  | 'CHALLENGE_RESPONSE'
  | 'SESSION_ESTABLISHED'
  | 'KEY_ROTATION';

export interface HandshakeHelloPacket {
  type: 'HELLO';
  peerId: string;
  publicKey: string;
}

export interface HandshakeChallengePacket {
  type: 'CHALLENGE';
  peerId: string; // Sender's peer ID
  publicKey: string; // Sender's public key
  encryptedNonce: string; // Random string encrypted with Initiator's public key
}

export interface HandshakeChallengeResponsePacket {
  type: 'CHALLENGE_RESPONSE';
  peerId: string;
  nonceSignature: string; // Signature of the decrypted nonce
  encryptedSessionKey: string; // Initiator's proposed AES session key, encrypted with Receiver's public key
}

export interface HandshakeSessionEstablishedPacket {
  type: 'SESSION_ESTABLISHED';
  peerId: string;
  status: 'ACCEPTED' | 'REJECTED';
}

export interface KeyRotationPacket {
  type: 'KEY_ROTATION';
  peerId: string;
  roomId?: string; // If this is a room key rotation
  encryptedKey: string; // New key encrypted with recipient's public key
  timestamp: number;
  signature: string;
}

export type AnySecurityPacket = 
  | HandshakeHelloPacket
  | HandshakeChallengePacket
  | HandshakeChallengeResponsePacket
  | HandshakeSessionEstablishedPacket
  | KeyRotationPacket;
