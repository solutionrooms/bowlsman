'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter, useParams, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import api from '../../../src/lib/axios';
import Navigation from '../../components/Navigation';
import PageHeading from '../../components/PageHeading';
import { canManageTeam } from '../../../src/utils/permissions';

interface Availability {
  id?: number;
  fixture: number;
  player_id?: number;
  availability: string;
  availability_display?: string;
  notes?: string | null;
}

interface Fixture {
  id: number;
  opponent: string;
  venue: string;
  fixture_date: string;
  for_score: number | null;
  against_score: number | null;
  is_upcoming: boolean;
  is_completed: boolean;
  player_availabilities?: Availability | null;
}

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
  upcoming_fixtures_count: number;
  upcoming_fixtures: Fixture[];
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

const AvailabilitySelector = ({ fixture, leagueId, onAvailabilityUpdated }) => {
  const [availability, setAvailability] = useState(fixture.player_availabilities?.availability || 'available');
  const [notes, setNotes] = useState(fixture.player_availabilities?.notes || '');
  const [loading, setLoading] = useState(false);
  const [showNotes, setShowNotes] = useState(false);
  const [error, setError] = useState('');
  const notesRef = useRef(null);

  useEffect(() => {
    // Update local state if the fixture's availability changes
    if (fixture.player_availabilities) {
      setAvailability(fixture.player_availabilities.availability);
      setNotes(fixture.player_availabilities.notes || '');
    }
  }, [fixture.player_availabilities]);

  useEffect(() => {
    // Close notes dropdown when clicking outside
    function handleClickOutside(event) {
      if (notesRef.current && !notesRef.current.contains(event.target)) {
        setShowNotes(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [notesRef]);

  const handleAvailabilityChange = async (newAvailability) => {
    try {
      setLoading(true);
      setError('');
      
      const response = await api.post(`fixtures/${fixture.id}/update_availability`, {
        availability: newAvailability,
        notes: notes
      });
      
      // Update the local state with the new availability
      setAvailability(newAvailability);
      
      // Create an updated fixture object with the new availability
      const updatedFixture = {
        ...fixture,
        player_availabilities: response.data
      };
      
      // Call the parent component's callback to update the fixture in the league state
      onAvailabilityUpdated(updatedFixture);
      
    } catch (err) {
      console.error('Error updating availability:', err);
      setError('Failed to update availability');
    } finally {
      setLoading(false);
    }
  };

  const handleNotesChange = async () => {
    try {
      setLoading(true);
      setError('');
      
      const response = await api.post(`fixtures/${fixture.id}/update_availability`, {
        availability: availability,
        notes: notes
      });
      
      // Create an updated fixture object with the new notes
      const updatedFixture = {
        ...fixture,
        player_availabilities: response.data
      };
      
      // Call the parent component's callback to update the fixture in the league state
      onAvailabilityUpdated(updatedFixture);
      
      // Hide the notes input
      setShowNotes(false);
      
    } catch (err) {
      console.error('Error updating notes:', err);
      setError('Failed to update notes');
    } finally {
      setLoading(false);
    }
  };

  const getAvailabilityColor = () => {
    switch (availability) {
      case 'available':
        return 'bg-green-100 text-green-800';
      case 'not_available':
        return 'bg-red-100 text-red-800';
      case 'prefer_not':
        return 'bg-yellow-100 text-yellow-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getAvailabilityText = () => {
    switch (availability) {
      case 'available':
        return 'Available';
      case 'not_available':
        return 'Not Available';
      case 'prefer_not':
        return 'Prefer Not';
      default:
        return 'Unknown';
    }
  };

  return (
    <div className="relative">
      <div className="flex items-center space-x-2">
        <div className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getAvailabilityColor()}`}>
          {getAvailabilityText()}
        </div>
        
        <div className="relative">
          <button
            onClick={() => setShowNotes(!showNotes)}
            className="text-gray-500 hover:text-gray-700"
            aria-label="Add notes"
            title={notes ? notes : "Add notes about your availability"}
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2h-1V9z" clipRule="evenodd" />
            </svg>
          </button>
          
          {showNotes && (
            <div 
              ref={notesRef}
              className="absolute z-10 mt-2 w-64 bg-white shadow-lg rounded-md p-3 right-0"
            >
              <textarea 
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500"
                placeholder="Add notes about your availability..."
                value={notes || ''}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
              />
              <div className="mt-2 flex justify-end space-x-2">
                <button 
                  className="px-3 py-1 text-xs text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200"
                  onClick={() => setShowNotes(false)}
                >
                  Cancel
                </button>
                <button 
                  className="px-3 py-1 text-xs text-white bg-blue-600 rounded-md hover:bg-blue-700"
                  onClick={handleNotesChange}
                  disabled={loading}
                >
                  Save
                </button>
              </div>
              {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
            </div>
          )}
        </div>
      </div>
      
      <div className="mt-2 flex space-x-1">
        <button
          className={`px-2 py-1 text-xs font-medium rounded-md ${
            availability === 'available' 
              ? 'bg-green-600 text-white' 
              : 'bg-green-100 text-green-800 hover:bg-green-200'
          }`}
          onClick={() => handleAvailabilityChange('available')}
          disabled={loading || availability === 'available'}
        >
          Available
        </button>
        <button
          className={`px-2 py-1 text-xs font-medium rounded-md ${
            availability === 'not_available' 
              ? 'bg-red-600 text-white' 
              : 'bg-red-100 text-red-800 hover:bg-red-200'
          }`}
          onClick={() => handleAvailabilityChange('not_available')}
          disabled={loading || availability === 'not_available'}
        >
          Not Available
        </button>
        <button
          className={`px-2 py-1 text-xs font-medium rounded-md ${
            availability === 'prefer_not' 
              ? 'bg-yellow-600 text-white' 
              : 'bg-yellow-100 text-yellow-800 hover:bg-yellow-200'
          }`}
          onClick={() => handleAvailabilityChange('prefer_not')}
          disabled={loading || availability === 'prefer_not'}
        >
          Prefer Not
        </button>
      </div>
    </div>
  );
};

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

          {/* Fixtures Section */}
          <div className="bg-white shadow overflow-hidden sm:rounded-lg mt-6">
            <div className="px-4 py-5 sm:p-6">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-medium text-gray-900">Upcoming Fixtures</h3>
                {canManage && (
                  <Link
                    href={`/leagues/${league.id}/members/manage`}
                    className="inline-flex items-center px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-md text-blue-600 bg-blue-100 hover:bg-blue-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                  >
                    Manage Team
                  </Link>
                )}
              </div>
              
              {league.upcoming_fixtures && league.upcoming_fixtures.length > 0 ? (
                <div className="overflow-hidden shadow ring-1 ring-black ring-opacity-5 sm:rounded-lg">
                  <table className="min-w-full divide-y divide-gray-300">
                    <thead className="bg-gray-50">
                      <tr>
                        <th scope="col" className="py-3.5 pl-4 pr-3 text-left text-sm font-semibold text-gray-900">Opponents</th>
                        <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">Venue</th>
                        <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">Fixture date</th>
                        <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">For</th>
                        <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">Agst</th>
                        <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">Availability</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200 bg-white">
                      {league.upcoming_fixtures.map((fixture) => (
                        <tr key={fixture.id} className="hover:bg-gray-50">
                          <td className="whitespace-nowrap py-4 pl-4 pr-3 text-sm font-medium text-blue-600">
                            {fixture.opponent}
                          </td>
                          <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-900">
                            {fixture.venue === 'home' ? 'Home' : 'Away'}
                          </td>
                          <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-900">
                            {new Date(fixture.fixture_date).toLocaleDateString('en-GB', { 
                              weekday: 'short', 
                              day: 'numeric', 
                              month: 'short' 
                            })}
                          </td>
                          <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-900">
                            {fixture.for_score !== null ? fixture.for_score : '-'}
                          </td>
                          <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-900">
                            {fixture.against_score !== null ? fixture.against_score : '-'}
                          </td>
                          <td className="whitespace-nowrap px-3 py-4 text-sm">
                            {league.members.some(member => member.user.id === userId) ? (
                              <AvailabilitySelector 
                                fixture={fixture} 
                                leagueId={league.id} 
                                onAvailabilityUpdated={(updatedFixture) => {
                                  // Update the fixture in the league state
                                  const updatedFixtures = league.upcoming_fixtures.map(f => 
                                    f.id === updatedFixture.id ? updatedFixture : f
                                  );
                                  setLeague({
                                    ...league,
                                    upcoming_fixtures: updatedFixtures
                                  });
                                }}
                              />
                            ) : (
                              <span className="text-gray-500">-</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="text-center py-6">
                  <p className="text-sm text-gray-500">No upcoming fixtures found</p>
                  {canManage && (
                    <p className="mt-2 text-sm text-gray-500">
                      Go to Team Management to import fixtures from the team website
                    </p>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
} 