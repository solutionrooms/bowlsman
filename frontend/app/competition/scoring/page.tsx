'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import api from '../../../src/lib/axios';
import Navigation from '../../components/Navigation';
import PageHeading from '../../components/PageHeading';
import pageDescriptions from '../../utils/pageDescriptions';
import Link from 'next/link';

interface Club {
  id: number;
  name: string;
  is_admin: boolean;
}

interface Competition {
  id: number;
  name: string;
  status: string;
  num_players: number;
  players: any[];
}

interface UserData {
  current_club: Club | null;
  clubs: Club[];
  user: {
    id: number;
    username: string;
    email: string;
  };
}

export default function ScoringSelectionPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [inProgressCompetitions, setInProgressCompetitions] = useState<Competition[]>([]);
  const [userClubs, setUserClubs] = useState<Club[]>([]);
  const [currentClub, setCurrentClub] = useState<Club | null>(null);

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('currentClub');
    router.push('/');
  };

  useEffect(() => {
    const fetchUserData = async () => {
      try {
        setLoading(true);
        setError(null); // Clear any previous errors
        
        // Get user data including clubs
        const userResponse = await api.get<UserData>('users/me');
        const userData = userResponse.data;
        const current_club = userData.current_club;
        const clubs = userData.clubs || [];
        
        setUserClubs(clubs);
        setCurrentClub(current_club);
        
        if (current_club) {
          // Get competitions for the current club - include all statuses
          const compsResponse = await api.get<Competition[]>(`competitions?club_id=${current_club.id}`);
          
          // Get all competitions for the club
          const competitions = compsResponse.data;
          
          console.log('Fetched competitions:', competitions);
          setInProgressCompetitions(competitions);
          
          if (competitions.length === 0) {
            console.log('No competitions found for this club');
          }
        } else {
          console.log('No current club selected');
          setError('Please select a club to view competitions');
        }
        
        setLoading(false);
      } catch (err: any) {
        console.error('Error fetching user data:', err);
        setError('Failed to load user data: ' + (err.response?.data?.error || err.message));
        setLoading(false);
      }
    };
    
    fetchUserData();
  }, [router]);

  const handleClubChange = async (clubId: number) => {
    try {
      setLoading(true);
      
      // Update current club in backend and localStorage
      await api.put('club-users/set_current_club', { club_id: clubId });
      
      // Reload competitions for the selected club
      const compsResponse = await api.get<Competition[]>(`competitions?club_id=${clubId}`);
      
      // Get all competitions for the club
      const competitions = compsResponse.data;
      
      setInProgressCompetitions(competitions);
      
      // Find and set the current club in state
      const selectedClub = userClubs.find(club => club.id === clubId);
      if (selectedClub) {
        setCurrentClub(selectedClub);
      }
      
      setLoading(false);
    } catch (err: any) {
      console.error('Error changing club:', err);
      setError('Failed to change club: ' + (err.response?.data?.error || err.message));
      setLoading(false);
    }
  };

  // Helper function to get status badge color
  const getStatusBadgeColor = (status: string) => {
    switch (status) {
      case 'in_progress':
        return 'bg-green-100 text-green-800';
      case 'completed':
        return 'bg-blue-100 text-blue-800';
      case 'scheduled':
        return 'bg-yellow-100 text-yellow-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  // Helper function to format status for display
  const formatStatus = (status: string) => {
    switch (status) {
      case 'in_progress':
        return 'In Progress';
      case 'completed':
        return 'Completed';
      case 'scheduled':
        return 'Scheduled';
      default:
        return status.charAt(0).toUpperCase() + status.slice(1).replace('_', ' ');
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
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <PageHeading 
          title="Competition Scoring" 
          infoText={pageDescriptions.competitionScoring}
          className="text-2xl font-bold mb-6"
        />
        
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
        
        {/* Club selection */}
        {userClubs.length > 0 && (
          <div className="bg-white shadow overflow-hidden sm:rounded-lg mb-6">
            <div className="px-4 py-5 sm:p-6">
              <h2 className="text-lg font-medium text-gray-900 mb-4">Select Club</h2>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {userClubs.map(club => (
                  <button
                    key={club.id}
                    onClick={() => handleClubChange(club.id)}
                    className={`relative block w-full p-4 border rounded-lg shadow-sm ${
                      currentClub?.id === club.id
                        ? 'border-blue-500 ring-2 ring-blue-500 bg-blue-50'
                        : 'border-gray-300 hover:border-gray-400'
                    }`}
                  >
                    <span className="block text-sm font-medium text-gray-900">{club.name}</span>
                    {club.is_admin && (
                      <span className="mt-1 block text-xs text-blue-600">(Admin)</span>
                    )}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
        
        {/* Competition selection */}
        {currentClub && (
          <div className="bg-white shadow overflow-hidden sm:rounded-lg">
            <div className="px-4 py-5 sm:p-6">
              <h2 className="text-lg font-medium text-gray-900 mb-4">
                {inProgressCompetitions.length > 0
                  ? 'Select Competition'
                  : 'No Competitions Found'}
              </h2>
              
              {inProgressCompetitions.length > 0 ? (
                <div className="space-y-4">
                  {inProgressCompetitions.map(comp => (
                    <button
                      key={comp.id}
                      onClick={() => router.push(`/competition/scoring/${comp.id}`)}
                      className="block w-full text-left px-6 py-4 border border-gray-300 rounded-lg hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                    >
                      <div className="flex justify-between items-center">
                        <div>
                          <h3 className="text-lg font-medium text-gray-900">{comp.name}</h3>
                          <p className="mt-1 text-sm text-gray-500">
                            Players: {comp.players?.length || 0} / {comp.num_players}
                          </p>
                        </div>
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusBadgeColor(comp.status)}`}>
                          {formatStatus(comp.status)}
                        </span>
                      </div>
                    </button>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                  </svg>
                  <h3 className="mt-2 text-sm font-medium text-gray-900">No competitions found</h3>
                  <p className="mt-1 text-sm text-gray-500">
                    Create a competition in the Competitions page first.
                  </p>
                  <div className="mt-6">
                    <button
                      type="button"
                      onClick={() => router.push('/competition/manage')}
                      className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                    >
                      Go to Competitions
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}