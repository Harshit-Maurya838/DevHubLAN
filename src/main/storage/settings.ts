import { app } from 'electron';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { UserIdentity } from '../../shared/types';

export class SettingsManager {
  private settingsPath: string;
  private identity: UserIdentity;

  constructor() {
    this.settingsPath = path.join(app.getPath('userData'), 'settings.json');
    this.identity = this.loadSettings();
  }

  private loadSettings(): UserIdentity {
    if (fs.existsSync(this.settingsPath)) {
      try {
        const data = fs.readFileSync(this.settingsPath, 'utf-8');
        return JSON.parse(data);
      } catch (e) {
        console.error('Failed to load settings', e);
      }
    }
    // Default settings
    return {
      username: 'Anonymous Dev',
      deviceName: os.hostname(),
      avatar: ''
    };
  }

  public getIdentity(): UserIdentity {
    return this.identity;
  }

  public updateIdentity(identity: Partial<UserIdentity>) {
    this.identity = { ...this.identity, ...identity };
    try {
      fs.writeFileSync(this.settingsPath, JSON.stringify(this.identity, null, 2));
    } catch (e) {
      console.error('Failed to save settings', e);
    }
  }
}

export const settingsManager = new SettingsManager();
