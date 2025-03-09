'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useMessaging } from '../context/MessagingContext';
import api from '../../../src/lib/axios';

interface User {
  id: number;
  username: string;
  email: string;
  first_name: string;
  last_name: string;
  full_name: string;
}

interface Competition {
  id: number;
  name: string;
  status: string;
}

interface UserInfoResponse {
  user: {
    id: number;
    username: string;
    email: string;
    clubs?: {
      id: number;
      name: string;
      is_admin: boolean;
    }[];
  };
}

interface CreateChatModalProps {
  isOpen: boolean;
  onClose: () => void;
  clubId: number;
  onChatCreated: (chatId: number) => void;
}

const CreateChatModal: React.FC<CreateChatModalProps> = ({ 
  isOpen, 
  onClose, 
  clubId,
  onChatCreated
}) => {
  const { createChat } = useMessaging();
  const [chatType, setChatType] = useState<'direct' | 'group' | 'team' | 'competition'>('direct');
  const [chatName, setChatName] = useState('');
  const [selectedUsers, setSelectedUsers] = useState<number[]>([]);
  const [selectedCompetition, setSelectedCompetition] = useState<number | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [competitions, setCompetitions] = useState<Competition[]>([]);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Fetch data only when the modal is opened
  useEffect(() => {
    if (!isOpen || !clubId) return;
    
    // Reset state when modal opens
    setChatType('direct');
    setChatName('');
    setSelectedUsers([]);
    setSelectedCompetition(null);
    setError('');
    
    // Fetch club members
    api.get<User[]>(`/api/club-members/${clubId}/`)
      .then(response => {
        setUsers(response.data);
      })
      .catch(error => {
        console.error('Error fetching club members:', error);
      });

    // Fetch competitions
    api.get<Competition[]>(`/api/competitions/?club_id=${clubId}`)
      .then(response => {
        setCompetitions(response.data);
      })
      .catch(error => {
        console.error('Error fetching competitions:', error);
      });

    // Check if user is admin
    api.get<UserInfoResponse>('/api/user-info/')
      .then(response => {
        const userClubs = response.data.user.clubs || [];
        const currentClub = userClubs.find((club) => club.id === clubId);
        setIsAdmin(currentClub?.is_admin || false);
      })
      .catch(error => {
        console.error('Error checking admin status:', error);
      });
  }, [isOpen, clubId]);

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      // Validate form based on chat type
      if (chatType === 'direct' && selectedUsers.length !== 1) {
        throw new Error('Please select exactly one user for direct chat');
      }

      if (chatType === 'group' && selectedUsers.length === 0) {
        throw new Error('Please select at least one user for group chat');
      }

      if (chatType === 'team' && !isAdmin) {
        throw new Error('Only team captains can create team chats');
      }

      if (chatType === 'competition' && !selectedCompetition) {
        throw new Error('Please select a competition');
      }

      // Prepare data for API
      const data: any = {
        chat_type: chatType,
        club_id: clubId,
      };

      // Add chat name if provided
      if (chatName.trim()) {
        data.name = chatName;
      }

      // Add members for direct and group chats
      if (chatType === 'direct' || chatType === 'group') {
        data.members = selectedUsers;
      }

      // Add competition for competition chats
      if (chatType === 'competition') {
        data.competition = selectedCompetition;
      }

      // Create the chat
      const newChat = await createChat(data);
      onChatCreated(newChat.id);
      onClose();
    } catch (error: any) {
      setError(error.message || 'Failed to create chat');
    } finally {
      setLoading(false);
    }
  }, [chatType, selectedUsers, isAdmin, selectedCompetition, chatName, clubId, createChat, onChatCreated, onClose]);

  // Don't render anything if the modal is closed
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md">
        <div className="p-6">
          <h2 className="text-xl font-semibold mb-4">Create New Chat</h2>
          
          {error && (
            <div className="mb-4 p-3 bg-red-100 text-red-700 rounded-md">
              {error}
            </div>
          )}
          
          <form onSubmit={handleSubmit}>
            <div className="mb-4">
              <label className="block text-gray-700 mb-2">Chat Type</label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  className={`p-2 rounded-md ${chatType === 'direct' ? 'bg-blue-100 border-blue-500 border' : 'bg-gray-100'}`}
                  onClick={() => setChatType('direct')}
                >
                  👤 Direct Chat
                </button>
                <button
                  type="button"
                  className={`p-2 rounded-md ${chatType === 'group' ? 'bg-blue-100 border-blue-500 border' : 'bg-gray-100'}`}
                  onClick={() => setChatType('group')}
                >
                  👥 Group Chat
                </button>
                <button
                  type="button"
                  className={`p-2 rounded-md ${chatType === 'team' ? 'bg-blue-100 border-blue-500 border' : 'bg-gray-100'} ${!isAdmin ? 'opacity-50 cursor-not-allowed' : ''}`}
                  onClick={() => isAdmin && setChatType('team')}
                  disabled={!isAdmin}
                >
                  🏆 Team Chat
                </button>
                <button
                  type="button"
                  className={`p-2 rounded-md ${chatType === 'competition' ? 'bg-blue-100 border-blue-500 border' : 'bg-gray-100'}`}
                  onClick={() => setChatType('competition')}
                >
                  🎯 Competition Chat
                </button>
              </div>
              {chatType === 'team' && !isAdmin && (
                <p className="text-xs text-gray-500 mt-1">Only team captains can create team chats</p>
              )}
            </div>
            
            {(chatType === 'group' || chatType === 'team') && (
              <div className="mb-4">
                <label htmlFor="chatName" className="block text-gray-700 mb-2">Chat Name (optional)</label>
                <input
                  type="text"
                  id="chatName"
                  value={chatName}
                  onChange={(e) => setChatName(e.target.value)}
                  className="w-full p-2 border border-gray-300 rounded-md"
                  placeholder="Enter a name for this chat"
                />
              </div>
            )}
            
            {(chatType === 'direct' || chatType === 'group') && (
              <div className="mb-4">
                <label className="block text-gray-700 mb-2">
                  {chatType === 'direct' ? 'Select User' : 'Select Users'}
                </label>
                <div className="max-h-40 overflow-y-auto border border-gray-300 rounded-md">
                  {users.length === 0 ? (
                    <p className="p-3 text-gray-500">No users available</p>
                  ) : (
                    users.map(user => (
                      <div 
                        key={user.id} 
                        className="p-2 hover:bg-gray-100 cursor-pointer flex items-center"
                        onClick={() => {
                          if (chatType === 'direct') {
                            setSelectedUsers([user.id]);
                          } else {
                            setSelectedUsers(prev => 
                              prev.includes(user.id) 
                                ? prev.filter(id => id !== user.id) 
                                : [...prev, user.id]
                            );
                          }
                        }}
                      >
                        <input 
                          type={chatType === 'direct' ? 'radio' : 'checkbox'}
                          checked={selectedUsers.includes(user.id)}
                          onChange={() => {}}
                          className="mr-2"
                        />
                        <span>{user.full_name || user.username}</span>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
            
            {chatType === 'competition' && (
              <div className="mb-4">
                <label className="block text-gray-700 mb-2">Select Competition</label>
                <select
                  value={selectedCompetition || ''}
                  onChange={(e) => setSelectedCompetition(Number(e.target.value) || null)}
                  className="w-full p-2 border border-gray-300 rounded-md"
                >
                  <option value="">-- Select a competition --</option>
                  {competitions.map(competition => (
                    <option key={competition.id} value={competition.id}>
                      {competition.name} ({competition.status})
                    </option>
                  ))}
                </select>
              </div>
            )}
            
            <div className="flex justify-end space-x-2 mt-6">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-blue-300"
              >
                {loading ? 'Creating...' : 'Create Chat'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default CreateChatModal; 