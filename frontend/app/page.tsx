'use client';

import React, { useState, FormEvent, ChangeEvent, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import api from '../src/lib/axios';

interface ApiError {
  error: string;
}

interface LoginResponse {
  token: string;
  user: User;
  clubs: Club[];
  current_club: Club | null;
  error?: string;
}

interface User {
  username: string;
  email: string;
  is_staff: boolean;
  first_name: string;
  last_name: string;
}

interface Club {
  id: number;
  name: string;
}

export default function Home() {
  const [mounted, setMounted] = useState(false);
  const [message, setMessage] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [email, setEmail] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [isLogin, setIsLogin] = useState(true);
  const [showClubSelection, setShowClubSelection] = useState(false);
  const [clubs, setClubs] = useState<Club[]>([]);
  const [selectedClubId, setSelectedClubId] = useState<number | null>(null);
  const router = useRouter();

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) return;
    
    const token = localStorage.getItem('token');
    if (token) {
      checkUserAuth();
    }
  }, [mounted]);

  const checkUserAuth = async () => {
    try {
      if (!mounted) return;
      
      const token = localStorage.getItem('token');
      if (!token) return;

      const response = await api.get<{ user: User, current_club: Club | null }>('/users/me/', {
        headers: { Authorization: `Token ${token}` }
      });

      if (response.data.current_club) {
        localStorage.setItem('currentClub', JSON.stringify(response.data.current_club));
        router.push('/home');
      } else {
        // User has no current club, check if they have any clubs
        const clubsResponse = await api.get<Club[]>('/clubs/', {
          headers: { Authorization: `Token ${token}` }
        });

        if (clubsResponse.data.length > 0) {
          setClubs(clubsResponse.data);
          setShowClubSelection(true);
        } else {
          // User has no clubs, redirect to club creation
          localStorage.removeItem('token');
          setMessage('You need to create or join a club first.');
        }
      }
    } catch (error) {
      console.error('Authentication error:', error);
      if (mounted) {
        localStorage.removeItem('token');
        localStorage.removeItem('currentClub');
      }
    }
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setMessage('');

    try {
      if (isLogin) {
        // Login
        const response = await api.post<LoginResponse>('/users/login/', {
          username,
          password
        });

        if (response.data.token) {
          if (mounted) {
            localStorage.setItem('token', response.data.token);
          }
          
          if (response.data.current_club) {
            if (mounted) {
              localStorage.setItem('currentClub', JSON.stringify(response.data.current_club));
            }
            router.push('/home');
          } else if (response.data.clubs && response.data.clubs.length > 0) {
            setClubs(response.data.clubs);
            setShowClubSelection(true);
          } else {
            router.push('/club/create');
          }
        } else {
          setMessage(response.data.error || 'Login failed. Please try again.');
        }
      } else {
        // Register
        const response = await api.post<LoginResponse | ApiError>('/users/register/', {
          username,
          password,
          email,
          first_name: firstName,
          last_name: lastName
        });

        if ('token' in response.data) {
          setMessage('Registration successful! Please log in.');
          setIsLogin(true);
        } else {
          setMessage(response.data.error || 'Registration failed. Please try again.');
        }
      }
    } catch (error: any) {
      console.error('Error:', error);
      setMessage(error.response?.data?.error || 'An error occurred. Please try again.');
    }
  };

  const handleClubSelect = async () => {
    if (!selectedClubId) {
      setMessage('Please select a club.');
      return;
    }

    try {
      const token = localStorage.getItem('token');
      const response = await api.put<{message: string, club: Club}>(
        'club-users/set_current_club/',
        { club_id: selectedClubId },
        { headers: { Authorization: `Token ${token}` } }
      );
      
      // Find the selected club in the clubs list
      const selectedClub = clubs.find(club => club.id === selectedClubId);
      if (selectedClub) {
        localStorage.setItem('currentClub', JSON.stringify(selectedClub));
        router.push('/home');
      }
    } catch (error) {
      console.error('Error selecting club:', error);
      setMessage('Failed to select club. Please try again.');
    }
  };

  const handleInputChange = (e: ChangeEvent<HTMLInputElement>, setter: (value: string) => void) => {
    setter(e.target.value);
  };

  if (!mounted) {
    return null;
  }

  if (showClubSelection) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <div className="bg-white p-8 rounded-lg shadow-md w-96">
          <h1 className="text-2xl font-bold mb-6 text-center">Select Your Club</h1>
          {message && <p className="mb-4 text-red-500">{message}</p>}
          <div className="space-y-4">
            {clubs.map(club => (
              <button
                key={club.id}
                onClick={() => {
                  setSelectedClubId(club.id);
                  handleClubSelect();
                }}
                className="w-full py-2 px-4 bg-blue-500 text-white rounded hover:bg-blue-600 transition"
              >
                {club.name}
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100">
      <div className="bg-white p-8 rounded-lg shadow-md w-96">
        <h1 className="text-2xl font-bold mb-6 text-center">
          {isLogin ? 'Login to Bowlsman' : 'Create an Account'}
        </h1>
        {message && <p className="mb-4 text-red-500">{message}</p>}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="username" className="block text-sm font-medium text-gray-700">
              Username
            </label>
            <input
              type="text"
              id="username"
              value={username}
              onChange={(e) => handleInputChange(e, setUsername)}
              className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
              required
            />
          </div>
          {!isLogin && (
            <>
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-gray-700">
                  Email
                </label>
                <input
                  type="email"
                  id="email"
                  value={email}
                  onChange={(e) => handleInputChange(e, setEmail)}
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  required={!isLogin}
                />
              </div>
              <div>
                <label htmlFor="firstName" className="block text-sm font-medium text-gray-700">
                  First Name
                </label>
                <input
                  type="text"
                  id="firstName"
                  value={firstName}
                  onChange={(e) => handleInputChange(e, setFirstName)}
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              <div>
                <label htmlFor="lastName" className="block text-sm font-medium text-gray-700">
                  Last Name
                </label>
                <input
                  type="text"
                  id="lastName"
                  value={lastName}
                  onChange={(e) => handleInputChange(e, setLastName)}
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            </>
          )}
          <div>
            <label htmlFor="password" className="block text-sm font-medium text-gray-700">
              Password
            </label>
            <input
              type="password"
              id="password"
              value={password}
              onChange={(e) => handleInputChange(e, setPassword)}
              className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
              required
            />
          </div>
          <button
            type="submit"
            className="w-full py-2 px-4 bg-blue-500 text-white rounded hover:bg-blue-600 transition"
          >
            {isLogin ? 'Login' : 'Register'}
          </button>
        </form>
        <div className="mt-4 text-center">
          <button
            onClick={() => setIsLogin(!isLogin)}
            className="text-blue-500 hover:underline"
          >
            {isLogin ? 'Need an account? Register' : 'Already have an account? Login'}
          </button>
          {isLogin && (
            <div className="mt-2">
              <button
                onClick={() => router.push('/reset-password')}
                className="text-blue-500 hover:underline"
              >
                Forgot your password?
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
} 