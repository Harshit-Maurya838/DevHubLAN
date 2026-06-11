import fs from 'fs';
import path from 'path';
import { app } from 'electron';
import { SecurityEventLog } from '../../shared/trustTypes';
import { v4 as uuidv4 } from 'uuid';
import { EventEmitter } from 'events';

export class SecurityLogManager extends EventEmitter {
  private logPath: string;
  private logs: SecurityEventLog[] = [];

  constructor() {
    super();
    this.logPath = path.join(app.getPath('userData'), 'security_logs.json');
    this.loadLogs();
  }

  private loadLogs() {
    if (fs.existsSync(this.logPath)) {
      try {
        const data = fs.readFileSync(this.logPath, 'utf-8');
        this.logs = JSON.parse(data);
      } catch (e) {
        console.error('Failed to load security logs', e);
      }
    }
  }

  private saveLogs() {
    try {
      // Keep last 1000 logs
      if (this.logs.length > 1000) {
        this.logs = this.logs.slice(this.logs.length - 1000);
      }
      fs.writeFileSync(this.logPath, JSON.stringify(this.logs, null, 2));
    } catch (e) {
      console.error('Failed to save security logs', e);
    }
  }

  public logEvent(type: SecurityEventLog['type'], details: string, peerId?: string) {
    const log: SecurityEventLog = {
      id: uuidv4(),
      timestamp: Date.now(),
      type,
      details,
      peerId
    };
    this.logs.push(log);
    this.saveLogs();
    console.warn(`[SECURITY] ${type}: ${details}`);
    this.emit('new-log', log);
  }

  public getLogs(): SecurityEventLog[] {
    return this.logs;
  }
}

export const securityLogManager = new SecurityLogManager();
