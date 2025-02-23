'use client';

import React, { useState, FormEvent, ChangeEvent } from 'react';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import api from '../src/lib/axios';

interface ApiError {
  error: string;
}

interface LoginResponse {
  token: string;
  user_id: number;
  is_staff: boolean;
}

interface User {
  username: string;
  email: string;
  is_staff: boolean;
}

export default function Home() {
  const [mounted, setMounted] = useState(false);
  const [message, setMessage] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [email, setEmail] = useState('');
  const [isLogin, setIsLogin] = useState(true);
  const router = useRouter();

  useEffect(() => {
    setMounted(true);
    const token = localStorage.getItem('token');
    if (token) {
      checkUserRole();
    }
  }, []);

  const checkUserRole = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await api.get<User>('/users/me/', {
        headers: { Authorization: `Token ${token}` }
      });
      if (response.data.is_staff) {
        router.push('/admin');
      }
    } catch (error) {
      localStorage.removeItem('token');
    }
  };

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    try {
      if (isLogin) {
        console.log('Attempting login for user:', username);
        const response = await api.post('users/login', {
          username,
          password
        });
        console.log('Login response:', response.data);
        localStorage.setItem('token', response.data.token);
        setMessage('Login successful!');
        console.log('Redirecting user based on role:', response.data.is_staff ? 'admin' : 'regular user');
        if (response.data.is_staff) {
          router.push('/admin');
        } else {
          router.push('/home');
        }
      } else {
        console.log('Attempting registration for user:', username);
        await api.post<User>('/users/', {
          username,
          email,
          password,
          is_staff: false,
          is_active: true
        });
        setMessage('Registration successful! Please login.');
        setIsLogin(true);
      }
    } catch (error) {
      console.error('Full error object:', error);
      const axiosError = error as any;
      console.error('Error response:', axiosError?.response?.data);
      setMessage(axiosError?.response?.data?.error || 'An error occurred');
    }
  };

  const handleInputChange = (e: ChangeEvent<HTMLInputElement>, setter: (value: string) => void) => {
    setter(e.target.value);
  };

  if (!mounted) {
    return null;
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div>
          <h1 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
            Welcome
          </h1>
          <p className="mt-2 text-center text-sm text-gray-600">
            {isLogin ? 'Sign in to your account' : 'Create a new account'}
          </p>
        </div>

        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
          <div className="rounded-md shadow-sm -space-y-px">
            <div>
              <label htmlFor="username" className="sr-only">
                Username
              </label>
              <input
                id="username"
                name="username"
                type="text"
                required
                className="appearance-none rounded-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-t-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 focus:z-10 sm:text-sm"
                placeholder="Username"
                value={username}
                onChange={(e) => handleInputChange(e, setUsername)}
              />
            </div>

            {!isLogin && (
              <div>
                <label htmlFor="email" className="sr-only">
                  Email
                </label>
                <input
                  id="email"
                  name="email"
                  type="email"
                  required
                  className="appearance-none rounded-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 focus:z-10 sm:text-sm"
                  placeholder="Email"
                  value={email}
                  onChange={(e) => handleInputChange(e, setEmail)}
                />
              </div>
            )}

            <div>
              <label htmlFor="password" className="sr-only">
                Password
              </label>
              <input
                id="password"
                name="password"
                type="password"
                required
                className="appearance-none rounded-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-b-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 focus:z-10 sm:text-sm"
                placeholder="Password"
                value={password}
                onChange={(e) => handleInputChange(e, setPassword)}
              />
            </div>
          </div>

          <div>
            <button
              type="submit"
              className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
            >
              {isLogin ? 'Sign in' : 'Register'}
            </button>
          </div>

          <div className="text-center">
            <button
              type="button"
              onClick={() => setIsLogin(!isLogin)}
              className="font-medium text-indigo-600 hover:text-indigo-500"
            >
              {isLogin ? 'Need an account? Register' : 'Already have an account? Login'}
            </button>
          </div>
        </form>

        {message && (
          <div className={`mt-4 text-center text-sm font-medium ${
            message.includes('successful') ? 'text-green-600' : 'text-red-600'
          }`}>
            {message}
          </div>
        )}
      </div>
    </div>
  );
} 