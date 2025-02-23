'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Navigation from '../components/Navigation';
import api from '@/lib/axios';

interface User {
  username: string;
  email: string;
  is_staff: boolean;
}

export default function Home() {
  const [user, setUser] = useState<User | null>(null);
  const router = useRouter();

  useEffect(() => {
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
          headers: { 
            Authorization: `Token ${token}`
          }
        });
        console.log('User details received:', response.data);
        setUser(response.data);
      } catch (error) {
        console.error('Error fetching user details:', error);
        const axiosError = error as any;
        console.error('Error response:', axiosError?.response?.data);
        localStorage.removeItem('token');
        router.push('/');
      }
    };

    fetchUser();
  }, []);

  const handleLogout = () => {
    localStorage.removeItem('token');
    router.push('/');
  };

  if (!user) {
    return <div>Loading...</div>;
  }

  return (
    <div className="min-h-screen bg-gray-100">
      <Navigation isStaff={user.is_staff} />

      <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="px-4 py-6 sm:px-0">
          <div className="bg-white shadow rounded-lg p-6">
            <h2 className="text-2xl font-bold mb-4">Welcome, {user.username}!</h2>
            <div className="mt-4">
              <p className="text-gray-600">Email: {user.email}</p>
              <p className="text-gray-600">Role: {user.is_staff ? 'Admin' : 'User'}</p>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
} 