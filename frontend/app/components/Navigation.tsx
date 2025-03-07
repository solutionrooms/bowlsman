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
  const [allClubs, setAllClubs] = useState<Club[]>([]);
  const [user, setUser] = useState<User | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    // Create a flag to prevent multiple calls
    let isMounted = true;
    
    const fetchUserData = async () => {
      try {
        // Safely access localStorage with browser check
        let token = null;
        if (typeof window !== 'undefined') {
          token = localStorage.getItem('token');
          if (!token) return;
        } else {
          return; // Not in browser context
        }

        const response = await api.get<{user: User, current_club: Club | null}>('/users/me/');
        
        if (!isMounted) return;
        
        setUser(response.data.user);
        setCurrentClub(response.data.current_club);
        
        if (response.data.user.clubs) {
          setUserClubs(response.data.user.clubs);
        }

        // If user is staff, fetch all clubs
        if (response.data.user.is_staff) {
          const clubsResponse = await api.get<Club[]>('/clubs/');
          if (!isMounted) return;
          setAllClubs(clubsResponse.data);
        }
      } catch (error) {
        if (!isMounted) return;
        console.error('Error fetching user data:', error);
      }
    };

    fetchUserData();
    
    // Get current club from localStorage as fallback - safely
    if (typeof window !== 'undefined') {
      const storedClub = localStorage.getItem('currentClub');
      if (storedClub) {
        try {
          setCurrentClub(JSON.parse(storedClub));
        } catch (e) {
          // Handle potential JSON parse error
          localStorage.removeItem('currentClub');
        }
      }
    }
    
    // Cleanup function to prevent state updates after unmount
    return () => {
      isMounted = false;
    };
  }, []);

  const handleLogout = () => {
    // Safely access localStorage only in browser context
    if (typeof window !== 'undefined') {
      try {
        localStorage.removeItem('token');
        localStorage.removeItem('currentClub');
      } catch (e) {
        // Handle localStorage errors silently
      }
    }
    onLogout();
  };

  const handleClubChange = async (clubId: number) => {
    try {
      // Safe localStorage check
      if (typeof window === 'undefined') return;
      
      const endpoint = 'club-users/set_current_club/';
      
      const response = await api.put<{message: string, club: Club}>(
        endpoint,
        { club_id: clubId }
      );
      
      // Safely update localStorage
      try {
        localStorage.setItem('currentClub', JSON.stringify(response.data.club));
      } catch (e) {
        // Handle localStorage errors silently
      }
      
      setCurrentClub(response.data.club);
      setClubDropdownOpen(false);
      setMessage(null); // Clear any previous error messages
      
      // Safely dispatch event only in browser context
      if (typeof window !== 'undefined') {
        // Dispatch a custom event to notify all components about the club change
        const clubChangeEvent = new CustomEvent('clubChanged', { 
          detail: { club: response.data.club }
        });
        window.dispatchEvent(clubChangeEvent);
        
        // If on a page that needs refresh, reload it
        const currentPath = window.location.pathname;
        if (currentPath === '/bowlers' || 
            currentPath.startsWith('/competition/') || 
            currentPath.includes('/club/')) {
          window.location.reload();
        }
      }
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
                {currentClub && (
                  <>
                    <Link
                      href={`/competition/scoring`}
                      className={`px-3 py-2 rounded-md text-sm font-medium ${
                        pathname?.startsWith('/competition/scoring') ? 'bg-blue-700 text-white' : 'text-white hover:bg-blue-500'
                      }`}
                    >
                      Scoring
                    </Link>
                    <Link
                      href={`/competition/results/${currentClub.id}`}
                      className={`px-3 py-2 rounded-md text-sm font-medium ${
                        pathname?.startsWith('/competition/results/') ? 'bg-blue-700 text-white' : 'text-white hover:bg-blue-500'
                      }`}
                    >
                      Results
                    </Link>
                  </>
                )}
                <Link
                  href="/bowlers"
                  className={`px-3 py-2 rounded-md text-sm font-medium ${
                    pathname === '/bowlers' ? 'bg-blue-700 text-white' : 'text-white hover:bg-blue-500'
                  }`}
                >
                  Bowlers
                </Link>
                <Link
                  href="/messaging"
                  className={`px-3 py-2 rounded-md text-sm font-medium ${
                    pathname?.startsWith('/messaging') ? 'bg-blue-700 text-white' : 'text-white hover:bg-blue-500'
                  }`}
                >
                  Messages
                </Link>
                <Link
                  href="/social"
                  className={`px-3 py-2 rounded-md text-sm font-medium ${
                    pathname?.startsWith('/social') ? 'bg-blue-700 text-white' : 'text-white hover:bg-blue-500'
                  }`}
                >
                  Social
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
                {!user?.is_staff && userClubs.some(club => club.is_admin) && currentClub && (
                  <Link
                    href={`/club/${currentClub.id}`}
                    className={`px-3 py-2 rounded-md text-sm font-medium ${
                      pathname === `/club/${currentClub.id}` ? 'bg-blue-700 text-white' : 'text-white hover:bg-blue-500'
                    }`}
                  >
                    Manage Club
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
                        {user?.is_staff ? (
                          <>
                            {userClubs.length > 0 && (
                              <>
                                <div className="px-4 py-1 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                                  My Clubs
                                </div>
                                {userClubs.map((club) => (
                                  <button
                                    key={club.id}
                                    onClick={() => handleClubChange(club.id)}
                                    className={`block w-full text-left px-4 py-2 text-sm ${
                                      currentClub?.id === club.id ? 'bg-gray-100 text-gray-900 font-medium' : 'text-gray-700 hover:bg-gray-100'
                                    }`}
                                  >
                                    {club.name}
                                    {club.is_admin && (
                                      <span className="ml-2 text-xs text-blue-600">(Admin)</span>
                                    )}
                                  </button>
                                ))}
                                <div className="border-t border-gray-200 my-1"></div>
                              </>
                            )}
                            <div className="px-4 py-1 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                              All Clubs
                            </div>
                            {allClubs
                              .filter(club => !userClubs.some(uc => uc.id === club.id))
                              .map((club) => (
                                <button
                                  key={club.id}
                                  onClick={() => handleClubChange(club.id)}
                                  className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                                >
                                  {club.name}
                                </button>
                              ))}
                          </>
                        ) : (
                          // Regular users only see their clubs
                          userClubs.map((club) => (
                            <button
                              key={club.id}
                              onClick={() => handleClubChange(club.id)}
                              className={`block w-full text-left px-4 py-2 text-sm ${
                                currentClub?.id === club.id ? 'bg-gray-100 text-gray-900 font-medium' : 'text-gray-700 hover:bg-gray-100'
                              }`}
                            >
                              {club.name}
                              {club.is_admin && (
                                <span className="ml-2 text-xs text-blue-600">(Admin)</span>
                              )}
                            </button>
                          ))
                        )}
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
          
          {/* Mobile menu button */}
          <div className="-mr-2 flex md:hidden">
            <button
              onClick={() => setIsOpen(!isOpen)}
              className="inline-flex items-center justify-center p-2 rounded-md text-white hover:bg-blue-700 focus:outline-none"
            >
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
            href="/home"
            className={`block px-3 py-2 rounded-md text-base font-medium ${
              pathname === '/home' ? 'bg-blue-700 text-white' : 'text-white hover:bg-blue-500'
            }`}
          >
            Dashboard
          </Link>
          <Link
            href="/competition/manage"
            className={`block px-3 py-2 rounded-md text-base font-medium ${
              pathname === '/competition/manage' ? 'bg-blue-700 text-white' : 'text-white hover:bg-blue-500'
            }`}
          >
            Competitions
          </Link>
          {currentClub && (
            <>
              <Link
                href={`/competition/scoring`}
                className={`block px-3 py-2 rounded-md text-base font-medium ${
                  pathname?.startsWith('/competition/scoring') ? 'bg-blue-700 text-white' : 'text-white hover:bg-blue-500'
                }`}
              >
                Scoring
              </Link>
              <Link
                href={`/competition/results/${currentClub.id}`}
                className={`block px-3 py-2 rounded-md text-base font-medium ${
                  pathname?.startsWith('/competition/results/') ? 'bg-blue-700 text-white' : 'text-white hover:bg-blue-500'
                }`}
              >
                Results
              </Link>
            </>
          )}
          <Link
            href="/bowlers"
            className={`block px-3 py-2 rounded-md text-base font-medium ${
              pathname === '/bowlers' ? 'bg-blue-700 text-white' : 'text-white hover:bg-blue-500'
            }`}
          >
            Bowlers
          </Link>
          <Link
            href="/messaging"
            className={`block px-3 py-2 rounded-md text-base font-medium ${
              pathname?.startsWith('/messaging') ? 'bg-blue-700 text-white' : 'text-white hover:bg-blue-500'
            }`}
          >
            Messages
          </Link>
          <Link
            href="/social"
            className={`block px-3 py-2 rounded-md text-base font-medium ${
              pathname?.startsWith('/social') ? 'bg-blue-700 text-white' : 'text-white hover:bg-blue-500'
            }`}
          >
            Social
          </Link>
          {user?.is_staff && (
            <Link
              href="/club/manage"
              className={`block px-3 py-2 rounded-md text-base font-medium ${
                pathname === '/club/manage' ? 'bg-blue-700 text-white' : 'text-white hover:bg-blue-500'
              }`}
            >
              Manage Clubs
            </Link>
          )}
          {!user?.is_staff && userClubs.some(club => club.is_admin) && currentClub && (
            <Link
              href={`/club/${currentClub.id}`}
              className={`block px-3 py-2 rounded-md text-base font-medium ${
                pathname === `/club/${currentClub.id}` ? 'bg-blue-700 text-white' : 'text-white hover:bg-blue-500'
              }`}
            >
              Manage Club
            </Link>
          )}
        </div>
      </div>
    </nav>
  );
}