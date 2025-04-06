'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import api from '../../../../../../src/lib/axios';
import Navigation from '../../../../../components/Navigation';
import PageHeading from '../../../../../components/PageHeading';
import { canManageTeam } from '../../../../../../src/utils/permissions';

interface Availability {
  id?: number;
  fixture: number;
  player_id?: number;
  player_name?: string;
  availability: string;
  availability_display?: string;
  notes?: string | null;
}

interface PlayerSelection {
  id?: number;
  fixture: number;
  player_id: number;
  is_selected: boolean;
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
  player_selections?: PlayerSelection[];
  player_availabilities?: Availability[];
}

interface LeagueMember {
  id: number;
  user: {
    id: number;
    first_name: string;
    last_name: string;
    username: string;
  };
  joined_at: string;
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
  members: LeagueMember[];
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

export default function ManageFixturesPage() {
  const router = useRouter();
  const params = useParams();
  const searchParams = useSearchParams();
  const [league, setLeague] = useState<League | null>(null);
  const [selectedFixture, setSelectedFixture] = useState<Fixture | null>(null);
  const [memberAvailability, setMemberAvailability] = useState<Map<number, Map<number, string>>>(new Map());
  const [selectedPlayers, setSelectedPlayers] = useState<Map<number, Set<number>>>(new Map());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [canManage, setCanManage] = useState(false);
  const [userId, setUserId] = useState<number | null>(null);
  const [userClubs, setUserClubs] = useState<Club[]>([]);

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

        // Get user data
        const userResponse = await api.get<UserData>('users/me');
        const userData = userResponse.data;
        const clubs = userData.clubs || [];
        
        setUserClubs(clubs);
        setUserId(userData.user.id);
        
        // Get league details
        const leagueResponse = await api.get<League>(`leagues/${params.id}`);
        const leagueData = leagueResponse.data;
        
        // Log the fixture and availability data for debugging
        if (leagueData.upcoming_fixtures) {
          console.log('Upcoming fixtures:', leagueData.upcoming_fixtures);
          leagueData.upcoming_fixtures.forEach(fixture => {
            console.log(`Fixture ${fixture.id} availabilities:`, fixture.player_availabilities);
          });
        }
        
        setLeague(leagueData);
        
        // Initialize availability and selection maps
        const availabilityMap = new Map<number, Map<number, string>>();
        const selectionMap = new Map<number, Set<number>>();
        
        // Fetch team availabilities for all fixtures
        if (leagueData.upcoming_fixtures && leagueData.upcoming_fixtures.length > 0) {
          for (const fixture of leagueData.upcoming_fixtures) {
            try {
              // Fetch team availabilities for this fixture
              const availabilityResponse = await api.get(`fixtures/${fixture.id}/team_availabilities`);
              const teamAvailabilities = availabilityResponse.data;
              console.log(`Team availabilities for fixture ${fixture.id}:`, teamAvailabilities);
              
              // Initialize availability map for this fixture
              const fixtureAvailabilityMap = new Map<number, string>();
              
              // Process team availabilities
              if (Array.isArray(teamAvailabilities)) {
                teamAvailabilities.forEach(member => {
                  if (member.user && member.availability) {
                    // Handle different API response formats
                    if (typeof member.availability === 'object' && member.availability.status) {
                      fixtureAvailabilityMap.set(member.user.id, member.availability.status);
                    } else if (typeof member.availability === 'string') {
                      fixtureAvailabilityMap.set(member.user.id, member.availability);
                    }
                  }
                });
              }
              
              availabilityMap.set(fixture.id, fixtureAvailabilityMap);
              
              // Initialize selection map for each fixture
              const selectedPlayersSet = new Set<number>();
              
              // Process team selections if available
              if (teamAvailabilities && Array.isArray(teamAvailabilities)) {
                teamAvailabilities.forEach(member => {
                  if (member.user && member.is_selected) {
                    selectedPlayersSet.add(member.user.id);
                  }
                });
              }
              
              selectionMap.set(fixture.id, selectedPlayersSet);
            } catch (err) {
              console.error(`Error fetching availabilities for fixture ${fixture.id}:`, err);
              // Initialize with empty maps if fetch fails
              availabilityMap.set(fixture.id, new Map());
              selectionMap.set(fixture.id, new Set());
            }
          }
        }
        
        setMemberAvailability(availabilityMap);
        setSelectedPlayers(selectionMap);
        
        // Check if a specific fixture was requested in the URL
        const fixtureId = searchParams.get('fixtureId');
        if (fixtureId && leagueData.upcoming_fixtures) {
          const fixture = leagueData.upcoming_fixtures.find(f => f.id.toString() === fixtureId);
          if (fixture) {
            setSelectedFixture(fixture);
          } else if (leagueData.upcoming_fixtures.length > 0) {
            // Fall back to the first fixture if the requested one isn't found
            setSelectedFixture(leagueData.upcoming_fixtures[0]);
          }
        } else if (leagueData.upcoming_fixtures && leagueData.upcoming_fixtures.length > 0) {
          // Select the first fixture by default if no specific fixture was requested
          setSelectedFixture(leagueData.upcoming_fixtures[0]);
        }
        
        setLoading(false);
      } catch (err: any) {
        console.error('Error fetching data:', err);
        setError('Failed to load data. Please try again later.');
        setLoading(false);
      }
    };

    fetchData();
  }, [params.id, searchParams]);

  // Check if user can manage the team whenever relevant data changes
  useEffect(() => {
    if (userId && league && userClubs.length > 0) {
      const hasPermission = canManageTeam(userId, league, userClubs);
      setCanManage(hasPermission);
      
      // If user doesn't have permission, redirect
      if (!hasPermission) {
        router.push(`/leagues/${params.id}`);
      }
    }
  }, [userId, league, userClubs, params.id, router]);

  const getAvailabilityLabel = (availability: string | undefined) => {
    if (!availability) return 'Not Set';
    
    switch (availability) {
      case 'available':
        return 'Available';
      case 'not_available':
        return 'Not Available';
      case 'prefer_not':
        return 'Prefer Not';
      default:
        return availability === 'undefined' ? 'Not Set' : availability;
    }
  };

  const getAvailabilityColor = (availability: string | undefined) => {
    if (!availability) return 'bg-gray-100 text-gray-800';
    
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

  const togglePlayerSelection = (playerId: number) => {
    if (!selectedFixture) return;
    
    setSelectedPlayers(prevSelections => {
      const newSelections = new Map(prevSelections);
      const fixtureSelections = new Set(newSelections.get(selectedFixture.id) || []);
      
      if (fixtureSelections.has(playerId)) {
        fixtureSelections.delete(playerId);
      } else {
        fixtureSelections.add(playerId);
      }
      
      newSelections.set(selectedFixture.id, fixtureSelections);
      return newSelections;
    });
  };

  const saveTeamSelection = async () => {
    if (!selectedFixture || !league) return;
    
    try {
      setSaving(true);
      setError(null);
      setSuccessMessage(null);
      
      const selectedPlayerIds = Array.from(selectedPlayers.get(selectedFixture.id) || []);
      
      await api.post(`/fixtures/${selectedFixture.id}/update_team_selection`, {
        league_id: league.id,
        player_ids: selectedPlayerIds
      });
      
      setSuccessMessage('Team selection saved successfully');
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err: any) {
      console.error('Error saving team selection:', err);
      setError('Failed to save team selection. Please try again.');
    } finally {
      setSaving(false);
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

  if (!league || !canManage) {
    return (
      <div className="min-h-screen bg-gray-100">
        <Navigation onLogout={handleLogout} />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="bg-white shadow overflow-hidden sm:rounded-lg p-6">
            <div className="text-center">
              <h3 className="text-lg font-medium text-gray-900">Access Denied</h3>
              <div className="mt-2">
                <p className="text-sm text-gray-500">You don't have permission to manage fixtures for this team.</p>
              </div>
              <div className="mt-6">
                <Link
                  href={`/leagues/${params.id}`}
                  className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700"
                >
                  Back to Team
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
        <div className="mb-6 flex justify-between items-center">
          <PageHeading 
            title={`Manage Team Selection - ${league.name}`}
            infoText="Select players for each fixture"
          />
          <Link
            href={`/leagues/${league.id}`}
            className="inline-flex items-center px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-md text-blue-700 bg-blue-100 hover:bg-blue-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
          >
            ← Back to Team
          </Link>
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

        {successMessage && (
          <div className="bg-green-50 border-l-4 border-green-400 p-4 mb-6">
            <div className="flex">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5 text-green-400" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="ml-3">
                <p className="text-sm text-green-700">{successMessage}</p>
              </div>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          {/* Fixture Selection Sidebar */}
          <div className="md:col-span-1 bg-white shadow sm:rounded-lg p-4">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Upcoming Fixtures</h3>
            {league.upcoming_fixtures && league.upcoming_fixtures.length > 0 ? (
              <ul className="space-y-2">
                {league.upcoming_fixtures.map((fixture) => (
                  <li key={fixture.id}>
                    <button
                      onClick={() => setSelectedFixture(fixture)}
                      className={`w-full text-left py-2 px-3 rounded-md transition-colors ${
                        selectedFixture?.id === fixture.id
                          ? 'bg-blue-100 text-blue-800'
                          : 'hover:bg-gray-100'
                      }`}
                    >
                      <div className="font-medium">{fixture.opponent}</div>
                      <div className="text-sm text-gray-600">
                        {fixture.venue === 'home' ? 'Home' : 'Away'} - {new Date(fixture.fixture_date).toLocaleDateString('en-GB', { 
                          weekday: 'short', 
                          day: 'numeric', 
                          month: 'short' 
                        })}
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-gray-500">No upcoming fixtures</p>
            )}
          </div>

          {/* Team Selection Panel */}
          <div className="md:col-span-3 bg-white shadow sm:rounded-lg">
            {selectedFixture ? (
              <div>
                <div className="px-4 py-5 sm:px-6 border-b border-gray-200">
                  <h3 className="text-lg font-medium text-gray-900">
                    Select Players for {selectedFixture.opponent}
                  </h3>
                  <p className="mt-1 text-sm text-gray-500">
                    {new Date(selectedFixture.fixture_date).toLocaleDateString('en-GB', { 
                      weekday: 'long', 
                      day: 'numeric', 
                      month: 'long',
                      year: 'numeric'
                    })} - {selectedFixture.venue === 'home' ? 'Home' : 'Away'}
                  </p>
                </div>
                <div className="px-4 py-5 sm:p-6">
                  <div className="overflow-hidden shadow ring-1 ring-black ring-opacity-5 sm:rounded-lg">
                    <table className="min-w-full divide-y divide-gray-300">
                      <thead className="bg-gray-50">
                        <tr>
                          <th scope="col" className="py-3.5 pl-4 pr-3 text-left text-sm font-semibold text-gray-900 sm:pl-6">Player</th>
                          <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">Availability</th>
                          <th scope="col" className="px-3 py-3.5 text-center text-sm font-semibold text-gray-900">Selected</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200 bg-white">
                        {league.members.map((member) => {
                          const playerAvailability = memberAvailability.get(selectedFixture.id)?.get(member.user.id);
                          console.log(`Player ${member.user.id} availability:`, playerAvailability);
                          const isSelected = selectedPlayers.get(selectedFixture.id)?.has(member.user.id) || false;
                          
                          return (
                            <tr key={member.id} className="hover:bg-gray-50">
                              <td className="whitespace-nowrap py-4 pl-4 pr-3 text-sm font-medium text-gray-900 sm:pl-6">
                                {member.user.first_name} {member.user.last_name}
                              </td>
                              <td className="whitespace-nowrap px-3 py-4 text-sm">
                                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getAvailabilityColor(playerAvailability)}`}>
                                  {getAvailabilityLabel(playerAvailability)}
                                </span>
                              </td>
                              <td className="whitespace-nowrap px-3 py-4 text-sm text-center">
                                <button
                                  onClick={() => togglePlayerSelection(member.user.id)}
                                  className={`w-5 h-5 rounded ${isSelected ? 'bg-blue-600' : 'bg-gray-200'} transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500`}
                                  aria-label={isSelected ? 'Deselect player' : 'Select player'}
                                >
                                  {isSelected && (
                                    <svg className="w-5 h-5 text-white" viewBox="0 0 20 20" fill="currentColor">
                                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                    </svg>
                                  )}
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                  
                  <div className="mt-6 flex justify-end">
                    <button
                      onClick={saveTeamSelection}
                      disabled={saving}
                      className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                    >
                      {saving ? 'Saving...' : 'Save Team Selection'}
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="px-4 py-5 sm:p-6 text-center">
                <p className="text-sm text-gray-500">Select a fixture to manage team selection</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}