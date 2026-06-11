import React, { useState, useEffect, useRef } from 'react';
import { useAppStore } from '../store';
import { Send, Users, Crown, Settings } from 'lucide-react';

export const RoomChatPanel: React.FC = () => {
  const { activeRoomId, rooms, roomMessages, addRoomMessage, identity, peers } = useAppStore();
  const [inputText, setInputText] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const activeRoom = rooms.find(r => r.id === activeRoomId);
  const activeMessages = activeRoomId ? roomMessages[activeRoomId] || [] : [];

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [activeMessages]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim() || !activeRoomId) return;

    try {
      const msg = await window.api.sendRoomMessage(activeRoomId, inputText.trim());
      addRoomMessage(activeRoomId, msg);
      setInputText('');
    } catch (err) {
      console.error('Failed to send room message:', err);
    }
  };

  if (!activeRoom) return null;

  return (
    <div className="flex h-full w-full">
      <div className="flex flex-col flex-1 bg-[#242438]">
        {/* Room Header */}
        <div className="h-16 px-6 border-b border-dark-700 flex items-center justify-between bg-dark-800 shadow-sm z-10 shrink-0">
          <div className="flex flex-col">
            <h2 className="font-semibold text-lg text-white"># {activeRoom.name}</h2>
            <div className="flex items-center gap-2 text-xs text-gray-400">
              <span>{activeRoom.description || 'No description'}</span>
            </div>
          </div>
          <button className="text-gray-400 hover:text-white p-2 rounded-lg hover:bg-dark-700">
            <Settings size={18} />
          </button>
        </div>

        {/* Messages Area */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6 scroll-smooth">
          {activeMessages.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-gray-500 opacity-70">
              <p className="text-lg">Welcome to # {activeRoom.name}</p>
              <p className="text-sm">This is the start of the room history.</p>
            </div>
          ) : (
            activeMessages.map(msg => {
              const isMe = msg.senderId === identity?.username;
              return (
                <div key={msg.id} className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
                  <div className="flex items-end gap-2 max-w-[70%]">
                    {!isMe && (
                      <div className="w-8 h-8 rounded-full bg-dark-700 flex-shrink-0 flex items-center justify-center text-sm font-bold border border-dark-600">
                        {msg.senderId.charAt(0).toUpperCase()}
                      </div>
                    )}
                    <div className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
                      {!isMe && <span className="text-xs text-gray-400 ml-1 mb-1">{msg.senderId}</span>}
                      <div className={`px-4 py-2.5 rounded-2xl shadow-sm ${
                        isMe 
                          ? 'bg-primary-600 text-white rounded-br-sm' 
                          : 'bg-dark-800 text-gray-100 rounded-bl-sm border border-dark-700'
                      }`}>
                        <p className="leading-relaxed break-words whitespace-pre-wrap">{msg.content}</p>
                      </div>
                    </div>
                  </div>
                  <span className="text-[10px] text-gray-500 mt-1 px-1">
                    {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    {isMe && <span className="ml-2 text-primary-400">{msg.status}</span>}
                  </span>
                </div>
              );
            })
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input Area */}
        <div className="p-4 bg-dark-900 border-t border-dark-800 shrink-0">
          <form onSubmit={handleSend} className="relative flex items-center">
            <input
              type="text"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder={`Message # ${activeRoom.name}`}
              className="w-full bg-dark-800 border border-dark-700 text-white rounded-xl pl-4 pr-12 py-3.5 focus:outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500 transition-all"
            />
            <button
              type="submit"
              disabled={!inputText.trim()}
              className="absolute right-2 p-2 bg-primary-600 hover:bg-primary-500 text-white rounded-lg transition-colors disabled:opacity-50 disabled:hover:bg-primary-600"
            >
              <Send size={18} className="ml-0.5" />
            </button>
          </form>
        </div>
      </div>

      {/* Members Sidebar */}
      <aside className="w-56 bg-dark-900 border-l border-dark-800 flex flex-col shrink-0">
        <div className="h-16 flex items-center px-4 border-b border-dark-800 font-semibold text-gray-300 gap-2 shrink-0">
          <Users size={16} /> Members
        </div>
        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {activeRoom.members.map(member => {
            const peer = peers.find(p => p.username === member.peerId);
            const isOnline = peer?.status === 'Online' || member.peerId === identity?.username;
            return (
              <div key={member.peerId} className="flex items-center gap-3 p-2 rounded-lg hover:bg-dark-800 text-gray-300 group transition-all">
                <div className="relative">
                  <div className="w-8 h-8 rounded-full bg-dark-700 flex items-center justify-center font-bold text-sm">
                    {member.peerId.charAt(0).toUpperCase()}
                  </div>
                  <div className={`absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full border-2 border-dark-900 ${
                    isOnline ? 'bg-green-500' : 'bg-gray-500'
                  }`} />
                </div>
                <div className="flex flex-col flex-1 min-w-0">
                  <div className="flex items-center gap-1">
                    <span className="font-medium text-sm truncate">{member.peerId}</span>
                    {member.role === 'Owner' && <Crown size={12} className="text-yellow-500" />}
                  </div>
                  <span className="text-[10px] text-gray-500">{member.role}</span>
                </div>
              </div>
            );
          })}
        </div>
      </aside>
    </div>
  );
};
