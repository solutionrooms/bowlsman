'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import api from '../../../src/lib/axios';
import Navigation from '../../components/Navigation';
import PageHeading from '../../components/PageHeading';
import { canManageTeam } from '../../../src/utils/permissions';

interface League {
  id: number;
  name: string;
  club: {
    id: number;
    name: string;
  };
  season: string;
  captain: {
    id: number;
    first_name: string;
    last_name: string;
    username: string;
  } | null;
  deputy: {
    id: number;
    first_name: string;
    last_name: string;
    username: string;
  } | null;
  league_table_link: string | null;
  team_link: string | null;
  members_count: number;
  members: {
    id: number;
    user: {
      id: number;
      first_name: string;
      last_name: string;
      username: string;
    };
    joined_at: string;
  }[];
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

export default function TeamPage() {
  const router = useRouter();
  const params = useParams();
  const searchParams = useSearchParams();
  const [league, setLeague] = useState<League | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [currentClub, setCurrentClub] = useState<Club | null>(null);
  const [userClubs, setUserClubs] = useState<Club[]>([]);
  const [userId, setUserId] = useState<number | null>(null);
  const [canManage, setCanManage] = useState(false);

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('currentClub');
    router.push('/');
  };

  useEffect(() => {
    // Check for error message in URL parameters
    const errorMsg = searchParams.get('error');
    if (errorMsg) {
      setError(errorMsg);
    }
    
    // Check for success message in URL parameters
    const successMsg = searchParams.get('success');
    if (successMsg) {
      // We don't have a success state, so we'll just log it for now
      console.log('Success:', successMsg);
      // You could add a success message component here if needed
    }
  }, [searchParams]);

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
        
        setCurrentClub(current_club);
        setUserClubs(clubs);
        setUserId(userData.user.id);
        
        // Check if user is admin of current club
        if (current_club) {
          let isClubAdmin = clubs.some(
            (club: Club) => club.id === current_club.id && club.is_admin
          );
          
          // If not admin according to clubs array, double-check with backend directly
          if (!isClubAdmin) {
            try {
              const adminCheckResponse = await api.get<{club_id: number, is_admin: boolean, username: string}>(
                `club-admin-status?club_id=${current_club.id}`
              );
              if (adminCheckResponse.data.is_admin) {
                isClubAdmin = true;
              }
            } catch (err) {
              console.error('Error checking admin status:', err);
            }
          }
          
          setIsAdmin(isClubAdmin);
        }

        // Get league details
        const leagueResponse = await api.get<League>(`leagues/${params.id}`);
        setLeague(leagueResponse.data);
        
        setLoading(false);
      } catch (err: any) {
        console.error('Error fetching data:', err);
        setError('Failed to load data: ' + (err.response?.data?.error || err.message));
        setLoading(false);
      }
    };
    
    fetchData();
  }, [params.id, router]);

  // Check if user can manage the team whenever relevant data changes
  useEffect(() => {
    if (userId && league && userClubs.length > 0) {
      const hasPermission = canManageTeam(userId, league, userClubs);
      setCanManage(hasPermission);
    }
  }, [userId, league, userClubs]);

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
          <div className="bg-white shadow overflow-hidden sm:rounded-lg p-6">
            <div className="text-center">
              <h3 className="text-lg font-medium text-gray-900">Team not found</h3>
              <div className="mt-2">
                <p className="text-sm text-gray-500">The team you're looking for doesn't exist or you don't have permission to view it.</p>
              </div>
              <div className="mt-6">
                <Link
                  href="/leagues"
                  className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700"
                >
                  Back to Teams
                </Link>
              </div>
            </div>
          </div>
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
            <PageHeading 
              title={league.name}
              infoText={`Team details for ${league.name}`}
            />
            <div className="flex space-x-2">
              {canManage && (
                <Link
                  href={`/leagues/${league.id}/edit`}
                  className="inline-flex items-center px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                >
                  Edit Team
                </Link>
              )}
              <Link
                href="/leagues"
                className="inline-flex items-center px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-md text-blue-700 bg-blue-100 hover:bg-blue-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              >
                ← Back to Teams
              </Link>
            </div>
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

        {searchParams.get('success') && (
          <div className="bg-green-50 border-l-4 border-green-400 p-4 mb-6">
            <div className="flex">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5 text-green-400" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="ml-3">
                <p className="text-sm text-green-700">{searchParams.get('success')}</p>
              </div>
            </div>
          </div>
        )}

        <div className="bg-white shadow overflow-hidden sm:rounded-lg">
          <div className="px-4 py-5 sm:p-6">
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
              <div>
                <h3 className="text-lg font-medium text-gray-900 mb-4">Team Information</h3>
                <dl className="grid grid-cols-1 gap-4">
                  <div>
                    <dt className="text-sm font-medium text-gray-500">Club</dt>
                    <dd className="mt-1 text-sm text-gray-900">{league.club.name}</dd>
                  </div>
                  <div>
                    <dt className="text-sm font-medium text-gray-500">Season</dt>
                    <dd className="mt-1 text-sm text-gray-900">{league.season}</dd>
                  </div>
                  <div>
                    <dt className="text-sm font-medium text-gray-500">Captain</dt>
                    <dd className="mt-1 text-sm text-gray-900">
                      {league.captain ? `${league.captain.first_name} ${league.captain.last_name}` : 'None'}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-sm font-medium text-gray-500">Deputy</dt>
                    <dd className="mt-1 text-sm text-gray-900">
                      {league.deputy ? `${league.deputy.first_name} ${league.deputy.last_name}` : 'None'}
                    </dd>
                  </div>
                  {league.league_table_link && (
                    <div>
                      <dt className="text-sm font-medium text-gray-500">League Table</dt>
                      <dd className="mt-1 text-sm text-gray-900">
                        <a
                          href={league.league_table_link}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-600 hover:text-blue-900"
                        >
                          View League Table
                        </a>
                      </dd>
                    </div>
                  )}
                  {league.team_link && (
                    <div>
                      <dt className="text-sm font-medium text-gray-500">Team Website</dt>
                      <dd className="mt-1 text-sm text-gray-900">
                        <a
                          href={league.team_link}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-600 hover:text-blue-900"
                        >
                          Visit Team Website
                        </a>
                      </dd>
                    </div>
                  )}
                </dl>
              </div>

              <div>
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-lg font-medium text-gray-900">Team Members</h3>
                  {canManage && (
                    <Link
                      href={`/leagues/${league.id}/members/manage`}
                      className="inline-flex items-center px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                    >
                      Manage Members
                    </Link>
                  )}
                </div>
                {league.members.length > 0 ? (
                  <ul className="divide-y divide-gray-200">
                    {league.members.map((member) => (
                      <li key={member.id} className="py-3">
                        <div className="flex items-center space-x-3">
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-gray-900 truncate">
                              {member.user.first_name} {member.user.last_name}
                            </p>
                            <p className="text-sm text-gray-500 truncate">
                              {member.user.username}
                            </p>
                          </div>
                          <div className="flex-shrink-0 text-sm text-gray-500">
                            Joined {new Date(member.joined_at).toLocaleDateString()}
                          </div>
                        </div>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-gray-500">No members found</p>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
} 