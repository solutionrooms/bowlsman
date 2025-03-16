'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import { EllipsisVerticalIcon, XMarkIcon as XIcon, Bars3Icon as GripVerticalIcon } from '@heroicons/react/24/solid';
import Navigation from '../../components/Navigation';
import PageHeading from '../../components/PageHeading';
import pageDescriptions from '../../utils/pageDescriptions';
import api from '../../../src/lib/axios';
import { notification } from 'antd';
import React from 'react';

interface User {
  id: number;
  username: string;
  email: string;
  is_staff: boolean;
  first_name: string;
  last_name: string;
  display_name: string;
  search_name: string;
}

interface Player {
  id: number;
  username: string;
  guest_name: string | null;
  user: number | null;
  order: number;
}

interface Club {
  id: number;
  name: string;
}

interface Competition {
  id: number;
  name: string;
  created_at: string;
  num_players: number;
  creator_name: string;
  competition_type: number;
  competition_type_name: string;
  parallel_matches: number;
  max_rounds: number;
  is_full: boolean;
  players: Player[];
  available_slots: number;
  status: 'open' | 'full' | 'scheduled' | 'in_progress' | 'completed';
}

interface CompetitionSchedule {
  id: number;
  competition: number;
  round: number;
  sub_round: number;
  created_at: string;
  side_1_player_1: number;
  side_1_player_2: number;
  side_1_player_3: number;
  side_1_player_4: number;
  side_2_player_1: number;
  side_2_player_2: number;
  side_2_player_3: number;
  side_2_player_4: number;
}

interface CompetitionType {
  id: number;
  name: string;
  description: string;
}

const reorder = (list: Player[], startIndex: number, endIndex: number): Player[] => {
  const result = Array.from(list);
  const [removed] = result.splice(startIndex, 1);
  result.splice(endIndex, 0, removed);
  return result.map((item, index) => ({
    ...item,
    order: index + 1
  }));
};

export default function ManageCompetitions() {
  const [user, setUser] = useState<User | null>(null);
  const [competitions, setCompetitions] = useState<Competition[]>([]);
  const [editingCompetition, setEditingCompetition] = useState<Competition | null>(null);
  const [managingPlayers, setManagingPlayers] = useState<Competition | null>(null);
  const [viewingSchedule, setViewingSchedule] = useState<Competition | null>(null);
  const [schedules, setSchedules] = useState<CompetitionSchedule[]>([]);
  const [newPlayerName, setNewPlayerName] = useState('');
  const [error, setError] = useState('');
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [filteredUsers, setFilteredUsers] = useState<User[]>([]);
  const [showUserDropdown, setShowUserDropdown] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [mounted, setMounted] = useState(false);
  const [openMenuId, setOpenMenuId] = useState<number | null>(null);
  const [showAddPlayerModal, setShowAddPlayerModal] = useState(false);
  const [showReplacePlayerModal, setShowReplacePlayerModal] = useState(false);
  const [selectedPlayerToReplace, setSelectedPlayerToReplace] = useState<Player | null>(null);
  const [currentClub, setCurrentClub] = useState<Club | null>(null);
  const [userClubs, setUserClubs] = useState<Club[]>([]);
  const [competitionTypes, setCompetitionTypes] = useState<CompetitionType[]>([]);
  const router = useRouter();
  
  useEffect(() => {
    setMounted(true);
    
    // Close any open menu when component unmounts
    return () => {
      setOpenMenuId(null);
    };
  }, []);

  // Add click outside handler
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      // Only process if a menu is open
      if (openMenuId !== null) {
        // Get the actual target element
        const targetElement = event.target as Element;
        
        // Check if the click was on a menu toggle button
        const isMenuButton = targetElement.closest('[data-menu-button]');
        
        // Check if the click was inside a menu content
        const isInsideMenu = targetElement.closest('[data-menu-content]');
        
        // Only close the menu if the click was outside both menu button and menu content
        if (!isMenuButton && !isInsideMenu) {
          setOpenMenuId(null);
        }
      }
    }

    // Add event listener when dropdown is open
    if (openMenuId !== null) {
      // Use mousedown for better mobile compatibility
      document.addEventListener('mousedown', handleClickOutside);
      // Also add touchstart for mobile devices
      document.addEventListener('touchstart', handleClickOutside as EventListener);
    }
    
    // Clean up event listener
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside as EventListener);
    };
  }, [openMenuId]);

  useEffect(() => {
    if (!mounted) return;

    const token = localStorage.getItem('token');
    if (!token) {
      router.push('/');
      return;
    }

    // Get current club from localStorage
    const storedCurrentClub = localStorage.getItem('currentClub');
    if (storedCurrentClub) {
      try {
        setCurrentClub(JSON.parse(storedCurrentClub));
      } catch (e) {
        console.error('Error parsing stored club:', e);
      }
    }

    const fetchData = async () => {
      try {
        // First get user data
        const userResponse = await api.get<{user: User, clubs: Club[], current_club: Club | null}>('/users/me/');
        setUser(userResponse.data.user);
        
        // Set user clubs
        const clubs = userResponse.data.clubs || [];
        setUserClubs(clubs);
        
        // Update current club if needed
        if (userResponse.data.current_club && (!currentClub || currentClub.id !== userResponse.data.current_club.id)) {
          setCurrentClub(userResponse.data.current_club);
          localStorage.setItem('currentClub', JSON.stringify(userResponse.data.current_club));
        } else if (!userResponse.data.current_club && clubs.length > 0 && !currentClub) {
          // Default to first club if no current club
          setCurrentClub(clubs[0]);
          localStorage.setItem('currentClub', JSON.stringify(clubs[0]));
        }
        
        // Use the current club to filter competitions and users
        const clubId = currentClub?.id || (clubs.length > 0 ? clubs[0].id : null);
        
        const params = clubId ? { club_id: clubId } : {};
        
        // Get competitions, users, and competition types
        const [competitionsResponse, usersResponse, typesResponse] = await Promise.all([
          api.get<Competition[]>('/competitions/', { params }),
          api.get<User[]>('/users/', { params }),
          api.get<CompetitionType[]>('/competition-types/')
        ]);
        
        setCompetitions(competitionsResponse.data);
        setAllUsers(usersResponse.data);
        setCompetitionTypes(typesResponse.data);
      } catch (error) {
        console.error('Error fetching data:', error);
        router.push('/');
      }
    };

    fetchData();
  }, [mounted, currentClub?.id]);

  useEffect(() => {
    if (newPlayerName.trim() === '') {
      setFilteredUsers([]);
      setShowUserDropdown(false);
      return;
    }

    // Get IDs of users already in the competition
    const existingUserIds = managingPlayers?.players
      .filter(p => p.user !== null)
      .map(p => p.user) || [];
    
    // When replacing a player, we need to exclude all players except the one being replaced
    let filteredIds = existingUserIds;
    if (selectedPlayerToReplace && selectedPlayerToReplace.user) {
      // Remove the selected player's ID from the exclusion list
      filteredIds = existingUserIds.filter(id => id !== selectedPlayerToReplace.user);
    }

    // Filter users by name and exclude those already in the competition
    const filtered = allUsers.filter(u => 
      u.search_name.includes(newPlayerName.toLowerCase()) && 
      !filteredIds.includes(u.id)
    );
    
    setFilteredUsers(filtered);
    setShowUserDropdown(filtered.length > 0);
  }, [newPlayerName, allUsers, managingPlayers, selectedPlayerToReplace]);

  const handleDelete = async (id: number) => {
    if (!confirm('Are you sure you want to delete this competition?')) return;
    
    try {
      await api.delete(`/competitions/${id}/`);
      setCompetitions(competitions.filter(comp => comp.id !== id));
    } catch (error) {
      console.error('Error deleting competition:', error);
    }
  };

  const handleEdit = async (competition: Competition) => {
    setEditingCompetition(competition);
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCompetition) return;

    if (!editingCompetition.name.trim()) {
      setError('Competition name is required');
      return;
    }

    try {
      const response = await api.put<Competition>(`competitions/${editingCompetition.id}/`, {
        name: editingCompetition.name,
        num_players: editingCompetition.num_players,
        competition_type: editingCompetition.competition_type,
        parallel_matches: editingCompetition.parallel_matches,
        max_rounds: editingCompetition.max_rounds
      });
      setCompetitions(competitions.map(comp => 
        comp.id === editingCompetition.id ? response.data : comp
      ));
      setEditingCompetition(null);
    } catch (error) {
      console.error('Error updating competition:', error);
    }
  };

  const handleManagePlayers = (competition: Competition) => {
    setManagingPlayers(competition);
    setNewPlayerName('');
    setError('');
    setSelectedUser(null);
    setShowUserDropdown(false);
  };

  const handleSelectUser = (user: User) => {
    setSelectedUser(user);
    setNewPlayerName(user.display_name);
    setShowUserDropdown(false);
    
    // Immediately add the selected user
    if (managingPlayers) {
      addPlayer(user.id);
    }
  };

  const addPlayer = async (userId?: number) => {
    if (!managingPlayers) return;

    try {
      const response = await api.post<Player>(`/competitions/${managingPlayers.id}/add_player/`, {
        user_id: userId,
        guest_name: !userId ? newPlayerName : undefined
      });

      const updatedCompetition = {
        ...managingPlayers,
        players: [...managingPlayers.players, response.data] as Player[],
        available_slots: managingPlayers.available_slots - 1,
        is_full: managingPlayers.available_slots - 1 === 0
      };

      setCompetitions(competitions.map(comp =>
        comp.id === managingPlayers.id ? updatedCompetition : comp
      ));
      setManagingPlayers(updatedCompetition);
      setNewPlayerName('');
      setSelectedUser(null);
      setError('');
    } catch (error: any) {
      setError(error.response?.data?.error || 'Failed to add player');
    }
  };

  const handleAddPlayer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!managingPlayers || !newPlayerName) return;

    // This now only handles guest players (non-registered users)
    await addPlayer();
  };

  const handleRemovePlayer = async (playerId: number) => {
    if (!managingPlayers) return;

    try {
      await api.delete(`/competitions/${managingPlayers.id}/remove_player/`, {
        params: { player_id: playerId }
      });

      const updatedCompetition = {
        ...managingPlayers,
        players: managingPlayers.players.filter(p => p.id !== playerId),
        available_slots: managingPlayers.available_slots + 1,
        is_full: false
      } as Competition;

      setCompetitions(competitions.map(comp =>
        comp.id === managingPlayers.id ? updatedCompetition : comp
      ));
      setManagingPlayers(updatedCompetition);
    } catch (error) {
      console.error('Error removing player:', error);
    }
  };

  const handleDragEnd = async (result: any) => {
    if (!managingPlayers || !result.destination) return;

    const reorderedPlayers = reorder(
      managingPlayers.players,
      result.source.index,
      result.destination.index
    );

    const updatedCompetition = {
      ...managingPlayers,
      players: reorderedPlayers
    };

    setManagingPlayers(updatedCompetition);
    setCompetitions(competitions.map(comp =>
      comp.id === managingPlayers.id ? updatedCompetition : comp
    ));

    try {
      await api.post(`/competitions/${managingPlayers.id}/reorder_players/`, {
        player_orders: reorderedPlayers.map(player => ({
          id: player.id,
          order: player.order
        }))
      });
    } catch (error) {
      console.error('Error reordering players:', error);
    }
  };

  const handleSchedule = async (competition: Competition) => {
    try {
      const response = await api.post<CompetitionSchedule[]>(`/competitions/${competition.id}/create_schedule/`);
      
      notification.success({
        message: 'Schedule Created',
        description: `Schedule created successfully! ${response.data.length} matches created.`,
        duration: 4,
      });
      
      // Fetch fresh competition data to get updated status
      const updatedCompResponse = await api.get<Competition>(`/competitions/${competition.id}/`);
      setCompetitions(competitions.map(comp => 
        comp.id === competition.id ? updatedCompResponse.data : comp
      ));
    } catch (error) {
      console.error('Error creating schedule:', error);
      
      notification.error({
        message: 'Schedule Creation Failed',
        description: 'Failed to create schedule',
        duration: 4,
      });
    }
  };

  const handleViewSchedule = async (competition: Competition) => {
    try {
      const response = await api.get<CompetitionSchedule[]>(`/competitions/${competition.id}/schedule/`);
      setSchedules(response.data);
      setViewingSchedule(competition);
    } catch (error) {
      console.error('Error fetching schedule:', error);
      
      notification.error({
        message: 'Schedule Error',
        description: 'Failed to fetch schedule',
        duration: 4,
      });
    }
  };

  const handleDeleteSchedule = async (competition: Competition) => {
    if (!confirm('Are you sure you want to delete this schedule?')) return;

    try {
      await api.delete(`/competitions/${competition.id}/delete_schedule/`);
      
      notification.success({
        message: 'Schedule Deleted',
        description: 'Schedule has been successfully deleted',
        duration: 4,
      });
      
      setCompetitions(competitions.map(comp => 
        comp.id === competition.id ? { ...comp, status: 'full' } : comp
      ));
      setViewingSchedule(null);
      setSchedules([]);
    } catch (error) {
      console.error('Error deleting schedule:', error);
      
      notification.error({
        message: 'Delete Error',
        description: 'Failed to delete schedule',
        duration: 4,
      });
    }
  };

  const handleStartCompetition = async (competition: Competition) => {
    try {
      const response = await api.post(`/competitions/${competition.id}/start_competition/`);
      
      // Update the competition status locally
      const updatedCompetitions = competitions.map(comp => {
        if (comp.id === competition.id) {
          return {
            ...comp,
            status: 'in_progress' as 'in_progress' // Type assertion to fix the error
          };
        }
        return comp;
      });
      
      console.log("Updated competition status to in_progress");
      setCompetitions(updatedCompetitions);
    } catch (error) {
      console.error('Error starting competition:', error);
      notification.error({
        message: 'Error',
        description: 'Failed to start competition. Please try again.'
      });
    }
  };

  const getPlayerName = (playerId: number, competition: Competition) => {
    const player = competition.players.find(p => p.id === playerId);
    return player?.username || 'Unknown Player';
  };

  const toggleMenu = (competitionId: number, event?: React.MouseEvent) => {
    // Prevent event from bubbling up to parent elements
    if (event) {
      event.stopPropagation();
      event.preventDefault();
    }
    
    // Toggle the menu open/closed state
    const newMenuId = openMenuId === competitionId ? null : competitionId;
    setOpenMenuId(newMenuId);
  };

  const handleReplacePlayer = async () => {
    if (!managingPlayers || !selectedPlayerToReplace || (!selectedUser && !newPlayerName)) return;

    try {
      await api.post(`/competitions/${managingPlayers.id}/replace_player/`, {
        old_player_id: selectedPlayerToReplace.id,
        new_user_id: selectedUser?.id,
        new_guest_name: !selectedUser ? newPlayerName : undefined
      });

      // Refresh competition data
      const response = await api.get<Competition>(`/competitions/${managingPlayers.id}/`);
      setManagingPlayers(response.data);
      setCompetitions(competitions.map(comp =>
        comp.id === managingPlayers.id ? response.data : comp
      ));

      notification.success({
        message: 'Player Replaced',
        description: 'Player has been successfully replaced',
        duration: 4,
      });

      // Reset form
      setShowReplacePlayerModal(false);
      setSelectedPlayerToReplace(null);
      setNewPlayerName('');
      setSelectedUser(null);
    } catch (error) {
      console.error('Error replacing player:', error);
      
      notification.error({
        message: 'Replace Error',
        description: 'Failed to replace player',
        duration: 4,
      });
    }
  };

  // Add a handleLogout function for the Navigation component
  const handleLogout = () => {
    localStorage.removeItem('token');
    router.push('/');
  };

  if (!user) {
    return <div>Loading...</div>;
  }

  return (
    <div className="min-h-screen bg-gray-100">
      <Navigation onLogout={handleLogout} />
      
      <div className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="px-4 py-6 sm:px-0">
          <div className="bg-white shadow rounded-lg p-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
              <PageHeading 
                title="Manage Competitions" 
                infoText={pageDescriptions.competitions}
                helpHref="/help/content/competitions"
              />
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 w-full sm:w-auto">
                {userClubs.length > 1 && (
                  <div className="w-full sm:w-auto">
                    <select
                      value={currentClub?.id || ''}
                      onChange={async (e) => {
                        const clubId = e.target.value;
                        const selected = userClubs.find(c => c.id === parseInt(clubId));
                        if (selected) {
                          try {
                            const token = localStorage.getItem('token');
                            const endpoint = '/club-users/set_current_club/';
                            
                            await api.put(
                              endpoint,
                              { club_id: selected.id },
                              { headers: { Authorization: `Token ${token}` } }
                            );
                            
                            // Update locally
                            setCurrentClub(selected);
                            localStorage.setItem('currentClub', JSON.stringify(selected));
                            
                            // Fetch competitions and users for the new club
                            const params = { club_id: selected.id };
                            const [competitionsResponse, usersResponse] = await Promise.all([
                              api.get<Competition[]>('/competitions/', { params }),
                              api.get<User[]>('/users/', { params })
                            ]);
                            
                            setCompetitions(competitionsResponse.data);
                            setAllUsers(usersResponse.data);
                          } catch (error) {
                            console.error('Error updating current club:', error);
                          }
                        }
                      }}
                      className="w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                    >
                      {userClubs.map(club => (
                        <option key={club.id} value={club.id}>{club.name}</option>
                      ))}
                    </select>
                  </div>
                )}
                <button 
                  onClick={() => router.push('/competition/create')} 
                  className="w-full sm:w-auto bg-indigo-600 text-white px-4 py-2 rounded-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  Create Competition
                </button>
              </div>
            </div>
            
            {/* Desktop Table View */}
            <div className="hidden md:block overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Created</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Players</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Creator</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Type</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {competitions.map(competition => (
                    <tr key={competition.id}>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {competition.name}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {new Date(competition.created_at).toLocaleString()}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {competition.num_players - competition.available_slots}/{competition.num_players}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {competition.creator_name}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {competition.competition_type_name}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {competition.status === 'scheduled' ? (
                          <span className="text-purple-600 font-bold">Scheduled</span>
                        ) : competition.status === 'in_progress' ? (
                          <span className="text-blue-600 font-bold">In Progress</span>
                        ) : competition.status === 'completed' ? (
                          <span className="text-indigo-600 font-bold">Completed</span>
                        ) : (competition.num_players - competition.available_slots) > competition.num_players ? (
                          <span className="text-red-600 font-bold">Too Many Players</span>
                        ) : competition.is_full ? (
                          <span className="text-green-600 font-bold">Full</span>
                        ) : (
                          <span>{competition.available_slots} slots left</span>
                        )}
                        {competition.status === 'scheduled' ? (
                          <>
                            <button
                              onClick={() => handleViewSchedule(competition)}
                              className="ml-2 px-2 py-1 text-xs bg-green-100 text-green-800 rounded hover:bg-green-200"
                              title="View Schedule"
                            >
                              View Schedule
                            </button>
                            <button
                              onClick={() => handleStartCompetition(competition)}
                              className="ml-2 px-2 py-1 text-xs bg-blue-100 text-blue-800 rounded hover:bg-blue-200"
                              title="Start Competition"
                            >
                              Start
                            </button>
                          </>
                        ) : competition.status === 'in_progress' ? (
                          <button
                            onClick={() => router.push(`/competition/scoring/${competition.id}`)}
                            className="ml-2 px-2 py-1 text-xs bg-purple-100 text-purple-800 rounded hover:bg-purple-200"
                            title="Scoring"
                          >
                            Scoring
                          </button>
                        ) : competition.status === 'completed' ? (
                          <button
                            onClick={() => router.push(`/competition/results/${competition.id}`)}
                            className="ml-2 px-2 py-1 text-xs bg-indigo-100 text-indigo-800 rounded hover:bg-indigo-200"
                            title="Results"
                          >
                            Results
                          </button>
                        ) : competition.is_full ? (
                          <button
                            onClick={() => handleSchedule(competition)}
                            className="ml-2 px-2 py-1 text-xs bg-green-100 text-green-800 rounded hover:bg-green-200"
                            title="Create Schedule"
                          >
                            Create Schedule
                          </button>
                        ) : (
                          <button
                            onClick={() => handleManagePlayers(competition)}
                            className="ml-2 px-2 py-1 text-xs bg-blue-100 text-blue-800 rounded hover:bg-blue-200"
                            title="Manage Players"
                          >
                            Manage Players
                          </button>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium relative">
                        <div className="relative">
                          <button
                            onClick={(e) => toggleMenu(competition.id, e)}
                            className="p-2 rounded-md text-gray-600 hover:text-gray-900 hover:bg-gray-100 focus:outline-none"
                            data-menu-button
                          >
                            <EllipsisVerticalIcon className="h-6 w-6" />
                          </button>
                          
                          {openMenuId === competition.id && (
                            <div className="absolute right-0 mt-2 w-48 rounded-md shadow-lg bg-white ring-1 ring-black ring-opacity-5 z-50" data-menu-content>
                              <div className="py-1" role="menu">
                                <button
                                  onClick={() => {
                                    handleManagePlayers(competition);
                                    setOpenMenuId(null);
                                  }}
                                  className="block w-full text-left px-4 py-2 text-sm text-blue-600 hover:bg-gray-100"
                                >
                                  Manage Players
                                </button>
                                <button
                                  onClick={() => {
                                    handleEdit(competition);
                                    setOpenMenuId(null);
                                  }}
                                  className="block w-full text-left px-4 py-2 text-sm text-indigo-600 hover:bg-gray-100"
                                >
                                  Edit Competition
                                </button>
                                {competition.is_full && competition.status !== 'scheduled' && (
                                  <button
                                    onClick={() => {
                                      handleSchedule(competition);
                                      setOpenMenuId(null);
                                    }}
                                    className="block w-full text-left px-4 py-2 text-sm text-green-600 hover:bg-gray-100"
                                  >
                                    Create Schedule
                                  </button>
                                )}
                                {competition.status === 'scheduled' && (
                                  <>
                                    <button
                                      onClick={() => {
                                        handleViewSchedule(competition);
                                        setOpenMenuId(null);
                                      }}
                                      className="block w-full text-left px-4 py-2 text-sm text-green-600 hover:bg-gray-100"
                                    >
                                      View Schedule
                                    </button>
                                    <button
                                      onClick={() => {
                                        handleStartCompetition(competition);
                                        setOpenMenuId(null);
                                      }}
                                      className="block w-full text-left px-4 py-2 text-sm text-blue-600 hover:bg-gray-100"
                                    >
                                      Start Competition
                                    </button>
                                    <button
                                      onClick={() => {
                                        handleDeleteSchedule(competition);
                                        setOpenMenuId(null);
                                      }}
                                      className="block w-full text-left px-4 py-2 text-sm text-yellow-600 hover:bg-gray-100"
                                    >
                                      Delete Schedule
                                    </button>
                                  </>
                                )}
                                {competition.status === 'in_progress' && (
                                  <>
                                    <button
                                      onClick={() => {
                                        router.push(`/competition/scoring/${competition.id}`);
                                        setOpenMenuId(null);
                                      }}
                                      className="block w-full text-left px-4 py-2 text-sm text-purple-600 hover:bg-gray-100"
                                    >
                                      Scoring
                                    </button>
                                    <button
                                      onClick={() => {
                                        handleViewSchedule(competition);
                                        setOpenMenuId(null);
                                      }}
                                      className="block w-full text-left px-4 py-2 text-sm text-green-600 hover:bg-gray-100"
                                    >
                                      View Schedule
                                    </button>
                                  </>
                                )}
                                {competition.status === 'completed' && (
                                  <>
                                    <button
                                      onClick={() => {
                                        router.push(`/competition/results/${competition.id}`);
                                        setOpenMenuId(null);
                                      }}
                                      className="block w-full text-left px-4 py-2 text-sm text-purple-600 hover:bg-gray-100"
                                    >
                                      View Results
                                    </button>
                                  </>
                                )}
                                <button
                                  onClick={() => {
                                    handleDelete(competition.id);
                                    setOpenMenuId(null);
                                  }}
                                  className="block w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-gray-100"
                                >
                                  Delete Competition
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile Card View */}
            <div className="md:hidden space-y-4">
              {competitions.map(competition => (
                <div key={competition.id} className="bg-white shadow rounded-lg p-4 border border-gray-200">
                  <div className="flex justify-between items-start mb-4">
                    <h3 className="text-lg font-medium text-gray-900">{competition.name}</h3>
                    <div className="relative">
                      <button
                        onClick={(e) => toggleMenu(competition.id, e)}
                        className="p-2 rounded-md text-gray-600 hover:text-gray-900 hover:bg-gray-100 focus:outline-none"
                        data-menu-button
                      >
                        <EllipsisVerticalIcon className="h-6 w-6" />
                      </button>
                      
                      {openMenuId === competition.id && (
                        <div className="absolute right-0 mt-2 w-48 rounded-md shadow-lg bg-white ring-1 ring-black ring-opacity-5 z-50" data-menu-content>
                          <div className="py-1" role="menu">
                            <button
                              onClick={() => {
                                handleManagePlayers(competition);
                                setOpenMenuId(null);
                              }}
                              className="block w-full text-left px-4 py-2 text-sm text-blue-600 hover:bg-gray-100"
                            >
                              Players
                            </button>
                            <button
                              onClick={() => {
                                handleEdit(competition);
                                setOpenMenuId(null);
                              }}
                              className="block w-full text-left px-4 py-2 text-sm text-indigo-600 hover:bg-gray-100"
                            >
                              Edit
                            </button>
                            {competition.is_full && competition.status !== 'scheduled' && (
                              <button
                                onClick={() => {
                                  handleSchedule(competition);
                                  setOpenMenuId(null);
                                }}
                                className="block w-full text-left px-4 py-2 text-sm text-green-600 hover:bg-gray-100"
                              >
                                Schedule
                              </button>
                            )}
                            {competition.status === 'scheduled' && (
                              <>
                                <button
                                  onClick={() => {
                                    handleViewSchedule(competition);
                                    setOpenMenuId(null);
                                  }}
                                  className="block w-full text-left px-4 py-2 text-sm text-green-600 hover:bg-gray-100"
                                >
                                  View Schedule
                                </button>
                                <button
                                  onClick={() => {
                                    handleStartCompetition(competition);
                                    setOpenMenuId(null);
                                  }}
                                  className="block w-full text-left px-4 py-2 text-sm text-blue-600 hover:bg-gray-100"
                                >
                                  Start
                                </button>
                                <button
                                  onClick={() => {
                                    handleDeleteSchedule(competition);
                                    setOpenMenuId(null);
                                  }}
                                  className="block w-full text-left px-4 py-2 text-sm text-yellow-600 hover:bg-gray-100"
                                >
                                  Delete Schedule
                                </button>
                              </>
                            )}
                            {competition.status === 'in_progress' && (
                              <>
                                <button
                                  onClick={() => {
                                    router.push(`/competition/scoring/${competition.id}`);
                                    setOpenMenuId(null);
                                  }}
                                  className="block w-full text-left px-4 py-2 text-sm text-purple-600 hover:bg-gray-100"
                                >
                                  Scoring
                                </button>
                                <button
                                  onClick={() => {
                                    handleViewSchedule(competition);
                                    setOpenMenuId(null);
                                  }}
                                  className="block w-full text-left px-4 py-2 text-sm text-green-600 hover:bg-gray-100"
                                >
                                  View Schedule
                                </button>
                              </>
                            )}
                            {competition.status === 'completed' && (
                              <>
                                <button
                                  onClick={() => {
                                    router.push(`/competition/results/${competition.id}`);
                                    setOpenMenuId(null);
                                  }}
                                  className="block w-full text-left px-4 py-2 text-sm text-purple-600 hover:bg-gray-100"
                                >
                                  Results
                                </button>
                              </>
                            )}
                            <button
                              onClick={() => {
                                handleDelete(competition.id);
                                setOpenMenuId(null);
                              }}
                              className="block w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-gray-100"
                            >
                              Delete
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                  
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-500">Created:</span>
                      <span className="text-gray-900">{new Date(competition.created_at).toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">Players:</span>
                      <span className="text-gray-900">
                        {competition.num_players - competition.available_slots}/{competition.num_players}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">Creator:</span>
                      <span className="text-gray-900">{competition.creator_name}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">Competition Type:</span>
                      <span className="text-gray-900">{competition.competition_type_name}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-gray-500">Status:</span>
                      <div className="flex items-center">
                        <span className={`font-medium ${
                          competition.status === 'scheduled'
                            ? 'text-purple-600'
                            : competition.status === 'in_progress'
                            ? 'text-blue-600'
                            : competition.status === 'completed'
                            ? 'text-indigo-600'
                            : (competition.num_players - competition.available_slots) > competition.num_players
                            ? 'text-red-600'
                            : competition.is_full
                            ? 'text-green-600'
                            : 'text-gray-900'
                        }`}>
                          {competition.status === 'scheduled'
                            ? 'Scheduled'
                            : competition.status === 'in_progress'
                            ? 'In Progress'
                            : competition.status === 'completed'
                            ? 'Completed'
                            : (competition.num_players - competition.available_slots) > competition.num_players
                            ? 'Too Many Players'
                            : competition.is_full
                            ? 'Full'
                            : `${competition.available_slots} slots left`}
                        </span>
                        {competition.status === 'scheduled' ? (
                          <>
                            <button
                              onClick={() => handleViewSchedule(competition)}
                              className="ml-2 px-2 py-1 text-xs bg-green-100 text-green-800 rounded hover:bg-green-200"
                              title="View Schedule"
                            >
                              View
                            </button>
                            <button
                              onClick={() => handleStartCompetition(competition)}
                              className="ml-2 px-2 py-1 text-xs bg-blue-100 text-blue-800 rounded hover:bg-blue-200"
                              title="Start Competition"
                            >
                              Start
                            </button>
                          </>
                        ) : competition.status === 'in_progress' ? (
                          <button
                            onClick={() => router.push(`/competition/scoring/${competition.id}`)}
                            className="ml-2 px-2 py-1 text-xs bg-purple-100 text-purple-800 rounded hover:bg-purple-200"
                            title="Scoring"
                          >
                            Score
                          </button>
                        ) : competition.status === 'completed' ? (
                          <button
                            onClick={() => router.push(`/competition/results/${competition.id}`)}
                            className="ml-2 px-2 py-1 text-xs bg-indigo-100 text-indigo-800 rounded hover:bg-indigo-200"
                            title="Results"
                          >
                            Results
                          </button>
                        ) : competition.is_full ? (
                          <button
                            onClick={() => handleSchedule(competition)}
                            className="ml-2 px-2 py-1 text-xs bg-green-100 text-green-800 rounded hover:bg-green-200"
                            title="Create Schedule"
                          >
                            Schedule
                          </button>
                        ) : (
                          <button
                            onClick={() => handleManagePlayers(competition)}
                            className="ml-2 px-2 py-1 text-xs bg-blue-100 text-blue-800 rounded hover:bg-blue-200"
                            title="Manage Players"
                          >
                            Players
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Schedule View Modal */}
            {viewingSchedule && (
              <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center">
                <div className="bg-white rounded-lg p-6 max-w-4xl w-full max-h-[90vh] overflow-y-auto">
                  <div className="flex justify-between items-center mb-6">
                    <h2 className="text-xl font-bold">Schedule for {viewingSchedule.name}</h2>
                    <button
                      onClick={() => setViewingSchedule(null)}
                      className="text-gray-500 hover:text-gray-700"
                    >
                      Close
                    </button>
                  </div>

                  <div className="space-y-6">
                    {schedules.map((schedule) => (
                      <div key={schedule.id} className="border rounded-lg p-4">
                        <h3 className="text-lg font-medium mb-4">Round {schedule.round}, Game {schedule.sub_round}</h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div className="bg-blue-50 p-4 rounded-lg">
                            <h4 className="font-medium mb-2">Side 1</h4>
                            <ul className="space-y-2">
                              {schedule.side_1_player_1 && getPlayerName(schedule.side_1_player_1, viewingSchedule) !== 'Unknown Player' && (
                                <li>{getPlayerName(schedule.side_1_player_1, viewingSchedule)}</li>
                              )}
                              {schedule.side_1_player_2 && getPlayerName(schedule.side_1_player_2, viewingSchedule) !== 'Unknown Player' && (
                                <li>{getPlayerName(schedule.side_1_player_2, viewingSchedule)}</li>
                              )}
                              {schedule.side_1_player_3 && getPlayerName(schedule.side_1_player_3, viewingSchedule) !== 'Unknown Player' && (
                                <li>{getPlayerName(schedule.side_1_player_3, viewingSchedule)}</li>
                              )}
                              {schedule.side_1_player_4 && getPlayerName(schedule.side_1_player_4, viewingSchedule) !== 'Unknown Player' && (
                                <li>{getPlayerName(schedule.side_1_player_4, viewingSchedule)}</li>
                              )}
                            </ul>
                          </div>
                          <div className="bg-red-50 p-4 rounded-lg">
                            <h4 className="font-medium mb-2">Side 2</h4>
                            <ul className="space-y-2">
                              {schedule.side_2_player_1 && getPlayerName(schedule.side_2_player_1, viewingSchedule) !== 'Unknown Player' && (
                                <li>{getPlayerName(schedule.side_2_player_1, viewingSchedule)}</li>
                              )}
                              {schedule.side_2_player_2 && getPlayerName(schedule.side_2_player_2, viewingSchedule) !== 'Unknown Player' && (
                                <li>{getPlayerName(schedule.side_2_player_2, viewingSchedule)}</li>
                              )}
                              {schedule.side_2_player_3 && getPlayerName(schedule.side_2_player_3, viewingSchedule) !== 'Unknown Player' && (
                                <li>{getPlayerName(schedule.side_2_player_3, viewingSchedule)}</li>
                              )}
                              {schedule.side_2_player_4 && getPlayerName(schedule.side_2_player_4, viewingSchedule) !== 'Unknown Player' && (
                                <li>{getPlayerName(schedule.side_2_player_4, viewingSchedule)}</li>
                              )}
                            </ul>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {editingCompetition && (
              <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center">
                <div className="bg-white rounded-lg p-6 max-w-md w-full">
                  <h2 className="text-xl font-bold mb-4">Edit Competition</h2>
                  {(editingCompetition.num_players - editingCompetition.available_slots) > editingCompetition.num_players && (
                    <div className="mb-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded">
                      Warning: There are more players registered than the new player limit allows.
                    </div>
                  )}
                  <form onSubmit={handleUpdate}>
                    <div className="mb-4">
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Competition Name
                      </label>
                      <input
                        type="text"
                        value={editingCompetition.name}
                        onChange={(e) => setEditingCompetition({
                          ...editingCompetition,
                          name: e.target.value
                        })}
                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                        required
                      />
                    </div>
                    <div className="mb-4">
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Number of Players
                      </label>
                      <input
                        type="number"
                        min={4}
                        max={40}
                        value={editingCompetition.num_players}
                        onChange={(e) => setEditingCompetition({
                          ...editingCompetition,
                          num_players: parseInt(e.target.value)
                        })}
                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                      />
                    </div>
                    <div className="mb-4">
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Competition Type
                      </label>
                      <select
                        value={editingCompetition.competition_type}
                        onChange={(e) => setEditingCompetition({
                          ...editingCompetition,
                          competition_type: parseInt(e.target.value)
                        })}
                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                      >
                        {competitionTypes.map(type => (
                          <option key={type.id} value={type.id}>
                            {type.name}
                          </option>
                        ))}
                      </select>
                      {competitionTypes.find(t => t.id === editingCompetition.competition_type)?.description && (
                        <p className="mt-1 text-sm text-gray-500">
                          {competitionTypes.find(t => t.id === editingCompetition.competition_type)?.description}
                        </p>
                      )}
                    </div>
                    <div className="mb-4">
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Parallel Matches
                      </label>
                      <input
                        type="number"
                        min={1}
                        max={10}
                        value={editingCompetition.parallel_matches}
                        onChange={(e) => setEditingCompetition({
                          ...editingCompetition,
                          parallel_matches: parseInt(e.target.value)
                        })}
                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                      />
                      <p className="mt-1 text-sm text-gray-500">
                        Number of matches that can be played simultaneously (1-10)
                      </p>
                    </div>

                    <div className="mb-4">
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Maximum Rounds
                      </label>
                      <input
                        type="number"
                        min={1}
                        max={20}
                        value={editingCompetition.max_rounds}
                        onChange={(e) => setEditingCompetition({
                          ...editingCompetition,
                          max_rounds: parseInt(e.target.value)
                        })}
                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                      />
                      <p className="mt-1 text-sm text-gray-500">
                        Maximum number of rounds to generate (1-20)
                      </p>
                    </div>

                    <div className="flex justify-end space-x-4">
                      <button
                        type="button"
                        onClick={() => setEditingCompetition(null)}
                        className="bg-gray-200 text-gray-700 px-4 py-2 rounded-md hover:bg-gray-300"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        className="bg-indigo-600 text-white px-4 py-2 rounded-md hover:bg-indigo-700"
                      >
                        Save
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            )}

            {managingPlayers && (
              <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4">
                <div className="bg-white rounded-lg p-6 w-full max-w-lg">
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="text-lg font-medium">Manage Players - {managingPlayers.name}</h3>
                    <button
                      onClick={() => setManagingPlayers(null)}
                      className="text-gray-500 hover:text-gray-700"
                    >
                      <XIcon className="h-6 w-6" />
                    </button>
                  </div>

                  {/* Add Player Section */}
                  <div className="mb-6 p-4 bg-gray-50 rounded-lg">
                    <h4 className="text-md font-medium mb-3">Add Player</h4>
                    {managingPlayers.is_full || managingPlayers.available_slots <= 0 ? (
                      <div className="p-3 bg-yellow-50 border border-yellow-200 text-yellow-800 rounded-md">
                        <p className="text-sm font-medium">Maximum number of players reached</p>
                        <p className="text-xs mt-1">Remove a player to add a new one.</p>
                      </div>
                    ) : (
                      <>
                        <div className="relative">
                          <input
                            type="search"
                            value={newPlayerName}
                            onChange={(e) => {
                              setNewPlayerName(e.target.value);
                              setSelectedUser(null);
                            }}
                            className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                            placeholder="Search for a player or enter guest name"
                            autoFocus
                            autoComplete="off"
                            data-lpignore="true"
                          />
                          {showUserDropdown && (
                            <div className="absolute z-10 w-full mt-1 bg-white shadow-lg rounded-md border border-gray-200 max-h-60 overflow-y-auto">
                              {filteredUsers.map(user => (
                                <div
                                  key={user.id}
                                  className="px-4 py-2 hover:bg-gray-100 cursor-pointer"
                                  onClick={() => handleSelectUser(user)}
                                >
                                  {user.display_name}
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                        
                        {error && (
                          <div className="mt-2 p-2 bg-red-100 border border-red-400 text-red-700 rounded text-sm">
                            {error}
                          </div>
                        )}
                        
                        {newPlayerName && !showUserDropdown && (
                          <button
                            onClick={() => addPlayer()}
                            className="mt-2 bg-blue-600 text-white px-3 py-1 text-sm rounded hover:bg-blue-700"
                            disabled={!newPlayerName}
                          >
                            Add as Guest
                          </button>
                        )}
                      </>
                    )}
                    
                    {!managingPlayers.is_full && managingPlayers.available_slots > 0 && (
                      <div className="mt-2 text-xs text-gray-500">
                        {managingPlayers.available_slots} {managingPlayers.available_slots === 1 ? 'slot' : 'slots'} remaining
                      </div>
                    )}
                  </div>

                  <h4 className="text-md font-medium mb-3">Current Players</h4>
                  <DragDropContext onDragEnd={handleDragEnd}>
                    <Droppable droppableId="players">
                      {(provided) => (
                        <div {...provided.droppableProps} ref={provided.innerRef} className="max-h-[40vh] overflow-y-auto">
                          {managingPlayers.players.length === 0 ? (
                            <div className="text-center py-4 text-gray-500">
                              No players added yet
                            </div>
                          ) : (
                            managingPlayers.players.map((player, index) => (
                              <Draggable key={player.id} draggableId={String(player.id)} index={index}>
                                {(provided) => (
                                  <div
                                    ref={provided.innerRef}
                                    {...provided.draggableProps}
                                    {...provided.dragHandleProps}
                                    className="flex items-center justify-between bg-white p-3 mb-2 rounded border"
                                  >
                                    <div className="flex items-center">
                                      <GripVerticalIcon className="h-5 w-5 text-gray-400 mr-2" />
                                      <span>{player.username || player.guest_name}</span>
                                    </div>
                                    <div className="flex gap-2">
                                      <button
                                        onClick={() => {
                                          setSelectedPlayerToReplace(player);
                                          setShowReplacePlayerModal(true);
                                        }}
                                        className="text-blue-600 hover:text-blue-800"
                                      >
                                        Replace
                                      </button>
                                      <button
                                        onClick={() => handleRemovePlayer(player.id)}
                                        className="text-red-600 hover:text-red-800"
                                        disabled={managingPlayers.status === 'scheduled'}
                                      >
                                        Remove
                                      </button>
                                    </div>
                                  </div>
                                )}
                              </Draggable>
                            ))
                          )}
                          {provided.placeholder}
                        </div>
                      )}
                    </Droppable>
                  </DragDropContext>

                  <div className="mt-6 flex justify-end">
                    <button
                      onClick={() => setManagingPlayers(null)}
                      className="bg-gray-200 text-gray-700 px-4 py-2 rounded hover:bg-gray-300"
                    >
                      Done
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Replace Player Modal */}
            {showReplacePlayerModal && selectedPlayerToReplace && (
              <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4">
                <div className="bg-white rounded-lg p-6 w-full max-w-lg">
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="text-lg font-medium">Replace Player</h3>
                    <button
                      onClick={() => {
                        setShowReplacePlayerModal(false);
                        setSelectedPlayerToReplace(null);
                        setNewPlayerName('');
                        setSelectedUser(null);
                      }}
                      className="text-gray-500 hover:text-gray-700"
                    >
                      <XIcon className="h-6 w-6" />
                    </button>
                  </div>

                  <div className="mb-4">
                    <p>Replacing: {selectedPlayerToReplace.username || selectedPlayerToReplace.guest_name}</p>
                  </div>

                  <div className="mb-4 relative">
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      New Player
                    </label>
                    <input
                      type="search"
                      value={newPlayerName}
                      onChange={(e) => {
                        setNewPlayerName(e.target.value);
                        setSelectedUser(null);
                      }}
                      className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                      placeholder="Search for a player or enter guest name"
                      autoComplete="off"
                      data-lpignore="true"
                    />
                    {showUserDropdown && (
                      <div className="absolute z-10 w-full mt-1 bg-white shadow-lg rounded-md border border-gray-200 max-h-60 overflow-y-auto">
                        {filteredUsers.map(user => (
                          <div
                            key={user.id}
                            className="px-4 py-2 hover:bg-gray-100 cursor-pointer"
                            onClick={() => handleSelectUser(user)}
                          >
                            {user.display_name}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="flex justify-end gap-2">
                    <button
                      onClick={() => {
                        setShowReplacePlayerModal(false);
                        setSelectedPlayerToReplace(null);
                        setNewPlayerName('');
                        setSelectedUser(null);
                      }}
                      className="px-4 py-2 text-gray-700 hover:text-gray-900"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleReplacePlayer}
                      disabled={!newPlayerName && !selectedUser}
                      className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 disabled:opacity-50"
                    >
                      Save
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
} 