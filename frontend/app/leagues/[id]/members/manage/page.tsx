'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import api from '../../../../../src/lib/axios';
import Navigation from '../../../../components/Navigation';
import PageHeading from '../../../../components/PageHeading';
import { canManageTeam } from '../../../../../src/utils/permissions';

interface User {
  id: number;
  first_name: string;
  last_name: string;
  username: string;
  display_name?: string;
}

interface LeagueMember {
  id: number;
  user: User;
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
  captain: User | null;
  deputy: User | null;
  members: LeagueMember[];
  team_link?: string;
}

interface Club {
  id: number;
  name: string;
  is_admin: boolean;
}

interface ClubMember {
  id: number;
  username: string;
  email: string;
  first_name: string;
  last_name: string;
  is_active: boolean;
  is_staff: boolean;
  joined_at?: string;
}

interface ImportedPlayer {
  first_name: string;
  last_name: string;
  full_name: string;
  mapped_user_id?: number;
  mapped_user_name?: string;
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

export default function ManageTeamMembersPage() {
  const router = useRouter();
  const params = useParams();
  const [league, setLeague] = useState<League | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchText, setSearchText] = useState('');
  const [showDropdown, setShowDropdown] = useState(false);
  const [clubMembers, setClubMembers] = useState<ClubMember[]>([]);
  const [filteredMembers, setFilteredMembers] = useState<ClubMember[]>([]);
  const [addingMember, setAddingMember] = useState(false);
  const [removingMember, setRemovingMember] = useState<number | null>(null);
  const [importedPlayers, setImportedPlayers] = useState<ImportedPlayer[]>([]);
  const [importLoading, setImportLoading] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const [mappingUser, setMappingUser] = useState<{playerId: string, searchText: string}>({
    playerId: '',
    searchText: ''
  });
  const [showMappingDropdown, setShowMappingDropdown] = useState(false);
  const [filteredMappingUsers, setFilteredMappingUsers] = useState<ClubMember[]>([]);
  const isMounted = useRef(true);
  const [userClubs, setUserClubs] = useState<Club[]>([]);
  const [userId, setUserId] = useState<number | null>(null);
  const [hasPermission, setHasPermission] = useState(false);
  const [permissionChecked, setPermissionChecked] = useState(false);

  useEffect(() => {
    // Set isMounted to true when component mounts
    isMounted.current = true;
    
    // Set isMounted to false when component unmounts
    return () => {
      isMounted.current = false;
    };
  }, []);

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

        // Get user data first to check permissions
        const userResponse = await api.get<UserData>('users/me');
        const userData = userResponse.data;
        const clubs = userData.clubs || [];
        setUserClubs(clubs);
        setUserId(userData.user.id);

        // Get league details
        const leagueResponse = await api.get<League>(`leagues/${params.id}`);
        setLeague(leagueResponse.data);

        // Check if user has permission to manage this team
        const canManage = canManageTeam(userData.user.id, leagueResponse.data, clubs);
        setHasPermission(canManage);
        setPermissionChecked(true);

        // If user doesn't have permission, we'll redirect in another useEffect
        // but still continue loading the data in case they do have permission

        // Get club members
        const clubMembersResponse = await api.get<ClubMember[]>(`clubs/${leagueResponse.data.club.id}/members`);
        console.log('Club Members API Response:', clubMembersResponse.data);
        setClubMembers(clubMembersResponse.data);
        
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
      router.push(`/leagues/${league.id}?error=You do not have permission to manage this team`);
    }
  }, [permissionChecked, hasPermission, loading, league, router]);

  // Add a separate effect to refresh club members periodically
  useEffect(() => {
    // Refresh club members when the component mounts
    if (league && !loading) {
      refreshClubMembers();
    }
  }, [league?.id]); // Only run when league ID changes or is first set

  useEffect(() => {
    // Log the club members data structure when it changes
    console.log('Club Members Data Structure:', JSON.stringify(clubMembers, null, 2));
    console.log('Number of Club Members:', clubMembers.length);
  }, [clubMembers]);

  useEffect(() => {
    // If search text is empty but dropdown is shown, show all available members
    if (!searchText) {
      if (showDropdown) {
        // Show all members not already in the league
        const leagueMemberIds = new Set(league?.members?.map(m => m?.user?.id) || []);
        const available = clubMembers.filter(member => 
          member && member.id && !leagueMemberIds.has(member.id)
        );
        setFilteredMembers(available.slice(0, 10)); // Limit to first 10 for performance
      } else {
        setFilteredMembers([]);
      }
      return;
    }

    const searchLower = searchText.toLowerCase();
    const leagueMemberIds = new Set(league?.members?.map(m => m?.user?.id) || []);
    
    // Reduce console logging to improve performance
    // console.log('League Member IDs:', Array.from(leagueMemberIds));
    
    const filtered = clubMembers.filter(member => {
      // Check if member has the necessary properties
      if (!member || !member.id || !member.username) {
        // console.log('Invalid member data:', member);
        return false;
      }
      
      // Don't show members already in the league
      if (leagueMemberIds.has(member.id)) {
        // console.log('Member already in league:', member.id, member.first_name, member.last_name);
        return false;
      }

      // If search is just 1-2 characters, be more lenient
      if (searchLower.length <= 2) {
        const fullName = `${member.first_name || ''} ${member.last_name || ''}`.toLowerCase();
        const username = (member.username || '').toLowerCase();
        
        return fullName.startsWith(searchLower) || 
               member.first_name?.toLowerCase().startsWith(searchLower) || 
               member.last_name?.toLowerCase().startsWith(searchLower) || 
               username.startsWith(searchLower);
      }

      // Normal search for 3+ characters
      const fullName = `${member.first_name || ''} ${member.last_name || ''}`.toLowerCase();
      const username = (member.username || '').toLowerCase();
      
      // Reduce console logging to improve performance
      // console.log('Checking member for search:', { 
      //   id: member.id,
      //   fullName, 
      //   username, 
      //   searchLower,
      //   matches: fullName.includes(searchLower) || username.includes(searchLower)
      // });
      
      return fullName.includes(searchLower) || username.includes(searchLower);
    });

    // console.log('Filtered Results for Add:', filtered);
    setFilteredMembers(filtered);
  }, [searchText, clubMembers, league?.members, showDropdown]);

  const handleAddMember = async (memberId: number) => {
    if (!league) return;
    
    try {
      setAddingMember(true);
      setError(null);

      await api.post(`league-members`, {
        user_id: memberId,
        league: league.id
      });
      
      // Refresh league data to get updated members list
      const leagueResponse = await api.get<League>(`leagues/${league.id}`);
      setLeague(leagueResponse.data);

      setSearchText('');
      setShowDropdown(false);
    } catch (err: any) {
      console.error('Error adding member:', err);
      setError('Failed to add member: ' + (err.response?.data?.error || err.message));
    } finally {
      setAddingMember(false);
    }
  };

  const handleRemoveMember = async (memberId: number) => {
    if (!league) return;
    
    try {
      setRemovingMember(memberId);
      setError(null);

      await api.delete(`league-members/${memberId}`);
      
      // Refresh league data to get updated members list
      const leagueResponse = await api.get<League>(`leagues/${league.id}`);
      setLeague(leagueResponse.data);
    } catch (err: any) {
      console.error('Error removing member:', err);
      setError('Failed to remove member: ' + (err.response?.data?.error || err.message));
    } finally {
      setRemovingMember(null);
    }
  };

  const handleImportMembers = async () => {
    if (!league?.team_link) {
      setImportError('No team website link configured. Please add a team website link first.');
      return;
    }

    try {
      setImportLoading(true);
      setImportError(null);

      const response = await api.get<ImportedPlayer[]>(`leagues/${league.id}/fetch_team_members`);
      setImportedPlayers(response.data);
    } catch (err: any) {
      console.error('Error importing members:', err);
      setImportError('Failed to import members: ' + (err.response?.data?.error || err.message));
    } finally {
      setImportLoading(false);
    }
  };

  useEffect(() => {
    // If search text is empty but dropdown is shown, show all available members
    if (!mappingUser.searchText) {
      if (showMappingDropdown) {
        // console.log('Showing all club members for mapping (first 10):', clubMembers.slice(0, 10));
        setFilteredMappingUsers(clubMembers.slice(0, 10)); // Limit to first 10 for performance
      } else {
        setFilteredMappingUsers([]);
      }
      return;
    }

    // console.log('Mapping Search Text:', mappingUser.searchText);
    // console.log('Total Club Members to search through:', clubMembers.length);
    
    const searchLower = mappingUser.searchText.toLowerCase();
    const filtered = clubMembers.filter(member => {
      // Check if member has the necessary properties
      if (!member || !member.id || !member.username) {
        // console.log('Invalid member data (mapping):', member);
        return false;
      }
      
      // If search is just 1-2 characters, be more lenient
      if (searchLower.length <= 2) {
        const fullName = `${member.first_name || ''} ${member.last_name || ''}`.toLowerCase();
        const username = (member.username || '').toLowerCase();
        
        const matches = fullName.startsWith(searchLower) || 
                       member.first_name?.toLowerCase().startsWith(searchLower) || 
                       member.last_name?.toLowerCase().startsWith(searchLower) || 
                       username.startsWith(searchLower);
                       
        // if (matches) {
        //   console.log('Match found for short search:', { 
        //     id: member.id,
        //     fullName,
        //     username,
        //     searchLower
        //   });
        // }
        
        return matches;
      }
      
      // Normal search for 3+ characters
      const fullName = `${member.first_name || ''} ${member.last_name || ''}`.toLowerCase();
      const username = (member.username || '').toLowerCase();
      
      const matches = fullName.includes(searchLower) || username.includes(searchLower);
      
      // console.log('Checking member for mapping:', { 
      //   id: member.id,
      //   fullName, 
      //   username, 
      //   searchLower,
      //   matches
      // });
      
      return matches;
    });

    // console.log('Filtered Results for Mapping:', filtered);
    setFilteredMappingUsers(filtered);
  }, [mappingUser.searchText, clubMembers, showMappingDropdown]);

  const handleCreateMapping = async (importedPlayer: ImportedPlayer, userId: number) => {
    try {
      setError(null);

      // Create the name mapping
      await api.post(`leagues/${league?.id}/create_name_mapping`, {
        roster_first_name: importedPlayer.first_name,
        roster_last_name: importedPlayer.last_name,
        roster_full_name: importedPlayer.full_name,
        user_id: userId
      });

      // Refresh imported players to update mappings
      const response = await api.get<ImportedPlayer[]>(`leagues/${league?.id}/fetch_team_members`);
      setImportedPlayers(response.data);

      // Check if the user is already a team member
      // League members have a nested user object with id
      const isAlreadyMember = league?.members?.some(member => member.user?.id === userId);
      
      // Only try to add the user as a team member if they're not already a member
      if (!isAlreadyMember) {
        try {
          console.log(`Attempting to add user ${userId} as team member for league ${league?.id}`);
          
          const addMemberResponse = await api.post(`league-members`, {
            user_id: userId,
            league: league?.id
          });
          
          console.log('Successfully added mapped user as team member:', addMemberResponse.data);
          
          // Refresh league data to get updated members list
          const leagueResponse = await api.get<League>(`leagues/${league?.id}`);
          setLeague(leagueResponse.data);
        } catch (addError: any) {
          console.error('Error adding mapped user as team member:', addError);
          console.error('Error response:', addError.response?.data);
          
          // Don't show an error to the user for this part, as the mapping was successful
          // Just log it for debugging purposes
        }
      } else {
        console.log(`User ${userId} is already a member of league ${league?.id}, skipping add`);
      }

      // Clear mapping state
      setMappingUser({ playerId: '', searchText: '' });
      setShowMappingDropdown(false);
      
      // Show success message
      setError(null);
    } catch (err: any) {
      console.error('Error creating mapping:', err);
      setError('Failed to create mapping: ' + (err.response?.data?.error || err.message));
    }
  };

  const handleRemoveMapping = async (importedPlayer: ImportedPlayer) => {
    try {
      setError(null);

      await api.post(`leagues/${league?.id}/delete_name_mapping`, {
        roster_first_name: importedPlayer.first_name,
        roster_last_name: importedPlayer.last_name,
        roster_full_name: importedPlayer.full_name
      });

      // Refresh imported players to update mappings
      const response = await api.get<ImportedPlayer[]>(`leagues/${league?.id}/fetch_team_members`);
      setImportedPlayers(response.data);
    } catch (err: any) {
      console.error('Error removing mapping:', err);
      setError('Failed to remove mapping: ' + (err.response?.data?.error || err.message));
    }
  };

  const refreshClubMembers = async () => {
    if (!league) return;
    
    try {
      // Only set loading if this is a user-initiated refresh
      const wasLoading = loading;
      if (!wasLoading) {
        setLoading(true);
      }
      setError(null);
      
      console.log('Refreshing club members data...');
      
      // Get club members
      const clubMembersResponse = await api.get<ClubMember[]>(`clubs/${league.club.id}/members`);
      
      // Check if component is still mounted before updating state
      if (isMounted.current) {
        console.log('Club Members API Response:', clubMembersResponse.data);
        setClubMembers(clubMembersResponse.data);
        
        if (!wasLoading) {
          setLoading(false);
        }
      }
    } catch (err: any) {
      // Check if component is still mounted before updating state
      if (isMounted.current) {
        console.error('Error refreshing club members:', err);
        setError('Failed to refresh club members: ' + (err.response?.data?.error || err.message));
        setLoading(false);
      }
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
              title="Manage Team Members"
              infoText={`Manage members for ${league.name}`}
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

        <div className="space-y-6">
          {/* Import section */}
          <div className="bg-white shadow overflow-hidden sm:rounded-lg">
            <div className="px-4 py-5 sm:p-6">
              <h3 className="text-lg font-medium text-gray-900 mb-4">Import Team Members</h3>
              
              {!league?.team_link ? (
                <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4">
                  <div className="flex">
                    <div className="flex-shrink-0">
                      <svg className="h-5 w-5 text-yellow-400" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                      </svg>
                    </div>
                    <div className="ml-3">
                      <p className="text-sm text-yellow-700">
                        No team website link configured. Please add a team website link to enable importing.
                      </p>
                    </div>
                  </div>
                </div>
              ) : (
                <>
                  <div className="mb-4 flex space-x-2">
                    <button
                      type="button"
                      onClick={handleImportMembers}
                      disabled={importLoading}
                      className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                    >
                      {importLoading ? (
                        <>
                          <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                          </svg>
                          Importing...
                        </>
                      ) : (
                        'Import from Team Website'
                      )}
                    </button>
                    
                    <button
                      type="button"
                      onClick={refreshClubMembers}
                      disabled={loading}
                      className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md shadow-sm text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                    >
                      {loading ? (
                        <>
                          <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-gray-700" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                          </svg>
                          Refreshing...
                        </>
                      ) : (
                        'Refresh Club Members'
                      )}
                    </button>
                  </div>

                  {importError && (
                    <div className="mb-4 bg-red-50 border-l-4 border-red-400 p-4">
                      <div className="flex">
                        <div className="flex-shrink-0">
                          <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                          </svg>
                        </div>
                        <div className="ml-3">
                          <p className="text-sm text-red-700">{importError}</p>
                        </div>
                      </div>
                    </div>
                  )}

                  {importedPlayers.length > 0 && (
                    <div className="mt-4">
                      <h4 className="text-sm font-medium text-gray-900 mb-2">Imported Players</h4>
                      <div className="overflow-hidden shadow ring-1 ring-black ring-opacity-5 sm:rounded-lg">
                        <table className="min-w-full divide-y divide-gray-300">
                          <thead className="bg-gray-50">
                            <tr>
                              <th scope="col" className="py-3.5 pl-4 pr-3 text-left text-sm font-semibold text-gray-900">Name from Website</th>
                              <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">Mapped To</th>
                              <th scope="col" className="relative py-3.5 pl-3 pr-4 sm:pr-6">
                                <span className="sr-only">Actions</span>
                              </th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-200 bg-white">
                            {importedPlayers.map((player) => (
                              <tr key={player.full_name}>
                                <td className="whitespace-nowrap py-4 pl-4 pr-3 text-sm font-medium text-gray-900">
                                  {player.full_name}
                                </td>
                                <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                                  {player.mapped_user_id ? (
                                    player.mapped_user_name
                                  ) : (
                                    <div className="relative">
                                      <input
                                        type="text"
                                        className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                                        placeholder="Search for a member..."
                                        value={mappingUser.playerId === player.full_name ? mappingUser.searchText : ''}
                                        onChange={(e) => setMappingUser({
                                          playerId: player.full_name,
                                          searchText: e.target.value
                                        })}
                                        onClick={(e) => {
                                          e.stopPropagation(); // Prevent event bubbling
                                          setMappingUser({
                                            playerId: player.full_name,
                                            searchText: mappingUser.playerId === player.full_name ? mappingUser.searchText : ''
                                          });
                                          setShowMappingDropdown(true);
                                          // Don't call refreshClubMembers here as it causes re-render
                                        }}
                                        onFocus={() => {
                                          if (!showMappingDropdown) {
                                            setShowMappingDropdown(true);
                                          }
                                        }}
                                        onBlur={(e) => {
                                          // Only hide dropdown if not clicking on a dropdown item
                                          if (!e.relatedTarget || !e.relatedTarget.closest('.mapping-dropdown-item')) {
                                            setTimeout(() => setShowMappingDropdown(false), 200);
                                          }
                                        }}
                                      />
                                      {showMappingDropdown && mappingUser.playerId === player.full_name && (
                                        <div className="absolute z-10 mt-1 w-full bg-white shadow-lg max-h-60 rounded-md py-1 text-base ring-1 ring-black ring-opacity-5 overflow-auto focus:outline-none sm:text-sm">
                                          {filteredMappingUsers.length > 0 ? (
                                            filteredMappingUsers.map((member) => (
                                              <button
                                                key={member.id}
                                                className="w-full text-left px-4 py-2 hover:bg-gray-100 mapping-dropdown-item"
                                                onClick={() => handleCreateMapping(player, member.id)}
                                              >
                                                <div className="flex items-center">
                                                  <div>
                                                    <p className="text-sm font-medium text-gray-900">
                                                      {member.first_name} {member.last_name}
                                                    </p>
                                                    <p className="text-sm text-gray-500">
                                                      {member.username}
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
                                    </div>
                                  )}
                                </td>
                                <td className="relative whitespace-nowrap py-4 pl-3 pr-4 text-right text-sm font-medium sm:pr-6">
                                  {player.mapped_user_id && (
                                    <button
                                      type="button"
                                      onClick={() => handleRemoveMapping(player)}
                                      className="text-red-600 hover:text-red-900"
                                    >
                                      Remove Mapping
                                    </button>
                                  )}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>

          {/* Existing add member section */}
          <div className="bg-white shadow overflow-hidden sm:rounded-lg">
            <div className="px-4 py-5 sm:p-6">
              <div className="mb-6">
                <label htmlFor="search" className="block text-sm font-medium text-gray-700">
                  Add Team Member
                </label>
                <div className="mt-1 relative">
                  <input
                    type="text"
                    name="search"
                    id="search"
                    className="shadow-sm focus:ring-blue-500 focus:border-blue-500 block w-full sm:text-sm border-gray-300 rounded-md"
                    placeholder="Search for club members to add..."
                    value={searchText}
                    onChange={(e) => setSearchText(e.target.value)}
                    onClick={() => {
                      setShowDropdown(true);
                      // Don't call any other functions here that might cause re-renders
                    }}
                    onBlur={(e) => {
                      // Only hide dropdown if not clicking on a dropdown item
                      if (!e.relatedTarget || !e.relatedTarget.closest('.search-dropdown-item')) {
                        setTimeout(() => setShowDropdown(false), 200);
                      }
                    }}
                  />
                  {showDropdown && (
                    <div className="absolute z-10 mt-1 w-full bg-white shadow-lg max-h-60 rounded-md py-1 text-base ring-1 ring-black ring-opacity-5 overflow-auto focus:outline-none sm:text-sm">
                      {filteredMembers.length > 0 ? (
                        filteredMembers.map((member) => (
                          <button
                            key={member.id}
                            className="w-full text-left px-4 py-2 hover:bg-gray-100 search-dropdown-item"
                            onClick={() => handleAddMember(member.id)}
                            disabled={addingMember}
                          >
                            <div className="flex items-center">
                              <div>
                                <p className="text-sm font-medium text-gray-900">
                                  {member.first_name} {member.last_name}
                                </p>
                                <p className="text-sm text-gray-500">
                                  {member.username}
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
                </div>
              </div>
            </div>
          </div>

          {/* Existing current members section */}
          <div className="bg-white shadow overflow-hidden sm:rounded-lg">
            <div className="px-4 py-5 sm:p-6">
              <div>
                <h3 className="text-lg font-medium text-gray-900 mb-4">Current Team Members</h3>
                {league.members.length > 0 ? (
                  <ul className="divide-y divide-gray-200">
                    {league.members.map((member) => (
                      <li key={member.id} className="py-4">
                        <div className="flex items-center justify-between">
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-gray-900">
                              {member.user.first_name} {member.user.last_name}
                            </p>
                            <p className="text-sm text-gray-500">
                              {member.user.username}
                            </p>
                            <p className="text-sm text-gray-500">
                              Joined {new Date(member.joined_at).toLocaleDateString()}
                            </p>
                          </div>
                          <div className="ml-4">
                            {/* Don't allow removing captain or deputy */}
                            {league.captain?.id !== member.user.id && 
                             league.deputy?.id !== member.user.id && (
                              <button
                                type="button"
                                className="inline-flex items-center px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-md text-red-700 bg-red-100 hover:bg-red-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
                                onClick={() => handleRemoveMember(member.id)}
                                disabled={removingMember === member.id}
                              >
                                {removingMember === member.id ? (
                                  <span>Removing...</span>
                                ) : (
                                  <span>Remove</span>
                                )}
                              </button>
                            )}
                          </div>
                        </div>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-gray-500">No members in this team yet</p>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
} 