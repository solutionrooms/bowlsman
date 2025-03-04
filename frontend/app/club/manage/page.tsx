'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Navigation from '../../components/Navigation';
import api from '../../../src/lib/axios';

export default function ManageClubs() {
  const [clubs, setClubs] = useState<Club[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentClub, setCurrentClub] = useState<Club | null>(null);
  const [mounted, setMounted] = useState(false);
  const router = useRouter();

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    const fetchClubs = async () => {
      try {
        if (!mounted) return;
        
        const token = localStorage.getItem('token');
        if (!token) {
          router.push('/');
          return;
        }

        // Load current club
        const clubData = localStorage.getItem('currentClub');
        if (clubData) {
          setCurrentClub(JSON.parse(clubData));
        }

        const response = await api.get<Club[]>('/clubs/', {
          headers: { Authorization: `Token ${token}` }
        });
        
        setClubs(response.data);
        setLoading(false);
      } catch (error) {
        console.error('Error fetching clubs:', error);
        setError('Failed to load clubs. Please try again later.');
        setLoading(false);
      }
    };

    fetchClubs();
  }, [router, mounted]);

  const handleLogout = () => {
    if (mounted) {
      localStorage.removeItem('token');
      router.push('/');
    }
  };

  const handleCreateClub = () => {
    router.push('/club/create');
  };

  const handleViewClub = (clubId: number) => {
    router.push(`/club/${clubId}`);
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative" role="alert">
          <strong className="font-bold">Error!</strong>
          <span className="block sm:inline"> {error}</span>
        </div>
      </div>
    );
  }

  return (
    <>
      <Navigation onLogout={handleLogout} />
      <div className="container mx-auto px-4 py-8">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold">Manage Clubs</h1>
          <button
            onClick={handleCreateClub}
            className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 transition"
          >
            Create New Club
          </button>
        </div>

        {clubs.length === 0 ? (
          <div className="bg-white shadow rounded-lg p-6 text-center">
            <p className="text-gray-500">No clubs found. Create your first club to get started!</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {clubs.map(club => (
              <div 
                key={club.id} 
                className={`bg-white shadow rounded-lg p-6 hover:shadow-md transition cursor-pointer ${
                  currentClub?.id === club.id ? 'border-2 border-blue-500' : ''
                }`}
                onClick={() => handleViewClub(club.id)}
              >
                <h2 className="text-xl font-semibold mb-2">{club.name}</h2>
                <p className="text-gray-500 mb-4">{club.address || 'No address provided'}</p>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-500">
                    {club.member_count} {club.member_count === 1 ? 'member' : 'members'}
                  </span>
                  {currentClub?.id === club.id && (
                    <span className="bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded">Current</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
} 