'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Navigation from '../components/Navigation';
import api from '../../src/lib/axios';

interface Bowler {
  id: number;
  name: string;
  avatar: string;
  average: number;
  games_played: number;
  high_score: number;
}

export default function Bowlers() {
  const [bowlers, setBowlers] = useState<Bowler[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);
  const router = useRouter();

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    const fetchBowlers = async () => {
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
        // const response = await api.get<Bowler[]>('/bowlers/', {
        //   headers: { Authorization: `Token ${token}` }
        // });
        // setBowlers(response.data);
        // setLoading(false);
      } catch (error) {
        console.error('Error fetching bowlers:', error);
        setError('Failed to load bowlers. Please try again later.');
        setLoading(false);
      }
    };

    fetchBowlers();
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
          <h1 className="text-2xl font-bold mb-6">Bowlers</h1>
          
          <div className="text-center py-8">
            <div className="mb-4">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-16 w-16 mx-auto text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
            </div>
            <h2 className="text-xl font-semibold mb-2">Bowler Profiles Coming Soon</h2>
            <p className="text-gray-600 mb-6">
              We're working on this feature. Check back soon for bowler profiles, statistics, and management.
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