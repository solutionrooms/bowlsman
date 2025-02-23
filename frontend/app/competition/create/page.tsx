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

export default function CreateCompetition() {
  const [numPlayers, setNumPlayers] = useState<number>(4);
  const [error, setError] = useState<string>('');
  const [user, setUser] = useState<User | null>(null);
  const router = useRouter();

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      router.push('/');
      return;
    }

    const fetchUser = async () => {
      try {
        const response = await api.get<User>('/users/me/', {
          headers: { 
            Authorization: `Token ${token}`
          }
        });
        setUser(response.data);
      } catch (error) {
        localStorage.removeItem('token');
        router.push('/');
      }
    };

    fetchUser();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (numPlayers < 4 || numPlayers > 40) {
      setError('Number of players must be between 4 and 40');
      return;
    }

    try {
      await api.post('/competitions/', {
        num_players: numPlayers,
        rule_set_id: 1  // Default rule set, you can modify this later
      });
      router.push('/competition/manage');
    } catch (error) {
      console.error('Error creating competition:', error);
      setError('Failed to create competition');
    }
  };

  if (!user) {
    return <div>Loading...</div>;
  }

  return (
    <div className="min-h-screen bg-gray-100">
      <Navigation isStaff={user.is_staff} />
      
      <div className="py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-md mx-auto">
          <div className="bg-white shadow rounded-lg p-6">
            <h1 className="text-2xl font-bold mb-6">Create New Competition</h1>
            
            <form onSubmit={handleSubmit}>
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