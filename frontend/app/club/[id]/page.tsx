'use client';

import { useState, useEffect, FormEvent } from 'react';
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

export default function ClubDetail({ params }: ClubDetailProps) {
  const [club, setClub] = useState<Club | null>(null);
  const [members, setMembers] = useState<ClubMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [username, setUsername] = useState('');
  const [isAdmin, setIsAdmin] = useState(false);
  const [addingMember, setAddingMember] = useState(false);
  const [addMemberError, setAddMemberError] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);
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

        // Fetch club details
        const clubResponse = await api.get<Club>(`/clubs/${clubId}/`, {
          headers: { Authorization: `Token ${token}` }
        });
        
        setClub(clubResponse.data);
        
        // Fetch club members
        const membersResponse = await api.get<ClubMember[]>(`/club-users/?club=${clubId}`, {
          headers: { Authorization: `Token ${token}` }
        });
        
        setMembers(membersResponse.data);
        setLoading(false);
      } catch (error) {
        console.error('Error fetching club details:', error);
        setError('Failed to load club details. Please try again later.');
        setLoading(false);
      }
    };

    fetchClubDetails();
  }, [clubId, router, mounted]);

  const handleLogout = () => {
    if (mounted) {
      localStorage.removeItem('token');
      router.push('/');
    }
  };

  const handleAddMember = async (e: FormEvent) => {
    e.preventDefault();
    setAddingMember(true);
    setAddMemberError(null);

    try {
      const token = localStorage.getItem('token');
      if (!token) {
        router.push('/');
        return;
      }

      const response = await api.post<AddMemberResponse>(
        `/clubs/${clubId}/add_user/`,
        { username, is_admin: isAdmin },
        { headers: { Authorization: `Token ${token}` } }
      );

      // Add the new member to the list
      setMembers([...members, response.data]);
      
      // Reset form
      setUsername('');
      setIsAdmin(false);
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

      await api.post(
        `/clubs/${clubId}/remove_user/`,
        { user_id: userId },
        { headers: { Authorization: `Token ${token}` } }
      );

      // Remove the member from the list
      setMembers(members.filter(member => member.user !== userId));
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

      // First remove the user
      await api.post(
        `/clubs/${clubId}/remove_user/`,
        { user_id: member.user },
        { headers: { Authorization: `Token ${token}` } }
      );

      // Then add them back with the new admin status
      const response = await api.post<AddMemberResponse>(
        `/clubs/${clubId}/add_user/`,
        { 
          user_id: member.user,
          is_admin: !member.is_admin 
        },
        { headers: { Authorization: `Token ${token}` } }
      );

      // Update the member in the list
      setMembers(members.map(m => 
        m.id === member.id ? response.data : m
      ));
    } catch (error: any) {
      console.error('Error toggling admin status:', error);
      alert(error.response?.data?.error || 'Failed to update member. Please try again.');
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
          <p className="text-sm text-gray-500">
            {members.length} {members.length === 1 ? 'member' : 'members'}
          </p>
        </div>

        <div className="bg-white shadow rounded-lg p-6 mb-8">
          <h2 className="text-xl font-semibold mb-4">Add Member</h2>
          
          {addMemberError && (
            <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative mb-4" role="alert">
              <span className="block sm:inline">{addMemberError}</span>
            </div>
          )}
          
          <form onSubmit={handleAddMember} className="space-y-4">
            <div>
              <label htmlFor="username" className="block text-sm font-medium text-gray-700 mb-1">
                Username
              </label>
              <input
                type="text"
                id="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                required
              />
            </div>
            
            <div className="flex items-center">
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
            
            <button
              type="submit"
              disabled={addingMember}
              className={`px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition ${
                addingMember ? 'opacity-50 cursor-not-allowed' : ''
              }`}
            >
              {addingMember ? 'Adding...' : 'Add Member'}
            </button>
          </form>
        </div>

        <div className="bg-white shadow rounded-lg p-6">
          <h2 className="text-xl font-semibold mb-4">Members</h2>
          
          {members.length === 0 ? (
            <p className="text-gray-500">No members found.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      User
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Role
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Last Login
                    </th>
                    <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {members.map(member => (
                    <tr key={member.id}>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">
                          {member.user_details.display_name}
                        </div>
                        <div className="text-sm text-gray-500">
                          @{member.user_details.username}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                          member.is_admin ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                        }`}>
                          {member.is_admin ? 'Admin' : 'Member'}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {member.last_login_at ? new Date(member.last_login_at).toLocaleString() : 'Never'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <button
                          onClick={() => handleToggleAdmin(member)}
                          className="text-indigo-600 hover:text-indigo-900 mr-4"
                        >
                          {member.is_admin ? 'Remove Admin' : 'Make Admin'}
                        </button>
                        <button
                          onClick={() => handleRemoveMember(member.user)}
                          className="text-red-600 hover:text-red-900"
                        >
                          Remove
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </>
  );
} 