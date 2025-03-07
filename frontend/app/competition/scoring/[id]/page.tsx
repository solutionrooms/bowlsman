'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import api from '../../../../src/lib/axios';

interface GameScore {
  id: number;
  competition_schedule: number;
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
}

const ScoringPage = () => {
  const { id } = useParams();
  const router = useRouter();
  const [competitionData, setCompetitionData] = useState<any>(null);
  const [availableCompetitions, setAvailableCompetitions] = useState<any[]>([]);
  const [schedules, setSchedules] = useState<CompetitionSchedule[]>([]);
  const [gameScores, setGameScores] = useState<GameScore[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentClub, setCurrentClub] = useState<any>(null);
  
  // Keep track of edited scores
  const [editedScores, setEditedScores] = useState<{
    [key: number]: { side_1_score: number | null; side_2_score: number | null }
  }>({});

  // First, get the user's current club and available competitions
  useEffect(() => {
    const fetchClubAndCompetitions = async () => {
      try {
        setLoading(true);
        
        // Get current club
        const userResponse = await api.get('users/me');
        const club = userResponse.data.current_club;
        setCurrentClub(club);
        
        if (!club) {
          setError('No club selected. Please select a club first.');
          setLoading(false);
          return;
        }
        
        console.log(`Fetching competitions for club_id=${club.id} with status=in_progress`);
        
        // Get in-progress competitions for the current club
        let inProgressCompetitions = [];
        try {
          // Make sure status value has no typos, whitespace or trailing characters
          const status = "in_progress";
          // Make sure we don't add a trailing slash in the query parameter
          const compsResponse = await api.get(`competitions?club_id=${club.id}&status=${status}`);
          console.log('Raw competition response:', compsResponse.data);
          
          // Additional check to filter by status in the frontend (should already be filtered by backend)
          inProgressCompetitions = compsResponse.data.filter(
            (comp: any) => comp.status === 'in_progress'
          );
          
          console.log('Filtered in-progress competitions:', inProgressCompetitions);
        } catch (error) {
          console.error('Error fetching competitions:', error);
          setError('Failed to fetch competitions: ' + (error.response?.data?.error || error.message));
          setLoading(false);
          return;
        }
        
        setAvailableCompetitions(inProgressCompetitions);
        
        if (inProgressCompetitions.length === 0) {
          setError('No competitions in progress for this club. Start a competition first.');
          setLoading(false);
          return;
        }
        
        // If we have an ID in the URL, check if it's valid
        if (id) {
          const competitionExists = inProgressCompetitions.some(
            (comp: any) => comp.id === parseInt(id as string)
          );
          
          if (!competitionExists) {
            setError(`Competition with ID ${id} is not in progress or doesn't exist in your club.`);
            setLoading(false);
            return;
          }
        } else if (inProgressCompetitions.length > 0) {
          // No ID in URL, redirect to the first available competition
          router.push(`/competition/scoring/${inProgressCompetitions[0].id}`);
          return;
        }
        
        setLoading(false);
      } catch (err) {
        console.error('Error fetching club and competitions:', err);
        setError('Failed to load competitions: ' + (err.response?.data?.error || err.message));
        setLoading(false);
      }
    };
    
    fetchClubAndCompetitions();
  }, [router]);

  // Then, fetch the specific competition data once we've verified it's valid
  useEffect(() => {
    if (!id || !currentClub || availableCompetitions.length === 0 || loading) {
      return; // Wait until we have verified the ID is valid
    }
    
    const fetchCompetitionData = async () => {
      try {
        setLoading(true);
        
        // Fetch competition data
        const compResponse = await api.get(`competitions/${id}`);
        setCompetitionData(compResponse.data);
        
        // Fetch schedules for this competition
        const scheduleResponse = await api.get(`competitions/${id}/schedule`);
        setSchedules(scheduleResponse.data);
        
        // Fetch game scores
        const scoresResponse = await api.get(`game-scores/?competition=${id}`);
        setGameScores(scoresResponse.data);
        
        // Fetch all users to get names
        const usersResponse = await api.get('users');
        setUsers(usersResponse.data);
        
        setLoading(false);
      } catch (err) {
        console.error('Error fetching competition data:', err);
        if (err.response) {
          setError('Failed to load competition data: ' + (err.response.data?.error || err.message));
        } else {
          setError('Failed to load competition data: ' + err.message);
        }
        setLoading(false);
      }
    };
    
    fetchCompetitionData();
  }, [id, currentClub, availableCompetitions, loading]);
  
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
    const numValue = value === '' ? null : parseInt(value, 10);
    
    setEditedScores(prev => ({
      ...prev,
      [gameId]: {
        ...prev[gameId],
        [side]: numValue
      }
    }));
  };
  
  const commitScore = async (gameId: number) => {
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
      
    } catch (err) {
      console.error('Error committing score:', err);
      setError('Failed to commit score');
    }
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
  
  if (loading) return <div className="p-4">Loading...</div>;
  
  if (error) {
    return (
      <div className="p-4">
        <div className="bg-red-50 border-l-4 border-red-400 p-4 mb-4">
          <div className="flex">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3">
              <p className="text-sm text-red-700">{error}</p>
              <div className="mt-4">
                {availableCompetitions.length > 0 ? (
                  <div>
                    <p className="text-sm text-gray-700 mb-2">Available competitions:</p>
                    <div className="space-y-2">
                      {availableCompetitions.map(comp => (
                        <button
                          key={comp.id}
                          onClick={() => router.push(`/competition/scoring/${comp.id}`)}
                          className="block w-full text-left px-3 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                        >
                          {comp.name} - {comp.status}
                        </button>
                      ))}
                    </div>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => router.push('/competition/manage')}
                    className="inline-flex items-center px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                  >
                    Back to Competitions
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }
  
  return (
    <div className="p-4">
      <h1 className="text-2xl font-bold mb-4">
        {competitionData?.name || 'Competition'} - Scoring
      </h1>
      
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
                    gs => gs.competition_schedule === schedule.id
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
                          <input
                            type="number"
                            className="w-20 px-2 py-1 border rounded"
                            value={editedScores[gameScore.id]?.side_1_score ?? gameScore.side_1_score ?? ''}
                            onChange={(e) => handleScoreChange(gameScore.id, 'side_1_score', e.target.value)}
                            disabled={gameScore.completed}
                          />
                        )}
                      </td>
                      <td className="px-4 py-2 border">{team2Name}</td>
                      <td className="px-4 py-2 border">
                        {gameScore.completed ? (
                          gameScore.side_2_score
                        ) : (
                          <input
                            type="number"
                            className="w-20 px-2 py-1 border rounded"
                            value={editedScores[gameScore.id]?.side_2_score ?? gameScore.side_2_score ?? ''}
                            onChange={(e) => handleScoreChange(gameScore.id, 'side_2_score', e.target.value)}
                            disabled={gameScore.completed}
                          />
                        )}
                      </td>
                      <td className="px-4 py-2 border">
                        {!gameScore.completed && (
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
  );
};

export default ScoringPage;