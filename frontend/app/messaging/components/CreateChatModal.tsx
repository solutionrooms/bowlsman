'use client';

import React, { useState, useEffect } from 'react';
import { useMessaging } from '../context/MessagingContext';
import api from '../../../src/lib/axios';

// User interface definition
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

// Competition interface definition
interface Competition {
  id: number;
  name: string;
  status: string;
}

// User info response interface for API calls
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

// Props for the CreateChatModal component
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
  console.log('CLAUDE DEBUG: CreateChatModal rendering with clubId', clubId);
  
  // Get chat creation function from context
  const { createChat } = useMessaging();
  
  // Component state
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
  const [loadingMembers, setLoadingMembers] = useState(false);
  const [availableUsers, setAvailableUsers] = useState<User[]>([]);
  const [searchResults, setSearchResults] = useState<User[]>([]);

  // Load data when modal opens
  useEffect(() => {
    console.log('CLAUDE DEBUG: useEffect for data loading triggered');
    console.log('CLAUDE DEBUG: isOpen =', isOpen, 'clubId =', clubId);
    
    if (!isOpen || !clubId) {
      console.log('CLAUDE DEBUG: Modal not open or no clubId, skipping data fetch');
      return;
    }
    
    // Reset state when modal opens, but preserve initialChatType and initialChatName if provided
    setChatType(initialChatType || 'direct');
    setChatName(initialChatName || '');
    setSelectedUsers([]);
    setSelectedCompetition(null);
    setError('');
    setSearchQuery('');
    
    console.log('CLAUDE DEBUG: Reset states, now fetching data');
    
    // Fetch club members data
    const fetchData = async () => {
      setLoadingMembers(true);
      try {
        console.log('CLAUDE DEBUG: Starting to fetch club members for club ID:', clubId);
        const response = await Promise.all([
          api.get<any[]>(`/clubs/${clubId}/members`, {}),
          api.get(`/users/me/`)
        ]);
        
        const clubUsers = response[0].data as any[];
        console.log('CLAUDE DEBUG: Got club users:', clubUsers.length);
        
        // Debug the structure of the first few club users
        console.log('CLAUDE DEBUG: Club users data structure:');
        if (clubUsers.length > 0) {
          // Log the first user's structure for debugging
          console.log('CLAUDE DEBUG: First club user structure:', JSON.stringify(clubUsers[0], null, 2));
          
          // Check user property types
          const firstUser = clubUsers[0];
          const userProp = firstUser.user;
          console.log('CLAUDE DEBUG: User property type:', typeof userProp);
          console.log('CLAUDE DEBUG: User property value:', userProp);
          
          if (typeof userProp === 'object' && userProp !== null) {
            console.log('CLAUDE DEBUG: User.id property:', userProp.id);
          }
        }
        
        // Process club members into user objects
        const processedUsers = clubUsers.map((clubUser, index) => {
          console.log(`CLAUDE DEBUG: Processing club user ${index}:`, clubUser);
          
          // Handle different API response formats
          let userId, firstName, lastName, username, email;
          
          if (typeof clubUser.user === 'object' && clubUser.user !== null) {
            // User is a nested object
            userId = clubUser.user.id;
            firstName = clubUser.user.first_name || '';
            lastName = clubUser.user.last_name || '';
            username = clubUser.user.username || '';
            email = clubUser.user.email || '';
            console.log(`CLAUDE DEBUG: Found nested user object with ID: ${userId}`);
          } else if (typeof clubUser.user === 'number') {
            // User is just an ID, use other properties directly
            userId = clubUser.user;
            firstName = clubUser.first_name || '';
            lastName = clubUser.last_name || '';
            username = clubUser.username || '';
            email = clubUser.email || '';
            console.log(`CLAUDE DEBUG: Found user ID: ${userId}`);
          } else if (clubUser.user_id) {
            // Using user_id property
            userId = clubUser.user_id;
            firstName = clubUser.first_name || '';
            lastName = clubUser.last_name || '';
            username = clubUser.username || '';
            email = clubUser.email || '';
            console.log(`CLAUDE DEBUG: Found user_id: ${userId}`);
          } else {
            // Fallback - use ID from parent object if available
            userId = clubUser.id;
            firstName = clubUser.first_name || '';
            lastName = clubUser.last_name || '';
            username = clubUser.username || '';
            email = clubUser.email || '';
            console.log(`CLAUDE DEBUG: Using fallback ID: ${userId}`);
          }
          
          // Create a full name from first and last name, or use username as fallback
          const fullName = `${firstName} ${lastName}`.trim() || username;
          
          // Verify we have a valid ID
          if (!userId) {
            console.error('CLAUDE DEBUG: Missing user ID!', clubUser);
          }
          
          // Create user object with all needed properties
          return {
            id: userId,
            username: username,
            email: email,
            first_name: firstName,
            last_name: lastName,
            full_name: fullName,
            club_role: clubUser.club_role || '',
            is_admin: Boolean(clubUser.is_admin),
          };
        });
        
        console.log('CLAUDE DEBUG: Processed users:', processedUsers.length);
        
        // Debug each user's ID to check for undefined issues
        processedUsers.forEach((user, index) => {
          console.log(`CLAUDE DEBUG: User ${index}: ID=${user.id}, Name=${user.full_name || user.username}`);
        });
        
        // Ensure all user data is properly set up from the beginning
        setUsers(processedUsers);
        setAvailableUsers(processedUsers);
        setSearchResults(processedUsers); // Make sure search results are populated initially
        
        // Do a final check of the users array
        console.log('CLAUDE DEBUG: First few user IDs:', processedUsers.slice(0, 3).map(u => u.id));
        console.log('CLAUDE DEBUG: Initial search results set with', processedUsers.length, 'users');
        setLoadingMembers(false);
      } catch (error) {
        console.error('CLAUDE DEBUG: Error fetching club user details:', error);
        setLoadingMembers(false);
      }
    };

    fetchData();

    // Fetch competitions for the competition chat option
    api.get<Competition[]>(`/api/competitions/?club_id=${clubId}`)
      .then(response => {
        setCompetitions(response.data);
      })
      .catch(error => {
        console.error('Error fetching competitions:', error);
      });

    // Check if user is admin in the current club
    api.get<UserInfoResponse>('/api/users/me/')
      .then(response => {
        const clubs = response.data.clubs || [];
        const currentClub = clubs.find((club) => club.id === clubId);
        setIsAdmin(currentClub?.is_admin || false);
      })
      .catch(error => {
        console.error('Error checking admin status:', error);
        setIsAdmin(false);
      });
  }, [isOpen, clubId, initialChatType, initialChatName]);

  // Handle search input changes
  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const query = e.target.value.toLowerCase();
    console.log('CLAUDE DEBUG: Search query changed to:', query);
    setSearchQuery(query);
    
    // Get available users (all users not already selected)
    const currentAvailableUsers = users.filter(user => 
      !selectedUsers.some(selectedUser => selectedUser.id === user.id)
    );
    
    console.log('CLAUDE DEBUG: Available users for search:', currentAvailableUsers.length);
    
    if (!query) {
      // If search is empty, show all available users
      console.log('CLAUDE DEBUG: Empty query, showing all available users');
      setSearchResults(currentAvailableUsers);
      return;
    }
    
    // Filter available users based on search query
    const filtered = currentAvailableUsers.filter(user => {
      // Check each field that might contain the search term
      const matchesUsername = user.username && user.username.toLowerCase().includes(query);
      const matchesFirstName = user.first_name && user.first_name.toLowerCase().includes(query);
      const matchesLastName = user.last_name && user.last_name.toLowerCase().includes(query);
      const matchesEmail = user.email && user.email.toLowerCase().includes(query);
      const matchesFullName = user.full_name && user.full_name.toLowerCase().includes(query);
      
      return matchesUsername || matchesFirstName || matchesLastName || matchesEmail || matchesFullName;
    });
    
    console.log('CLAUDE DEBUG: Filtered search results:', filtered.length);
    setSearchResults(filtered);
  };

  // Add a user to selected users
  const handleSelectUser = (user: User) => {
    console.log('CLAUDE DEBUG: Selecting user:', user.full_name || user.username);
    
    // For direct chats, we can only have one user
    if (chatType === 'direct') {
      console.log('CLAUDE DEBUG: Direct chat - replacing any existing selected user');
      setSelectedUsers([user]); // Replace any existing selection
      
      // For direct chats, hide the dropdown after selection
      setSearchResults([]);
      
      // Clear search
      setSearchQuery('');
      return;
    }
    
    // For group chats, we can add multiple users
    // Update selected users state
    setSelectedUsers(prev => {
      // Make sure user isn't already selected
      if (prev.some(u => u.id === user.id)) {
        console.log('CLAUDE DEBUG: User already selected, not adding again');
        return prev;
      }
      
      console.log('CLAUDE DEBUG: Adding user to selected users');
      const newUsers = [...prev, user];
      console.log('CLAUDE DEBUG: Selected users count now:', newUsers.length);
      
      // For group chats, immediately refresh the list of available users
      // This is crucial for multiple selection to work properly
      
      // Add the current user to the previous selections
      const newSelectedUsers = [...prev, user];
      
      // Log all user information for debugging
      console.log('CLAUDE DEBUG: All users count:', users.length);
      console.log('CLAUDE DEBUG: New selected users:', newSelectedUsers.map(u => u.full_name || u.username));
      
      // For filtering, we need to compare objects by ID
      // Get all users that aren't in the selected list by filtering
      const remainingUsers = users.filter(u => 
        !newSelectedUsers.some(selected => selected.id === u.id)
      );
      console.log('CLAUDE DEBUG: Remaining available users:', remainingUsers.length);
      
      // Update search results right away
      setSearchResults(remainingUsers);
      
      return newUsers;
    });
    
    // Clear search
    setSearchQuery('');
  };

  // Remove a user from selected users
  const handleRemoveUser = (userId: number) => {
    console.log('CLAUDE DEBUG: Removing user with ID:', userId);
    
    // Find the user that's being removed
    const removedUser = selectedUsers.find(user => user.id === userId);
    if (!removedUser) {
      console.log('CLAUDE DEBUG: User not found in selected users');
      return;
    }
    
    console.log('CLAUDE DEBUG: Found user to remove:', removedUser.full_name || removedUser.username);
    
    // Remove from selected users
    setSelectedUsers(prev => {
      const newSelectedUsers = prev.filter(user => user.id !== userId);
      console.log('CLAUDE DEBUG: Updated selected users count:', newSelectedUsers.length);
      return newSelectedUsers;
    });
    
    // Refresh the entire search results with all available users
    // This ensures we always have the correct available users list
    setTimeout(() => {
      const updatedSearchResults = users.filter(user => 
        !selectedUsers.some(selectedUser => selectedUser.id === user.id && selectedUser.id !== userId)
      );
      
      console.log('CLAUDE DEBUG: Updated search results count:', updatedSearchResults.length);
      setSearchResults(updatedSearchResults);
    }, 0);
  };

  // Handle chat creation form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      // Validate based on chat type
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

      // Prepare chat data for API
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
        // Get the current user ID from the API response we already have
        let currentUserId = null;
        try {
          const userInfo = localStorage.getItem('user');
          if (userInfo) {
            const user = JSON.parse(userInfo);
            currentUserId = user.id;
            console.log('Found current user ID:', currentUserId);
          }
        } catch (e) {
          console.error('Error parsing current user info:', e);
        }
        
        // Filter out the current user from the members list to prevent duplicates
        // The backend already adds the current user as a member/admin of the chat
        data.members = selectedUsers
          .filter(user => !currentUserId || user.id !== currentUserId)
          .map(user => user.id);
        
        console.log('Selected members after filtering current user:', data.members);
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
  };

  // Update search results when chat type changes
  useEffect(() => {
    console.log('CLAUDE DEBUG: Chat type or selected users changed:', chatType);
    console.log('CLAUDE DEBUG: Current selected users count:', selectedUsers.length);
    
    // Reset selected users when changing chat type
    if (chatType === 'direct' && selectedUsers.length > 1) {
      // Direct chat can only have one user - keep just the first one
      console.log('CLAUDE DEBUG: Switching to direct chat, keeping only first selected user');
      setSelectedUsers(prev => prev.slice(0, 1));
    }
    
    // Update available users when selected users change
    const newAvailableUsers = users.filter(user => 
      !selectedUsers.some(selectedUser => selectedUser.id === user.id)
    );
    console.log('CLAUDE DEBUG: Updated available users count:', newAvailableUsers.length);
    setSearchResults(newAvailableUsers);
  }, [chatType, selectedUsers, users]);

  // Don't render anything if modal is closed
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
            {/* Chat Type Selection */}
            <div className="mb-4">
              <label className="block text-gray-700 mb-2">Chat Type</label>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { id: 'direct', label: '👤 Direct Chat', disabled: false },
                  { id: 'group', label: '👥 Group Chat', disabled: false },
                  { id: 'team', label: '🏆 Team Chat', disabled: !isAdmin },
                  { id: 'competition', label: '🎯 Competition Chat', disabled: false },
                ].map(type => (
                  <button
                    key={type.id}
                    type="button"
                    className={`p-2 rounded-md ${chatType === type.id ? 'bg-blue-100 border-blue-500 border' : 'bg-gray-100'} ${type.disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
                    onClick={() => !type.disabled && setChatType(type.id as 'direct' | 'group' | 'team' | 'competition')}
                    disabled={type.disabled}
                  >
                    {type.label}
                  </button>
                ))}
              </div>
              {chatType === 'team' && !isAdmin && (
                <p className="text-xs text-gray-500 mt-1">Only team captains can create team chats</p>
              )}
            </div>
            
            {/* Chat Name Input - shown for group and team chats */}
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
            
            {/* Competition Selection - shown for competition chats */}
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
                  <option key="default-option" value="">-- Select a competition --</option>
                  {competitions.map((competition, index) => (
                    <option key={`competition-${competition.id}-${index}`} value={competition.id}>
                      {competition.name}
                    </option>
                  ))}
                </select>
              </div>
            )}
            
            {/* User Selection - shown for direct and group chats */}
            {(chatType === 'direct' || chatType === 'group') && (
              <div className="mb-4">
                <label className="block text-gray-700 mb-2">
                  {chatType === 'direct' ? (
                    <>
                      Select User (Direct Chat requires exactly one user)
                    </>
                  ) : (
                    <>
                      Add Users (Click each user you want to add to the group)
                    </>
                  )}
                </label>
                
                {/* User search input */}
                <div className="relative mb-2">
                  <input
                    type="text"
                    className="w-full p-2 border border-gray-300 rounded-md"
                    value={searchQuery}
                    onChange={handleSearchChange}
                    placeholder={chatType === 'group' ? "Search for users to add..." : "Search for a user..."}
                    onFocus={() => console.log('CLAUDE DEBUG: Search input focused')}
                    onBlur={() => console.log('CLAUDE DEBUG: Search input blurred')}
                  />
                  
                  {/* Search results */}
                  <div className="mt-2 max-h-40 overflow-y-auto border border-gray-200 rounded-md">
                    {loadingMembers ? (
                      <div key="loading-state" className="p-3 text-center text-gray-500">
                        Loading users...
                      </div>
                    ) : searchResults.length > 0 ? (
                      <div>
                        {searchResults.map((user, index) => (
                          <div
                            key={`search-result-${user.id}-${index}`}
                            className="p-2 hover:bg-gray-100 cursor-pointer border-b border-gray-200 last:border-b-0"
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              console.log('CLAUDE DEBUG: User list item clicked:', user.full_name || user.username);
                              
                              // Update selected users with the clicked user
                              handleSelectUser(user);
                              
                              // For group chats, make sure we refresh the available users list 
                              // and refocus the input for adding more users
                              if (chatType === 'group') {
                                setTimeout(() => {
                                  // Get the current selected users (might have changed)
                                  const currentSelectedUsers = [...selectedUsers, user];
                                  
                                  // Get all users except the ones already selected (including the one we just added)
                                  const stillAvailableUsers = users.filter(u => {
                                    // Check if this user is one of the selected ones
                                    const isAlreadySelected = currentSelectedUsers.some(
                                      selected => selected && selected.id === u.id
                                    );
                                    return !isAlreadySelected;
                                  });
                                  
                                  console.log('CLAUDE DEBUG: Still available after selection:', stillAvailableUsers.length);
                                  setSearchResults(stillAvailableUsers);
                                  
                                  // Refocus input to continue adding users
                                  const inputElem = document.querySelector('input[placeholder*="Search for users"]');
                                  if (inputElem) {
                                    console.log('CLAUDE DEBUG: Refocusing input after user selection');
                                    (inputElem as HTMLInputElement).focus();
                                  }
                                }, 10);
                              }
                            }}
                          >
                            <div className="font-medium">{user.full_name || user.username}</div>
                            <div className="text-xs text-gray-500">{user.email}</div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div key="no-results" className="p-3 text-center text-gray-500">
                        {searchQuery ? "No users found matching your search" : "No users available"}
                      </div>
                    )}
                  </div>
                </div>
                
                {/* Selected users display */}
                <div className="mt-3">
                  <div className="text-sm font-medium text-gray-700 mb-1">
                    {selectedUsers.length > 0 
                      ? `Selected ${chatType === 'direct' ? 'User' : 'Users'} (${selectedUsers.length})` 
                      : `No ${chatType === 'direct' ? 'user' : 'users'} selected`}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {selectedUsers.map((user, index) => (
                      <div 
                        key={`selected-user-${user.id}-${index}`}
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
            
            {/* Form buttons */}
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