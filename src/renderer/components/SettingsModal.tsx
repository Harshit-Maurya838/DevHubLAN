import React, { useState, useEffect } from 'react';
import { useAppStore } from '../store';
import { User, Monitor, X } from 'lucide-react';

export const SettingsModal: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const { identity, setIdentity } = useAppStore();
  const [username, setUsername] = useState(identity?.username || '');
  const [deviceName, setDeviceName] = useState(identity?.deviceName || '');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (identity) {
      setUsername(identity.username);
      setDeviceName(identity.deviceName);
    }
  }, [identity]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !deviceName.trim()) return;

    setIsSaving(true);
    const updated = { username: username.trim(), deviceName: deviceName.trim() };
    await window.api.updateIdentity(updated);
    setIdentity({ ...identity!, ...updated });
    setIsSaving(false);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-dark-800 rounded-2xl shadow-2xl w-full max-w-md border border-dark-700 overflow-hidden transform transition-all">
        <div className="flex justify-between items-center p-6 border-b border-dark-700 bg-dark-800">
          <h2 className="text-xl font-bold text-white tracking-wide">Developer Profile</h2>
          <button 
            onClick={onClose} 
            className="text-gray-400 hover:text-white transition-colors p-1 rounded-md hover:bg-dark-700"
          >
            <X size={20} />
          </button>
        </div>
        
        <form onSubmit={handleSave} className="p-6 space-y-6">
          <div className="space-y-2">
            <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider flex items-center gap-2">
              <User size={14} /> Username
            </label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="e.g. Harshit"
              className="w-full bg-dark-900 border border-dark-600 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500 transition-all placeholder:text-dark-600"
              maxLength={20}
              required
            />
          </div>

          <div className="space-y-2">
            <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider flex items-center gap-2">
              <Monitor size={14} /> Device Name
            </label>
            <input
              type="text"
              value={deviceName}
              onChange={(e) => setDeviceName(e.target.value)}
              placeholder="e.g. DESKTOP-ABC"
              className="w-full bg-dark-900 border border-dark-600 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500 transition-all placeholder:text-dark-600"
              maxLength={30}
              required
            />
            <p className="text-xs text-gray-500 pt-1">This helps others identify your machine on the network.</p>
          </div>

          <div className="pt-4 flex justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2.5 rounded-lg text-sm font-medium text-gray-300 hover:text-white hover:bg-dark-700 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSaving || !username.trim() || !deviceName.trim()}
              className="px-6 py-2.5 bg-primary-600 hover:bg-primary-500 text-white rounded-lg font-medium shadow-lg transition-all disabled:opacity-50 disabled:hover:bg-primary-600"
            >
              {isSaving ? 'Saving...' : 'Save Profile'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
