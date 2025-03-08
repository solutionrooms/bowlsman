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

export default function CreateLeaguePage() {
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
  const [selectedClub, setSelectedClub] = useState<number | null>(null);
  const [selectedCaptain, setSelectedCaptain] = useState<number | null>(null);
  const [selectedDeputy, setSelectedDeputy] = useState<number | null>(null);
  
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
        let adminClubsList = clubs.filter(club => club.is_admin);
        
        // Log admin status for debugging
        console.log('Current club:', current_club);
        console.log('User clubs:', clubs);
        console.log('Admin clubs from clubs array:', adminClubsList);
        
        // If current club exists, always check with backend directly
        if (current_club) {
          try {
            const adminCheckResponse = await api.get<AdminStatusResponse>(`club-admin-status?club_id=${current_club.id}`);
            console.log('Admin status check from backend:', adminCheckResponse.data);
            
            // If backend says user is admin but it's not in adminClubsList, add it
            if (adminCheckResponse.data.is_admin) {
              const alreadyInList = adminClubsList.some(club => club.id === current_club.id);
              if (!alreadyInList) {
                // Add current club to admin clubs list with is_admin set to true
                const updatedClub = { ...current_club, is_admin: true };
                adminClubsList = [...adminClubsList, updatedClub];
                console.log('Updated admin clubs list:', adminClubsList);
              }
            }
          } catch (err) {
            console.error('Error checking admin status:', err);
          }
        }
        
        setAdminClubs(adminClubsList);
        
        // If user has only one admin club, select it by default
        if (adminClubsList.length === 1) {
          setSelectedClub(adminClubsList[0].id);
          await fetchClubMembers(adminClubsList[0].id);
        }
        
        setLoading(false);
      } catch (err: any) {
        console.error('Error fetching data:', err);
        setError('Failed to load data: ' + (err.response?.data?.error || err.message));
        setLoading(false);
      }
    };
    
    fetchData();
  }, []);

  const fetchClubMembers = async (clubId: number) => {
    try {
      const response = await api.get<ClubUserResponse[]>(`club-users?club_id=${clubId}`);
      
      // Extract user data from the response
      const members = response.data.map((cu) => {
        // Handle both old and new response formats
        if (typeof cu.user === 'object') {
          return cu.user;
        } else {
          // If we get the old format, create a basic user object
          return {
            id: cu.user as number,
            username: cu.user_details?.username || '',
            email: '',
            first_name: cu.user_details?.display_name?.split(' ')[0] || '',
            last_name: cu.user_details?.display_name?.split(' ')[1] || '',
            display_name: cu.user_details?.display_name || '',
            search_name: (cu.user_details?.display_name || '').toLowerCase()
          };
        }
      });
      
      // Add display_name and search_name to each user if not already present
      const enhancedMembers = members.map(member => ({
        ...member,
        display_name: member.display_name || `${member.first_name} ${member.last_name} (${member.username})`,
        search_name: member.search_name || `${member.first_name} ${member.last_name} ${member.username}`.toLowerCase()
      }));
      
      setClubMembers(enhancedMembers);
      
      // Reset selections
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

  const handleClubChange = async (e: React.ChangeEvent<HTMLSelectElement>) => {
    const clubId = Number(e.target.value);
    setSelectedClub(clubId);
    setSelectedCaptain(null);
    setSelectedDeputy(null);
    
    if (clubId) {
      await fetchClubMembers(clubId);
    } else {
      setClubMembers([]);
    }
  };

  // Filter captains based on search text
  useEffect(() => {
    if (!captainSearchText.trim() || !clubMembers.length) {
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
    if (!deputySearchText.trim() || !clubMembers.length) {
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
    
    if (!name || !season || !selectedClub || !selectedCaptain) {
      setError('Please fill in all required fields');
      return;
    }
    
    try {
      setSubmitting(true);
      setError(null);
      
      // Double-check admin status before submitting
      try {
        const adminCheckResponse = await api.get<AdminStatusResponse>(`club-admin-status?club_id=${selectedClub}`);
        console.log('Admin status check before submit:', adminCheckResponse.data);
        
        if (!adminCheckResponse.data.is_admin) {
          setError('You must be a club admin to create a league. The backend reports you are not an admin for this club.');
          setSubmitting(false);
          return;
        }
      } catch (err) {
        console.error('Error checking admin status:', err);
        // Continue with submission even if admin check fails
      }
      
      const leagueData = {
        name,
        season,
        club_id: selectedClub,
        captain_id: selectedCaptain,
        deputy_id: selectedDeputy || null
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
        <div className="mb-6 flex justify-between items-center">
          <h1 className="text-2xl font-bold">Create New League</h1>
          <Link
            href="/leagues"
            className="inline-flex items-center px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-md text-blue-700 bg-blue-100 hover:bg-blue-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
          >
            ← Back to Leagues
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
        
        {adminClubs.length === 0 ? (
          <div className="bg-white shadow overflow-hidden sm:rounded-lg p-6">
            <div className="text-center">
              <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
              <h3 className="mt-2 text-sm font-medium text-gray-900">Permission Denied</h3>
              <p className="mt-1 text-sm text-gray-500">
                You must be a club administrator to create leagues.
              </p>
            </div>
          </div>
        ) : (
          <div className="bg-white shadow overflow-hidden sm:rounded-lg">
            <div className="px-4 py-5 sm:p-6">
              <form onSubmit={handleSubmit}>
                <div className="space-y-6">
                  <div>
                    <label htmlFor="club" className="block text-sm font-medium text-gray-700">
                      Club <span className="text-red-500">*</span>
                    </label>
                    <select
                      id="club"
                      name="club"
                      className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm rounded-md"
                      value={selectedClub || ''}
                      onChange={handleClubChange}
                      required
                    >
                      <option value="">Select a club</option>
                      {adminClubs.map(club => (
                        <option key={club.id} value={club.id}>
                          {club.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  
                  <div>
                    <label htmlFor="name" className="block text-sm font-medium text-gray-700">
                      League Name <span className="text-red-500">*</span>
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
                        placeholder={selectedClub ? "Search for a captain" : "Select a club first"}
                        value={captainSearchText}
                        onChange={(e) => setCaptainSearchText(e.target.value)}
                        onClick={() => selectedClub && setShowCaptainDropdown(true)}
                        disabled={!selectedClub}
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
                        placeholder={selectedClub ? "Search for a deputy" : "Select a club first"}
                        value={deputySearchText}
                        onChange={(e) => setDeputySearchText(e.target.value)}
                        onClick={() => selectedClub && setShowDeputyDropdown(true)}
                        disabled={!selectedClub || !selectedCaptain}
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
                      {submitting ? 'Creating...' : 'Create League'}
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