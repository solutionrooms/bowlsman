'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useMessaging } from '../context/MessagingContext';
import api from '../../../src/lib/axios';
import { debounce } from 'lodash';

interface User {
  id: number;
  username: string;
  email: string;
  first_name: string;
  last_name: string;
  full_name: string;
  club_role?: string;
  is_admin?: boolean;
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
    is_staff: boolean;
  };
  current_club: {
    id: number;
    name: string;
    is_admin: boolean;
  } | null;
  clubs: {
    id: number;
    name: string;
    is_admin: boolean;
  }[];
}

interface CreateChatModalProps {
  isOpen: boolean;
  onClose: () => void;
  clubId: number;
  onChatCreated: (chatId: number) => void;
  initialChatType?: 'direct' | 'group' | 'team' | 'competition';
  initialChatName?: string;
}

const CreateChatModal: React.FC<CreateChatModalProps> = ({ 
  isOpen, 
  onClose, 
  clubId,
  onChatCreated,
  initialChatType,
  initialChatName
}) => {
  const { createChat } = useMessaging();
  const [chatType, setChatType] = useState<'direct' | 'group' | 'team' | 'competition'>(initialChatType || 'direct');
  const [chatName, setChatName] = useState(initialChatName || '');
  const [selectedUsers, setSelectedUsers] = useState<User[]>([]);
  const [selectedCompetition, setSelectedCompetition] = useState<number | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [competitions, setCompetitions] = useState<Competition[]>([]);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<User[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [loadingMembers, setLoadingMembers] = useState(false);

  // Fetch data only when the modal is opened
  useEffect(() => {
    if (!isOpen || !clubId) return;
    
    // Reset state when modal opens, but preserve initialChatType and initialChatName if provided
    setChatType(initialChatType || 'direct');
    setChatName(initialChatName || '');
    setSelectedUsers([]);
    setSelectedCompetition(null);
    setError('');
    setSearchQuery('');
    setSearchResults([]);
    
    // Define an async function inside useEffect
    const fetchData = async () => {
      // Fetch club members
      setLoadingMembers(true);
      try {
        const response = await Promise.all([
          api.get<any[]>(`/clubs/${clubId}/members`, {}),
          api.get(`/users/me/`)
        ]);
        
        const clubUsers = response[0].data as any[];
        
        // Enhance user data with club_role and is_admin
        const enhancedUsers = users.map(user => {
          // Try different ways to match the user
          const clubUser = clubUsers.find(cu => {
            // Check if user IDs match directly
            if (cu.user === user.id) return true;
            
            // Check if user is an object with an id property
            if (typeof cu.user === 'object' && cu.user !== null && cu.user.id === user.id) return true;
            
            // Check if user_id exists and matches
            if (cu.user_id === user.id) return true;
            
            return false;
          });
          
          return {
            ...user,
            club_role: clubUser ? clubUser.club_role : '',
            is_admin: clubUser ? Boolean(clubUser.is_admin) : false,
            full_name: `${user.first_name} ${user.last_name}`.trim() || user.username
          };
        });
        
        setUsers(enhancedUsers);
        // Initially show all users in search results
        setSearchResults(enhancedUsers);
      } catch (error) {
        console.error('Error fetching club user details:', error);
        setUsers(users);
        // Initially show all users in search results
        setSearchResults(users);
      }
    };

    fetchData();

    // Fetch competitions
    api.get<Competition[]>(`/api/competitions/?club_id=${clubId}`)
      .then(response => {
        setCompetitions(response.data);
      })
      .catch(error => {
        console.error('Error fetching competitions:', error);
      });

    // Check if user is admin
    api.get<UserInfoResponse>('/api/users/me/')
      .then(response => {
        // Check if the user is an admin in the current club
        const clubs = response.data.clubs || [];
        const currentClub = clubs.find((club) => club.id === clubId);
        setIsAdmin(currentClub?.is_admin || false);
      })
      .catch(error => {
        console.error('Error checking admin status:', error);
        // Don't prevent the user from using the component if this fails
        // Just assume they are not an admin
        setIsAdmin(false);
      });
  }, [isOpen, clubId, initialChatType, initialChatName]);

  // Replace the debounced API search with local filtering
  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const query = e.target.value.trim().toLowerCase();
    setSearchQuery(query);
    setShowDropdown(true);
    
    if (!query) {
      // Show all users when search is empty
      setSearchResults(users.filter(
        user => !selectedUsers.some(selectedUser => selectedUser.id === user.id)
      ));
      return;
    }
    
    // Filter users locally based on search query
    const filtered = users.filter(user => {
      // Filter out already selected users
      if (selectedUsers.some(selectedUser => selectedUser.id === user.id)) {
        return false;
      }
      
      // Search in username, first_name, last_name, email, or full_name
      return (
        user.username.toLowerCase().includes(query) ||
        (user.first_name && user.first_name.toLowerCase().includes(query)) ||
        (user.last_name && user.last_name.toLowerCase().includes(query)) ||
        user.email.toLowerCase().includes(query) ||
        (user.full_name && user.full_name.toLowerCase().includes(query))
      );
    });
    
    setSearchResults(filtered);
  };

  // Handle selecting a user from search results
  const handleSelectUser = (user: User) => {
    setSelectedUsers(prev => [...prev, user]);
    setSearchQuery('');
    // Update search results to remove selected user
    setSearchResults(prev => prev.filter(u => u.id !== user.id));
  };

  // Handle removing a selected user
  const handleRemoveUser = (userId: number) => {
    setSelectedUsers(prev => prev.filter(user => user.id !== userId));
  };

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
        data.members = selectedUsers.map(user => user.id);
      }

      // Add competition for competition chats
      if (chatType === 'competition') {
        data.competition = selectedCompetition;
      }

      // Create the chat (or find existing one - createChat function already handles this logic)
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
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-semibold">Create New Chat</h2>
            <button 
              onClick={onClose}
              className="text-gray-500 hover:text-gray-700"
            >
              ✕
            </button>
          </div>
          
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
                <label className="block text-gray-700 mb-2">
                  Chat Name
                </label>
                <input
                  type="text"
                  className="w-full p-2 border border-gray-300 rounded-md"
                  value={chatName}
                  onChange={(e) => setChatName(e.target.value)}
                  placeholder={chatType === 'group' ? "Enter group name" : "Enter team chat name"}
                />
              </div>
            )}
            
            {chatType === 'competition' && (
              <div className="mb-4">
                <label className="block text-gray-700 mb-2">
                  Select Competition
                </label>
                <select
                  className="w-full p-2 border border-gray-300 rounded-md"
                  value={selectedCompetition || ''}
                  onChange={(e) => setSelectedCompetition(Number(e.target.value) || null)}
                >
                  <option value="">-- Select a competition --</option>
                  {competitions.map((competition) => (
                    <option key={competition.id} value={competition.id}>
                      {competition.name}
                    </option>
                  ))}
                </select>
              </div>
            )}
            
            {(chatType === 'direct' || chatType === 'group') && (
              <div className="mb-4">
                <label className="block text-gray-700 mb-2">
                  {chatType === 'direct' ? 'Select User' : 'Add Users'}
                </label>
                
                {/* User search input */}
                <div className="relative mb-2">
                  <input
                    type="text"
                    className="w-full p-2 border border-gray-300 rounded-md"
                    value={searchQuery}
                    onChange={handleSearchChange}
                    placeholder="Search for users..."
                    onFocus={() => setShowDropdown(true)}
                    onBlur={() => setTimeout(() => setShowDropdown(false), 200)}
                  />
                  
                  {/* Search results dropdown - show when input is focused */}
                  {showDropdown && (
                    <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-y-auto">
                      {searchResults.length > 0 ? (
                        searchResults.map(user => (
                          <div
                            key={user.id}
                            className="p-2 hover:bg-gray-100 cursor-pointer"
                            onClick={() => handleSelectUser(user)}
                            onMouseDown={(e) => e.preventDefault()} // Prevent input blur when clicking
                          >
                            <div className="font-medium">{user.full_name || user.username}</div>
                            <div className="text-xs text-gray-500">{user.email}</div>
                          </div>
                        ))
                      ) : (
                        <div className="p-2 text-center text-gray-500">
                          {searchQuery ? "No users found matching your search" : "No users available"}
                        </div>
                      )}
                    </div>
                  )}
                </div>
                
                {/* Selected users */}
                <div className="mt-2">
                  <div className="text-sm font-medium text-gray-700 mb-1">
                    {selectedUsers.length > 0 
                      ? `Selected ${chatType === 'direct' ? 'User' : 'Users'} (${selectedUsers.length})` 
                      : `No ${chatType === 'direct' ? 'user' : 'users'} selected`}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {selectedUsers.map(user => (
                      <div 
                        key={user.id}
                        className="flex items-center bg-blue-100 text-blue-800 px-2 py-1 rounded-full text-sm"
                      >
                        <span>{user.full_name || user.username}</span>
                        <button
                          type="button"
                          className="ml-1 text-blue-600 hover:text-blue-800"
                          onClick={() => handleRemoveUser(user.id)}
                        >
                          ✕
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
            
            <div className="flex justify-end mt-6">
              <button
                type="button"
                className="mr-2 px-4 py-2 text-gray-700 bg-gray-200 rounded-md hover:bg-gray-300"
                onClick={onClose}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:bg-blue-300"
                disabled={loading || 
                  (chatType === 'direct' && selectedUsers.length !== 1) ||
                  (chatType === 'group' && selectedUsers.length === 0) ||
                  (chatType === 'competition' && !selectedCompetition) ||
                  (chatType === 'team' && !isAdmin)}
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