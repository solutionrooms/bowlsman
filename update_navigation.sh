#!/bin/bash

# Create a temporary file with the updated Navigation.tsx content
cat > navigation_temp.tsx << 'EOF'
'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import axios from 'axios';

const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL,
  headers: {
    "Content-Type": "application/json",
  },
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  if (token && config.headers) {
    config.headers.Authorization = `Token ${token}`;
  }
  
  if (config.url) {
    // Remove any leading slashes and ensure api prefix
    const cleanUrl = config.url.replace(/^\/+/, '').replace(/^api\//, '');
    config.url = `api/${cleanUrl}`;
  }

  return config;
});

interface NavigationProps {
  onLogout: () => void;
}

interface Club {
  id: number;
  name: string;
  is_admin: boolean;
  last_login_at?: string;
}

interface User {
  id: number;
  username: string;
  email: string;
  is_staff: boolean;
  clubs?: Club[];
}

export default function Navigation({ onLogout }: NavigationProps) {
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [clubDropdownOpen, setClubDropdownOpen] = useState(false);
  const [currentClub, setCurrentClub] = useState<Club | null>(null);
  const [userClubs, setUserClubs] = useState<Club[]>([]);
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    const fetchUserData = async () => {
      try {
        const token = localStorage.getItem('token');
        if (!token) return;

        const response = await api.get<{user: User, current_club: Club | null}>('/users/me/');
        
        setUser(response.data.user);
        setCurrentClub(response.data.current_club);
        
        if (response.data.user.clubs) {
          setUserClubs(response.data.user.clubs);
        }
      } catch (error) {
        console.error('Error fetching user data:', error);
      }
    };

    fetchUserData();
    
    // Get current club from localStorage as fallback
    const storedClub = localStorage.getItem('currentClub');
    if (storedClub) {
      setCurrentClub(JSON.parse(storedClub));
    }
  }, []);

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('currentClub');
    onLogout();
  };

  const handleClubChange = async (club: Club) => {
    try {
      const token = localStorage.getItem('token');
      const response = await api.post<{message: string, club: Club}>(
        '/club-users/set-current-club/',
        { club_id: club.id },
        { headers: { Authorization: `Token ${token}` } }
      );
      
      localStorage.setItem('currentClub', JSON.stringify(response.data.club));
      setCurrentClub(response.data.club);
      setClubDropdownOpen(false);
      
      // Refresh the page to update content for the new club
      window.location.reload();
    } catch (error) {
      console.error('Error changing club:', error);
    }
  };

  return (
    <nav className="bg-blue-600 text-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <Link href="/dashboard" className="text-xl font-bold">
                Bowlsman
              </Link>
            </div>
            <div className="hidden md:block">
              <div className="ml-10 flex items-baseline space-x-4">
                <Link
                  href="/dashboard"
                  className={`px-3 py-2 rounded-md text-sm font-medium ${
                    pathname === '/dashboard' ? 'bg-blue-700 text-white' : 'text-white hover:bg-blue-500'
                  }`}
                >
                  Dashboard
                </Link>
                <Link
                  href="/games"
                  className={`px-3 py-2 rounded-md text-sm font-medium ${
                    pathname === '/games' ? 'bg-blue-700 text-white' : 'text-white hover:bg-blue-500'
                  }`}
                >
                  Games
                </Link>
                <Link
                  href="/bowlers"
                  className={`px-3 py-2 rounded-md text-sm font-medium ${
                    pathname === '/bowlers' ? 'bg-blue-700 text-white' : 'text-white hover:bg-blue-500'
                  }`}
                >
                  Bowlers
                </Link>
                {user?.is_staff && (
                  <Link
                    href="/club/manage"
                    className={`px-3 py-2 rounded-md text-sm font-medium ${
                      pathname === '/club/manage' ? 'bg-blue-700 text-white' : 'text-white hover:bg-blue-500'
                    }`}
                  >
                    Manage Clubs
                  </Link>
                )}
              </div>
            </div>
          </div>
          <div className="hidden md:block">
            <div className="ml-4 flex items-center md:ml-6">
              {/* Club Selector */}
              {currentClub && (
                <div className="relative mr-4">
                  <button
                    onClick={() => setClubDropdownOpen(!clubDropdownOpen)}
                    className="flex items-center px-3 py-1 rounded-md text-sm font-medium bg-blue-700 hover:bg-blue-800"
                  >
                    <span className="mr-1 text-xs text-blue-300">Club:</span>
                    {currentClub.name}
                    <svg
                      className="ml-1 h-4 w-4"
                      xmlns="http://www.w3.org/2000/svg"
                      viewBox="0 0 20 20"
                      fill="currentColor"
                    >
                      <path
                        fillRule="evenodd"
                        d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z"
                        clipRule="evenodd"
                      />
                    </svg>
                  </button>
                  {clubDropdownOpen && (
                    <div className="origin-top-right absolute right-0 mt-2 w-48 rounded-md shadow-lg bg-white ring-1 ring-black ring-opacity-5 z-10">
                      <div className="py-1">
                        {userClubs.map((club) => (
                          <button
                            key={club.id}
                            onClick={() => handleClubChange(club)}
                            className={`block w-full text-left px-4 py-2 text-sm ${
                              currentClub.id === club.id
                                ? 'bg-gray-100 text-gray-900 font-medium'
                                : 'text-gray-700 hover:bg-gray-100'
                            }`}
                          >
                            {club.name}
                            {club.is_admin && (
                              <span className="ml-2 text-xs text-blue-600">(Admin)</span>
                            )}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
              
              {/* User Menu */}
              <div className="relative">
                <button
                  onClick={() => setDropdownOpen(!dropdownOpen)}
                  className="flex items-center max-w-xs text-sm rounded-full focus:outline-none"
                >
                  <span className="sr-only">Open user menu</span>
                  <div className="h-8 w-8 rounded-full bg-blue-800 flex items-center justify-center">
                    {user?.username?.charAt(0).toUpperCase() || 'U'}
                  </div>
                </button>
                {dropdownOpen && (
                  <div className="origin-top-right absolute right-0 mt-2 w-48 rounded-md shadow-lg bg-white ring-1 ring-black ring-opacity-5 z-10">
                    <div className="py-1">
                      <Link
                        href="/profile"
                        className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                        onClick={() => setDropdownOpen(false)}
                      >
                        Your Profile
                      </Link>
                      <button
                        onClick={handleLogout}
                        className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                      >
                        Sign out
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
          <div className="-mr-2 flex md:hidden">
            <button
              onClick={() => setIsOpen(!isOpen)}
              className="inline-flex items-center justify-center p-2 rounded-md text-white hover:bg-blue-500 focus:outline-none"
            >
              <span className="sr-only">Open main menu</span>
              <svg
                className={`${isOpen ? 'hidden' : 'block'} h-6 w-6`}
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16" />
              </svg>
              <svg
                className={`${isOpen ? 'block' : 'hidden'} h-6 w-6`}
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      </div>

      {/* Mobile menu */}
      <div className={`${isOpen ? 'block' : 'hidden'} md:hidden`}>
        <div className="px-2 pt-2 pb-3 space-y-1 sm:px-3">
          <Link
            href="/dashboard"
            className={`block px-3 py-2 rounded-md text-base font-medium ${
              pathname === '/dashboard' ? 'bg-blue-700 text-white' : 'text-white hover:bg-blue-500'
            }`}
            onClick={() => setIsOpen(false)}
          >
            Dashboard
          </Link>
          <Link
            href="/games"
            className={`block px-3 py-2 rounded-md text-base font-medium ${
              pathname === '/games' ? 'bg-blue-700 text-white' : 'text-white hover:bg-blue-500'
            }`}
            onClick={() => setIsOpen(false)}
          >
            Games
          </Link>
          <Link
            href="/bowlers"
            className={`block px-3 py-2 rounded-md text-base font-medium ${
              pathname === '/bowlers' ? 'bg-blue-700 text-white' : 'text-white hover:bg-blue-500'
            }`}
            onClick={() => setIsOpen(false)}
          >
            Bowlers
          </Link>
          {user?.is_staff && (
            <Link
              href="/club/manage"
              className={`block px-3 py-2 rounded-md text-base font-medium ${
                pathname === '/club/manage' ? 'bg-blue-700 text-white' : 'text-white hover:bg-blue-500'
              }`}
              onClick={() => setIsOpen(false)}
            >
              Manage Clubs
            </Link>
          )}
        </div>
        <div className="pt-4 pb-3 border-t border-blue-700">
          {/* Current Club (Mobile) */}
          {currentClub && (
            <div className="px-2 py-2">
              <p className="text-xs text-blue-300">Current Club</p>
              <div className="mt-1 flex items-center justify-between">
                <p className="text-white font-medium">{currentClub.name}</p>
                <button
                  onClick={() => setClubDropdownOpen(!clubDropdownOpen)}
                  className="px-2 py-1 text-sm bg-blue-700 rounded"
                >
                  Change
                </button>
              </div>
              {clubDropdownOpen && (
                <div className="mt-2 space-y-1">
                  {userClubs.map((club) => (
                    <button
                      key={club.id}
                      onClick={() => handleClubChange(club)}
                      className={`block w-full text-left px-3 py-2 rounded-md text-base font-medium ${
                        currentClub.id === club.id
                          ? 'bg-blue-700 text-white'
                          : 'text-white hover:bg-blue-500'
                      }`}
                    >
                      {club.name}
                      {club.is_admin && (
                        <span className="ml-2 text-xs">(Admin)</span>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
          
          {/* User Actions (Mobile) */}
          <div className="mt-3 px-2 space-y-1">
            <Link
              href="/profile"
              className="block px-3 py-2 rounded-md text-base font-medium text-white hover:bg-blue-500"
              onClick={() => setIsOpen(false)}
            >
              Your Profile
            </Link>
            <button
              onClick={handleLogout}
              className="block w-full text-left px-3 py-2 rounded-md text-base font-medium text-white hover:bg-blue-500"
            >
              Sign out
            </button>
          </div>
        </div>
      </div>
    </nav>
  );
}
EOF

# Copy the temporary file to the container
docker cp navigation_temp.tsx bowlsman-frontend-1:/app/app/components/Navigation.tsx

# Remove the temporary file
rm navigation_temp.tsx

# Restart the frontend container
docker restart bowlsman-frontend-1 