'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Navigation from '../components/Navigation';
import api from '../../src/lib/axios';

interface Game {
  id: number;
  date: string;
  location: string;
  status: string;
  players: string[];
  scores: number[];
}

export default function Games() {
  const [games, setGames] = useState<Game[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);
  const router = useRouter();

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    const fetchGames = async () => {
      try {
        if (!mounted) return;
        
        const token = localStorage.getItem('token');
        if (!token) {
          router.push('/');
          return;
        }

        // This is just a placeholder - replace with actual API endpoint when available
        setLoading(false);
        
        // Uncomment and modify when the API endpoint is ready
        // const response = await api.get<Game[]>('/games/', {
        //   headers: { Authorization: `Token ${token}` }
        // });
        // setGames(response.data);
        // setLoading(false);
      } catch (error) {
        console.error('Error fetching games:', error);
        setError('Failed to load games. Please try again later.');
        setLoading(false);
      }
    };

    fetchGames();
  }, [router, mounted]);

  const handleLogout = () => {
    if (mounted) {
      localStorage.removeItem('token');
      router.push('/');
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <>
      <Navigation onLogout={handleLogout} />
      <div className="container mx-auto px-4 py-8">
        <div className="bg-white shadow rounded-lg p-6">
          <h1 className="text-2xl font-bold mb-6">Games</h1>
          
          <div className="text-center py-8">
            <div className="mb-4">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-16 w-16 mx-auto text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h2 className="text-xl font-semibold mb-2">Games Coming Soon</h2>
            <p className="text-gray-600 mb-6">
              We're working on this feature. Check back soon for game tracking and management.
            </p>
            <button
              onClick={() => router.push('/home')}
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition"
            >
              Return to Dashboard
            </button>
          </div>
        </div>
      </div>
    </>
  );
} 