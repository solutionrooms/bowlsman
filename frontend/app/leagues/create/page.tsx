'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import api from '../../../src/lib/axios';
import Navigation from '../../components/Navigation';
import Link from 'next/link';

interface User {
  id: number;
  username: string;
  email: string;
  first_name: string;
  last_name: string;
  display_name?: string;
  search_name?: string;
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

interface AdminStatusResponse {
  club_id: number;
  is_admin: boolean;
  username: string;
  error?: string;
}

interface ClubUserResponse {
  id: number;
  user: User | number;
  club: number;
  club_name: string;
  is_admin: boolean;
  created_at: string;
  last_login_at: string;
  user_details?: {
    id: number;
    username: string;
    display_name: string;
  };
}

export default function CreateTeamPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentClub, setCurrentClub] = useState<Club | null>(null);
  const [userClubs, setUserClubs] = useState<Club[]>([]);
  const [adminClubs, setAdminClubs] = useState<Club[]>([]);
  const [clubMembers, setClubMembers] = useState<User[]>([]);
  
  // Form state
  const [name, setName] = useState('');
  const [season, setSeason] = useState(new Date().getFullYear().toString());
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
        const current_club = userData.current_club;
        const clubs = userData.clubs || [];
        
        setUserClubs(clubs);
        setCurrentClub(current_club);
        
        // Filter clubs where user is admin
        const adminClubsList = clubs.filter(club => club.is_admin);
        setAdminClubs(adminClubsList);
        
        if (current_club) {
          // Fetch club members for the current club
          await fetchClubMembers(current_club.id);
        }
        
        setLoading(false);
      } catch (err: any) {
        console.error('Error fetching user data:', err);
        setError('Failed to load user data: ' + (err.response?.data?.error || err.message));
        setLoading(false);
      }
    };
    
    fetchData();
  }, []);

  const fetchClubMembers = async (clubId: number) => {
    try {
      // Fetch club members
      const membersResponse = await api.get<ClubUserResponse[]>(
        `/clubs/${clubId}/members`,
        {}
      );
      
      // Extract user details and add search_name for filtering
      const members = membersResponse.data.map(member => {
        let user: User;
        
        if (typeof member.user === 'number') {
          // If user is just an ID, use user_details
          if (!member.user_details) {
            throw new Error('User details missing');
          }
          
          user = {
            id: member.user_details.id,
            username: member.user_details.username,
            email: '',
            first_name: '',
            last_name: '',
            display_name: member.user_details.display_name
          };
        } else {
          // If user is a full object
          user = member.user;
        }
        
        // Add search_name for filtering
        user.search_name = (user.display_name || `${user.first_name} ${user.last_name} ${user.username}`).toLowerCase();
        
        return user;
      });
      
      setClubMembers(members);
      setSelectedCaptain(null);
      setSelectedDeputy(null);
      setSelectedCaptainUser(null);
      setSelectedDeputyUser(null);
      setCaptainSearchText('');
      setDeputySearchText('');
    } catch (err: any) {
      console.error('Error fetching club members:', err);
      setError('Failed to load club members: ' + (err.response?.data?.error || err.message));
    }
  };

  // Filter captains based on search text
  useEffect(() => {
    if (!captainSearchText.trim() && clubMembers.length) {
      // Show all club members when search text is empty
      setFilteredCaptains(clubMembers);
      setShowCaptainDropdown(true);
      return;
    } else if (!clubMembers.length) {
      setFilteredCaptains([]);
      setShowCaptainDropdown(false);
      return;
    }

    const searchTerm = captainSearchText.toLowerCase();
    const filtered = clubMembers.filter(member => 
      member.search_name?.includes(searchTerm)
    );
    
    setFilteredCaptains(filtered);
    setShowCaptainDropdown(filtered.length > 0);
  }, [captainSearchText, clubMembers]);

  // Filter deputies based on search text
  useEffect(() => {
    if (!deputySearchText.trim() && clubMembers.length) {
      // Show all club members when search text is empty (except the selected captain)
      const filtered = clubMembers.filter(member => member.id !== selectedCaptain);
      setFilteredDeputies(filtered);
      setShowDeputyDropdown(true);
      return;
    } else if (!clubMembers.length) {
      setFilteredDeputies([]);
      setShowDeputyDropdown(false);
      return;
    }

    // Exclude the selected captain from deputy options
    const searchTerm = deputySearchText.toLowerCase();
    const filtered = clubMembers.filter(member => 
      member.search_name?.includes(searchTerm) && 
      member.id !== selectedCaptain
    );
    
    setFilteredDeputies(filtered);
    setShowDeputyDropdown(filtered.length > 0);
  }, [deputySearchText, clubMembers, selectedCaptain]);

  const handleSelectCaptain = (user: User) => {
    setSelectedCaptain(user.id);
    setSelectedCaptainUser(user);
    setCaptainSearchText(user.display_name || `${user.first_name} ${user.last_name}`);
    setShowCaptainDropdown(false);
    
    // If the selected captain was previously selected as deputy, clear deputy
    if (selectedDeputy === user.id) {
      setSelectedDeputy(null);
      setSelectedDeputyUser(null);
      setDeputySearchText('');
    }
  };

  const handleSelectDeputy = (user: User) => {
    setSelectedDeputy(user.id);
    setSelectedDeputyUser(user);
    setDeputySearchText(user.display_name || `${user.first_name} ${user.last_name}`);
    setShowDeputyDropdown(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!name || !season || !currentClub || !selectedCaptain) {
      setError('Please fill in all required fields');
      return;
    }
    
    try {
      setSubmitting(true);
      setError(null);
      
      const leagueData = {
        name,
        season,
        club_id: currentClub.id,
        captain_id: selectedCaptain,
        deputy_id: selectedDeputy || null,
        league_table_link: leagueTableLink || null,
        team_link: teamLink || null
      };
      
      await api.post('leagues/', leagueData);
      
      // Redirect to leagues page
      router.push('/leagues');
    } catch (err: any) {
      console.error('Error creating league:', err);
      setError('Failed to create league: ' + (err.response?.data?.error || err.message));
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

  return (
    <div className="min-h-screen bg-gray-100">
      <Navigation onLogout={handleLogout} />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-6">
          <div className="flex justify-between items-center">
            <h1 className="text-2xl font-bold">Create Team</h1>
            <Link
              href="/leagues"
              className="inline-flex items-center px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-md text-blue-700 bg-blue-100 hover:bg-blue-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              ← Back to Teams
            </Link>
          </div>
          <p className="text-gray-500">Create a new team for your club</p>
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
        
        {!currentClub ? (
          <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 mb-6">
            <div className="flex">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5 text-yellow-400" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="ml-3">
                <p className="text-sm text-yellow-700">
                  You need to be a member of a club to create a team. Please join or create a club first.
                </p>
              </div>
            </div>
          </div>
        ) : !currentClub.is_admin ? (
          <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 mb-6">
            <div className="flex">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5 text-yellow-400" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="ml-3">
                <p className="text-sm text-yellow-700">
                  You need to be an admin of {currentClub.name} to create a team.
                </p>
              </div>
            </div>
          </div>
        ) : (
          <div className="bg-white shadow overflow-hidden sm:rounded-lg">
            <div className="px-4 py-5 sm:p-6">
              <form onSubmit={handleSubmit}>
                <div className="space-y-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700">
                      Club
                    </label>
                    <div className="mt-1 p-2 bg-gray-100 rounded-md text-gray-700">
                      {currentClub.name}
                    </div>
                  </div>
                  
                  <div>
                    <label htmlFor="name" className="block text-sm font-medium text-gray-700">
                      Team Name <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      name="name"
                      id="name"
                      className="mt-1 focus:ring-blue-500 focus:border-blue-500 block w-full shadow-sm sm:text-sm border-gray-300 rounded-md"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      required
                    />
                  </div>
                  
                  <div>
                    <label htmlFor="season" className="block text-sm font-medium text-gray-700">
                      Season <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      name="season"
                      id="season"
                      className="mt-1 focus:ring-blue-500 focus:border-blue-500 block w-full shadow-sm sm:text-sm border-gray-300 rounded-md"
                      value={season}
                      onChange={(e) => setSeason(e.target.value)}
                      required
                    />
                    <p className="mt-1 text-sm text-gray-500">
                      Usually the year, e.g., "2023"
                    </p>
                  </div>
                  
                  <div>
                    <label htmlFor="captain" className="block text-sm font-medium text-gray-700">
                      Captain <span className="text-red-500">*</span>
                    </label>
                    <div className="relative mt-1">
                      <input
                        type="text"
                        id="captain"
                        name="captain"
                        className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                        placeholder="Search for a captain"
                        value={captainSearchText}
                        onChange={(e) => setCaptainSearchText(e.target.value)}
                        onClick={() => setShowCaptainDropdown(true)}
                        required
                      />
                      {showCaptainDropdown && (
                        <div className="absolute z-10 w-full mt-1 bg-white shadow-lg rounded-md border border-gray-200 max-h-60 overflow-y-auto">
                          {filteredCaptains.length > 0 ? (
                            filteredCaptains.map(user => (
                              <div
                                key={user.id}
                                className="px-4 py-2 hover:bg-gray-100 cursor-pointer"
                                onClick={() => handleSelectCaptain(user)}
                              >
                                {user.first_name} {user.last_name} ({user.username})
                              </div>
                            ))
                          ) : (
                            <div className="px-4 py-2 text-gray-500">No matching members found</div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                  
                  <div>
                    <label htmlFor="deputy" className="block text-sm font-medium text-gray-700">
                      Deputy (Optional)
                    </label>
                    <div className="relative mt-1">
                      <input
                        type="text"
                        id="deputy"
                        name="deputy"
                        className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                        placeholder="Search for a deputy"
                        value={deputySearchText}
                        onChange={(e) => setDeputySearchText(e.target.value)}
                        onClick={() => setShowDeputyDropdown(true)}
                        disabled={!selectedCaptain}
                      />
                      {showDeputyDropdown && (
                        <div className="absolute z-10 w-full mt-1 bg-white shadow-lg rounded-md border border-gray-200 max-h-60 overflow-y-auto">
                          {filteredDeputies.length > 0 ? (
                            filteredDeputies.map(user => (
                              <div
                                key={user.id}
                                className="px-4 py-2 hover:bg-gray-100 cursor-pointer"
                                onClick={() => handleSelectDeputy(user)}
                              >
                                {user.first_name} {user.last_name} ({user.username})
                              </div>
                            ))
                          ) : (
                            <div className="px-4 py-2 text-gray-500">No matching members found</div>
                          )}
                        </div>
                      )}
                    </div>
                    {selectedCaptain && !selectedDeputy && (
                      <p className="mt-1 text-sm text-gray-500">
                        Select a different member than the captain
                      </p>
                    )}
                  </div>
                  
                  <div>
                    <label htmlFor="leagueTableLink" className="block text-sm font-medium text-gray-700">
                      League Table Link (Optional)
                    </label>
                    <input
                      type="url"
                      name="leagueTableLink"
                      id="leagueTableLink"
                      className="mt-1 focus:ring-blue-500 focus:border-blue-500 block w-full shadow-sm sm:text-sm border-gray-300 rounded-md"
                      value={leagueTableLink}
                      onChange={(e) => setLeagueTableLink(e.target.value)}
                      placeholder="https://example.com/league-table"
                    />
                    <p className="mt-1 text-sm text-gray-500">
                      URL to the league's standings/table
                    </p>
                  </div>
                  
                  <div>
                    <label htmlFor="teamLink" className="block text-sm font-medium text-gray-700">
                      Team Link (Optional)
                    </label>
                    <input
                      type="url"
                      name="teamLink"
                      id="teamLink"
                      className="mt-1 focus:ring-blue-500 focus:border-blue-500 block w-full shadow-sm sm:text-sm border-gray-300 rounded-md"
                      value={teamLink}
                      onChange={(e) => setTeamLink(e.target.value)}
                      placeholder="https://example.com/team-page"
                    />
                    <p className="mt-1 text-sm text-gray-500">
                      URL to the team's website or page
                    </p>
                  </div>
                  
                  <div className="flex justify-end">
                    <Link
                      href="/leagues"
                      className="mr-3 inline-flex justify-center py-2 px-4 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                    >
                      Cancel
                    </Link>
                    <button
                      type="submit"
                      disabled={submitting}
                      className="inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                    >
                      {submitting ? 'Creating...' : 'Create Team'}
                    </button>
                  </div>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
} 