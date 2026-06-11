import fs from 'fs';
import path from 'path';
import { app } from 'electron';
import { DeviceIdentity, TrustStatus } from '../../shared/trustTypes';
import { EventEmitter } from 'events';

export class TrustManager extends EventEmitter {
  private trustPath: string;
  private identities: Map<string, DeviceIdentity> = new Map(); // fingerprint -> Identity

  constructor() {
    super();
    this.trustPath = path.join(app.getPath('userData'), 'trusted_devices.json');
    this.loadTrusts();
  }

  private loadTrusts() {
    if (fs.existsSync(this.trustPath)) {
      try {
        const data = fs.readFileSync(this.trustPath, 'utf-8');
        const parsed: DeviceIdentity[] = JSON.parse(data);
        parsed.forEach(dev => this.identities.set(dev.fingerprint, dev));
      } catch (e) {
        console.error('Failed to load trust database', e);
      }
    }
  }

  private saveTrusts() {
    try {
      const data = Array.from(this.identities.values());
      fs.writeFileSync(this.trustPath, JSON.stringify(data, null, 2));
    } catch (e) {
      console.error('Failed to save trust database', e);
    }
  }

  public registerDevice(peerId: string, publicKey: string, fingerprint: string) {
    if (!this.identities.has(fingerprint)) {
      this.identities.set(fingerprint, {
        peerId,
        publicKey,
        fingerprint,
        status: 'UNKNOWN',
        firstSeenAt: Date.now(),
        lastSeenAt: Date.now()
      });
      this.saveTrusts();
      this.emit('device-discovered', this.identities.get(fingerprint));
    } else {
      const dev = this.identities.get(fingerprint)!;
      dev.lastSeenAt = Date.now();
      // Update peerId if they changed username
      if (dev.peerId !== peerId) dev.peerId = peerId;
      this.saveTrusts();
    }
  }

  public getTrustStatus(fingerprint: string): TrustStatus {
    return this.identities.get(fingerprint)?.status || 'UNKNOWN';
  }

  public setTrustStatus(fingerprint: string, status: TrustStatus) {
    const dev = this.identities.get(fingerprint);
    if (dev) {
      dev.status = status;
      this.saveTrusts();
      this.emit('trust-updated', dev);
    }
  }

  public isBlocked(fingerprint: string): boolean {
    return this.getTrustStatus(fingerprint) === 'BLOCKED';
  }

  public getAllDevices(): DeviceIdentity[] {
    return Array.from(this.identities.values());
  }
}

export const trustManager = new TrustManager();
