import { RoomRole } from './roomTypes';

export const PERMISSIONS = {
  DELETE_ROOM: ['Owner'] as RoomRole[],
  PROMOTE_ADMIN: ['Owner'] as RoomRole[],
  UPDATE_SETTINGS: ['Owner'] as RoomRole[],
  REMOVE_USERS: ['Owner', 'Admin'] as RoomRole[],
  MANAGE_MESSAGES: ['Owner', 'Admin'] as RoomRole[],
  SEND_MESSAGES: ['Owner', 'Admin', 'Member'] as RoomRole[],
};

export function hasPermission(role: RoomRole, permission: keyof typeof PERMISSIONS): boolean {
  return PERMISSIONS[permission].includes(role);
}
