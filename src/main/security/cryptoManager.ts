import crypto from 'crypto';
import { EncryptedPayload, SessionKey } from '../../shared/cryptoTypes';
import { settingsManager } from '../storage/settings';
import { identityManager } from './identityManager';

export class CryptoManager {
  private activeSessions: Map<string, SessionKey> = new Map(); // peerId -> SessionKey

  /**
   * Generates a random AES-256 key
   */
  public generateSessionKey(): string {
    return crypto.randomBytes(32).toString('hex');
  }

  /**
   * Encrypts a payload using AES-256-GCM
   */
  public encryptAES(payload: string, hexKey: string): EncryptedPayload {
    const key = Buffer.from(hexKey, 'hex');
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
    
    let encrypted = cipher.update(payload, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    const authTag = cipher.getAuthTag().toString('hex');

    return {
      iv: iv.toString('hex'),
      data: encrypted,
      authTag
    };
  }

  /**
   * Decrypts a payload using AES-256-GCM
   */
  public decryptAES(payload: EncryptedPayload, hexKey: string): string {
    const key = Buffer.from(hexKey, 'hex');
    const iv = Buffer.from(payload.iv, 'hex');
    const authTag = Buffer.from(payload.authTag, 'hex');
    
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(authTag);
    
    let decrypted = decipher.update(payload.data, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
  }

  /**
   * Encrypts an AES key (or any short string) using a receiver's RSA Public Key
   */
  public encryptRSA(data: string, recipientPublicKeyPem: string): string {
    const buffer = Buffer.from(data, 'utf8');
    const encrypted = crypto.publicEncrypt(
      {
        key: recipientPublicKeyPem,
        padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
        oaepHash: 'sha256'
      },
      buffer
    );
    return encrypted.toString('base64');
  }

  /**
   * Decrypts an AES key (or any short string) using our local RSA Private Key
   */
  public decryptRSA(_encryptedBase64: string): string {
    // We have to extract the private key via a dirty workaround since IdentityManager 
    // keeps it private, but CryptoManager needs it.
    // Instead, let's expose it in IdentityManager, or put the decrypt func there.
    // Wait, IdentityManager handles identity. It's better to add decryptRSA to IdentityManager,
    // OR we expose a decrypt method on IdentityManager.
    // I will use IdentityManager's internal key. Wait, I'll update IdentityManager.
    throw new Error('decryptRSA implemented in IdentityManager to protect private key');
  }

  // Session Management
  public setSessionKey(peerId: string, keyHex: string, expiresInMs: number = 30 * 60 * 1000) {
    this.activeSessions.set(peerId, {
      key: keyHex,
      expiresAt: Date.now() + expiresInMs
    });
  }

  public getSessionKey(peerId: string): string | null {
    const session = this.activeSessions.get(peerId);
    if (!session) return null;
    
    if (Date.now() > session.expiresAt) {
      this.activeSessions.delete(peerId);
      return null;
    }
    
    return session.key;
  }

  public hasActiveSession(peerId: string): boolean {
    return this.getSessionKey(peerId) !== null;
  }

  public removeSession(peerId: string) {
    this.activeSessions.delete(peerId);
  }

  /**
   * Wraps a plaintext packet into a SignedMessage (AES Encrypted + RSA Signed)
   */
  public secureWrap(packet: any, peerId: string): any {
    const sessionKey = this.getSessionKey(peerId);
    if (!sessionKey) throw new Error('No active session key for peer');

    const plaintext = JSON.stringify(packet);
    const encryptedPayload = this.encryptAES(plaintext, sessionKey);
    
    // Sign the encrypted payload
    const payloadStr = JSON.stringify(encryptedPayload);
    const signature = identityManager.sign(Buffer.from(payloadStr));

    const myIdentity = settingsManager.getIdentity();

    return {
      payload: encryptedPayload,
      signature,
      senderId: myIdentity.username
    };
  }

  // Room Key Management
  private activeRoomKeys: Map<string, string> = new Map();

  public setRoomKey(roomId: string, keyHex: string) {
    this.activeRoomKeys.set(roomId, keyHex);
  }

  public getRoomKey(roomId: string): string | null {
    return this.activeRoomKeys.get(roomId) || null;
  }

  public secureRoomWrap(packet: any, roomId: string): any {
    const roomKey = this.getRoomKey(roomId);
    if (!roomKey) throw new Error('No active room key for ' + roomId);

    const plaintext = JSON.stringify(packet);
    const encryptedPayload = this.encryptAES(plaintext, roomKey);
    
    // Sign the encrypted payload
    const payloadStr = JSON.stringify(encryptedPayload);
    const signature = identityManager.sign(Buffer.from(payloadStr));

    const myIdentity = settingsManager.getIdentity();

    return {
      payload: encryptedPayload,
      signature,
      senderId: myIdentity.username,
      roomId // Attach roomId so receiver knows which key to use
    };
  }
}

export const cryptoManager = new CryptoManager();
