import { app } from 'electron';
import fs from 'fs';
import path from 'path';
import { Room } from '../../shared/roomTypes';

export class RoomManager {
  private storagePath: string;
  private rooms: Map<string, Room> = new Map();

  constructor() {
    this.storagePath = path.join(app.getPath('userData'), 'rooms.json');
    this.loadRooms();
  }

  private loadRooms() {
    if (fs.existsSync(this.storagePath)) {
      try {
        const data = fs.readFileSync(this.storagePath, 'utf-8');
        const parsed: Room[] = JSON.parse(data);
        parsed.forEach(room => this.rooms.set(room.id, room));
      } catch (e) {
        console.error('Failed to load rooms storage', e);
      }
    }
  }

  private saveRooms() {
    try {
      const data = Array.from(this.rooms.values());
      fs.writeFileSync(this.storagePath, JSON.stringify(data, null, 2));
    } catch (e) {
      console.error('Failed to save rooms storage', e);
    }
  }

  public getRooms(): Room[] {
    return Array.from(this.rooms.values());
  }

  public getRoom(roomId: string): Room | undefined {
    return this.rooms.get(roomId);
  }

  public addOrUpdateRoom(room: Room) {
    this.rooms.set(room.id, room);
    this.saveRooms();
  }

  public deleteRoom(roomId: string) {
    this.rooms.delete(roomId);
    this.saveRooms();
  }
}

export const roomManager = new RoomManager();
