'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Navigation from '../components/Navigation';
import api from '../../src/lib/axios';

interface User {
  id: number;
  username: string;
  email: string;
  first_name: string;
  last_name: string;
  is_staff: boolean;
  clubs: Club[];
}

interface Club {
  id: number;
  name: string;
  is_admin: boolean;
  last_login_at?: string;
}

export default function Profile() {
  const [user, setUser] = useState<User | null>(null);
  const [userClubs, setUserClubs] = useState<Club[]>([]);
  const [currentClub, setCurrentClub] = useState<Club | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);
  const router = useRouter();

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    const fetchUserProfile = async () => {
      try {
        if (!mounted) return;
        
        const token = localStorage.getItem('token');
        if (!token) {
          router.push('/');
          return;
        }

        const response = await api.get<{user: User, current_club: Club | null}>('/users/me/', {
          headers: { Authorization: `Token ${token}` }
        });
        
        setUser(response.data.user);
        setCurrentClub(response.data.current_club);
        
        if (response.data.user.clubs) {
          setUserClubs(response.data.user.clubs);
        }
        
        setLoading(false);
      } catch (error) {
        console.error('Error fetching user profile:', error);
        setError('Failed to load profile. Please try again later.');
        setLoading(false);
      }
    };

    if (mounted) {
      fetchUserProfile();
    }
  }, [mounted, router]);

  const handleLogout = () => {
    if (mounted) {
      localStorage.removeItem('token');
      router.push('/');
    }
  };

  const handleClubChange = async (clubId: number) => {
    try {
      const token = localStorage.getItem('token');
      const response = await api.put<{message: string, club: Club}>(
        'club-users/set-current-club/',
        { club_id: clubId },
        { headers: { Authorization: `Token ${token}` } }
      );
      
      // Find the club object from userClubs
      const selectedClub = userClubs.find(club => club.id === clubId);
      if (selectedClub) {
        localStorage.setItem('currentClub', JSON.stringify(selectedClub));
        setCurrentClub(selectedClub);
      }
    } catch (error) {
      console.error('Error changing club:', error);
      setError('Failed to change club. Please try again.');
    }
  };

  const handleManageClubs = () => {
    router.push('/club/manage');
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  if (error || !user) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative" role="alert">
          <strong className="font-bold">Error!</strong>
          <span className="block sm:inline"> {error || 'User not found'}</span>
        </div>
      </div>
    );
  }

  return (
    <>
      <Navigation onLogout={handleLogout} />
      <div className="container mx-auto px-4 py-8">
        <div className="bg-white shadow rounded-lg overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200">
            <h1 className="text-2xl font-bold">Profile</h1>
          </div>
          
          <div className="p-6">
            <div className="mb-8">
              <h2 className="text-xl font-semibold mb-4">User Information</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <p className="text-sm font-medium text-gray-500">Username</p>
                  <p className="mt-1">{user.username}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-500">Email</p>
                  <p className="mt-1">{user.email}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-500">Name</p>
                  <p className="mt-1">
                    {user.first_name || user.last_name 
                      ? `${user.first_name} ${user.last_name}`
                      : 'Not provided'}
                  </p>
                </div>
              </div>
            </div>
            
            {user.clubs && user.clubs.length > 0 && (
              <div className="mb-8">
                <h2 className="text-xl font-semibold mb-4">Club Membership</h2>
                <div className="space-y-4">
                  {user.clubs.map(club => (
                    <div key={club.id} className="flex items-center justify-between bg-gray-50 p-4 rounded">
                      <div>
                        <h3 className="font-medium">{club.name}</h3>
                        <p className="text-sm text-gray-500">
                          {club.is_admin ? 'Admin' : 'Member'}
                        </p>
                      </div>
                      <div className="space-x-2">
                        {currentClub?.id !== club.id && (
                          <button
                            onClick={() => handleClubChange(club.id)}
                            className="px-3 py-1 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 transition"
                          >
                            Set as Current
                          </button>
                        )}
                        {currentClub?.id === club.id && (
                          <span className="px-3 py-1 bg-green-100 text-green-800 text-sm rounded">
                            Current
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
            
            <div className="flex justify-end">
              <button
                onClick={handleManageClubs}
                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition"
              >
                Manage Clubs
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}