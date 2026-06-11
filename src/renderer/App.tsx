import React, { useEffect, useState } from 'react';
import { useAppStore } from './store';
import { Sidebar } from './components/Sidebar';
import { RoomsSidebar } from './components/RoomsSidebar';
import { ChatPanel } from './components/ChatPanel';
import { RoomChatPanel } from './components/RoomChatPanel';
import { SettingsModal } from './components/SettingsModal';
import { CreateRoomModal } from './components/CreateRoomModal';
import { JoinRoomModal } from './components/JoinRoomModal';
import { Settings, Users } from 'lucide-react';

const App: React.FC = () => {
  const { setIdentity, setPeers, updatePeer, addMessage, activeChatIp, activeRoomId, setRooms, updateRoom, addDiscoveredRoom, addRoomMessage } = useAppStore();
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isCreateRoomOpen, setIsCreateRoomOpen] = useState(false);
  const [isJoinRoomOpen, setIsJoinRoomOpen] = useState(false);

  useEffect(() => {
    // Initialize IPC listeners
    window.api.getIdentity().then(identity => {
      setIdentity(identity);
      if (identity.username === 'Anonymous Dev') {
        setIsSettingsOpen(true);
      }
    });

    window.api.getPeers().then(peers => setPeers(peers));
    window.api.getRooms().then(rooms => setRooms(rooms));

    window.api.onPeerAdded((peer) => updatePeer(peer));
    window.api.onPeerUpdated((peer) => updatePeer(peer));

    window.api.onMessageReceived((msg) => {
      window.api.getPeers().then(peers => {
        const peer = peers.find((p: import('../shared/types').Peer) => p.username === msg.sender);
        if (peer) addMessage(peer.ip, msg);
      });
    });

    window.api.onRoomAdvertised((packet) => addDiscoveredRoom(packet));
    window.api.onRoomSynced((room) => updateRoom(room));
    window.api.onRoomMessage((msg) => addRoomMessage(msg.roomId, msg));
  }, []);

  return (
    <div className="flex h-screen w-screen bg-dark-900 text-gray-100 overflow-hidden">
      {/* Rooms Sidebar (Leftmost) */}
      <RoomsSidebar 
        onCreateRoom={() => setIsCreateRoomOpen(true)}
        onJoinRoom={() => setIsJoinRoomOpen(true)}
      />

      {/* Direct Messages Sidebar (Middle-left) */}
      <Sidebar />

      {/* Main Content */}
      <div className="flex-1 flex flex-col relative bg-[#242438]">
        {/* Top Header */}
        <header className="h-14 border-b border-dark-800 bg-dark-900 flex items-center justify-between px-6 shadow-sm z-10 shrink-0">
          <div className="flex items-center gap-2">
            <Users size={20} className="text-primary-500" />
            <h1 className="font-semibold text-lg tracking-wide">DevHub LAN</h1>
          </div>
          <button 
            onClick={() => setIsSettingsOpen(true)}
            className="p-2 hover:bg-dark-700 rounded-md transition-colors text-gray-400 hover:text-white"
          >
            <Settings size={20} />
          </button>
        </header>

        {/* Chat Area */}
        <main className="flex-1 overflow-hidden relative">
          {activeRoomId ? (
            <RoomChatPanel />
          ) : activeChatIp ? (
            <ChatPanel />
          ) : (
            <div className="h-full flex flex-col items-center justify-center text-gray-500">
              <Users size={48} className="mb-4 opacity-50" />
              <p className="text-xl font-medium text-gray-400">Select a room or peer to start chatting</p>
              <p className="text-sm mt-2">Waiting for connections on LAN...</p>
            </div>
          )}
        </main>
      </div>

      {isSettingsOpen && <SettingsModal onClose={() => setIsSettingsOpen(false)} />}
      {isCreateRoomOpen && <CreateRoomModal onClose={() => setIsCreateRoomOpen(false)} />}
      {isJoinRoomOpen && <JoinRoomModal onClose={() => setIsJoinRoomOpen(false)} />}
    </div>
  );
};

export default App;
