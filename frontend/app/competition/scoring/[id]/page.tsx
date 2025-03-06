'use client';

import { useState, useEffect } from 'react';
import axios from 'axios';
import { useParams } from 'next/navigation';

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
  const [competitionData, setCompetitionData] = useState<any>(null);
  const [schedules, setSchedules] = useState<CompetitionSchedule[]>([]);
  const [gameScores, setGameScores] = useState<GameScore[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Keep track of edited scores
  const [editedScores, setEditedScores] = useState<{
    [key: number]: { side_1_score: number | null; side_2_score: number | null }
  }>({});

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        
        // Fetch competition data
        const compResponse = await axios.get(`/api/competitions/${id}/`);
        setCompetitionData(compResponse.data);
        
        // Fetch schedules for this competition
        const scheduleResponse = await axios.get(`/api/competition-schedules/?competition=${id}`);
        setSchedules(scheduleResponse.data);
        
        // Fetch game scores
        const scoresResponse = await axios.get(`/api/game-scores/?competition=${id}`);
        setGameScores(scoresResponse.data);
        
        // Fetch all users to get names
        const usersResponse = await axios.get('/api/users/');
        setUsers(usersResponse.data);
        
        setLoading(false);
      } catch (err) {
        console.error('Error fetching data:', err);
        setError('Failed to load competition data');
        setLoading(false);
      }
    };
    
    fetchData();
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
      
      await axios.patch(`/api/game-scores/${gameId}/`, {
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
  if (error) return <div className="p-4 text-red-500">{error}</div>;
  
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