import React, { useState } from 'react';
import { X, Hash } from 'lucide-react';
import { useAppStore } from '../store';

export const CreateRoomModal: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const { setActiveRoomId, updateRoom } = useAppStore();

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    setIsCreating(true);
    try {
      const room = await window.api.createRoom(name.trim(), description.trim());
      updateRoom(room);
      setActiveRoomId(room.id);
      onClose();
    } catch (err) {
      console.error(err);
      setIsCreating(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-dark-800 rounded-xl shadow-2xl w-full max-w-md border border-dark-700 overflow-hidden transform transition-all">
        <div className="flex justify-between items-center p-5 border-b border-dark-700 bg-dark-800">
          <h2 className="text-xl font-bold text-white tracking-wide">Create Room</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors p-1 rounded-md hover:bg-dark-700">
            <X size={20} />
          </button>
        </div>
        
        <form onSubmit={handleCreate} className="p-6 space-y-5">
          <div className="space-y-2">
            <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider flex items-center gap-2">
              <Hash size={14} /> Room Name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Frontend Team"
              className="w-full bg-dark-900 border border-dark-600 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500 transition-all placeholder:text-dark-600"
              maxLength={30}
              required
            />
          </div>

          <div className="space-y-2">
            <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
              Description (Optional)
            </label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What is this room about?"
              className="w-full bg-dark-900 border border-dark-600 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500 transition-all placeholder:text-dark-600"
              maxLength={100}
            />
          </div>

          <div className="pt-4 flex justify-end gap-3">
            <button type="button" onClick={onClose} className="px-5 py-2 rounded-lg text-sm font-medium text-gray-300 hover:text-white hover:bg-dark-700 transition-colors">
              Cancel
            </button>
            <button type="submit" disabled={isCreating || !name.trim()} className="px-6 py-2 bg-primary-600 hover:bg-primary-500 text-white rounded-lg font-medium shadow-md transition-all disabled:opacity-50">
              {isCreating ? 'Creating...' : 'Create Room'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
