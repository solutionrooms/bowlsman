'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Navigation from '../../components/Navigation';
import api from '../../../src/lib/axios';

interface User {
  username: string;
  email: string;
  is_staff: boolean;
}

interface Club {
  id: number;
  name: string;
}

export default function CreateCompetition() {
  const [numPlayers, setNumPlayers] = useState<number>(4);
  const [name, setName] = useState<string>('');
  const [parallelMatches, setParallelMatches] = useState<number>(1);
  const [maxRounds, setMaxRounds] = useState<number>(5);
  const [error, setError] = useState<string>('');
  const [user, setUser] = useState<User | null>(null);
  const [currentClub, setCurrentClub] = useState<Club | null>(null);
  const [userClubs, setUserClubs] = useState<Club[]>([]);
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

    const fetchUserData = async () => {
      try {
        const response = await api.get<User & { clubs: Club[] }>('/users/me/');
        setUser(response.data);
        
        // Get user's current club from localStorage
        const storedCurrentClub = localStorage.getItem('currentClub');
        if (storedCurrentClub) {
          setCurrentClub(JSON.parse(storedCurrentClub) as Club);
        }
        
        // Get user's clubs
        const userClubsData = response.data.clubs || [];
        setUserClubs(userClubsData);
        
        // If no current club but user has clubs, set the first one as current
        if (!storedCurrentClub && userClubsData.length > 0) {
          setCurrentClub(userClubsData[0]);
        }
      } catch (error) {
        console.error('Error fetching user data:', error);
        localStorage.removeItem('token');
        router.push('/');
      }
    };

    fetchUserData();
  }, [mounted]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (numPlayers < 4 || numPlayers > 40) {
      setError('Number of players must be between 4 and 40');
      return;
    }

    if (!name.trim()) {
      setError('Competition name is required');
      return;
    }
    
    if (!currentClub) {
      setError('You must be a member of a club to create a competition');
      return;
    }

    try {
      await api.post('/competitions/', {
        name,
        num_players: numPlayers,
        rule_set_id: 1,  // Default rule set, you can modify this later
        parallel_matches: parallelMatches,
        max_rounds: maxRounds,
        club: currentClub.id
      });
      router.push('/competition/manage');
    } catch (error: any) {
      console.error('Error creating competition:', error);
      if (error.response?.data?.error) {
        setError(error.response.data.error);
      } else {
        setError('Failed to create competition');
      }
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
      
      <div className="py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-md mx-auto">
          <div className="bg-white shadow rounded-lg p-6">
            <h1 className="text-2xl font-bold mb-6">Create New Competition</h1>
            
            <form onSubmit={handleSubmit}>
              <div className="mb-4">
                <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-2">
                  Competition Name
                </label>
                <input
                  type="text"
                  id="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                  required
                />
              </div>

              {userClubs.length > 1 && (
                <div className="mb-4">
                  <label htmlFor="club" className="block text-sm font-medium text-gray-700 mb-2">
                    Club
                  </label>
                  <select
                    id="club"
                    value={currentClub?.id || ''}
                    onChange={(e) => {
                      const selectedClub = userClubs.find(club => club.id === parseInt(e.target.value));
                      setCurrentClub(selectedClub || null);
                    }}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                    required
                  >
                    <option value="">Select a club</option>
                    {userClubs.map(club => (
                      <option key={club.id} value={club.id}>
                        {club.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {userClubs.length === 1 && currentClub && (
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Club
                  </label>
                  <div className="mt-1 p-2 bg-gray-100 rounded-md text-gray-700">
                    {currentClub.name}
                  </div>
                </div>
              )}

              <div className="mb-4">
                <label htmlFor="numPlayers" className="block text-sm font-medium text-gray-700 mb-2">
                  Number of Players
                </label>
                <input
                  type="number"
                  id="numPlayers"
                  min={4}
                  max={40}
                  value={numPlayers}
                  onChange={(e) => setNumPlayers(parseInt(e.target.value))}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                />
                <p className="mt-1 text-sm text-gray-500">
                  Choose a number between 4 and 40
                </p>
              </div>

              <div className="mb-4">
                <label htmlFor="parallelMatches" className="block text-sm font-medium text-gray-700 mb-2">
                  Parallel Matches
                </label>
                <input
                  type="number"
                  id="parallelMatches"
                  min={1}
                  max={10}
                  value={parallelMatches}
                  onChange={(e) => setParallelMatches(parseInt(e.target.value))}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                />
                <p className="mt-1 text-sm text-gray-500">
                  Number of matches that can be played simultaneously (1-10)
                </p>
              </div>

              <div className="mb-4">
                <label htmlFor="maxRounds" className="block text-sm font-medium text-gray-700 mb-2">
                  Maximum Rounds
                </label>
                <input
                  type="number"
                  id="maxRounds"
                  min={1}
                  max={20}
                  value={maxRounds}
                  onChange={(e) => setMaxRounds(parseInt(e.target.value))}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                />
                <p className="mt-1 text-sm text-gray-500">
                  Maximum number of rounds to generate (1-20)
                </p>
              </div>

              {error && (
                <div className="mb-4 text-red-600 text-sm">
                  {error}
                </div>
              )}

              <div className="flex justify-between">
                <button
                  type="button"
                  onClick={() => router.back()}
                  className="bg-gray-200 text-gray-700 px-4 py-2 rounded-md hover:bg-gray-300 focus:outline-none focus:ring-2 focus:ring-gray-500"
                >
                  Back
                </button>
                <button
                  type="submit"
                  className="bg-indigo-600 text-white px-4 py-2 rounded-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  Create Competition
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
} 