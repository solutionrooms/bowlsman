'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import api from '../../../src/lib/axios';
import Navigation from '../../components/Navigation';
import Link from 'next/link';

interface User {
  id: number;
  username: string;
  email: string;
  first_name: string;
  last_name: string;
}

interface LeagueMember {
  id: number;
  user: User;
  joined_at: string;
}

interface League {
  id: number;
  name: string;
  season: string;
  club: {
    id: number;
    name: string;
  };
  captain: User | null;
  deputy: User | null;
  members: LeagueMember[];
  members_count: number;
  created_at: string;
  updated_at: string;
}

interface ClubUser {
  id: number;
  user: User;
  club: {
    id: number;
    name: string;
  };
  is_admin: boolean;
}

interface UserData {
  user: User;
  current_club: {
    id: number;
    name: string;
  };
  clubs: Array<{
    id: number;
    name: string;
    is_admin: boolean;
  }>;
}

export default function LeagueDetailPage() {
  const { id } = useParams();
  const router = useRouter();
  const [league, setLeague] = useState<League | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isCaptain, setIsCaptain] = useState(false);
  const [isDeputy, setIsDeputy] = useState(false);
  const [clubMembers, setClubMembers] = useState<User[]>([]);
  const [selectedMember, setSelectedMember] = useState<number | null>(null);
  const [messageContent, setMessageContent] = useState('');
  const [showMessageForm, setShowMessageForm] = useState(false);
  const [messageSending, setMessageSending] = useState(false);
  const [messageSuccess, setMessageSuccess] = useState(false);

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('currentClub');
    router.push('/');
  };

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        setError(null);
        
        // Get league data
        const leagueResponse = await api.get<League>(`leagues/${id}`);
        const leagueData = leagueResponse.data;
        setLeague(leagueData);
        
        // Get user data to check permissions
        const userResponse = await api.get<UserData>('users/me');
        const userData = userResponse.data;
        const currentUser = userData.user;
        
        // Check if user is admin of the club
        const isClubAdmin = userData.clubs?.some(
          (club) => club.id === leagueData.club.id && club.is_admin
        );
        setIsAdmin(isClubAdmin);
        
        // Check if user is captain or deputy
        setIsCaptain(leagueData.captain?.id === currentUser.id);
        setIsDeputy(leagueData.deputy?.id === currentUser.id);
        
        // If user is admin, captain, or deputy, fetch club members for adding to league
        if (isClubAdmin || leagueData.captain?.id === currentUser.id || leagueData.deputy?.id === currentUser.id) {
          const clubMembersResponse = await api.get<ClubUser[]>(`club-users?club_id=${leagueData.club.id}`);
          setClubMembers(clubMembersResponse.data.map((cu) => cu.user));
        }
        
        setLoading(false);
      } catch (err: any) {
        console.error('Error fetching data:', err);
        setError('Failed to load league data: ' + (err.response?.data?.error || err.message));
        setLoading(false);
      }
    };
    
    if (id) {
      fetchData();
    }
  }, [id, router]);

  const handleAddMember = async () => {
    if (!selectedMember || !league) return;
    
    try {
      await api.post('league-members/', {
        league: league.id,
        user_id: selectedMember
      });
      
      // Refresh league data
      const leagueResponse = await api.get<League>(`leagues/${id}`);
      setLeague(leagueResponse.data);
      setSelectedMember(null);
    } catch (err: any) {
      console.error('Error adding member:', err);
      setError('Failed to add member: ' + (err.response?.data?.error || err.message));
    }
  };

  const handleRemoveMember = async (memberId: number) => {
    try {
      await api.delete(`league-members/${memberId}`);
      
      // Refresh league data
      const leagueResponse = await api.get<League>(`leagues/${id}`);
      setLeague(leagueResponse.data);
    } catch (err: any) {
      console.error('Error removing member:', err);
      setError('Failed to remove member: ' + (err.response?.data?.error || err.message));
    }
  };

  const handleUpdateDeputy = async (deputyId: number | null) => {
    if (!league) return;
    
    try {
      await api.post(`leagues/${league.id}/update_deputy/`, {
        deputy_id: deputyId
      });
      
      // Refresh league data
      const leagueResponse = await api.get<League>(`leagues/${id}`);
      setLeague(leagueResponse.data);
    } catch (err: any) {
      console.error('Error updating deputy:', err);
      setError('Failed to update deputy: ' + (err.response?.data?.error || err.message));
    }
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!messageContent || !league) return;
    
    try {
      setMessageSending(true);
      
      await api.post(`leagues/${league.id}/message_members/`, {
        content: messageContent
      });
      
      setMessageContent('');
      setShowMessageForm(false);
      setMessageSuccess(true);
      
      // Hide success message after 3 seconds
      setTimeout(() => {
        setMessageSuccess(false);
      }, 3000);
      
      setMessageSending(false);
    } catch (err: any) {
      console.error('Error sending message:', err);
      setError('Failed to send message: ' + (err.response?.data?.error || err.message));
      setMessageSending(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-100">
        <Navigation onLogout={handleLogout} />
        <div className="flex justify-center items-center min-h-screen">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
        </div>
      </div>
    );
  }

  if (!league) {
    return (
      <div className="min-h-screen bg-gray-100">
        <Navigation onLogout={handleLogout} />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="bg-red-50 border-l-4 border-red-400 p-4 mb-6">
            <div className="flex">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="ml-3">
                <p className="text-sm text-red-700">League not found</p>
              </div>
            </div>
          </div>
          <Link
            href="/leagues"
            className="inline-flex items-center px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-md text-blue-700 bg-blue-100 hover:bg-blue-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
          >
            ← Back to Leagues
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100">
      <Navigation onLogout={handleLogout} />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-6">
          <div className="flex justify-between items-center">
            <h1 className="text-2xl font-bold">{league.name}</h1>
            <Link
              href="/leagues"
              className="inline-flex items-center px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-md text-blue-700 bg-blue-100 hover:bg-blue-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              ← Back to Leagues
            </Link>
          </div>
          <p className="text-gray-500">Season: {league.season}</p>
          <p className="text-gray-500">Club: {league.club.name}</p>
        </div>
        
        {error && (
          <div className="bg-red-50 border-l-4 border-red-400 p-4 mb-6">
            <div className="flex">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="ml-3">
                <p className="text-sm text-red-700">{error}</p>
              </div>
            </div>
          </div>
        )}
        
        {messageSuccess && (
          <div className="bg-green-50 border-l-4 border-green-400 p-4 mb-6">
            <div className="flex">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5 text-green-400" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="ml-3">
                <p className="text-sm text-green-700">Message sent successfully!</p>
              </div>
            </div>
          </div>
        )}
        
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {/* League Management */}
          <div className="bg-white shadow overflow-hidden sm:rounded-lg">
            <div className="px-4 py-5 sm:px-6">
              <h2 className="text-lg font-medium text-gray-900">League Management</h2>
              <p className="mt-1 max-w-2xl text-sm text-gray-500">League officials and actions</p>
            </div>
            <div className="border-t border-gray-200 px-4 py-5 sm:p-6">
              <dl className="grid grid-cols-1 gap-x-4 gap-y-6 sm:grid-cols-2">
                <div className="sm:col-span-1">
                  <dt className="text-sm font-medium text-gray-500">Captain</dt>
                  <dd className="mt-1 text-sm text-gray-900">
                    {league.captain ? `${league.captain.first_name} ${league.captain.last_name}` : 'None'}
                  </dd>
                </div>
                <div className="sm:col-span-1">
                  <dt className="text-sm font-medium text-gray-500">Deputy</dt>
                  <dd className="mt-1 text-sm text-gray-900">
                    {league.deputy ? `${league.deputy.first_name} ${league.deputy.last_name}` : 'None'}
                    {isCaptain && (
                      <button
                        onClick={() => setShowMessageForm(false)}
                        className="ml-2 text-xs text-blue-600 hover:text-blue-800"
                      >
                        Change
                      </button>
                    )}
                  </dd>
                </div>
                
                {/* Captain actions */}
                {(isCaptain || isDeputy) && (
                  <div className="sm:col-span-2 mt-4">
                    <button
                      onClick={() => setShowMessageForm(!showMessageForm)}
                      className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                    >
                      Message All Members
                    </button>
                    
                    {showMessageForm && (
                      <form onSubmit={handleSendMessage} className="mt-4">
                        <div>
                          <label htmlFor="message" className="block text-sm font-medium text-gray-700">
                            Message
                          </label>
                          <textarea
                            id="message"
                            name="message"
                            rows={3}
                            className="shadow-sm focus:ring-blue-500 focus:border-blue-500 mt-1 block w-full sm:text-sm border border-gray-300 rounded-md"
                            placeholder="Enter your message to all league members..."
                            value={messageContent}
                            onChange={(e) => setMessageContent(e.target.value)}
                            required
                          />
                        </div>
                        <div className="mt-2 flex justify-end">
                          <button
                            type="button"
                            onClick={() => setShowMessageForm(false)}
                            className="mr-2 inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                          >
                            Cancel
                          </button>
                          <button
                            type="submit"
                            disabled={messageSending}
                            className="inline-flex items-center px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                          >
                            {messageSending ? 'Sending...' : 'Send Message'}
                          </button>
                        </div>
                      </form>
                    )}
                  </div>
                )}
                
                {/* Deputy selection (for captain) */}
                {isCaptain && !showMessageForm && (
                  <div className="sm:col-span-2 mt-4">
                    <label htmlFor="deputy" className="block text-sm font-medium text-gray-700">
                      Change Deputy
                    </label>
                    <div className="mt-1 flex rounded-md shadow-sm">
                      <select
                        id="deputy"
                        name="deputy"
                        className="focus:ring-blue-500 focus:border-blue-500 flex-1 block w-full rounded-none rounded-l-md sm:text-sm border-gray-300"
                        value={selectedMember || ''}
                        onChange={(e) => setSelectedMember(Number(e.target.value) || null)}
                      >
                        <option value="">Select a member</option>
                        {league.members.map((member) => (
                          <option key={member.user.id} value={member.user.id}>
                            {member.user.first_name} {member.user.last_name}
                          </option>
                        ))}
                      </select>
                      <button
                        type="button"
                        onClick={() => selectedMember && handleUpdateDeputy(selectedMember)}
                        className="inline-flex items-center px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-r-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                      >
                        Update
                      </button>
                    </div>
                  </div>
                )}
              </dl>
            </div>
          </div>
          
          {/* Members List */}
          <div className="bg-white shadow overflow-hidden sm:rounded-lg">
            <div className="px-4 py-5 sm:px-6">
              <h2 className="text-lg font-medium text-gray-900">League Members</h2>
              <p className="mt-1 max-w-2xl text-sm text-gray-500">
                {league.members.length} {league.members.length === 1 ? 'member' : 'members'}
              </p>
            </div>
            <div className="border-t border-gray-200">
              {/* Add member form (for admins, captains, deputies) */}
              {(isAdmin || isCaptain || isDeputy) && (
                <div className="px-4 py-5 sm:p-6 border-b border-gray-200">
                  <h3 className="text-sm font-medium text-gray-500">Add Member</h3>
                  <div className="mt-1 flex rounded-md shadow-sm">
                    <select
                      id="new-member"
                      name="new-member"
                      className="focus:ring-blue-500 focus:border-blue-500 flex-1 block w-full rounded-none rounded-l-md sm:text-sm border-gray-300"
                      value={selectedMember || ''}
                      onChange={(e) => setSelectedMember(Number(e.target.value) || null)}
                    >
                      <option value="">Select a club member</option>
                      {clubMembers
                        .filter(member => !league.members.some(m => m.user.id === member.id))
                        .map((member) => (
                          <option key={member.id} value={member.id}>
                            {member.first_name} {member.last_name}
                          </option>
                        ))}
                    </select>
                    <button
                      type="button"
                      onClick={handleAddMember}
                      disabled={!selectedMember}
                      className="inline-flex items-center px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-r-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                    >
                      Add
                    </button>
                  </div>
                </div>
              )}
              
              {/* Members list */}
              <ul className="divide-y divide-gray-200">
                {league.members.length > 0 ? (
                  league.members.map((member) => (
                    <li key={member.id} className="px-4 py-4 sm:px-6">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center">
                          <div className="ml-3">
                            <p className="text-sm font-medium text-gray-900">
                              {member.user.first_name} {member.user.last_name}
                            </p>
                            <p className="text-sm text-gray-500">{member.user.email}</p>
                          </div>
                        </div>
                        {(isAdmin || isCaptain || isDeputy) && (
                          <button
                            onClick={() => handleRemoveMember(member.id)}
                            className="inline-flex items-center px-2.5 py-1.5 border border-transparent text-xs font-medium rounded text-red-700 bg-red-100 hover:bg-red-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
                          >
                            Remove
                          </button>
                        )}
                      </div>
                    </li>
                  ))
                ) : (
                  <li className="px-4 py-5 sm:px-6 text-center text-sm text-gray-500">
                    No members yet
                  </li>
                )}
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
} 