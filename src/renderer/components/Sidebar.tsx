import React from 'react';
import { useAppStore } from '../store';
import { Monitor } from 'lucide-react';

export const Sidebar: React.FC = () => {
  const { peers, activeChatIp, setActiveChatIp } = useAppStore();

  return (
    <aside className="w-64 bg-dark-800 border-r border-dark-700 flex flex-col h-full">
      <div className="h-14 flex items-center px-4 border-b border-dark-700 font-semibold text-gray-300">
        Active Peers
      </div>
      <div className="flex-1 overflow-y-auto p-3 space-y-1">
        {peers.length === 0 ? (
          <div className="text-center text-sm text-gray-500 mt-8">
            No peers found on LAN.
          </div>
        ) : (
          peers.map(peer => (
            <button
              key={peer.ip}
              onClick={() => setActiveChatIp(peer.ip)}
              className={`w-full flex items-center gap-3 p-3 rounded-lg transition-all ${
                activeChatIp === peer.ip ? 'bg-primary-600 text-white shadow-md' : 'hover:bg-dark-700 text-gray-300'
              }`}
            >
              <div className="relative flex-shrink-0">
                <div className="w-10 h-10 rounded-full bg-dark-900 flex items-center justify-center border border-dark-700">
                  <span className="font-bold text-lg">{peer.username.charAt(0).toUpperCase()}</span>
                </div>
                <div className={`absolute bottom-0 right-0 w-3.5 h-3.5 rounded-full border-2 border-dark-800 ${
                  peer.status === 'Online' ? 'bg-green-500' : 'bg-gray-500'
                }`} />
              </div>
              <div className="flex flex-col items-start overflow-hidden flex-1">
                <span className="font-medium truncate w-full text-left">{peer.username}</span>
                <div className="flex items-center gap-1 text-xs text-gray-400 truncate w-full">
                  <Monitor size={12} />
                  <span className="truncate">{peer.deviceName}</span>
                </div>
              </div>
            </button>
          ))
        )}
      </div>
    </aside>
  );
};
