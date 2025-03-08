'use client';

import { useState, useEffect } from 'react';
import axios from 'axios';
import { useParams } from 'next/navigation';
import PageHeading from '../../../components/PageHeading';
import pageDescriptions from '../../../utils/pageDescriptions';

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
}

interface User {
  id: number;
  username: string;
  email: string;
  first_name: string;
  last_name: string;
}

const ResultsPage = () => {
  const { id } = useParams();
  const [competitionData, setCompetitionData] = useState<any>(null);
  const [schedules, setSchedules] = useState<CompetitionSchedule[]>([]);
  const [gameScores, setGameScores] = useState<GameScore[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
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
      <PageHeading 
        title={`${competitionData?.name || 'Competition'} - Results`}
        infoText={pageDescriptions.competitionResults}
        className="text-2xl font-bold mb-4"
      />
      
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
                  <th className="px-4 py-2 border">Status</th>
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
                  
                  // Calculate winner
                  let winner = null;
                  if (gameScore.completed) {
                    if (gameScore.side_1_score !== null && gameScore.side_2_score !== null) {
                      if (gameScore.side_1_score > gameScore.side_2_score) {
                        winner = 1;
                      } else if (gameScore.side_2_score > gameScore.side_1_score) {
                        winner = 2;
                      } else {
                        winner = 'tie';
                      }
                    }
                  }
                  
                  return (
                    <tr key={schedule.id}>
                      <td className="px-4 py-2 border">
                        {schedule.sub_round > 0 ? `${schedule.sub_round}` : ''}
                      </td>
                      <td className={`px-4 py-2 border ${winner === 1 ? 'font-bold bg-green-100' : ''}`}>
                        {team1Name}
                      </td>
                      <td className={`px-4 py-2 border ${winner === 1 ? 'font-bold bg-green-100' : ''}`}>
                        {gameScore.side_1_score !== null ? gameScore.side_1_score : '-'}
                      </td>
                      <td className={`px-4 py-2 border ${winner === 2 ? 'font-bold bg-green-100' : ''}`}>
                        {team2Name}
                      </td>
                      <td className={`px-4 py-2 border ${winner === 2 ? 'font-bold bg-green-100' : ''}`}>
                        {gameScore.side_2_score !== null ? gameScore.side_2_score : '-'}
                      </td>
                      <td className="px-4 py-2 border">
                        {gameScore.completed ? (
                          <span className="text-green-600">Completed</span>
                        ) : (
                          <span className="text-yellow-600">Pending</span>
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

export default ResultsPage;