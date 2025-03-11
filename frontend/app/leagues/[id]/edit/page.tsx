'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams, useSearchParams } from 'next/navigation';
import api from '../../../../src/lib/axios';
import Navigation from '../../../components/Navigation';
import PageHeading from '../../../components/PageHeading';
import Link from 'next/link';
import { canManageTeam } from '../../../../src/utils/permissions';

interface User {
  id: number;
  username: string;
  email: string;
  first_name: string;
  last_name: string;
  display_name?: string;
  search_name?: string;
}

interface League {
  id: number;
  name: string;
  club: {
    id: number;
    name: string;
  };
  season: string;
  captain: User | null;
  deputy: User | null;
  league_table_link: string | null;
  team_link: string | null;
}

interface Club {
  id: number;
  name: string;
  is_admin: boolean;
}

interface UserData {
  user: User;
  current_club: Club | null;
  clubs: Club[];
}

export default function EditTeamPage() {
  const router = useRouter();
  const params = useParams();
  const searchParams = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [league, setLeague] = useState<League | null>(null);
  const [userClubs, setUserClubs] = useState<Club[]>([]);
  const [clubMembers, setClubMembers] = useState<User[]>([]);
  const [userId, setUserId] = useState<number | null>(null);
  const [hasPermission, setHasPermission] = useState(false);
  const [permissionChecked, setPermissionChecked] = useState(false);
  
  // Form state
  const [name, setName] = useState('');
  const [season, setSeason] = useState('');
  const [selectedCaptain, setSelectedCaptain] = useState<number | null>(null);
  const [selectedDeputy, setSelectedDeputy] = useState<number | null>(null);
  const [leagueTableLink, setLeagueTableLink] = useState('');
  const [teamLink, setTeamLink] = useState('');
  
  // Search state
  const [captainSearchText, setCaptainSearchText] = useState('');
  const [deputySearchText, setDeputySearchText] = useState('');
  const [showCaptainDropdown, setShowCaptainDropdown] = useState(false);
  const [showDeputyDropdown, setShowDeputyDropdown] = useState(false);
  const [filteredCaptains, setFilteredCaptains] = useState<User[]>([]);
  const [filteredDeputies, setFilteredDeputies] = useState<User[]>([]);
  const [selectedCaptainUser, setSelectedCaptainUser] = useState<User | null>(null);
  const [selectedDeputyUser, setSelectedDeputyUser] = useState<User | null>(null);

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
        const clubs = userData.clubs || [];
        
        setUserClubs(clubs);
        setUserId(userData.user.id);

        // Get league details
        const leagueResponse = await api.get<League>(`leagues/${params.id}`);
        const leagueData = leagueResponse.data;
        setLeague(leagueData);
        
        // Check if user has permission to edit this team
        const canManage = canManageTeam(userData.user.id, leagueData, clubs);
        setHasPermission(canManage);
        setPermissionChecked(true);

        // Initialize form with league data
        setName(leagueData.name);
        setSeason(leagueData.season);
        setSelectedCaptain(leagueData.captain?.id || null);
        setSelectedCaptainUser(leagueData.captain);
        setSelectedDeputy(leagueData.deputy?.id || null);
        setSelectedDeputyUser(leagueData.deputy);
        setLeagueTableLink(leagueData.league_table_link || '');
        setTeamLink(leagueData.team_link || '');
        
        // Fetch club members for captain/deputy selection
        await fetchClubMembers(leagueData.club.id);
        
        setLoading(false);
      } catch (err: any) {
        console.error('Error fetching data:', err);
        setError('Failed to load data: ' + (err.response?.data?.error || err.message));
        setLoading(false);
      }
    };
    
    fetchData();
  }, [params.id]);

  // Redirect if user doesn't have permission
  useEffect(() => {
    if (permissionChecked && !loading && !hasPermission && league) {
      // Redirect to the team page with a message
      router.push(`/leagues/${league.id}?error=You do not have permission to edit this team`);
    }
  }, [permissionChecked, hasPermission, loading, league, router]);

  const fetchClubMembers = async (clubId: number) => {
    try {
      const response = await api.get<User[]>(`clubs/${clubId}/members`);
      setClubMembers(response.data);
    } catch (err: any) {
      console.error('Error fetching club members:', err);
      setError('Failed to load club members: ' + (err.response?.data?.error || err.message));
    }
  };

  // Filter captains based on search text
  useEffect(() => {
    if (!captainSearchText) {
      setFilteredCaptains(clubMembers.slice(0, 10));
      return;
    }
    
    const searchLower = captainSearchText.toLowerCase();
    const filtered = clubMembers.filter(member => {
      const fullName = `${member.first_name} ${member.last_name}`.toLowerCase();
      const username = member.username.toLowerCase();
      const searchName = member.search_name?.toLowerCase() || '';
      
      return fullName.includes(searchLower) || 
             username.includes(searchLower) || 
             searchName.includes(searchLower);
    });
    
    setFilteredCaptains(filtered.slice(0, 10));
  }, [captainSearchText, clubMembers]);

  // Filter deputies based on search text
  useEffect(() => {
    if (!deputySearchText) {
      setFilteredDeputies(clubMembers.slice(0, 10));
      return;
    }
    
    const searchLower = deputySearchText.toLowerCase();
    const filtered = clubMembers.filter(member => {
      const fullName = `${member.first_name} ${member.last_name}`.toLowerCase();
      const username = member.username.toLowerCase();
      const searchName = member.search_name?.toLowerCase() || '';
      
      return fullName.includes(searchLower) || 
             username.includes(searchLower) || 
             searchName.includes(searchLower);
    });
    
    setFilteredDeputies(filtered.slice(0, 10));
  }, [deputySearchText, clubMembers]);

  const handleSelectCaptain = (user: User) => {
    setSelectedCaptain(user.id);
    setSelectedCaptainUser(user);
    setCaptainSearchText('');
    setShowCaptainDropdown(false);
  };

  const handleClearCaptain = () => {
    setSelectedCaptain(null);
    setSelectedCaptainUser(null);
  };

  const handleSelectDeputy = (user: User) => {
    setSelectedDeputy(user.id);
    setSelectedDeputyUser(user);
    setDeputySearchText('');
    setShowDeputyDropdown(false);
  };

  const handleClearDeputy = () => {
    setSelectedDeputy(null);
    setSelectedDeputyUser(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!league) return;
    
    try {
      setSubmitting(true);
      setError(null);
      
      const updateData = {
        name,
        season,
        captain_id: selectedCaptain,
        deputy_id: selectedDeputy,
        league_table_link: leagueTableLink || null,
        team_link: teamLink || null
      };
      
      await api.patch(`leagues/${league.id}`, updateData);
      
      // Redirect back to team page
      router.push(`/leagues/${league.id}?success=Team updated successfully`);
    } catch (err: any) {
      console.error('Error updating team:', err);
      setError('Failed to update team: ' + (err.response?.data?.error || err.message));
      setSubmitting(false);
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
              title="Edit Team"
              infoText={`Edit details for ${league.name}`}
            />
            <Link
              href={`/leagues/${league.id}`}
              className="inline-flex items-center px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-md text-blue-700 bg-blue-100 hover:bg-blue-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              ← Back to Team
            </Link>
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

        <div className="bg-white shadow overflow-hidden sm:rounded-lg">
          <div className="px-4 py-5 sm:p-6">
            <form onSubmit={handleSubmit}>
              <div className="space-y-6">
                <div>
                  <label htmlFor="name" className="block text-sm font-medium text-gray-700">
                    Team Name
                  </label>
                  <div className="mt-1">
                    <input
                      type="text"
                      name="name"
                      id="name"
                      className="shadow-sm focus:ring-blue-500 focus:border-blue-500 block w-full sm:text-sm border-gray-300 rounded-md"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      required
                    />
                  </div>
                </div>

                <div>
                  <label htmlFor="season" className="block text-sm font-medium text-gray-700">
                    Season
                  </label>
                  <div className="mt-1">
                    <input
                      type="text"
                      name="season"
                      id="season"
                      className="shadow-sm focus:ring-blue-500 focus:border-blue-500 block w-full sm:text-sm border-gray-300 rounded-md"
                      value={season}
                      onChange={(e) => setSeason(e.target.value)}
                      required
                    />
                  </div>
                </div>

                <div>
                  <label htmlFor="captain" className="block text-sm font-medium text-gray-700">
                    Captain
                  </label>
                  <div className="mt-1 relative">
                    {selectedCaptainUser ? (
                      <div className="flex items-center justify-between p-2 border border-gray-300 rounded-md">
                        <div>
                          <p className="text-sm font-medium text-gray-900">
                            {selectedCaptainUser.first_name} {selectedCaptainUser.last_name}
                          </p>
                          <p className="text-sm text-gray-500">
                            {selectedCaptainUser.username}
                          </p>
                        </div>
                        <button
                          type="button"
                          className="text-sm text-red-600 hover:text-red-900"
                          onClick={handleClearCaptain}
                        >
                          Remove
                        </button>
                      </div>
                    ) : (
                      <>
                        <input
                          type="text"
                          name="captain"
                          id="captain"
                          className="shadow-sm focus:ring-blue-500 focus:border-blue-500 block w-full sm:text-sm border-gray-300 rounded-md"
                          placeholder="Search for a captain..."
                          value={captainSearchText}
                          onChange={(e) => setCaptainSearchText(e.target.value)}
                          onClick={() => setShowCaptainDropdown(true)}
                          onBlur={(e) => {
                            // Only hide dropdown if not clicking on a dropdown item
                            if (!e.relatedTarget || !e.relatedTarget.closest('.captain-dropdown-item')) {
                              setTimeout(() => setShowCaptainDropdown(false), 200);
                            }
                          }}
                        />
                        {showCaptainDropdown && (
                          <div className="absolute z-10 mt-1 w-full bg-white shadow-lg max-h-60 rounded-md py-1 text-base ring-1 ring-black ring-opacity-5 overflow-auto focus:outline-none sm:text-sm">
                            {filteredCaptains.length > 0 ? (
                              filteredCaptains.map((user) => (
                                <button
                                  key={user.id}
                                  type="button"
                                  className="w-full text-left px-4 py-2 hover:bg-gray-100 captain-dropdown-item"
                                  onClick={() => handleSelectCaptain(user)}
                                >
                                  <div className="flex items-center">
                                    <div>
                                      <p className="text-sm font-medium text-gray-900">
                                        {user.first_name} {user.last_name}
                                      </p>
                                      <p className="text-sm text-gray-500">
                                        {user.username}
                                      </p>
                                    </div>
                                  </div>
                                </button>
                              ))
                            ) : (
                              <div className="px-4 py-2 text-sm text-gray-500">
                                No matching members found
                              </div>
                            )}
                          </div>
                        )}
                      </>
                    )}
                  </div>
                </div>

                <div>
                  <label htmlFor="deputy" className="block text-sm font-medium text-gray-700">
                    Deputy
                  </label>
                  <div className="mt-1 relative">
                    {selectedDeputyUser ? (
                      <div className="flex items-center justify-between p-2 border border-gray-300 rounded-md">
                        <div>
                          <p className="text-sm font-medium text-gray-900">
                            {selectedDeputyUser.first_name} {selectedDeputyUser.last_name}
                          </p>
                          <p className="text-sm text-gray-500">
                            {selectedDeputyUser.username}
                          </p>
                        </div>
                        <button
                          type="button"
                          className="text-sm text-red-600 hover:text-red-900"
                          onClick={handleClearDeputy}
                        >
                          Remove
                        </button>
                      </div>
                    ) : (
                      <>
                        <input
                          type="text"
                          name="deputy"
                          id="deputy"
                          className="shadow-sm focus:ring-blue-500 focus:border-blue-500 block w-full sm:text-sm border-gray-300 rounded-md"
                          placeholder="Search for a deputy..."
                          value={deputySearchText}
                          onChange={(e) => setDeputySearchText(e.target.value)}
                          onClick={() => setShowDeputyDropdown(true)}
                          onBlur={(e) => {
                            // Only hide dropdown if not clicking on a dropdown item
                            if (!e.relatedTarget || !e.relatedTarget.closest('.deputy-dropdown-item')) {
                              setTimeout(() => setShowDeputyDropdown(false), 200);
                            }
                          }}
                        />
                        {showDeputyDropdown && (
                          <div className="absolute z-10 mt-1 w-full bg-white shadow-lg max-h-60 rounded-md py-1 text-base ring-1 ring-black ring-opacity-5 overflow-auto focus:outline-none sm:text-sm">
                            {filteredDeputies.length > 0 ? (
                              filteredDeputies.map((user) => (
                                <button
                                  key={user.id}
                                  type="button"
                                  className="w-full text-left px-4 py-2 hover:bg-gray-100 deputy-dropdown-item"
                                  onClick={() => handleSelectDeputy(user)}
                                >
                                  <div className="flex items-center">
                                    <div>
                                      <p className="text-sm font-medium text-gray-900">
                                        {user.first_name} {user.last_name}
                                      </p>
                                      <p className="text-sm text-gray-500">
                                        {user.username}
                                      </p>
                                    </div>
                                  </div>
                                </button>
                              ))
                            ) : (
                              <div className="px-4 py-2 text-sm text-gray-500">
                                No matching members found
                              </div>
                            )}
                          </div>
                        )}
                      </>
                    )}
                  </div>
                </div>

                <div>
                  <label htmlFor="league_table_link" className="block text-sm font-medium text-gray-700">
                    League Table Link (optional)
                  </label>
                  <div className="mt-1">
                    <input
                      type="url"
                      name="league_table_link"
                      id="league_table_link"
                      className="shadow-sm focus:ring-blue-500 focus:border-blue-500 block w-full sm:text-sm border-gray-300 rounded-md"
                      value={leagueTableLink}
                      onChange={(e) => setLeagueTableLink(e.target.value)}
                    />
                  </div>
                </div>

                <div>
                  <label htmlFor="team_link" className="block text-sm font-medium text-gray-700">
                    Team Website Link (optional)
                  </label>
                  <div className="mt-1">
                    <input
                      type="url"
                      name="team_link"
                      id="team_link"
                      className="shadow-sm focus:ring-blue-500 focus:border-blue-500 block w-full sm:text-sm border-gray-300 rounded-md"
                      value={teamLink}
                      onChange={(e) => setTeamLink(e.target.value)}
                    />
                  </div>
                </div>

                <div className="flex justify-end">
                  <Link
                    href={`/leagues/${league.id}`}
                    className="inline-flex items-center px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 mr-3"
                  >
                    Cancel
                  </Link>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                  >
                    {submitting ? (
                      <>
                        <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        Saving...
                      </>
                    ) : (
                      'Save Changes'
                    )}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
} 