'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import api from '../../src/lib/axios';
import Navigation from '../components/Navigation';
import PageHeading from '../components/PageHeading';
import pageDescriptions from '../utils/pageDescriptions';
import Link from 'next/link';
import { canManageTeam } from '../../src/utils/permissions';
import CreateChatModal from '../messaging/components/CreateChatModal';

interface League {
  id: number;
  name: string;
  season: string;
  club: {
    id: number;
    name: string;
  };
  captain: {
    id: number;
    first_name: string;
    last_name: string;
  } | null;
  deputy: {
    id: number;
    first_name: string;
    last_name: string;
  } | null;
  members_count: number;
}

interface Club {
  id: number;
  name: string;
  is_admin: boolean;
}

interface UserData {
  current_club: Club | null;
  clubs: Club[];
  user: {
    id: number;
    username: string;
    email: string;
    is_staff: boolean;
  };
}

export default function LeaguesPage() {
  const router = useRouter();
  const [leagues, setLeagues] = useState<League[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentClub, setCurrentClub] = useState<Club | null>(null);
  const [userClubs, setUserClubs] = useState<Club[]>([]);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isStaff, setIsStaff] = useState(false);
  const [userId, setUserId] = useState<number | null>(null);
  const [manageableTeams, setManageableTeams] = useState<Set<number>>(new Set());
  const [mounted, setMounted] = useState<boolean>(false);
  const [showCreateChatModal, setShowCreateChatModal] = useState<boolean>(false);
  const [selectedTeamForChat, setSelectedTeamForChat] = useState<{id: number, name: string} | null>(null);

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('currentClub');
    router.push('/');
  };

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) return;
    
    const fetchData = async () => {
      try {
        setLoading(true);
        setError(null);
        
        // Get user data including clubs
        const userResponse = await api.get<UserData>('users/me');
        const userData = userResponse.data;
        const current_club = userData.current_club;
        const clubs = userData.clubs || [];
        
        setUserClubs(clubs);
        setCurrentClub(current_club);
        setUserId(userData.user.id);
        
        // Check if user is admin of current club
        if (current_club) {
          // First check using the clubs array
          let isClubAdmin = clubs.some(
            (club: Club) => club.id === current_club.id && club.is_admin
          );
          
          // If not admin according to clubs array, double-check with backend directly
          if (!isClubAdmin) {
            try {
              const adminCheckResponse = await api.get<{club_id: number, is_admin: boolean, username: string}>(`club-admin-status?club_id=${current_club.id}`);
              console.log('Admin status check:', adminCheckResponse.data);
              
              // Update admin status based on direct backend check
              if (adminCheckResponse.data.is_admin) {
                isClubAdmin = true;
              }
            } catch (err) {
              console.error('Error checking admin status:', err);
            }
          }
          
          setIsAdmin(isClubAdmin);
          
          // Get leagues for the current club
          const leaguesResponse = await api.get<League[]>(`leagues?club_id=${current_club.id}`);
          setLeagues(leaguesResponse.data);
        }
        
        // Check if user is staff
        setIsStaff(userData.user?.is_staff || false);
        
        setLoading(false);
      } catch (err: any) {
        console.error('Error fetching data:', err);
        setError('Failed to load data: ' + (err.response?.data?.error || err.message));
        setLoading(false);
      }
    };
    
    fetchData();
  }, [mounted, router]);

  // Determine which teams the user can manage
  useEffect(() => {
    if (userId && leagues.length > 0 && userClubs.length > 0) {
      const manageable = new Set<number>();
      
      leagues.forEach(league => {
        if (canManageTeam(userId, league, userClubs)) {
          manageable.add(league.id);
        }
      });
      
      setManageableTeams(manageable);
    }
  }, [userId, leagues, userClubs]);

  const handleClubChange = async (clubId: number) => {
    try {
      setLoading(true);
      
      // Update current club in backend and localStorage
      await api.put('club-users/set_current_club', { club_id: clubId });
      
      // Find and set the current club in state
      const selectedClub = userClubs.find(club => club.id === clubId);
      if (selectedClub) {
        setCurrentClub(selectedClub);
        
        // Check if user is admin of selected club
        setIsAdmin(selectedClub.is_admin);
        
        // Get leagues for the selected club
        const leaguesResponse = await api.get<League[]>(`leagues?club_id=${clubId}`);
        setLeagues(leaguesResponse.data);
      }
      
      setLoading(false);
    } catch (err: any) {
      console.error('Error changing club:', err);
      setError('Failed to change club: ' + (err.response?.data?.error || err.message));
      setLoading(false);
    }
  };

  const handleTeamChatClick = (league: League) => {
    setSelectedTeamForChat({id: league.id, name: league.name});
    setShowCreateChatModal(true);
  };
  
  const handleChatCreated = (chatId: number) => {
    router.push(`/messaging?chat=${chatId}`);
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

  return (
    <div className="min-h-screen bg-gray-100">
      <Navigation onLogout={handleLogout} />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex justify-between items-center mb-6">
          <PageHeading 
            title="Teams" 
            infoText={pageDescriptions.leagues}
            helpHref="/help/content/leagues"
          />
          <div className="flex space-x-2">
            {isStaff && (
              <Link
                href="/leagues/admin"
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-purple-600 hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500"
              >
                Admin Tools
              </Link>
            )}
            {isAdmin && (
              <Link
                href="/leagues/create"
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              >
                Create Team
              </Link>
            )}
          </div>
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
        
        {/* Teams list */}
        {currentClub && (
          <div className="bg-white shadow overflow-hidden sm:rounded-lg">
            <div className="px-4 py-5 sm:p-6">
              <h2 className="text-lg font-medium text-gray-900 mb-4">
                {leagues.length > 0
                  ? `Teams in ${currentClub.name}`
                  : 'No Teams Found'}
              </h2>
              
              {leagues.length > 0 ? (
                <div className="mt-4 overflow-hidden shadow ring-1 ring-black ring-opacity-5 sm:rounded-lg">
                  <table className="min-w-full divide-y divide-gray-300">
                    <thead className="bg-gray-50">
                      <tr>
                        <th scope="col" className="py-3.5 pl-4 pr-3 text-left text-sm font-semibold text-gray-900 sm:pl-6">Name</th>
                        <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">Season</th>
                        <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">Captain</th>
                        <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">Members</th>
                        <th scope="col" className="relative py-3.5 pl-3 pr-4 sm:pr-6">
                          <span className="sr-only">Actions</span>
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200 bg-white">
                      {leagues.map((league) => (
                        <tr key={league.id}>
                          <td className="whitespace-nowrap py-4 pl-4 pr-3 text-sm font-medium text-gray-900 sm:pl-6">{league.name}</td>
                          <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">{league.season}</td>
                          <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                            {league.captain ? `${league.captain.first_name} ${league.captain.last_name}` : 'None'}
                          </td>
                          <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">{league.members_count}</td>
                          <td className="relative whitespace-nowrap py-4 pl-3 pr-4 text-right text-sm font-medium sm:pr-6">
                            <div className="flex justify-end space-x-2">
                              <Link
                                href={`/leagues/${league.id}`}
                                className="text-blue-600 hover:text-blue-900"
                              >
                                View<span className="sr-only">, {league.name}</span>
                              </Link>
                              
                              {manageableTeams.has(league.id) && (
                                <>
                                  <span className="text-gray-300 mx-1">|</span>
                                  <Link
                                    href={`/leagues/${league.id}/edit`}
                                    className="text-green-600 hover:text-green-900"
                                  >
                                    Edit<span className="sr-only">, {league.name}</span>
                                  </Link>
                                  <span className="text-gray-300 mx-1">|</span>
                                  <Link
                                    href={`/leagues/${league.id}/members/manage`}
                                    className="text-indigo-600 hover:text-indigo-900"
                                  >
                                    Manage<span className="sr-only">, {league.name}</span>
                                  </Link>
                                  <span className="text-gray-300 mx-1">|</span>
                                  <a
                                    href="#"
                                    onClick={(e) => {
                                      e.preventDefault();
                                      handleTeamChatClick(league);
                                    }}
                                    className="text-purple-600 hover:text-purple-900"
                                  >
                                    Chat<span className="sr-only">, {league.name}</span>
                                  </a>
                                </>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="text-center py-8">
                  <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                  </svg>
                  <h3 className="mt-2 text-sm font-medium text-gray-900">No teams found</h3>
                  <p className="mt-1 text-sm text-gray-500">
                    {isAdmin 
                      ? "Get started by creating a new team."
                      : "There are no teams in this club yet."}
                  </p>
                  {isAdmin && (
                    <div className="mt-6">
                      <Link
                        href="/leagues/create"
                        className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                      >
                        <svg className="-ml-1 mr-2 h-5 w-5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                          <path fillRule="evenodd" d="M10 5a1 1 0 011 1v3h3a1 1 0 110 2h-3v3a1 1 0 11-2 0v-3H6a1 1 0 110-2h3V6a1 1 0 011-1z" clipRule="evenodd" />
                        </svg>
                        Create Team
                      </Link>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
      
      {showCreateChatModal && selectedTeamForChat && currentClub && (
        <CreateChatModal
          isOpen={showCreateChatModal}
          onClose={() => setShowCreateChatModal(false)}
          clubId={currentClub.id}
          onChatCreated={handleChatCreated}
          initialChatType="team"
          initialChatName={`${selectedTeamForChat.name} Team Chat`}
        />
      )}
    </div>
  );
} 