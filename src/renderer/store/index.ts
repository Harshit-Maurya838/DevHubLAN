import { create } from 'zustand';
import { Peer, ChatMessage, UserIdentity } from '../../shared/types';

interface AppState {
  identity: UserIdentity | null;
  peers: Peer[];
  activeChatIp: string | null;
  messages: Record<string, ChatMessage[]>;
  
  setIdentity: (identity: UserIdentity) => void;
  setPeers: (peers: Peer[]) => void;
  updatePeer: (peer: Peer) => void;
  setActiveChatIp: (ip: string | null) => void;
  addMessage: (ip: string, message: ChatMessage) => void;
}

export const useAppStore = create<AppState>((set) => ({
  identity: null,
  peers: [],
  activeChatIp: null,
  messages: {},

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

  setActiveChatIp: (ip) => set({ activeChatIp: ip }),

  addMessage: (ip, message) => set((state) => {
    const existingMessages = state.messages[ip] || [];
    // Prevent duplicates if needed
    if (existingMessages.find(m => m.messageId === message.messageId)) {
      return state;
    }
    return {
      messages: {
        ...state.messages,
        [ip]: [...existingMessages, message]
      }
    };
  })
}));
