import React from 'react';
import { useAppStore } from '../store';
import { Hash, Plus, Globe } from 'lucide-react';

export const RoomsSidebar: React.FC<{ onCreateRoom: () => void, onJoinRoom: () => void }> = ({ onCreateRoom, onJoinRoom }) => {
  const { rooms, activeRoomId, setActiveRoomId } = useAppStore();

  return (
    <aside className="w-64 bg-dark-900 border-r border-dark-800 flex flex-col h-full shrink-0 shadow-lg z-20">
      <div className="h-14 flex items-center justify-between px-4 border-b border-dark-800">
        <span className="font-semibold text-gray-200 tracking-wide">Rooms</span>
        <div className="flex gap-1">
          <button onClick={onJoinRoom} className="p-1.5 text-gray-400 hover:text-white hover:bg-dark-700 rounded-md transition-all" title="Discover Rooms">
            <Globe size={16} />
          </button>
          <button onClick={onCreateRoom} className="p-1.5 text-gray-400 hover:text-white hover:bg-dark-700 rounded-md transition-all" title="Create Room">
            <Plus size={16} />
          </button>
        </div>
      </div>
      
      <div className="flex-1 overflow-y-auto p-2 space-y-0.5">
        <div className="px-3 py-2 text-xs font-bold text-gray-500 uppercase tracking-wider">My Rooms</div>
        {rooms.length === 0 ? (
          <div className="px-3 py-4 text-sm text-gray-500 text-center">
            No rooms joined.
          </div>
        ) : (
          rooms.map(room => (
            <button
              key={room.id}
              onClick={() => setActiveRoomId(room.id)}
              className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-all ${
                activeRoomId === room.id 
                  ? 'bg-dark-700 text-white shadow-sm' 
                  : 'hover:bg-dark-800 text-gray-400 hover:text-gray-200'
              }`}
            >
              <Hash size={18} className={activeRoomId === room.id ? 'text-gray-300' : 'text-gray-500'} />
              <div className="flex flex-col items-start truncate w-full">
                <span className="font-medium truncate">{room.name}</span>
              </div>
            </button>
          ))
        )}
      </div>
    </aside>
  );
};
