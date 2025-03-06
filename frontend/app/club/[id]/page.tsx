'use client';

import React, { useState, useEffect, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import Navigation from '../../components/Navigation';
import api from '../../../src/lib/axios';

interface ClubDetailProps {
  params: {
    id: string;
  };
}

interface Club {
  id: number;
  name: string;
  address: string;
  created_at: string;
  updated_at: string;
}

interface ClubMember {
  id: number;
  user: number;
  club: number;
  club_name: string;
  is_admin: boolean;
  created_at: string;
  last_login_at: string | null;
  user_details: {
    id: number;
    username: string;
    display_name: string;
  };
}

interface AddMemberResponse {
  id: number;
  user: number;
  club: number;
  club_name: string;
  is_admin: boolean;
  created_at: string;
  last_login_at: string | null;
  user_details: {
    id: number;
    username: string;
    display_name: string;
  };
}

interface User {
  id: number;
  username: string;
  display_name: string;
  search_name: string;
  is_staff?: boolean;
  first_name?: string;
  last_name?: string;
}

interface UserResponse {
  user: User;
  current_club: any;
}

export default function ClubDetail({ params }: ClubDetailProps) {
  const [club, setClub] = useState<Club | null>(null);
  const [members, setMembers] = useState<ClubMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [newPlayerName, setNewPlayerName] = useState('');
  const [isAdmin, setIsAdmin] = useState(false);
  const [addingMember, setAddingMember] = useState(false);
  const [addMemberError, setAddMemberError] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [filteredUsers, setFilteredUsers] = useState<User[]>([]);
  const [showUserDropdown, setShowUserDropdown] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [showManageModal, setShowManageModal] = useState(false);
  const router = useRouter();
  const clubId = parseInt(params.id);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    const fetchClubDetails = async () => {
      try {
        if (!mounted) return;
        
        const token = localStorage.getItem('token');
        if (!token) {
          router.push('/');
          return;
        }

        // Get current user to check if they are admin
        const userResponse = await api.get<UserResponse>('/users/me/', {
          headers: { Authorization: `Token ${token}` }
        });
        
        const isUserStaff = userResponse.data.user.is_staff;
        console.log('Current user:', userResponse.data.user);
        console.log('Is user staff:', isUserStaff);
        console.log('Club ID being requested:', clubId);

        // Fetch club details
        const clubResponse = await api.get<Club>(`/clubs/${clubId}/`, {
          headers: { Authorization: `Token ${token}` }
        });
        
        console.log('Club details:', clubResponse.data);
        setClub(clubResponse.data);
        
        // Fetch club members
        const membersResponse = await api.get<ClubMember[]>(`/club-users/?club=${clubId}`, {
          headers: { Authorization: `Token ${token}` }
        });
        
        console.log('Club members (raw):', membersResponse.data);
        console.log('Raw member user IDs:', membersResponse.data.map(m => m.user));
        
        // Filter out duplicate members (same user ID)
        const uniqueMembers = membersResponse.data.reduce((acc: ClubMember[], current: ClubMember) => {
          const isDuplicate = acc.find(item => item.user === current.user);
          console.log('Checking member:', current.user, 'isDuplicate:', !!isDuplicate);
          if (!isDuplicate) {
            return [...acc, current];
          }
          return acc;
        }, []);
        
        console.log('Club members (unique):', uniqueMembers);
        console.log('Unique member user IDs:', uniqueMembers.map(m => m.user));
        setMembers(uniqueMembers);
        
        // Fetch all users that can be added to the club (non-members)
        const usersResponse = await api.get<User[]>('/users/', {
          headers: { Authorization: `Token ${token}` },
          params: { club_id: clubId, show_non_members: 'true' }
        });
        
        console.log('All users fetched:', usersResponse.data);
        console.log('All user IDs:', usersResponse.data.map(u => u.id));
        
        // Filter out users who are already members
        const memberUserIds = new Set(uniqueMembers.map(m => m.user));
        const availableUsers = usersResponse.data.filter(user => !memberUserIds.has(user.id));
        
        console.log('Available users after filtering:', availableUsers);
        console.log('Available user IDs:', availableUsers.map(u => u.id));
        setAllUsers(availableUsers);
        
        setLoading(false);
      } catch (error) {
        console.error('Error fetching club details:', error);
        setError('Failed to load club details. Please try again later.');
        setLoading(false);
      }
    };

    fetchClubDetails();
  }, [clubId, router, mounted]);

  useEffect(() => {
    if (newPlayerName.trim() === '') {
      setFilteredUsers([]);
      setShowUserDropdown(false);
      return;
    }

    // Get IDs of users already in the club
    const existingUserIds = new Set(members.map((m: ClubMember) => m.user));
    console.log('Existing user IDs for dropdown filter:', Array.from(existingUserIds));
    console.log('All available users:', allUsers);
    
    // Filter users by name and exclude those already in the club
    const searchTermLower = newPlayerName.toLowerCase();
    const filtered = allUsers.filter((u: User) => {
      // Check if user is not already a member
      const isMember = existingUserIds.has(u.id);
      console.log('Checking user:', u.username, 'isMember:', isMember);
      if (isMember) {
        return false;
      }
      
      // Search by display name, username, first name, or last name
      const searchString = `${u.display_name || ''} ${u.username || ''} ${u.first_name || ''} ${u.last_name || ''}`.toLowerCase();
      const matches = searchString.includes(searchTermLower);
      console.log('User search string:', searchString, 'matches:', matches);
      return matches;
    });
    
    console.log('Filtered users for dropdown:', filtered.length);
    console.log('Filtered user details:', filtered);
    setFilteredUsers(filtered);
    setShowUserDropdown(true);
  }, [newPlayerName, allUsers, members]);

  const handleLogout = () => {
    if (mounted) {
      localStorage.removeItem('token');
      router.push('/');
    }
  };

  const handleSelectUser = (user: User) => {
    setSelectedUser(user);
    setNewPlayerName(user.display_name);
    setShowUserDropdown(false);
    
    // Immediately try to add the selected user
    handleAddMember(null, user);
  };

  const refreshMembers = async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        router.push('/');
        return;
      }
      
      // Fetch club members
      const membersResponse = await api.get<ClubMember[]>(`/club-users/?club=${clubId}`, {
        headers: { Authorization: `Token ${token}` }
      });
      
      // Filter out duplicate members
      const uniqueMembers = membersResponse.data.reduce((acc: ClubMember[], current: ClubMember) => {
        const isDuplicate = acc.find(item => item.user === current.user);
        if (!isDuplicate) {
          return [...acc, current];
        }
        return acc;
      }, []);
      
      console.log('Refreshed club members (unique):', uniqueMembers.length);
      setMembers(uniqueMembers);
      
      return uniqueMembers;
    } catch (error) {
      console.error('Error refreshing members:', error);
      return null;
    }
  };

  const handleAddMember = async (e: FormEvent | null, selectedUser?: User) => {
    if (e) e.preventDefault();
    if (!selectedUser && !newPlayerName.trim()) return;

    setAddingMember(true);
    setAddMemberError(null);

    try {
      const token = localStorage.getItem('token');
      if (!token) {
        router.push('/');
        return;
      }

      console.log('Adding member:', selectedUser ? selectedUser : newPlayerName);
      
      await api.post<AddMemberResponse>(
        `/clubs/${clubId}/add_user/`,
        { 
          username: selectedUser ? selectedUser.username : newPlayerName,
          is_admin: isAdmin 
        },
        { headers: { Authorization: `Token ${token}` } }
      );

      // Refresh the member list to ensure we have the latest data
      await refreshMembers();
      
      // Reset form
      setNewPlayerName('');
      setIsAdmin(false);
      setSelectedUser(null);
    } catch (error: any) {
      console.error('Error adding member:', error);
      if (error.response?.data?.error) {
        setAddMemberError(error.response.data.error);
      } else {
        setAddMemberError('Failed to add member. Please try again.');
      }
    } finally {
      setAddingMember(false);
    }
  };

  const handleRemoveMember = async (userId: number) => {
    if (!confirm('Are you sure you want to remove this member?')) {
      return;
    }

    try {
      const token = localStorage.getItem('token');
      if (!token) {
        router.push('/');
        return;
      }

      console.log('Removing member with user ID:', userId);
      
      await api.post(
        `/clubs/${clubId}/remove_user/`,
        { user_id: userId },
        { headers: { Authorization: `Token ${token}` } }
      );

      // Refresh the member list to ensure we have the latest data
      await refreshMembers();
    } catch (error: any) {
      console.error('Error removing member:', error);
      alert(error.response?.data?.error || 'Failed to remove member. Please try again.');
    }
  };

  const handleToggleAdmin = async (member: ClubMember) => {
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        router.push('/');
        return;
      }

      console.log('Toggling admin status for member:', member);
      
      // First remove the user
      await api.post(
        `/clubs/${clubId}/remove_user/`,
        { user_id: member.user },
        { headers: { Authorization: `Token ${token}` } }
      );

      // Then add them back with the new admin status
      await api.post<AddMemberResponse>(
        `/clubs/${clubId}/add_user/`,
        { 
          user_id: member.user,
          is_admin: !member.is_admin 
        },
        { headers: { Authorization: `Token ${token}` } }
      );

      // Refresh the member list to ensure we have the latest data
      await refreshMembers();
    } catch (error: any) {
      console.error('Error toggling admin status:', error);
      alert(error.response?.data?.error || 'Failed to update admin status. Please try again.');
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  if (error || !club) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative" role="alert">
          <strong className="font-bold">Error!</strong>
          <span className="block sm:inline"> {error || 'Club not found'}</span>
        </div>
        <div className="mt-4">
          <button
            onClick={() => router.push('/club/manage')}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition"
          >
            Back to Clubs
          </button>
        </div>
      </div>
    );
  }

  return (
    <>
      <Navigation onLogout={handleLogout} />
      <div className="container mx-auto px-4 py-8">
        <div className="mb-6">
          <button
            onClick={() => router.push('/club/manage')}
            className="px-4 py-2 bg-gray-200 text-gray-700 rounded hover:bg-gray-300 transition"
          >
            Back to Clubs
          </button>
        </div>

        <div className="bg-white shadow rounded-lg p-6 mb-8">
          <h1 className="text-2xl font-bold mb-2">{club.name}</h1>
          {club.address && <p className="text-gray-600 mb-4">{club.address}</p>}
          
          <div className="mt-8 flex justify-between items-center">
            <h2 className="text-xl font-semibold">Members ({members.length})</h2>
            <button
              onClick={() => setShowManageModal(true)}
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition"
            >
              Manage Members
            </button>
          </div>
          
          <div className="mt-4 space-y-4">
            {members.map(member => (
              <div key={member.id} className="flex items-center justify-between bg-white p-4 rounded-lg border">
                <div>
                  <span className="font-medium">{member.user_details.display_name}</span>
                  {member.is_admin && (
                    <span className="ml-2 px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded">
                      Admin
                    </span>
                  )}
                </div>
                <div className="space-x-2">
                  <button
                    onClick={() => handleToggleAdmin(member)}
                    className="px-3 py-1 text-sm bg-gray-100 text-gray-700 rounded hover:bg-gray-200 transition"
                  >
                    {member.is_admin ? 'Remove Admin' : 'Make Admin'}
                  </button>
                  <button
                    onClick={() => handleRemoveMember(member.user)}
                    className="px-3 py-1 text-sm bg-red-100 text-red-700 rounded hover:bg-red-200 transition"
                  >
                    Remove
                  </button>
                </div>
              </div>
            ))}
            {members.length === 0 && (
              <p className="text-gray-500 text-center py-4">No members yet</p>
            )}
          </div>
        </div>
      </div>

      {/* Manage Members Modal */}
      {showManageModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-lg w-full max-w-2xl p-6">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-bold">Manage Members - {club?.name || ''}</h2>
              <button 
                onClick={() => setShowManageModal(false)}
                className="text-gray-500 hover:text-gray-700"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="mb-8">
              <h3 className="text-lg font-semibold mb-4">Add Member</h3>
              <div className="relative">
                <input
                  type="text"
                  value={newPlayerName}
                  onChange={(e) => {
                    setNewPlayerName(e.target.value);
                    setSelectedUser(null);
                  }}
                  className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                  placeholder="Search for a player or enter guest name"
                  autoFocus
                />
                {showUserDropdown && (
                  <div className="absolute z-10 w-full mt-1 bg-white shadow-lg rounded-md border border-gray-200 max-h-60 overflow-y-auto">
                    {filteredUsers.length > 0 ? (
                      filteredUsers.map(user => (
                        <div
                          key={user.id}
                          className="px-4 py-2 hover:bg-gray-100 cursor-pointer"
                          onClick={() => handleSelectUser(user)}
                        >
                          {user.display_name}
                        </div>
                      ))
                    ) : (
                      <div className="px-4 py-2 text-gray-500">No matching users found</div>
                    )}
                  </div>
                )}
              </div>
              
              <div className="flex items-center mt-2">
                <input
                  type="checkbox"
                  id="isAdmin"
                  checked={isAdmin}
                  onChange={(e) => setIsAdmin(e.target.checked)}
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                />
                <label htmlFor="isAdmin" className="ml-2 block text-sm text-gray-700">
                  Make this user an admin
                </label>
              </div>
              
              {addMemberError && (
                <div className="p-3 mt-2 bg-red-100 border border-red-400 text-red-700 rounded">
                  {addMemberError}
                </div>
              )}
            </div>

            <div>
              <h3 className="text-lg font-semibold mb-4">Current Members</h3>
              <div className="space-y-2 max-h-60 overflow-y-auto">
                {members.length > 0 ? (
                  members.map(member => (
                    <div key={member.id} className="flex items-center justify-between bg-white p-3 rounded-lg border">
                      <div>
                        <span className="font-medium">{member.user_details.display_name}</span>
                        {member.is_admin && (
                          <span className="ml-2 px-2 py-0.5 bg-blue-100 text-blue-800 text-xs rounded">
                            Admin
                          </span>
                        )}
                      </div>
                      <div className="space-x-2">
                        <button
                          onClick={() => handleToggleAdmin(member)}
                          className="px-2 py-1 text-xs bg-gray-100 text-gray-700 rounded hover:bg-gray-200 transition"
                        >
                          {member.is_admin ? 'Remove Admin' : 'Make Admin'}
                        </button>
                        <button
                          onClick={() => handleRemoveMember(member.user)}
                          className="px-2 py-1 text-xs bg-red-100 text-red-700 rounded hover:bg-red-200 transition"
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-gray-500 text-center py-4">No members yet</p>
                )}
              </div>
            </div>

            <div className="mt-6 text-right">
              <button
                onClick={() => setShowManageModal(false)}
                className="px-4 py-2 bg-gray-200 text-gray-700 rounded hover:bg-gray-300 transition"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
} 