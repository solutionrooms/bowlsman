'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import api from '../../../../src/lib/axios';
import Navigation from '../../../components/Navigation';
import PageHeading from '../../../components/PageHeading';
import pageDescriptions from '../../../utils/pageDescriptions';

interface GameScore {
  id: number;
  schedule: number;
  side_1_score: number | null;
  side_2_score: number | null;
  completed: boolean;
  round: number;
  sub_round: number;
}

interface CompetitionSchedule {
  id: number;
  competition: number;
  side_1_player_1: number;
  side_1_player_2: number | null;
  side_1_player_3: number | null;
  side_1_player_4: number | null;
  side_2_player_1: number;
  side_2_player_2: number | null;
  side_2_player_3: number | null;
  side_2_player_4: number | null;
  round: number;
  sub_round: number;
  player_1_name?: string;
  player_2_name?: string;
}

interface User {
  id: number;
  username: string;
  email: string;
  first_name: string;
  last_name: string;
  clubs?: UserClub[];
}

interface UserClub {
  id: number;
  name: string;
  is_admin: boolean;
}

interface Competition {
  id: number;
  name: string;
  status: string;
  creator: number;
  num_players: number;
  players: any[];
}

const ScoringPage = () => {
  const { id } = useParams();
  const router = useRouter();
  const [competitionData, setCompetitionData] = useState<Competition | null>(null);
  const [availableCompetitions, setAvailableCompetitions] = useState<Competition[]>([]);
  const [schedules, setSchedules] = useState<CompetitionSchedule[]>([]);
  const [gameScores, setGameScores] = useState<GameScore[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [canEditScores, setCanEditScores] = useState(true);
  const [currentClub, setCurrentClub] = useState<UserClub | null>(null);
  
  // Keep track of edited scores
  const [editedScores, setEditedScores] = useState<{
    [key: number]: { side_1_score: number | null; side_2_score: number | null }
  }>({});

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('currentClub');
    router.push('/');
  };

  // Simplified data fetching to avoid race conditions
  useEffect(() => {
    let isComponentMounted = true;
    
    const fetchAllData = async () => {
      try {
        setLoading(true);
        setError(null); // Clear any previous errors
        
        // Get user data
        const userResponse = await api.get<{user: User; current_club: UserClub}>('/users/me/');
        if (!isComponentMounted) return;
        
        const userData = userResponse.data;
        setCurrentUser(userData.user);
        setCurrentClub(userData.current_club);
        
        if (!id) {
          setError('No competition ID provided');
          setLoading(false);
          return;
        }
        
        // Fetch competition details
        console.log(`Fetching competition data for ID: ${id}`);
        const compResponse = await api.get<Competition>(`competitions/${id}`);
        if (!isComponentMounted) return;
        
        const competition = compResponse.data;
        console.log('Competition data:', competition);
        setCompetitionData(competition);
        
        // Check permissions
        const isCompetitionOrganizer = competition.creator === userData.user.id;
        const isClubAdmin = userData.user.clubs?.some(
          club => club.id === userData.current_club?.id && club.is_admin
        );
        
        console.log('User is club admin:', isClubAdmin);
        console.log('User is competition organizer:', isCompetitionOrganizer);
        setCanEditScores(isClubAdmin || isCompetitionOrganizer);
        
        // Fetch schedules for this competition
        const scheduleResponse = await api.get<CompetitionSchedule[]>(`competitions/${id}/schedule`);
        if (!isComponentMounted) return;
        
        if (scheduleResponse.data.length === 0) {
          setError(`No schedule found for this competition. Please create a schedule first.`);
          setLoading(false);
          return;
        }
        
        setSchedules(scheduleResponse.data);
        
        // Fetch game scores
        const scoresResponse = await api.get<GameScore[]>(`game-scores/?competition=${id}`);
        if (!isComponentMounted) return;
        
        if (scoresResponse.data.length === 0) {
          setError(`No scores found. This competition may not have been started yet.`);
          setLoading(false);
          return;
        }
        
        setGameScores(scoresResponse.data);
        
        // Fetch all users to get names
        const usersResponse = await api.get<User[]>('users');
        if (!isComponentMounted) return;
        setUsers(usersResponse.data);
        
        setLoading(false);
      } catch (err: any) {
        console.error('Error fetching data:', err);
        if (!isComponentMounted) return;
        
        if (err.response) {
          setError('Failed to load competition data: ' + (err.response.data?.error || err.message));
        } else {
          setError('Failed to load competition data: ' + err.message);
        }
        setLoading(false);
      }
    };
    
    fetchAllData();
    
    return () => {
      isComponentMounted = false;
    };
  }, [id]);

  const getUserName = (userId: number | null) => {
    if (!userId) return '';
    const user = users.find(u => u.id === userId);
    return user ? `${user.first_name} ${user.last_name}` : 'Unknown player';
  };
  
  const getTeamName = (schedule: CompetitionSchedule, side: 1 | 2) => {
    const playerIds = [];
    
    if (side === 1) {
      if (schedule.side_1_player_1) playerIds.push(schedule.side_1_player_1);
      if (schedule.side_1_player_2) playerIds.push(schedule.side_1_player_2);
      if (schedule.side_1_player_3) playerIds.push(schedule.side_1_player_3);
      if (schedule.side_1_player_4) playerIds.push(schedule.side_1_player_4);
    } else {
      if (schedule.side_2_player_1) playerIds.push(schedule.side_2_player_1);
      if (schedule.side_2_player_2) playerIds.push(schedule.side_2_player_2);
      if (schedule.side_2_player_3) playerIds.push(schedule.side_2_player_3);
      if (schedule.side_2_player_4) playerIds.push(schedule.side_2_player_4);
    }
    
    return playerIds.map(id => getUserName(id)).join(', ');
  };
  
  const handleScoreChange = (gameId: number, side: 'side_1_score' | 'side_2_score', value: string) => {
    // We'll still log a warning if somehow a user without permission tries to edit
    if (!canEditScores) {
      console.warn('User does not have permission to edit scores');
      return;
    }
    
    const numValue = value === '' ? null : parseInt(value, 10);
    
    setEditedScores(prev => ({
      ...prev,
      [gameId]: {
        ...(prev[gameId] || {}),
        [side]: numValue
      }
    }));
  };
  
  const commitScore = async (gameId: number) => {
    // We'll still log a warning if somehow a user without permission tries to commit
    if (!canEditScores) {
      console.warn('User does not have permission to edit scores');
      return;
    }
    
    try {
      const scoreData = editedScores[gameId];
      if (!scoreData) return;
      
      await api.patch(`game-scores/${gameId}`, {
        ...scoreData,
        completed: true
      });
      
      // Update local state
      setGameScores(prev => prev.map(game => 
        game.id === gameId 
          ? { 
              ...game, 
              ...scoreData,
              completed: true 
            } 
          : game
      ));
      
      // Clear from edited scores
      const newEditedScores = { ...editedScores };
      delete newEditedScores[gameId];
      setEditedScores(newEditedScores);
      
    } catch (err: any) {
      console.error('Error committing score:', err);
      setError('Failed to commit score');
    }
  };
  
  // Add a function to increment/decrement scores
  const adjustScore = (gameId: number, side: 'side_1_score' | 'side_2_score', adjustment: number) => {
    if (!canEditScores) {
      console.warn('User does not have permission to edit scores');
      return;
    }
    
    // Get current score value
    const currentScore = editedScores[gameId]?.[side] ?? 
                         gameScores.find(gs => gs.id === gameId)?.[side] ?? 
                         0;
    
    // Calculate new score (don't allow negative scores)
    const newScore = Math.max(0, (currentScore || 0) + adjustment);
    
    // Update the score
    setEditedScores(prev => ({
      ...prev,
      [gameId]: {
        ...(prev[gameId] || {}),
        [side]: newScore
      }
    }));
  };
  
  // Group schedules by round
  const roundGroups = schedules.reduce((groups, schedule) => {
    const round = schedule.round;
    if (!groups[round]) {
      groups[round] = [];
    }
    groups[round].push(schedule);
    return groups;
  }, {} as { [key: number]: CompetitionSchedule[] });

  if (error && !loading) {
    return (
      <div className="min-h-screen bg-gray-100">
        <Navigation onLogout={handleLogout} />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="mb-6">
            <PageHeading 
              title="Competition Scoring" 
              infoText={pageDescriptions.competitionScoring}
              className="text-2xl font-bold text-gray-900"
            />
            <div className="mt-2 flex items-center">
              <button
                onClick={() => router.push('/competition/scoring')}
                className="inline-flex items-center px-3 py-1 border border-transparent text-sm font-medium rounded-md text-blue-700 bg-blue-100 hover:bg-blue-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              >
                ← Back to Competitions
              </button>
            </div>
          </div>
          
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
        </div>
      </div>
    );
  }

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
          <PageHeading 
            title="Competition Scoring" 
            infoText={pageDescriptions.competitionScoring}
            className="text-2xl font-bold text-gray-900"
          />
          <div className="mt-2 flex items-center">
            <button
              onClick={() => router.push('/competition/scoring')}
              className="inline-flex items-center px-3 py-1 border border-transparent text-sm font-medium rounded-md text-blue-700 bg-blue-100 hover:bg-blue-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              ← Back to Competitions
            </button>
            {competitionData && (
              <span className="ml-4 text-gray-500">
                {competitionData.name}
              </span>
            )}
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
        
        {!canEditScores && (
          <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 mb-6">
            <div className="flex">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5 text-yellow-400" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="ml-3">
                <p className="text-sm text-yellow-700">
                  You are in view-only mode. Only club administrators and competition organizers can edit scores.
                </p>
              </div>
            </div>
          </div>
        )}
        
        {Object.entries(roundGroups).map(([round, roundSchedules]) => (
          <div key={round} className="mb-8">
            <h2 className="text-xl font-semibold mb-2">Round {round}</h2>
            
            <div className="overflow-x-auto">
              <table className="min-w-full bg-white border border-gray-300">
                <thead>
                  <tr className="bg-gray-100">
                    <th className="px-4 py-2 border">Match</th>
                    <th className="px-4 py-2 border">Team 1</th>
                    <th className="px-4 py-2 border">Score</th>
                    <th className="px-4 py-2 border">Team 2</th>
                    <th className="px-4 py-2 border">Score</th>
                    <th className="px-4 py-2 border">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {roundSchedules.map(schedule => {
                    const gameScore = gameScores.find(
                      gs => gs.schedule === schedule.id
                    );
                    
                    if (!gameScore) return null;
                    
                    const team1Name = getTeamName(schedule, 1);
                    const team2Name = getTeamName(schedule, 2);
                    const isEdited = !!editedScores[gameScore.id];
                    
                    return (
                      <tr key={schedule.id} className={gameScore.completed ? "bg-green-50" : ""}>
                        <td className="px-4 py-2 border">
                          {schedule.sub_round > 0 ? `${schedule.sub_round}` : ''}
                        </td>
                        <td className="px-4 py-2 border">{team1Name}</td>
                        <td className="px-4 py-2 border">
                          {gameScore.completed ? (
                            gameScore.side_1_score
                          ) : (
                            <div className="flex items-center space-x-1">
                              <button 
                                className="w-6 h-6 flex items-center justify-center bg-red-100 text-red-700 rounded hover:bg-red-200"
                                onClick={() => adjustScore(gameScore.id, 'side_1_score', -1)}
                                disabled={!canEditScores || gameScore.completed}
                              >
                                -
                              </button>
                              <input
                                type="number"
                                className="w-16 px-2 py-1 border rounded text-center"
                                value={editedScores[gameScore.id]?.side_1_score ?? gameScore.side_1_score ?? ''}
                                onChange={(e) => handleScoreChange(gameScore.id, 'side_1_score', e.target.value)}
                                disabled={!canEditScores || gameScore.completed}
                              />
                              <button 
                                className="w-6 h-6 flex items-center justify-center bg-green-100 text-green-700 rounded hover:bg-green-200"
                                onClick={() => adjustScore(gameScore.id, 'side_1_score', 1)}
                                disabled={!canEditScores || gameScore.completed}
                              >
                                +
                              </button>
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-2 border">{team2Name}</td>
                        <td className="px-4 py-2 border">
                          {gameScore.completed ? (
                            gameScore.side_2_score
                          ) : (
                            <div className="flex items-center space-x-1">
                              <button 
                                className="w-6 h-6 flex items-center justify-center bg-red-100 text-red-700 rounded hover:bg-red-200"
                                onClick={() => adjustScore(gameScore.id, 'side_2_score', -1)}
                                disabled={!canEditScores || gameScore.completed}
                              >
                                -
                              </button>
                              <input
                                type="number"
                                className="w-16 px-2 py-1 border rounded text-center"
                                value={editedScores[gameScore.id]?.side_2_score ?? gameScore.side_2_score ?? ''}
                                onChange={(e) => handleScoreChange(gameScore.id, 'side_2_score', e.target.value)}
                                disabled={!canEditScores || gameScore.completed}
                              />
                              <button 
                                className="w-6 h-6 flex items-center justify-center bg-green-100 text-green-700 rounded hover:bg-green-200"
                                onClick={() => adjustScore(gameScore.id, 'side_2_score', 1)}
                                disabled={!canEditScores || gameScore.completed}
                              >
                                +
                              </button>
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-2 border">
                          {!gameScore.completed && canEditScores && (
                            <button
                              className={`px-3 py-1 rounded ${isEdited ? 'bg-blue-500 text-white' : 'bg-gray-200'}`}
                              onClick={() => commitScore(gameScore.id)}
                              disabled={!isEdited}
                            >
                              Commit
                            </button>
                          )}
                          {gameScore.completed && (
                            <span className="text-green-600">Completed</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default ScoringPage;