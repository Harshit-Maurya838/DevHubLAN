import { create } from 'zustand';
import { Peer, ChatMessage, UserIdentity } from '../../shared/types';
import { Room, RoomMessage, RoomNotification } from '../../shared/roomTypes';
import { RoomAdvertisementPacket } from '../../shared/roomPackets';

interface AppState {
  identity: UserIdentity | null;
  peers: Peer[];
  activeChatIp: string | null;
  messages: Record<string, ChatMessage[]>; // Phase 1 direct messages
  
  // Phase 2: Rooms
  rooms: Room[];
  discoveredRooms: RoomAdvertisementPacket[];
  activeRoomId: string | null;
  roomMessages: Record<string, RoomMessage[]>;
  notifications: RoomNotification[];

  setIdentity: (identity: UserIdentity) => void;
  setPeers: (peers: Peer[]) => void;
  updatePeer: (peer: Peer) => void;
  setActiveChatIp: (ip: string | null) => void;
  addMessage: (ip: string, message: ChatMessage) => void;

  setRooms: (rooms: Room[]) => void;
  updateRoom: (room: Room) => void;
  addDiscoveredRoom: (packet: RoomAdvertisementPacket) => void;
  setActiveRoomId: (id: string | null) => void;
  addRoomMessage: (roomId: string, message: RoomMessage) => void;
}

export const useAppStore = create<AppState>((set) => ({
  identity: null,
  peers: [],
  activeChatIp: null,
  messages: {},
  rooms: [],
  discoveredRooms: [],
  activeRoomId: null,
  roomMessages: {},
  notifications: [],

  setIdentity: (identity) => set({ identity }),
  
  setPeers: (peers) => set({ peers }),
  
  updatePeer: (peer) => set((state) => {
    const existingIndex = state.peers.findIndex(p => p.ip === peer.ip);
    if (existingIndex >= 0) {
      const newPeers = [...state.peers];
      newPeers[existingIndex] = peer;
      return { peers: newPeers };
    }
    return { peers: [...state.peers, peer] };
  }),

  setActiveChatIp: (ip) => set({ activeChatIp: ip, activeRoomId: null }),

  addMessage: (ip, message) => set((state) => {
    const existingMessages = state.messages[ip] || [];
    if (existingMessages.find(m => m.messageId === message.messageId)) return state;
    return { messages: { ...state.messages, [ip]: [...existingMessages, message] } };
  }),

  setRooms: (rooms) => set({ rooms }),

  updateRoom: (room) => set((state) => {
    const existingIndex = state.rooms.findIndex(r => r.id === room.id);
    if (existingIndex >= 0) {
      const newRooms = [...state.rooms];
      newRooms[existingIndex] = room;
      return { rooms: newRooms };
    }
    return { rooms: [...state.rooms, room] };
  }),

  addDiscoveredRoom: (packet) => set((state) => {
    // Only add if we aren't already in it
    if (state.rooms.some(r => r.id === packet.roomId)) return state;
    
    const existingIndex = state.discoveredRooms.findIndex(r => r.roomId === packet.roomId);
    if (existingIndex >= 0) {
      const newDiscovered = [...state.discoveredRooms];
      newDiscovered[existingIndex] = packet;
      return { discoveredRooms: newDiscovered };
    }
    return { discoveredRooms: [...state.discoveredRooms, packet] };
  }),

  setActiveRoomId: (id) => set({ activeRoomId: id, activeChatIp: null }),

  addRoomMessage: (roomId, message) => set((state) => {
    const existingMessages = state.roomMessages[roomId] || [];
    if (existingMessages.find(m => m.id === message.id)) return state;
    return { roomMessages: { ...state.roomMessages, [roomId]: [...existingMessages, message] } };
  }),
}));
