'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Navigation from '../components/Navigation';
import api from '../../src/lib/axios';
import ManageUsers from '../../src/app/manage/users/page';

interface User {
  id: number;
  username: string;
  email: string;
  is_staff: boolean;
}

export default function AdminPage() {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const router = useRouter();

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      router.push('/');
      return;
    }

    const fetchData = async () => {
      try {
        const userResponse = await api.get<User>('/users/me/');
        
        if (!userResponse.data.is_staff) {
          router.push('/home');
          return;
        }
        
        setCurrentUser(userResponse.data);
      } catch (error) {
        console.error('Error:', error);
        router.push('/');
      }
    };

    fetchData();
  }, []);

  if (!currentUser) {
    return <div>Loading...</div>;
  }

  return (
    <div className="min-h-screen bg-gray-100">
      <Navigation isStaff={true} />
      <ManageUsers />
    </div>
  );
} 