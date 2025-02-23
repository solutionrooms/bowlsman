'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import Navigation from '../../components/Navigation';
import api from '../../../src/lib/axios';

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

interface Competition {
  id: number;
  name: string;
  created_at: string;
  num_players: number;
  creator_name: string;
  rule_set_id: number;
  is_full: boolean;
  players: Player[];
  available_slots: number;
  status: 'open' | 'full' | 'scheduled';
}

interface CompetitionSchedule {
  id: number;
  competition: number;
  round: number;
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
  const router = useRouter();

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) return;

    const token = localStorage.getItem('token');
    if (!token) {
      router.push('/');
      return;
    }

    const fetchData = async () => {
      try {
        const [userResponse, competitionsResponse, usersResponse] = await Promise.all([
          api.get<User>('/users/me/'),
          api.get<Competition[]>('/competitions/'),
          api.get<User[]>('/users/')
        ]);
        setUser(userResponse.data);
        setCompetitions(competitionsResponse.data);
        setAllUsers(usersResponse.data);
      } catch (error) {
        console.error('Error fetching data:', error);
        router.push('/');
      }
    };

    fetchData();
  }, [mounted]);

  useEffect(() => {
    if (newPlayerName.trim() === '') {
      setFilteredUsers([]);
      setShowUserDropdown(false);
      return;
    }

    const filtered = allUsers.filter(u => 
      u.search_name.includes(newPlayerName.toLowerCase())
    );
    setFilteredUsers(filtered);
    setShowUserDropdown(filtered.length > 0);
  }, [newPlayerName, allUsers]);

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
      const response = await api.put<Competition>(`/competitions/${editingCompetition.id}/`, {
        name: editingCompetition.name,
        num_players: editingCompetition.num_players,
        rule_set_id: editingCompetition.rule_set_id
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
  };

  const handleAddPlayer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!managingPlayers) return;

    try {
      const response = await api.post<Player>(`/competitions/${managingPlayers.id}/add_player/`, {
        user_id: selectedUser?.id,
        guest_name: !selectedUser ? newPlayerName : undefined
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
      alert(`Schedule created successfully! ${response.data.length} rounds created.`);
      
      // Fetch fresh competition data to get updated status
      const updatedCompResponse = await api.get<Competition>(`/competitions/${competition.id}/`);
      setCompetitions(competitions.map(comp => 
        comp.id === competition.id ? updatedCompResponse.data : comp
      ));
    } catch (error) {
      console.error('Error creating schedule:', error);
      alert('Failed to create schedule');
    }
  };

  const handleViewSchedule = async (competition: Competition) => {
    try {
      const response = await api.get<CompetitionSchedule[]>(`/competitions/${competition.id}/schedule/`);
      setSchedules(response.data);
      setViewingSchedule(competition);
    } catch (error) {
      console.error('Error fetching schedule:', error);
      alert('Failed to fetch schedule');
    }
  };

  const handleDeleteSchedule = async (competition: Competition) => {
    if (!confirm('Are you sure you want to delete this schedule?')) return;

    try {
      await api.delete(`/competitions/${competition.id}/delete_schedule/`);
      setCompetitions(competitions.map(comp => 
        comp.id === competition.id ? { ...comp, status: 'full' } : comp
      ));
      setViewingSchedule(null);
      setSchedules([]);
    } catch (error) {
      console.error('Error deleting schedule:', error);
      alert('Failed to delete schedule');
    }
  };

  const getPlayerName = (playerId: number, competition: Competition) => {
    const player = competition.players.find(p => p.id === playerId);
    return player?.username || 'Unknown Player';
  };

  if (!user) {
    return <div>Loading...</div>;
  }

  return (
    <div className="min-h-screen bg-gray-100">
      <Navigation isStaff={user.is_staff} />
      
      <div className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="px-4 py-6 sm:px-0">
          <div className="bg-white shadow rounded-lg p-6">
            <h1 className="text-2xl font-bold mb-6">Manage Competitions</h1>
            
            {/* Desktop Table View */}
            <div className="hidden md:block overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Created</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Players</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Creator</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Rule Set</th>
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
                        {competition.rule_set_id}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {competition.status === 'scheduled' ? (
                          <span className="text-purple-600 font-bold">Scheduled</span>
                        ) : (competition.num_players - competition.available_slots) > competition.num_players ? (
                          <span className="text-red-600 font-bold">Too Many Players</span>
                        ) : competition.is_full ? (
                          <span className="text-green-600 font-bold">Full</span>
                        ) : (
                          <span>{competition.available_slots} slots left</span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                        <button
                          onClick={() => handleManagePlayers(competition)}
                          className="text-blue-600 hover:text-blue-900 mr-4"
                        >
                          Players
                        </button>
                        <button
                          onClick={() => handleEdit(competition)}
                          className="text-indigo-600 hover:text-indigo-900 mr-4"
                        >
                          Edit
                        </button>
                        {competition.is_full && competition.status !== 'scheduled' && (
                          <button
                            onClick={() => handleSchedule(competition)}
                            className="text-green-600 hover:text-green-900 mr-4"
                          >
                            Schedule
                          </button>
                        )}
                        {competition.status === 'scheduled' && (
                          <>
                            <button
                              onClick={() => handleViewSchedule(competition)}
                              className="text-green-600 hover:text-green-900 mr-4"
                            >
                              View Schedule
                            </button>
                            <button
                              onClick={() => handleDeleteSchedule(competition)}
                              className="text-yellow-600 hover:text-yellow-900 mr-4"
                            >
                              Delete Schedule
                            </button>
                          </>
                        )}
                        <button
                          onClick={() => handleDelete(competition.id)}
                          className="text-red-600 hover:text-red-900"
                        >
                          Delete
                        </button>
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
                    <div className="flex space-x-2">
                      <button
                        onClick={() => handleManagePlayers(competition)}
                        className="text-blue-600 hover:text-blue-900"
                      >
                        Players
                      </button>
                      <button
                        onClick={() => handleEdit(competition)}
                        className="text-indigo-600 hover:text-indigo-900"
                      >
                        Edit
                      </button>
                      {competition.is_full && competition.status !== 'scheduled' && (
                        <button
                          onClick={() => handleSchedule(competition)}
                          className="text-green-600 hover:text-green-900"
                        >
                          Schedule
                        </button>
                      )}
                      {competition.status === 'scheduled' && (
                        <>
                          <button
                            onClick={() => handleViewSchedule(competition)}
                            className="text-green-600 hover:text-green-900"
                          >
                            View Schedule
                          </button>
                          <button
                            onClick={() => handleDeleteSchedule(competition)}
                            className="text-yellow-600 hover:text-yellow-900"
                          >
                            Delete Schedule
                          </button>
                        </>
                      )}
                      <button
                        onClick={() => handleDelete(competition.id)}
                        className="text-red-600 hover:text-red-900"
                      >
                        Delete
                      </button>
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
                      <span className="text-gray-500">Rule Set:</span>
                      <span className="text-gray-900">{competition.rule_set_id}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">Status:</span>
                      <span className={`font-medium ${
                        competition.status === 'scheduled'
                          ? 'text-purple-600'
                          : (competition.num_players - competition.available_slots) > competition.num_players
                          ? 'text-red-600'
                          : competition.is_full
                          ? 'text-green-600'
                          : 'text-gray-900'
                      }`}>
                        {competition.status === 'scheduled'
                          ? 'Scheduled'
                          : (competition.num_players - competition.available_slots) > competition.num_players
                          ? 'Too Many Players'
                          : competition.is_full
                          ? 'Full'
                          : `${competition.available_slots} slots left`}
                      </span>
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
                        <h3 className="text-lg font-medium mb-4">Round {schedule.round}</h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div className="bg-blue-50 p-4 rounded-lg">
                            <h4 className="font-medium mb-2">Side 1</h4>
                            <ul className="space-y-2">
                              <li>{getPlayerName(schedule.side_1_player_1, viewingSchedule)}</li>
                              <li>{getPlayerName(schedule.side_1_player_2, viewingSchedule)}</li>
                              <li>{getPlayerName(schedule.side_1_player_3, viewingSchedule)}</li>
                              <li>{getPlayerName(schedule.side_1_player_4, viewingSchedule)}</li>
                            </ul>
                          </div>
                          <div className="bg-red-50 p-4 rounded-lg">
                            <h4 className="font-medium mb-2">Side 2</h4>
                            <ul className="space-y-2">
                              <li>{getPlayerName(schedule.side_2_player_1, viewingSchedule)}</li>
                              <li>{getPlayerName(schedule.side_2_player_2, viewingSchedule)}</li>
                              <li>{getPlayerName(schedule.side_2_player_3, viewingSchedule)}</li>
                              <li>{getPlayerName(schedule.side_2_player_4, viewingSchedule)}</li>
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
                        Rule Set ID
                      </label>
                      <input
                        type="number"
                        value={editingCompetition.rule_set_id}
                        onChange={(e) => setEditingCompetition({
                          ...editingCompetition,
                          rule_set_id: parseInt(e.target.value)
                        })}
                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                      />
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
              <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center">
                <div className="bg-white rounded-lg p-6 max-w-md w-full">
                  <h2 className="text-xl font-bold mb-4">Manage Players</h2>
                  <div className="mb-4">
                    <p className="text-sm text-gray-600">
                      {managingPlayers.available_slots} slots available out of {managingPlayers.num_players}
                    </p>
                  </div>

                  {!managingPlayers.is_full && (
                    <form onSubmit={handleAddPlayer} className="mb-6">
                      <div className="relative">
                        <input
                          type="text"
                          placeholder="Enter player name"
                          value={newPlayerName}
                          onChange={(e) => setNewPlayerName(e.target.value)}
                          className="w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                        />
                        {showUserDropdown && (
                          <div className="absolute z-10 w-full mt-1 bg-white shadow-lg rounded-md border border-gray-200">
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
                        <button
                          type="submit"
                          className="mt-2 w-full bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700"
                        >
                          Add {selectedUser ? 'User' : 'Guest'}
                        </button>
                      </div>
                      {error && (
                        <p className="mt-2 text-sm text-red-600">{error}</p>
                      )}
                    </form>
                  )}

                  <DragDropContext onDragEnd={handleDragEnd}>
                    <Droppable droppableId="players">
                      {(provided) => (
                        <div
                          ref={provided.innerRef}
                          {...provided.droppableProps}
                          className="space-y-2"
                        >
                          {managingPlayers.players.map((player, index) => (
                            <Draggable
                              key={player.id}
                              draggableId={player.id.toString()}
                              index={index}
                            >
                              {(provided) => (
                                <div
                                  ref={provided.innerRef}
                                  {...provided.draggableProps}
                                  {...provided.dragHandleProps}
                                  className="flex items-center p-2 bg-gray-50 rounded"
                                >
                                  <span className="mr-2 text-gray-500">#{player.order}</span>
                                  <span className="flex-grow">{player.username}</span>
                                  <button
                                    onClick={() => handleRemovePlayer(player.id)}
                                    className="text-red-600 hover:text-red-900"
                                  >
                                    Remove
                                  </button>
                                </div>
                              )}
                            </Draggable>
                          ))}
                          {provided.placeholder}
                        </div>
                      )}
                    </Droppable>
                  </DragDropContext>

                  <div className="mt-6 flex justify-end">
                    <button
                      onClick={() => setManagingPlayers(null)}
                      className="bg-gray-200 text-gray-700 px-4 py-2 rounded-md hover:bg-gray-300"
                    >
                      Close
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