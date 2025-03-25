'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Navigation from '../components/Navigation';
import api from '../../src/lib/axios';
import { useMessaging } from '../messaging/context/MessagingContext';

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
  const { findExistingChat, createChat } = useMessaging();

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
          
          // Fetch club members with role information
          const clubMembersResponse = await api.get<any[]>(`/clubs/${clubId}/members/`, {
            headers: { Authorization: `Token ${token}` }
          });
          
          const clubMembers = clubMembersResponse.data.map((member: any) => {
            // The response already contains is_admin and club_role fields
            return {
              id: member.user_details?.id || member.user, // Use user_details.id or fall back to user
              username: member.user_details?.username || '',
              first_name: member.user_details?.display_name?.split(' ')[0] || '',
              last_name: member.user_details?.display_name?.split(' ').slice(1).join(' ') || '',
              email: member.email || '',
              is_admin: member.is_admin || false,
              club_role: member.club_role || ''
            };
          });
          
          console.log('Club members data:', clubMembers);
          setBowlers(clubMembers);
          setFilteredBowlers(sortBowlers(clubMembers));
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
      
      try {
        // Attempt to find an existing chat with this user
        const existingChatId = await findExistingChat(currentClub.id, userId);
        
        if (existingChatId) {
          // Navigate to the existing chat
          console.log('Using existing chat:', existingChatId);
          router.push(`/messaging?chat=${existingChatId}`);
          return;
        }
        
        // Create a direct chat with the selected user
        const chatData = {
          chat_type: 'direct',
          club_id: currentClub.id,
          members: [userId]
        };
        
        console.log('Creating new chat with data:', chatData);
        const newChat = await createChat(chatData);
        console.log('Chat created or found:', newChat);
        
        // Navigate to the chat
        router.push(`/messaging?chat=${newChat.id}`);
      } catch (error: any) {
        console.error('Error handling chat:', error);
        
        // If we get an error that suggests a duplicate chat, try to find the existing one again
        if (error.response && error.response.data && 
            typeof error.response.data.error === 'string' &&
            (error.response.data.error.includes('already exists') || 
             error.response.data.error.includes('duplicate key'))) {
          
          console.log('Got duplicate key error, retrying to find existing chat');
          
          // Wait a moment and try again
          await new Promise(resolve => setTimeout(resolve, 500));
          const retryExistingChatId = await findExistingChat(currentClub.id, userId);
          
          if (retryExistingChatId) {
            console.log('Found existing chat after error:', retryExistingChatId);
            router.push(`/messaging?chat=${retryExistingChatId}`);
            return;
          }
        }
        
        alert('Failed to open chat. Please try again.');
      }
    } catch (error: any) {
      console.error('Error starting chat:', error);
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
      setFilteredBowlers(sortBowlers(bowlers));
    } else {
      const lowercasedSearch = searchTerm.toLowerCase();
      const filtered = bowlers.filter(bowler => 
        bowler.username.toLowerCase().includes(lowercasedSearch) ||
        bowler.first_name.toLowerCase().includes(lowercasedSearch) ||
        bowler.last_name.toLowerCase().includes(lowercasedSearch)
      );
      setFilteredBowlers(sortBowlers(filtered));
    }
  }, [searchTerm, bowlers]);

  // Sort bowlers according to criteria:
  // 1. Any bowlers with club roles (president etc) come first
  // 2. Any admins come second
  // 3. All standard bowlers are then listed alphabetically
  const sortBowlers = (bowlersList: Bowler[]): Bowler[] => {
    return [...bowlersList].sort((a, b) => {
      // If one has a club role and the other doesn't, the one with role comes first
      if (a.club_role && !b.club_role) return -1;
      if (!a.club_role && b.club_role) return 1;
      
      // If both have club roles or neither have club roles, check admin status
      if (a.club_role && b.club_role) {
        // If admin status differs, sort by that next
        if (a.is_admin && !b.is_admin) return -1;
        if (!a.is_admin && b.is_admin) return 1;
        
        // Both have roles and same admin status, sort alphabetically
        return (a.first_name + ' ' + a.last_name).localeCompare(b.first_name + ' ' + b.last_name);
      }
      
      // If neither has club role, check admin status
      if (!a.club_role && !b.club_role) {
        // If admin status differs, sort by that
        if (a.is_admin && !b.is_admin) return -1;
        if (!a.is_admin && b.is_admin) return 1;
        
        // Both are standard bowlers, sort alphabetically
        return (a.first_name + ' ' + a.last_name).localeCompare(b.first_name + ' ' + b.last_name);
      }
      
      // Fallback alphabetic sort (shouldn't reach here due to above conditions)
      return (a.first_name + ' ' + a.last_name).localeCompare(b.first_name + ' ' + b.last_name);
    });
  };

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
                    className="block w-full p-4 pl-10 text-sm border border-gray-300 rounded-md bg-gray-50 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Filter bowlers list..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    autoComplete="off"
                    data-lpignore="true"
                    data-form-type="other"
                    data-1p-ignore="true"
                    name="bowlers-filter-query"
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