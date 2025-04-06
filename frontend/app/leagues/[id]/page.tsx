// frontend/app/leagues/[id]/page.tsx
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

interface AvailabilitySelectorProps {
  fixture: Fixture;
  leagueId: number;
  defaultAvailability: string | null;
  onAvailabilityUpdated: (updatedFixture: Fixture) => void;
}

const AvailabilitySelector = ({ fixture, leagueId, defaultAvailability, onAvailabilityUpdated }: AvailabilitySelectorProps) => {
  // The initial values should prioritize user-set values over defaults
  const [availability, setAvailability] = useState(
    fixture.player_availabilities?.availability || defaultAvailability || 'available'
  );
  const [notes, setNotes] = useState(fixture.player_availabilities?.notes || '');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  
  useEffect(() => {
    // Update local state if the fixture's availability data changed
    if (fixture.player_availabilities) {
      // Always use explicitly set availability if it exists
      setAvailability(fixture.player_availabilities.availability);
      setNotes(fixture.player_availabilities.notes || '');
    } else if (defaultAvailability && !fixture.player_availabilities) {
      // Only apply default availability when there's no specific user setting
      setAvailability(defaultAvailability);
    }
  }, [fixture.player_availabilities, defaultAvailability]);

  // Combined handler for both availability and notes
  const saveAvailability = async (newAvailability: string, newNotes: string = notes) => {
    try {
      setLoading(true);
      setError('');
      
      const response = await api.post(`fixtures/${fixture.id}/update_availability`, {
        availability: newAvailability,
        notes: newNotes
      });
      
      // Update the local state
      setAvailability(newAvailability);
      setNotes(newNotes);
      
      // Create an updated fixture object with the new data
      const updatedFixture = {
        ...fixture,
        player_availabilities: response.data
      };
      
      // Also store in localStorage as a backup
      if (typeof window !== 'undefined') {
        const storageKey = `fixture_${fixture.id}_availability`;
        localStorage.setItem(storageKey, JSON.stringify({
          availability: newAvailability,
          notes: newNotes
        }));
      }
      
      // Call the parent component's callback to update the fixture in the league state
      onAvailabilityUpdated(updatedFixture);
      
    } catch (err) {
      console.error('Error updating availability:', err);
      setError('Failed to update availability');
    } finally {
      setLoading(false);
    }
  };

  // On component mount, check localStorage for any cached availability data
  useEffect(() => {
    if (typeof window !== 'undefined' && !fixture.player_availabilities) {
      const storageKey = `fixture_${fixture.id}_availability`;
      const cachedData = localStorage.getItem(storageKey);
      
      if (cachedData) {
        try {
          const { availability: cachedAvailability, notes: cachedNotes } = JSON.parse(cachedData);
          if (cachedAvailability) {
            setAvailability(cachedAvailability);
          }
          if (cachedNotes !== undefined) {
            setNotes(cachedNotes);
          }
        } catch (err) {
          console.error('Error parsing cached availability data:', err);
        }
      }
    }
  }, [fixture.id, fixture.player_availabilities]);

  const handleAvailabilityChange = (newAvailability: string) => {
    saveAvailability(newAvailability, notes);
  };
  
  // Only track notes in state, save on blur
  const handleNotesChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setNotes(e.target.value);
  };
  
  // Save notes only when focus is lost
  const handleNotesBlur = () => {
    if (notes !== fixture.player_availabilities?.notes) {
      saveAvailability(availability, notes);
    }
  };
  
  // Determine if current availability is using default - only true if no explicit player_availabilities record exists
  const isUsingDefault = !fixture.player_availabilities;
  
  // Render different colored status badges based on availability
  const getOptionClass = (value: string) => {
    switch (value) {
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
  
  // Get display text with (default) suffix if applicable
  const getOptionText = (value: string, label: string) => {
    // Only add the (default) suffix if:
    // 1. We're using the default availability (no explicit player_availabilities record exists)
    // 2. This option value matches the current default availability setting
    // 3. This option value matches the currently selected availability
    if (isUsingDefault && value === defaultAvailability && value === availability) {
      return `${label} (default)`;
    }
    return label;
  };

  return (
    <div className="relative">
      <div className="grid grid-cols-1 gap-2 w-full">
        {/* Combined dropdown with availability and note fields */}
        <div className="relative">
          <select
            className={`appearance-none w-full pl-3 pr-8 py-1.5 text-xs font-medium rounded-md ${
              isUsingDefault 
                ? 'bg-white text-gray-800 border-gray-300' 
                : availability === 'available' 
                  ? 'bg-green-100 text-green-800 border-green-300' 
                  : availability === 'not_available'
                  ? 'bg-red-100 text-red-800 border-red-300'
                  : 'bg-yellow-100 text-yellow-800 border-yellow-300'
            } border focus:outline-none focus:ring-1 focus:ring-blue-500`}
            value={availability}
            onChange={(e) => handleAvailabilityChange(e.target.value)}
            disabled={loading}
          >
            <option 
              value="available" 
              className={isUsingDefault && defaultAvailability === 'available' ? 'bg-white text-gray-800' : getOptionClass('available')}
            >
              {getOptionText('available', 'Available')}
            </option>
            <option 
              value="not_available" 
              className={isUsingDefault && defaultAvailability === 'not_available' ? 'bg-white text-gray-800' : getOptionClass('not_available')}
            >
              {getOptionText('not_available', 'Not Available')}
            </option>
            <option 
              value="prefer_not" 
              className={isUsingDefault && defaultAvailability === 'prefer_not' ? 'bg-white text-gray-800' : getOptionClass('prefer_not')}
            >
              {getOptionText('prefer_not', 'Prefer Not')}
            </option>
          </select>
          <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-gray-700">
            <svg className="fill-current h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20">
              <path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z"/>
            </svg>
          </div>
        </div>
        
        {/* Notes input field - always visible, no popup */}
        <div className="relative">
          <input 
            type="text"
            className="w-full px-3 py-1.5 text-xs border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500"
            placeholder="(Optional) note to captain"
            value={notes || ''}
            onChange={handleNotesChange}
            onBlur={handleNotesBlur}
            disabled={loading}
          />
          {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
        </div>
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
  const [fixtureStats, setFixtureStats] = useState<Map<number, {available: number, selected: number}>>(new Map());
  const [fixtureSelections, setFixtureSelections] = useState<Map<number, boolean>>(new Map());
  const [defaultAvailability, setDefaultAvailability] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'info' | 'fixtures'>('fixtures');

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('currentClub');
    router.push('/');
  };
  
  // Helper function to get tooltip text for the Availability/Selection badge
  const getAvailabilityStatsTooltip = (fixtureId: number) => {
    if (!fixtureStats.has(fixtureId)) return "No availability data";
    
    const stats = fixtureStats.get(fixtureId);
    if (!stats) return "No availability data";
    
    if (stats.available === 0) {
      return "No players available for this fixture";
    } else if (stats.selected === 0) {
      return "No players selected for this fixture";
    } else if (stats.selected >= stats.available) {
      return "All available players have been selected";
    } else {
      return `${stats.selected} out of ${stats.available} available players selected`;
    }
  };
  
  // Function to handle setting default availability
  const handleSetDefaultAvailability = async (availability: string) => {
    try {
      // Update UI immediately for responsiveness
      setDefaultAvailability(availability);
      
      // Send request to the backend
      const response = await api.post(`leagues/${params.id}/default_availability/`, {
        availability: availability
      });
      
      // Store default availability in localStorage for persistence between page reloads
      if (typeof window !== 'undefined') {
        localStorage.setItem(`league_${params.id}_default_availability`, availability);
      }
      
      // Apply the new default to all unset fixture availabilities
      if (league && league.upcoming_fixtures) {
        const updatedFixtures = league.upcoming_fixtures.map(fixture => {
          // Only update fixtures that don't have player_availabilities set
          if (!fixture.player_availabilities) {
            return {
              ...fixture,
              player_availabilities: {
                fixture: fixture.id,
                availability: availability,
                availability_display: availability === 'available' ? 'Available' : 
                                      availability === 'not_available' ? 'Not Available' : 'Prefer Not',
                notes: null
              }
            };
          }
          return fixture;
        });
        
        // Update the league state with the updated fixtures
        setLeague({
          ...league,
          upcoming_fixtures: updatedFixtures
        });
      }
      
      // Show a short confirmation message
      const message = document.createElement('div');
      message.className = 'fixed bottom-4 right-4 bg-green-100 text-green-800 px-4 py-2 rounded-lg shadow-lg';
      message.innerText = `Default availability set to ${
        availability === 'available' ? 'Available' : 
        availability === 'not_available' ? 'Not Available' : 'Prefer Not'
      }`;
      document.body.appendChild(message);
      
      // Remove message after 3 seconds
      setTimeout(() => {
        document.body.removeChild(message);
      }, 3000);
      
    } catch (err) {
      console.error('Error setting default availability:', err);
      setError('Failed to set default availability. Please try again.');
    }
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
        const leagueData = leagueResponse.data;
        setLeague(leagueData);
        
        // Check localStorage for cached default availability first
        if (typeof window !== 'undefined') {
          const cachedAvailability = localStorage.getItem(`league_${params.id}_default_availability`);
          if (cachedAvailability) {
            setDefaultAvailability(cachedAvailability);
          }
        }
        
        // Then fetch from backend to ensure data is up to date
        try {
          const defaultAvailResponse = await api.get(`leagues/${params.id}/default_availability/`);
          if (defaultAvailResponse.data && defaultAvailResponse.data.availability) {
            const serverAvailability = defaultAvailResponse.data.availability;
            setDefaultAvailability(serverAvailability);
            
            // Update localStorage with server value
            if (typeof window !== 'undefined') {
              localStorage.setItem(`league_${params.id}_default_availability`, serverAvailability);
            }
          }
        } catch (err) {
          console.error('Error fetching default availability:', err);
          // Default availability not set yet, that's ok
        }
        
        // Fetch selection status for all fixtures for the current user
        if (leagueData.upcoming_fixtures && leagueData.upcoming_fixtures.length > 0) {
          const selectionsMap = new Map<number, boolean>();
          
          for (const fixture of leagueData.upcoming_fixtures) {
            try {
              const selectionResponse = await api.get(`fixtures/${fixture.id}/my_selection`);
              if (selectionResponse.data && 'is_selected' in selectionResponse.data) {
                selectionsMap.set(fixture.id, selectionResponse.data.is_selected);
              }
            } catch (err) {
              console.error(`Error fetching selection for fixture ${fixture.id}:`, err);
            }
          }
          
          setFixtureSelections(selectionsMap);
        }
        
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
  
  // Fetch availability and selection stats for fixtures when user is captain/deputy
  useEffect(() => {
    const fetchFixtureStats = async () => {
      if (!league || !league.upcoming_fixtures || !canManage) return;
      
      const statsMap = new Map<number, {available: number, selected: number}>();
      
      for (const fixture of league.upcoming_fixtures) {
        try {
          // Fetch team availabilities for this fixture
          const response = await api.get(`fixtures/${fixture.id}/team_availabilities`);
          const teamAvailabilities = response.data;
          
          let availableCount = 0;
          let selectedCount = 0;
          
          if (Array.isArray(teamAvailabilities)) {
            teamAvailabilities.forEach(member => {
              // Count available players
              if (member.availability) {
                const status = typeof member.availability === 'object' ? member.availability.status : member.availability;
                if (status === 'available') {
                  availableCount++;
                }
              }
              
              // Count selected players
              if (member.is_selected) {
                selectedCount++;
              }
            });
          }
          
          const fixtureStats = {
            available: availableCount,
            selected: selectedCount
          };
          statsMap.set(fixture.id, fixtureStats);
        } catch (error) {
          console.error(`Error fetching stats for fixture ${fixture.id}:`, error);
          statsMap.set(fixture.id, { available: 0, selected: 0 });
        }
      }
      
      setFixtureStats(statsMap);
    };

    if (canManage && league) {
      fetchFixtureStats();
    }
  }, [canManage, league]);

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
        
        <div className="bg-white shadow overflow-hidden sm:rounded-lg mb-6">
          <div className="border-b border-gray-200">
            <nav className="-mb-px flex" aria-label="Tabs">
              <button
                onClick={() => setActiveTab('info')}
                className={`${
                  activeTab === 'info'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                } w-1/2 py-4 px-1 text-center border-b-2 font-medium text-sm`}
              >
                Team Information
              </button>
              <button
                onClick={() => setActiveTab('fixtures')}
                className={`${
                  activeTab === 'fixtures'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                } w-1/2 py-4 px-1 text-center border-b-2 font-medium text-sm`}
              >
                Upcoming Fixtures {league.upcoming_fixtures && league.upcoming_fixtures.length > 0 && `(${league.upcoming_fixtures.length})`}
              </button>
            </nav>
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

        {activeTab === 'info' && (
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
        )}

        {/* Fixtures Section */}
        {activeTab === 'fixtures' && (
          <div className="bg-white shadow overflow-hidden sm:rounded-lg">
            <div className="px-4 py-5 sm:p-6">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-medium text-gray-900">Upcoming Fixtures</h3>
                {canManage && (
                  <Link
                    href={`/leagues/${league.id}/fixtures/manage`}
                    className="inline-flex items-center px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-md text-blue-600 bg-blue-100 hover:bg-blue-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                  >
                    Manage Fixtures
                  </Link>
                )}
              </div>
              
              {/* Default Availability Section */}
              {league.members.some(member => member.user.id === userId) && (
                <div className="bg-gray-50 p-4 rounded-lg mb-4 flex items-center justify-between">
                  <div>
                    <h4 className="text-sm font-medium text-gray-900">Default Availability</h4>
                    <p className="text-xs text-gray-500 mt-1">
                      This will be your default availability for all fixtures unless overridden.
                    </p>
                  </div>
                  <div className="relative max-w-xs">
                  <select
                    className={`appearance-none w-full px-3 py-1.5 text-sm font-medium rounded-md ${
                      defaultAvailability === 'available' 
                        ? 'bg-green-100 text-green-800 border-green-300' 
                        : defaultAvailability === 'not_available'
                        ? 'bg-red-100 text-red-800 border-red-300'
                        : 'bg-yellow-100 text-yellow-800 border-yellow-300'
                    } border focus:outline-none focus:ring-1 focus:ring-blue-500`}
                    value={defaultAvailability || 'available'}
                    onChange={(e) => handleSetDefaultAvailability(e.target.value)}
                  >
                    <option 
                      value="available" 
                      className="bg-green-100 text-green-800"
                    >
                      Available
                    </option>
                    <option 
                      value="not_available" 
                      className="bg-red-100 text-red-800"
                    >
                      Not Available
                    </option>
                    <option 
                      value="prefer_not" 
                      className="bg-yellow-100 text-yellow-800"
                    >
                      Prefer Not
                    </option>
                  </select>
                  <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-gray-700">
                    <svg className="fill-current h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20">
                      <path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z"/>
                    </svg>
                  </div>
                </div>
                </div>
              )}
              
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
                        {canManage && (
                          <th scope="col" className="px-3 py-3.5 text-center text-sm font-semibold text-gray-900">Avail/Selected</th>
                        )}
                        <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">Availability</th>
                        <th scope="col" className="px-3 py-3.5 text-center text-sm font-semibold text-gray-900">Selected</th>
                        {canManage && (
                          <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">Actions</th>
                        )}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200 bg-white">
                      {league.upcoming_fixtures.map((fixture) => (
                        <tr key={fixture.id} className="hover:bg-gray-50">
                          <td className="whitespace-nowrap py-4 pl-4 pr-3 text-sm font-medium text-gray-900">
                            {fixture.opponent}
                          </td>
                          <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-900">
                            {fixture.venue}
                          </td>
                          <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-900">
                            {new Date(fixture.fixture_date).toLocaleDateString(undefined, {
                              weekday: 'short',
                              year: 'numeric',
                              month: 'short',
                              day: 'numeric',
                            })}
                          </td>
                          <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-900">
                            {fixture.for_score !== null ? fixture.for_score : '-'}
                          </td>
                          <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-900">
                            {fixture.against_score !== null ? fixture.against_score : '-'}
                          </td>
                          {canManage && (
                            <td className="whitespace-nowrap px-3 py-4 text-sm text-center">
                              {fixtureStats.has(fixture.id) ? (
                                <span 
                                  className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium cursor-help ${
                                    fixtureStats.get(fixture.id)?.available === 0 
                                      ? 'bg-red-100 text-red-800' // No available players
                                      : fixtureStats.get(fixture.id)?.selected === 0 
                                        ? 'bg-yellow-100 text-yellow-800' // Available but none selected
                                        : fixtureStats.get(fixture.id)?.selected! >= fixtureStats.get(fixture.id)?.available!
                                          ? 'bg-green-100 text-green-800' // All available players selected
                                          : 'bg-blue-100 text-blue-800' // Some selected
                                  }`}
                                  title={getAvailabilityStatsTooltip(fixture.id)}
                                >
                                  {fixtureStats.get(fixture.id)?.available}/{fixtureStats.get(fixture.id)?.selected}
                                </span>
                              ) : (
                                <span className="text-gray-500">-/-</span>
                              )}
                            </td>
                          )}
                          <td className="whitespace-nowrap px-3 py-4 text-sm">
                            {league.members.some(member => member.user.id === userId) ? (
                              <AvailabilitySelector 
                                fixture={fixture} 
                                leagueId={league.id} 
                                defaultAvailability={defaultAvailability}
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
                          <td className="whitespace-nowrap px-3 py-4 text-sm text-center">
                            {fixtureSelections.has(fixture.id) ? (
                              fixtureSelections.get(fixture.id) ? (
                                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                                  Selected
                                </span>
                              ) : (
                                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                                  Not Selected
                                </span>
                              )
                            ) : (
                              <span className="text-gray-500">-</span>
                            )}
                          </td>
                          {canManage && (
                            <td className="whitespace-nowrap px-3 py-4 text-sm">
                              <Link
                                href={`/leagues/${league.id}/fixtures/manage/selection?fixtureId=${fixture.id}`}
                                className="inline-flex items-center px-2.5 py-1.5 border border-transparent text-xs font-medium rounded text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                              >
                                Manage
                              </Link>
                            </td>
                          )}
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
        )}
      </div>
    </div>
  );
}