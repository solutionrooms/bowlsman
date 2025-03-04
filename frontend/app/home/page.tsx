'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Navigation from '../components/Navigation';
import api from '../../src/lib/axios';

interface User {
  username: string;
  email: string;
  is_staff: boolean;
}

export default function Home() {
  const [user, setUser] = useState<User | null>(null);
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
        const response = await api.get<User>('/users/me/', {
          headers: { Authorization: `Token ${token}` }
        });
        
        setUser(response.data);
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
            <h2 className="text-2xl font-bold mb-4">Welcome, {user.username}!</h2>
            <div className="mt-4">
              <p className="text-gray-600">Email: {user.email}</p>
              <p className="text-gray-600">Role: {user.is_staff ? 'Admin' : 'User'}</p>
            </div>
          </div>
          
          {/* Welcome Message */}
          <div className="bg-white shadow rounded-lg p-6 mb-6">
            <h2 className="text-2xl font-bold mb-4">About Bowlsman</h2>
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
          
          {/* Getting Started Steps */}
          <div className="bg-white shadow rounded-lg p-6">
            <h2 className="text-2xl font-bold mb-4">Getting Started</h2>
            <div className="space-y-4">
              <div className="flex">
                <div className="flex-shrink-0">
                  <div className="flex items-center justify-center h-8 w-8 rounded-full bg-indigo-600 text-white">
                    1
                  </div>
                </div>
                <div className="ml-4">
                  <h3 className="text-lg font-medium text-gray-900">Create a Competition</h3>
                  <p className="mt-1 text-gray-500">
                    Start by creating a new competition. Set the number of players, rule set, and other parameters.
                  </p>
                </div>
              </div>
              
              <div className="flex">
                <div className="flex-shrink-0">
                  <div className="flex items-center justify-center h-8 w-8 rounded-full bg-indigo-600 text-white">
                    2
                  </div>
                </div>
                <div className="ml-4">
                  <h3 className="text-lg font-medium text-gray-900">Add Players</h3>
                  <p className="mt-1 text-gray-500">
                    Add registered users or guest players to your competition. You can manage and reorder players as needed.
                  </p>
                </div>
              </div>
              
              <div className="flex">
                <div className="flex-shrink-0">
                  <div className="flex items-center justify-center h-8 w-8 rounded-full bg-indigo-600 text-white">
                    3
                  </div>
                </div>
                <div className="ml-4">
                  <h3 className="text-lg font-medium text-gray-900">Generate Schedule</h3>
                  <p className="mt-1 text-gray-500">
                    Once your competition is full, generate a round-robin schedule. You can customize the number of rounds and parallel matches.
                  </p>
                </div>
              </div>
              
              <div className="flex">
                <div className="flex-shrink-0">
                  <div className="flex items-center justify-center h-8 w-8 rounded-full bg-indigo-600 text-white">
                    4
                  </div>
                </div>
                <div className="ml-4">
                  <h3 className="text-lg font-medium text-gray-900">Manage Your Competition</h3>
                  <p className="mt-1 text-gray-500">
                    View schedules, replace players if needed, and keep track of your competition all in one place.
                  </p>
                </div>
              </div>
              
              <div className="mt-6">
                <a 
                  href="/competition/create" 
                  className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                >
                  Create Your First Competition
                </a>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
} 