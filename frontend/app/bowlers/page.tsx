'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Navigation from '../components/Navigation';
import api from '../../src/lib/axios';

interface Bowler {
  id: number;
  username: string;
  first_name: string;
  last_name: string;
  email?: string;
  avatar?: string;
  is_admin?: boolean;
  club_role?: string;
  // Will add these fields later
  // phone_number?: string;
  // average?: number;
  // games_played?: number;
  // high_score?: number;
}

interface UserResponse {
  user: {
    id: number;
    username: string;
  };
  current_club: {
    id: number;
    name: string;
  } | null;
}

export default function Bowlers() {
  const [bowlers, setBowlers] = useState<Bowler[]>([]);
  const [filteredBowlers, setFilteredBowlers] = useState<Bowler[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);
  const [currentClub, setCurrentClub] = useState<any>(null);
  const router = useRouter();

  useEffect(() => {
    setMounted(true);
  }, []);

  // Function to fetch bowlers data
  const fetchBowlers = async () => {
    try {
      if (!mounted) return;
      
      const token = localStorage.getItem('token');
      if (!token) {
        router.push('/');
        return;
      }
      
      setLoading(true);
      
      // First, get the current club
      try {
        const userResponse = await api.get<UserResponse>('/users/me/', {
          headers: { Authorization: `Token ${token}` }
        });
        
        if (userResponse.data.current_club) {
          setCurrentClub(userResponse.data.current_club);
          const clubId = userResponse.data.current_club.id;
          
          // Then fetch club members
          const membersResponse = await api.get<any[]>(`/users/?club_id=${clubId}`, {
            headers: { Authorization: `Token ${token}` }
          });
          
          // Fetch club user details to get roles and admin status
          const clubUsersResponse = await api.get<any[]>(`/club-users/?club=${clubId}`, {
            headers: { Authorization: `Token ${token}` }
          });
          
          const clubUsers = clubUsersResponse.data as any[];
          console.log('Club users data:', clubUsers);
          
          const clubMembers = membersResponse.data.map((user: any) => {
            // Find the corresponding club user data
            const clubUser = clubUsers.find((cu: any) => {
              // Try different ways to match the user
              if (cu.user === user.id) return true;
              if (typeof cu.user === 'object' && cu.user !== null && cu.user.id === user.id) return true;
              if (cu.user_id === user.id) return true;
              return false;
            });
            
            return {
              id: user.id,
              username: user.username,
              first_name: user.first_name,
              last_name: user.last_name,
              email: user.email,
              is_admin: clubUser ? Boolean(clubUser.is_admin) : false,
              club_role: clubUser ? clubUser.club_role : ''
            };
          });
          
          console.log('Enhanced club members:', clubMembers);
          setBowlers(clubMembers);
          setFilteredBowlers(clubMembers);
          setError(null);
        } else {
          setBowlers([]);
          setFilteredBowlers([]);
          setError('No club selected. Please select a club first.');
        }
      } catch (error) {
        console.error('Error fetching club members:', error);
        setError('Failed to load club members. Please try again later.');
      }
      
      setLoading(false);
    } catch (error) {
      console.error('Error fetching bowlers:', error);
      setError('Failed to load bowlers. Please try again later.');
      setLoading(false);
    }
  };

  // Function to start a chat with a bowler
  const startChat = async (userId: number) => {
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        router.push('/');
        return;
      }
      
      if (!currentClub) {
        alert('No club selected. Please select a club first.');
        return;
      }
      
      console.log('Starting chat with user ID:', userId);
      
      // Create a direct chat with the selected user
      const response = await api.post<{id: number}>('/api/chats/', {
        chat_type: 'direct',
        club_id: currentClub.id,
        members: [userId]  // This is the correct format - just the array of user IDs
      }, {
        headers: { Authorization: `Token ${token}` }
      });
      
      console.log('Chat created:', response.data);
      
      // Navigate to the chat
      if (response.data && response.data.id) {
        router.push(`/messaging?chat=${response.data.id}`);
      } else {
        alert('Failed to create chat. Please try again.');
      }
    } catch (error) {
      console.error('Error creating chat:', error);
      alert('Failed to create chat. Please try again.');
    }
  };

  // Initial load
  useEffect(() => {
    if (mounted) {
      fetchBowlers();
    }
  }, [router, mounted]);
  
  // Listen for club change events
  useEffect(() => {
    const handleClubChange = () => {
      if (mounted) {
        fetchBowlers();
      }
    };
    
    window.addEventListener('clubChanged', handleClubChange);
    
    return () => {
      window.removeEventListener('clubChanged', handleClubChange);
    };
  }, [mounted]);

  useEffect(() => {
    if (searchTerm.trim() === '') {
      setFilteredBowlers(bowlers);
    } else {
      const lowercasedSearch = searchTerm.toLowerCase();
      const filtered = bowlers.filter(bowler => 
        bowler.username.toLowerCase().includes(lowercasedSearch) ||
        bowler.first_name.toLowerCase().includes(lowercasedSearch) ||
        bowler.last_name.toLowerCase().includes(lowercasedSearch)
      );
      setFilteredBowlers(filtered);
    }
  }, [searchTerm, bowlers]);

  const handleLogout = () => {
    if (mounted) {
      localStorage.removeItem('token');
      router.push('/');
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <>
      <Navigation onLogout={handleLogout} />
      <div className="container mx-auto px-4 py-8">
        <div className="bg-white shadow rounded-lg p-6">
          <div className="flex justify-between items-center mb-6">
            <h1 className="text-2xl font-bold">Bowlers</h1>
            {currentClub && (
              <div className="text-sm text-gray-600">
                Club: <span className="font-semibold">{currentClub.name}</span>
              </div>
            )}
          </div>
          
          {!currentClub ? (
            <div className="bg-yellow-100 border border-yellow-400 text-yellow-700 px-4 py-3 rounded mb-4">
              No club selected. Please select a club to view its members.
            </div>
          ) : (
            <>
              <div className="mb-6">
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                    <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path>
                    </svg>
                  </div>
                  <input
                    type="search"
                    className="block w-full p-4 pl-10 text-sm border border-gray-300 rounded-lg bg-gray-50 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Search by name or username..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </div>
              </div>
              
              {error ? (
                <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
                  {error}
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full bg-white border border-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Username
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          First Name
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Last Name
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Role
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Actions
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {filteredBowlers.length > 0 ? (
                        filteredBowlers.map((bowler) => (
                          <tr key={bowler.id} className="hover:bg-gray-50">
                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                              {bowler.username}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                              {bowler.first_name}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                              {bowler.last_name}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                              <div className="flex flex-wrap gap-1">
                                {bowler.is_admin && (
                                  <span className="inline-block text-xs px-2 py-0.5 bg-blue-100 text-blue-800 rounded">
                                    Admin
                                  </span>
                                )}
                                {bowler.club_role && (
                                  <span className="inline-block text-xs px-2 py-0.5 bg-green-100 text-green-800 rounded">
                                    {bowler.club_role}
                                  </span>
                                )}
                              </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                              <button
                                onClick={() => startChat(bowler.id)}
                                className="px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 transition"
                              >
                                Chat
                              </button>
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan={5} className="px-6 py-4 text-center text-sm text-gray-500">
                            No bowlers found matching your search criteria.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </>
  );
} 