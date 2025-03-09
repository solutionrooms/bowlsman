'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Navigation from '../components/Navigation';
import PageHeading from '../components/PageHeading';
import pageDescriptions from '../utils/pageDescriptions';
import api from '../../src/lib/axios';

interface User {
  id: number;
  username: string;
  email: string;
  is_staff: boolean;
  is_superuser: boolean;
  club_memberships?: ClubUser[];
}

interface Club {
  id: number;
  name: string;
}

interface ClubUser {
  id: number;
  club: number;
  club_name: string;
  is_admin: boolean;
  club_role: string;
}

interface UserResponse {
  user: User;
  current_club: Club | null;
}

export default function Home() {
  const [user, setUser] = useState<User | null>(null);
  const [currentClub, setCurrentClub] = useState<Club | null>(null);
  const [clubMembership, setClubMembership] = useState<ClubUser | null>(null);
  const [mounted, setMounted] = useState(false);
  const router = useRouter();

  // Set mounted to true after component mounts
  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    // Only run if the component is mounted to avoid localStorage errors
    if (!mounted) return;

    const token = localStorage.getItem('token');
    console.log('Home page - Token exists:', !!token);
    if (!token) {
      console.log('No token found, redirecting to login');
      router.push('/');
      return;
    }

    const fetchUser = async () => {
      try {
        console.log('Fetching user details');
        const response = await api.get<UserResponse>('/users/me/', {
          headers: { Authorization: `Token ${token}` }
        });
        
        setUser(response.data.user);
        setCurrentClub(response.data.current_club);
        
        // If we have a current club, find the user's membership for that club
        if (response.data.current_club && response.data.user.club_memberships) {
          const membership = response.data.user.club_memberships.find(
            m => m.club === response.data.current_club?.id
          );
          setClubMembership(membership || null);
        }
        
        console.log('User data:', response.data);
      } catch (error) {
        console.error('Error fetching user:', error);
        localStorage.removeItem('token');
        router.push('/');
      }
    };

    fetchUser();
  }, [mounted, router]);

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

      <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="px-4 py-6 sm:px-0">
          <div className="bg-white shadow rounded-lg p-6 mb-6">
            <PageHeading 
              title={`Welcome, ${user.username}!`} 
              infoText={pageDescriptions.home}
              className="text-2xl font-bold mb-4"
            />
            <div className="mt-4">
              <p className="text-gray-600">Email: {user.email}</p>
              <p className="text-gray-600">Role: {user.is_staff ? 'Admin' : 'User'}</p>
              
              {/* Debug Information */}
              {currentClub && (
                <p className="text-gray-600">Current Club: {currentClub.name}</p>
              )}
              
              {user?.is_staff && (
                <p className="text-gray-600">Staff: Yes</p>
              )}
              
              {user?.is_superuser && (
                <p className="text-gray-600">Superuser: Yes</p>
              )}
              
              {clubMembership?.is_admin && (
                <p className="text-gray-600">Club Admin: Yes</p>
              )}
              
              {currentClub && (
                <p className="text-gray-600">Club Role: {clubMembership?.club_role || "Player"}</p>
              )}
            </div>
          </div>
          
          {/* Welcome Message */}
          <div className="bg-white shadow rounded-lg p-6 mb-6">
            <PageHeading 
              title="About Bowlsman" 
              className="text-2xl font-bold mb-4"
            />
            <p className="text-gray-700 mb-4">
              Bowlsman is your all-in-one platform for managing bowling competitions and tournaments. 
              Whether you're organizing a casual league or a professional tournament, our app helps you 
              create and manage competitions, track players, generate schedules, and more.
            </p>
            <p className="text-gray-700">
              With Bowlsman, you can easily add players to your competitions, create round-robin schedules, 
              replace players when needed, and keep everything organized in one place.
            </p>
          </div>
        </div>
      </main>
    </div>
  );
} 