import React, { useState, useEffect, useRef } from 'react';
import { useAppStore } from '../store';
import { Send, Monitor } from 'lucide-react';

export const ChatPanel: React.FC = () => {
  const { activeChatIp, peers, messages, addMessage, identity } = useAppStore();
  const [inputText, setInputText] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const activePeer = peers.find(p => p.ip === activeChatIp);
  const activeMessages = activeChatIp ? messages[activeChatIp] || [] : [];

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [activeMessages]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim() || !activeChatIp) return;

    try {
      const msg = await window.api.sendMessage(activeChatIp, inputText.trim());
      addMessage(activeChatIp, msg);
      setInputText('');
    } catch (err) {
      console.error('Failed to send message:', err);
      // Optional: show a toast/error to the user
    }
  };

  if (!activePeer) return null;

  return (
    <div className="flex flex-col h-full bg-[#242438]">
      {/* Chat Header */}
      <div className="h-16 px-6 border-b border-dark-700 flex items-center bg-dark-800 shadow-sm z-10 shrink-0">
        <div className="flex flex-col">
          <h2 className="font-semibold text-lg text-white">{activePeer.username}</h2>
          <div className="flex items-center gap-2 text-xs text-gray-400">
            <span className="flex items-center gap-1">
              <div className={`w-2 h-2 rounded-full ${activePeer.status === 'Online' ? 'bg-green-500' : 'bg-gray-500'}`} />
              {activePeer.status}
            </span>
            <span>•</span>
            <span className="flex items-center gap-1"><Monitor size={12}/> {activePeer.deviceName}</span>
            <span>•</span>
            <span className="font-mono">{activePeer.ip}</span>
          </div>
        </div>
      </div>

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto p-6 space-y-6 scroll-smooth">
        {activeMessages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-gray-500 opacity-70">
            <p className="text-lg">No messages yet.</p>
            <p className="text-sm">Say hello to {activePeer.username}!</p>
          </div>
        ) : (
          activeMessages.map(msg => {
            const isMe = msg.sender === identity?.username;
            return (
              <div key={msg.messageId} className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
                <div className="flex items-end gap-2 max-w-[70%]">
                  {!isMe && (
                    <div className="w-8 h-8 rounded-full bg-dark-700 flex-shrink-0 flex items-center justify-center text-sm font-bold border border-dark-600">
                      {msg.sender.charAt(0).toUpperCase()}
                    </div>
                  )}
                  <div className={`px-4 py-2.5 rounded-2xl shadow-sm ${
                    isMe 
                      ? 'bg-primary-600 text-white rounded-br-sm' 
                      : 'bg-dark-800 text-gray-100 rounded-bl-sm border border-dark-700'
                  }`}>
                    <p className="leading-relaxed break-words whitespace-pre-wrap">{msg.content}</p>
                  </div>
                </div>
                <span className="text-[10px] text-gray-500 mt-1 px-1">
                  {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
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
            disabled={activePeer.status === 'Offline'}
            placeholder={activePeer.status === 'Offline' ? "Peer is offline..." : `Message @${activePeer.username}`}
            className="w-full bg-dark-800 border border-dark-700 text-white rounded-xl pl-4 pr-12 py-3.5 focus:outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500 transition-all disabled:opacity-50"
          />
          <button
            type="submit"
            disabled={!inputText.trim() || activePeer.status === 'Offline'}
            className="absolute right-2 p-2 bg-primary-600 hover:bg-primary-500 text-white rounded-lg transition-colors disabled:opacity-50 disabled:hover:bg-primary-600"
          >
            <Send size={18} className="ml-0.5" />
          </button>
        </form>
      </div>
    </div>
  );
};
