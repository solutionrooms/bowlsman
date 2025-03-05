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
  const [currentClub, setCurrentClub] = useState<Club | null>(null);
  const [userClubs, setUserClubs] = useState<Club[]>([]);
  const [allClubs, setAllClubs] = useState<Club[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    const fetchUserData = async () => {
      try {
        const token = localStorage.getItem('token');
        if (!token) {
          router.push('/');
          return;
        }

        const response = await api.get<{user: User, current_club: Club | null}>('/users/me/');
        setUser(response.data.user);
        
        if (response.data.current_club) {
          setCurrentClub(response.data.current_club);
        }
        
        if (response.data.user.clubs) {
          setUserClubs(response.data.user.clubs);
        }

        // If user is staff, fetch all clubs
        if (response.data.user.is_staff) {
          const clubsResponse = await api.get<Club[]>('/clubs/', {
            headers: { Authorization: `Token ${token}` }
          });
          setAllClubs(clubsResponse.data);
        }
        
        setLoading(false);
      } catch (error) {
        console.error('Error fetching user data:', error);
        setError('Failed to load user data. Please try again later.');
        setLoading(false);
      }
    };

    fetchUserData();
  }, [router]);

  const handleLogout = () => {
    if (user) {
      localStorage.removeItem('token');
      router.push('/');
    }
  };

  const handleClubChange = async (clubId: number) => {
    try {
      const token = localStorage.getItem('token');
      // Remove any api/ prefix as the axios interceptor adds it automatically
      const endpoint = 'club-users/set_current_club/';
      
      const response = await api.put<{message: string, club: Club}>(
        endpoint,
        { club_id: clubId },
        { headers: { Authorization: `Token ${token}` } }
      );
      
      // Find the club object from userClubs or allClubs
      const selectedClub = userClubs.find(club => club.id === clubId) || 
                          allClubs.find(club => club.id === clubId);
      
      if (selectedClub) {
        localStorage.setItem('currentClub', JSON.stringify(selectedClub));
        setCurrentClub(selectedClub);
        setError(null); // Clear any previous errors
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
        <div className="bg-white shadow rounded-lg p-6">
          <h1 className="text-2xl font-bold mb-6">Your Profile</h1>
          
          {/* User Information */}
          <div className="mb-8">
            <h2 className="text-xl font-semibold mb-4">Account Information</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">Username</label>
                <div className="mt-1 p-2 bg-gray-50 rounded-md">{user?.username}</div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Email</label>
                <div className="mt-1 p-2 bg-gray-50 rounded-md">{user?.email}</div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Account Type</label>
                <div className="mt-1 p-2 bg-gray-50 rounded-md">
                  {user?.is_staff ? 'Administrator' : 'Regular User'}
                </div>
              </div>
            </div>
          </div>
          
          {/* User's Clubs */}
          {user?.clubs && user.clubs.length > 0 && (
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
          
          {/* All Clubs (for staff users) */}
          {user?.is_staff && allClubs.length > 0 && (
            <div className="mb-8">
              <h2 className="text-xl font-semibold mb-4">All Clubs (Staff Access)</h2>
              <div className="space-y-4">
                {allClubs
                  .filter(club => !userClubs.some(uc => uc.id === club.id))
                  .map(club => (
                    <div key={club.id} className="flex items-center justify-between bg-gray-50 p-4 rounded">
                      <div>
                        <h3 className="font-medium">{club.name}</h3>
                        <p className="text-sm text-gray-500">Not a member</p>
                      </div>
                      <div className="space-x-2">
                        <button
                          onClick={() => handleClubChange(club.id)}
                          className="px-3 py-1 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 transition"
                        >
                          Switch to Club
                        </button>
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
    </>
  );
}