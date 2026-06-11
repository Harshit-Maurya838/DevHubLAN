import { app, safeStorage } from 'electron';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import util from 'util';
import { KeyPair } from '../../shared/cryptoTypes';

const generateKeyPairAsync = util.promisify(crypto.generateKeyPair);

export class IdentityManager {
  private keyPath: string;
  private keyPair: KeyPair | null = null;
  public fingerprint: string | null = null;

  constructor() {
    this.keyPath = path.join(app.getPath('userData'), 'identity_keys.json');
  }

  public async initialize(): Promise<void> {
    if (fs.existsSync(this.keyPath)) {
      this.loadKeys();
    } else {
      await this.generateKeys();
    }
  }

  private async generateKeys(): Promise<void> {
    console.log('Generating RSA-4096 Keypair. This might take a few seconds...');
    
    const { publicKey, privateKey } = await generateKeyPairAsync('rsa', {
      modulusLength: 4096,
      publicKeyEncoding: {
        type: 'spki',
        format: 'pem'
      },
      privateKeyEncoding: {
        type: 'pkcs8',
        format: 'pem'
      }
    });

    this.keyPair = { publicKey, privateKey };
    this.calculateFingerprint();
    this.saveKeys();
  }

  private calculateFingerprint() {
    if (!this.keyPair) return;
    const hash = crypto.createHash('sha256');
    hash.update(this.keyPair.publicKey);
    this.fingerprint = hash.digest('hex');
  }

  private saveKeys() {
    if (!this.keyPair) return;

    let privateKeyToSave = this.keyPair.privateKey;
    let isEncrypted = false;

    if (safeStorage.isEncryptionAvailable()) {
      try {
        const encryptedBuffer = safeStorage.encryptString(this.keyPair.privateKey);
        privateKeyToSave = encryptedBuffer.toString('base64');
        isEncrypted = true;
      } catch (err) {
        console.warn('Failed to encrypt private key with safeStorage, saving in plaintext.', err);
      }
    } else {
      console.warn('safeStorage is not available on this OS, saving private key in plaintext.');
    }

    const data = {
      publicKey: this.keyPair.publicKey,
      privateKey: privateKeyToSave,
      isEncrypted
    };

    fs.writeFileSync(this.keyPath, JSON.stringify(data, null, 2));
  }

  private loadKeys() {
    try {
      const dataStr = fs.readFileSync(this.keyPath, 'utf-8');
      const data = JSON.parse(dataStr);

      let privateKey = data.privateKey;

      if (data.isEncrypted) {
        if (safeStorage.isEncryptionAvailable()) {
          try {
            const buffer = Buffer.from(privateKey, 'base64');
            privateKey = safeStorage.decryptString(buffer);
          } catch (err) {
            console.error('Failed to decrypt private key!', err);
            // In a real app we might need to prompt the user or regenerate.
            // For now, we will throw.
            throw new Error('Failed to decrypt private key. Device identity compromised.');
          }
        } else {
          throw new Error('Key is encrypted but safeStorage is not available.');
        }
      }

      this.keyPair = {
        publicKey: data.publicKey,
        privateKey
      };
      this.calculateFingerprint();
    } catch (e) {
      console.error('Error loading identity keys:', e);
    }
  }

  public getPublicKey(): string {
    if (!this.keyPair) throw new Error('IdentityManager not initialized');
    return this.keyPair.publicKey;
  }

  public sign(data: string | Buffer): string {
    if (!this.keyPair) throw new Error('IdentityManager not initialized');
    
    const sign = crypto.createSign('SHA256');
    sign.update(data);
    sign.end();
    
    return sign.sign(this.keyPair.privateKey, 'base64');
  }

  public verify(data: string | Buffer, signature: string, publicKey: string): boolean {
    const verify = crypto.createVerify('SHA256');
    verify.update(data);
    verify.end();
    
    return verify.verify(publicKey, signature, 'base64');
  }

  public getFingerprint(publicKey: string): string {
    const hash = crypto.createHash('sha256');
    hash.update(publicKey);
    return hash.digest('hex');
  }

  public decryptRSA(encryptedBase64: string): string {
    if (!this.keyPair) throw new Error('IdentityManager not initialized');
    
    const buffer = Buffer.from(encryptedBase64, 'base64');
    const decrypted = crypto.privateDecrypt(
      {
        key: this.keyPair.privateKey,
        padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
        oaepHash: 'sha256'
      },
      buffer
    );
    return decrypted.toString('utf8');
  }
}

export const identityManager = new IdentityManager();
