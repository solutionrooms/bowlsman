'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import api from '../../src/lib/axios';
import Navigation from '../components/Navigation';
import Link from 'next/link';

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
        
        // Get user data including clubs
        const userResponse = await api.get<UserData>('users/me');
        const userData = userResponse.data;
        const current_club = userData.current_club;
        const clubs = userData.clubs || [];
        
        setUserClubs(clubs);
        setCurrentClub(current_club);
        
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
  }, [router]);

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
          <h1 className="text-2xl font-bold">Leagues</h1>
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
                Create League
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
        
        {/* Club selection */}
        {userClubs.length > 0 && (
          <div className="bg-white shadow overflow-hidden sm:rounded-lg mb-6">
            <div className="px-4 py-5 sm:p-6">
              <h2 className="text-lg font-medium text-gray-900 mb-4">Select Club</h2>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {userClubs.map(club => (
                  <button
                    key={club.id}
                    onClick={() => handleClubChange(club.id)}
                    className={`relative block w-full p-4 border rounded-lg shadow-sm ${
                      currentClub?.id === club.id
                        ? 'border-blue-500 ring-2 ring-blue-500 bg-blue-50'
                        : 'border-gray-300 hover:border-gray-400'
                    }`}
                  >
                    <span className="block text-sm font-medium text-gray-900">{club.name}</span>
                    {club.is_admin && (
                      <span className="mt-1 block text-xs text-blue-600">(Admin)</span>
                    )}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
        
        {/* Leagues list */}
        {currentClub && (
          <div className="bg-white shadow overflow-hidden sm:rounded-lg">
            <div className="px-4 py-5 sm:p-6">
              <h2 className="text-lg font-medium text-gray-900 mb-4">
                {leagues.length > 0
                  ? `Leagues in ${currentClub.name}`
                  : 'No Leagues Found'}
              </h2>
              
              {/* Admin status diagnostic */}
              <div className="mb-6 p-4 bg-gray-50 rounded-lg border border-gray-200">
                <h3 className="text-md font-medium text-gray-900 mb-2">Admin Status</h3>
                <p className="text-sm text-gray-600">
                  Current club: {currentClub.name} (ID: {currentClub.id})
                </p>
                <p className="text-sm text-gray-600">
                  Admin status from frontend: {isAdmin ? 'Yes' : 'No'}
                </p>
                <p className="text-sm text-gray-600 mt-2">
                  If you're having trouble creating leagues, please contact support and mention this information.
                </p>
                <div className="mt-3">
                  <button
                    onClick={async () => {
                      try {
                        const response = await api.get(`club-admin-status?club_id=${currentClub.id}`);
                        alert(`Backend admin status: ${JSON.stringify(response.data, null, 2)}`);
                      } catch (err) {
                        alert(`Error checking admin status: ${err}`);
                      }
                    }}
                    className="inline-flex items-center px-3 py-1 border border-transparent text-sm font-medium rounded-md text-blue-700 bg-blue-100 hover:bg-blue-200"
                  >
                    Check Backend Admin Status
                  </button>
                </div>
              </div>
              
              {leagues.length > 0 ? (
                <div className="space-y-4">
                  {leagues.map(league => (
                    <div
                      key={league.id}
                      className="block w-full text-left px-6 py-4 border border-gray-300 rounded-lg hover:bg-gray-50"
                    >
                      <div className="flex justify-between items-center">
                        <div>
                          <h3 className="text-lg font-medium text-gray-900">
                            <Link href={`/leagues/${league.id}`} className="hover:text-blue-600">
                              {league.name}
                            </Link>
                          </h3>
                          <p className="mt-1 text-sm text-gray-500">
                            Season: {league.season}
                          </p>
                          <p className="mt-1 text-sm text-gray-500">
                            Members: {league.members_count}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm text-gray-500">
                            Captain: {league.captain ? `${league.captain.first_name} ${league.captain.last_name}` : 'None'}
                          </p>
                          <p className="text-sm text-gray-500">
                            Deputy: {league.deputy ? `${league.deputy.first_name} ${league.deputy.last_name}` : 'None'}
                          </p>
                          <Link
                            href={`/leagues/${league.id}`}
                            className="mt-2 inline-flex items-center px-3 py-1 border border-transparent text-sm font-medium rounded-md text-blue-700 bg-blue-100 hover:bg-blue-200"
                          >
                            View Details
                          </Link>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                  </svg>
                  <h3 className="mt-2 text-sm font-medium text-gray-900">No leagues found</h3>
                  {isAdmin ? (
                    <div className="mt-6">
                      <Link
                        href="/leagues/create"
                        className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                      >
                        Create a League
                      </Link>
                    </div>
                  ) : (
                    <p className="mt-1 text-sm text-gray-500">
                      No leagues have been created for this club yet.
                    </p>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
} 