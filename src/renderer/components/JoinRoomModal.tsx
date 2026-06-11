import React, { useState } from 'react';
import { X, Hash, Users, Crown } from 'lucide-react';
import { useAppStore } from '../store';

export const JoinRoomModal: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const { discoveredRooms, peers } = useAppStore();
  const [joiningId, setJoiningId] = useState<string | null>(null);

  const handleJoin = async (roomId: string, ownerUsername: string) => {
    // Find owner IP from peers
    const ownerPeer = peers.find(p => p.username === ownerUsername);
    if (!ownerPeer) {
      alert("Cannot find owner on LAN to send join request.");
      return;
    }

    setJoiningId(roomId);
    try {
      await window.api.joinRoom(roomId, ownerPeer.ip);
      // Wait for state sync to actually add the room
      // For now just close or show 'Requested'
      onClose();
    } catch (err) {
      console.error(err);
      setJoiningId(null);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-dark-800 rounded-xl shadow-2xl w-full max-w-lg border border-dark-700 overflow-hidden transform transition-all flex flex-col max-h-[80vh]">
        <div className="flex justify-between items-center p-5 border-b border-dark-700 bg-dark-800 shrink-0">
          <h2 className="text-xl font-bold text-white tracking-wide">Discover Rooms</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors p-1 rounded-md hover:bg-dark-700">
            <X size={20} />
          </button>
        </div>
        
        <div className="overflow-y-auto p-2 flex-1">
          {discoveredRooms.length === 0 ? (
            <div className="text-center py-10 text-gray-500">
              <Globe size={48} className="mx-auto mb-4 opacity-30" />
              <p>No active rooms found on the LAN.</p>
              <p className="text-sm mt-1">Wait for someone to create a room.</p>
            </div>
          ) : (
            <div className="space-y-2 p-2">
              {discoveredRooms.map(room => (
                <div key={room.roomId} className="flex items-center justify-between bg-dark-900 border border-dark-700 p-4 rounded-xl">
                  <div className="flex flex-col">
                    <div className="flex items-center gap-2">
                      <Hash size={16} className="text-gray-400" />
                      <span className="font-semibold text-white text-lg">{room.roomName}</span>
                    </div>
                    <div className="flex items-center gap-3 mt-1 text-xs text-gray-500">
                      <span className="flex items-center gap-1"><Crown size={12} className="text-yellow-500"/> {room.owner}</span>
                      <span className="flex items-center gap-1"><Users size={12}/> {room.memberCount} members</span>
                    </div>
                  </div>
                  <button 
                    onClick={() => handleJoin(room.roomId, room.owner)}
                    disabled={joiningId === room.roomId}
                    className="px-4 py-1.5 bg-primary-600 hover:bg-primary-500 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
                  >
                    {joiningId === room.roomId ? 'Joining...' : 'Join'}
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
// Add Globe import
import { Globe } from 'lucide-react';
