export interface KeyPair {
  publicKey: string;
  privateKey: string; // Will be encrypted at rest
}

export interface EncryptedPayload {
  iv: string; // hex string of initialization vector (for AES-GCM)
  data: string; // hex string of encrypted data
  authTag: string; // hex string of authentication tag (for AES-GCM)
}

export interface SignedMessage {
  payload: string | EncryptedPayload;
  signature: string; // RSA signature of payload
  senderId: string;
}

export interface SessionKey {
  key: string; // hex string of AES-256 key
  expiresAt: number;
}
