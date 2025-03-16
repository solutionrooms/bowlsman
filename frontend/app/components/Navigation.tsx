'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import api from '../../src/lib/axios';
import { useMessaging } from '../messaging/context/MessagingContext';

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
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [clubDropdownOpen, setClubDropdownOpen] = useState(false);
  const [mobileProfileOpen, setMobileProfileOpen] = useState(false);
  const [mobileClubOpen, setMobileClubOpen] = useState(false);
  const [currentClub, setCurrentClub] = useState<Club | null>(null);
  const [userClubs, setUserClubs] = useState<Club[]>([]);
  const [allClubs, setAllClubs] = useState<Club[]>([]);
  const [user, setUser] = useState<User | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const { unreadCount, fetchUnreadCount } = useMessaging();
  
  // Refs for dropdown containers
  const userDropdownRef = useRef<HTMLDivElement>(null);
  const clubDropdownRef = useRef<HTMLDivElement>(null);
  const mobileProfileRef = useRef<HTMLDivElement>(null);
  const mobileClubRef = useRef<HTMLDivElement>(null);

  // Fetch unread count when currentClub changes
  useEffect(() => {
    if (currentClub?.id) {
      fetchUnreadCount(currentClub.id);
    }
  }, [currentClub, fetchUnreadCount]);

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

  const handleLogout = async () => {
    try {
      // Call backend logout endpoint
      await api.post('/logout/');
    } catch (error) {
      console.error('Error during logout API call:', error);
      // Continue with client-side logout even if API call fails
    }
    
    // Safely access localStorage only in browser context
    if (typeof window !== 'undefined') {
      try {
        localStorage.removeItem('token');
        localStorage.removeItem('currentClub');
      } catch (e) {
        // Handle localStorage errors silently
      }
    }
    
    // Call the provided onLogout callback
    onLogout();
    
    // Always redirect to the login page
    router.push('/');
  };

  const handleClubChange = async (clubId: number) => {
    try {
      // Safe localStorage check
      if (typeof window === 'undefined') return;
      
      const endpoint = '/club-users/set_current_club/';
      
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
      setMobileClubOpen(false);
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

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      // Check if click is outside each dropdown
      if (userDropdownRef.current && !userDropdownRef.current.contains(event.target as Node)) {
        setDropdownOpen(false);
      }
      
      if (clubDropdownRef.current && !clubDropdownRef.current.contains(event.target as Node)) {
        setClubDropdownOpen(false);
      }
      
      if (mobileProfileRef.current && !mobileProfileRef.current.contains(event.target as Node)) {
        setMobileProfileOpen(false);
      }
      
      if (mobileClubRef.current && !mobileClubRef.current.contains(event.target as Node)) {
        setMobileClubOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // Toggle dropdown state
  const toggleDropdown = (setter: React.Dispatch<React.SetStateAction<boolean>>) => {
    setter(prev => !prev);
  };

  return (
    <nav className="bg-blue-600 text-white shadow-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo and brand */}
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <Link href={currentClub ? "/home" : "/dashboard"} className="text-xl font-bold">
                BowlsHub
              </Link>
            </div>
          </div>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center justify-between flex-1 ml-6">
            {/* Main Navigation Links - Only show if user has a current club */}
            {currentClub ? (
              <div className="flex items-center space-x-2">
                <Link
                  href="/competition/manage"
                  className={`px-3 py-2 rounded-md text-sm font-medium ${
                    pathname === '/competition/manage' ? 'bg-blue-700 text-white' : 'text-white hover:bg-blue-500'
                  }`}
                >
                  Competitions
                </Link>
                <Link
                  href={`/competition/scoring`}
                  className={`px-3 py-2 rounded-md text-sm font-medium ${
                    pathname?.startsWith('/competition/scoring') ? 'bg-blue-700 text-white' : 'text-white hover:bg-blue-500'
                  }`}
                >
                  Scoring
                </Link>
                <Link
                  href="/leagues"
                  className={`px-3 py-2 rounded-md text-sm font-medium ${
                    pathname?.startsWith('/leagues') ? 'bg-blue-700 text-white' : 'text-white hover:bg-blue-500'
                  }`}
                >
                  Teams
                </Link>
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
                  className={`px-3 py-2 rounded-md text-sm font-medium relative ${
                    pathname === '/messaging' ? 'bg-blue-700 text-white' : 'text-white hover:bg-blue-500'
                  }`}
                >
                  Chat
                  {unreadCount > 0 && (
                    <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center">
                      {unreadCount > 9 ? '9+' : unreadCount}
                    </span>
                  )}
                </Link>
                <Link
                  href="/noticeboard"
                  className={`px-3 py-2 rounded-md text-sm font-medium ${
                    pathname === '/noticeboard' ? 'bg-blue-700 text-white' : 'text-white hover:bg-blue-500'
                  }`}
                >
                  Noticeboard
                </Link>
              </div>
            ) : (
              // For users without a club, show minimal navigation
              <div className="flex-1"></div> // Empty div to maintain spacing
            )}

            {/* Right side items */}
            <div className="flex items-center space-x-2">
              {/* Admin/Club Management */}
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

              {/* Club Selector */}
              {currentClub && (
                <div className="relative" ref={clubDropdownRef}>
                  <button
                    onClick={() => toggleDropdown(setClubDropdownOpen)}
                    className="flex items-center px-3 py-1 rounded-md text-sm font-medium bg-blue-700 hover:bg-blue-800"
                  >
                    <span className="max-w-[150px] truncate">{currentClub.name}</span>
                    <svg xmlns="http://www.w3.org/2000/svg" className="ml-2 h-4 w-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>
                  {clubDropdownOpen && (
                    <div className="absolute right-0 mt-2 w-48 rounded-md shadow-lg bg-white ring-1 ring-black ring-opacity-5 z-50">
                      <div className="py-1" role="menu">
                        {userClubs.map((club: Club) => (
                          <button
                            key={club.id}
                            onClick={() => handleClubChange(club.id)}
                            className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                            role="menuitem"
                          >
                            {club.name}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* User Menu */}
              <div className="relative" ref={userDropdownRef}>
                <button
                  onClick={() => toggleDropdown(setDropdownOpen)}
                  className="flex items-center px-3 py-1 rounded-md text-sm font-medium bg-blue-700 hover:bg-blue-800"
                >
                  {user?.username}
                  <svg xmlns="http://www.w3.org/2000/svg" className="ml-2 h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
                {dropdownOpen && (
                  <div className="absolute right-0 mt-2 w-48 rounded-md shadow-lg bg-white ring-1 ring-black ring-opacity-5 z-50">
                    <div className="py-1" role="menu">
                      <Link
                        href="/profile"
                        className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                        role="menuitem"
                      >
                        Profile
                      </Link>
                      <Link
                        href="/help"
                        className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                        role="menuitem"
                      >
                        Help
                      </Link>
                      <button
                        onClick={handleLogout}
                        className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                        role="menuitem"
                      >
                        Logout
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
          
          {/* Mobile menu button */}
          <div className="flex md:hidden items-center space-x-2">
            {/* Mobile Club Selector */}
            {currentClub && (
              <div className="relative" ref={mobileClubRef}>
                <button
                  onClick={() => toggleDropdown(setMobileClubOpen)}
                  className="flex items-center px-2 py-1 rounded-md text-sm font-medium bg-blue-700 hover:bg-blue-800"
                >
                  <span className="max-w-[100px] truncate">{currentClub.name}</span>
                  <svg xmlns="http://www.w3.org/2000/svg" className="ml-1 h-4 w-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
                {mobileClubOpen && (
                  <div className="absolute right-0 mt-2 w-48 rounded-md shadow-lg bg-white ring-1 ring-black ring-opacity-5 z-50">
                    <div className="py-1" role="menu">
                      {userClubs.map((club: Club) => (
                        <button
                          key={club.id}
                          onClick={() => handleClubChange(club.id)}
                          className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                          role="menuitem"
                        >
                          {club.name}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Mobile Profile Menu */}
            <div className="relative" ref={mobileProfileRef}>
              <button
                onClick={() => toggleDropdown(setMobileProfileOpen)}
                className="flex items-center px-2 py-1 rounded-md text-sm font-medium bg-blue-700 hover:bg-blue-800"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
              </button>
              {mobileProfileOpen && (
                <div className="absolute right-0 mt-2 w-48 rounded-md shadow-lg bg-white ring-1 ring-black ring-opacity-5 z-50">
                  <div className="py-1" role="menu">
                    <Link
                      href="/profile"
                      className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                      role="menuitem"
                    >
                      Profile
                    </Link>
                    <Link
                      href="/help"
                      className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                      role="menuitem"
                    >
                      Help
                    </Link>
                    <button
                      onClick={handleLogout}
                      className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                      role="menuitem"
                    >
                      Logout
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Mobile hamburger menu */}
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
          {currentClub ? (
            <>
              <Link
                href="/competition/manage"
                className={`block px-3 py-2 rounded-md text-base font-medium ${
                  pathname === '/competition/manage' ? 'bg-blue-700 text-white' : 'text-white hover:bg-blue-500'
                }`}
              >
                Competitions
              </Link>
              <Link
                href={`/competition/scoring`}
                className={`block px-3 py-2 rounded-md text-base font-medium ${
                  pathname?.startsWith('/competition/scoring') ? 'bg-blue-700 text-white' : 'text-white hover:bg-blue-500'
                }`}
              >
                Scoring
              </Link>
              <Link
                href="/leagues"
                className={`block px-3 py-2 rounded-md text-base font-medium ${
                  pathname?.startsWith('/leagues') ? 'bg-blue-700 text-white' : 'text-white hover:bg-blue-500'
                }`}
              >
                Teams
              </Link>
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
                className={`block px-3 py-2 rounded-md text-base font-medium relative ${
                  pathname === '/messaging' ? 'bg-blue-700 text-white' : 'text-white hover:bg-blue-500'
                }`}
              >
                Chat
                {unreadCount > 0 && (
                  <span className="absolute top-1 ml-1 bg-red-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center">
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </span>
                )}
              </Link>
              <Link
                href="/noticeboard"
                className={`block px-3 py-2 rounded-md text-base font-medium ${
                  pathname === '/noticeboard' ? 'bg-blue-700 text-white' : 'text-white hover:bg-blue-500'
                }`}
              >
                Noticeboard
              </Link>
            </>
          ) : (
            // For users without a club, show a link to dashboard
            <Link
              href="/dashboard"
              className={`block px-3 py-2 rounded-md text-base font-medium ${
                pathname === '/dashboard' ? 'bg-blue-700 text-white' : 'text-white hover:bg-blue-500'
              }`}
            >
              Dashboard
            </Link>
          )}

          {/* Admin/Club Management */}
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
        
        {/* ... rest of the mobile menu ... */}
      </div>
    </nav>
  );
}