'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import api from '../../src/lib/axios';

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
  const [message, setMessage] = useState<string | null>(null);

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
      const response = await api.put<{message: string, club: Club}>(
        'club-users/set-current-club/',
        { club_id: club.id },
        { headers: { Authorization: `Token ${token}` } }
      );
      
      localStorage.setItem('currentClub', JSON.stringify(club));
      setCurrentClub(club);
      setClubDropdownOpen(false);
      setMessage(null); // Clear any previous error messages
    } catch (error) {
      console.error('Error changing club:', error);
      setMessage('Failed to change club. Please try again.');
    }
  };

  return (
    <nav className="bg-blue-600 text-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <Link href="/home" className="text-xl font-bold">
                Bowlsman
              </Link>
            </div>
            <div className="hidden md:block">
              <div className="ml-10 flex items-baseline space-x-4">
                <Link
                  href="/home"
                  className={`px-3 py-2 rounded-md text-sm font-medium ${
                    pathname === '/home' ? 'bg-blue-700 text-white' : 'text-white hover:bg-blue-500'
                  }`}
                >
                  Dashboard
                </Link>
                <Link
                  href="/competition/manage"
                  className={`px-3 py-2 rounded-md text-sm font-medium ${
                    pathname === '/competition/manage' ? 'bg-blue-700 text-white' : 'text-white hover:bg-blue-500'
                  }`}
                >
                  Competitions
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
                            className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                          >
                            {club.name}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
              {/* Profile dropdown */}
              <div className="relative">
                <button
                  onClick={() => setDropdownOpen(!dropdownOpen)}
                  className="flex items-center px-3 py-1 rounded-md text-sm font-medium bg-blue-700 hover:bg-blue-800"
                >
                  {user?.username}
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
                {dropdownOpen && (
                  <div className="origin-top-right absolute right-0 mt-2 w-48 rounded-md shadow-lg bg-white ring-1 ring-black ring-opacity-5 z-10">
                    <div className="py-1">
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
        </div>
      </div>
    </nav>
  );
}