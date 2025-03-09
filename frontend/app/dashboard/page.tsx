'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Navigation from '../components/Navigation';
import PageHeading from '../components/PageHeading';
import api from '../../src/lib/axios';
import Link from 'next/link';

interface User {
  id: number;
  username: string;
  email: string;
  is_staff: boolean;
  is_superuser: boolean;
}

interface Club {
  id: number;
  name: string;
  address: string;
  member_count: number;
}

interface ClubApplication {
  id: number;
  club: number;
  club_name: string;
  status: string;
  created_at: string;
}

interface UserResponse {
  user: User;
  current_club: any;
}

export default function Dashboard() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [clubs, setClubs] = useState<Club[]>([]);
  const [applications, setApplications] = useState<ClubApplication[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [applyingToClub, setApplyingToClub] = useState<number | null>(null);
  const [applicationMessage, setApplicationMessage] = useState('');
  const [applicationSuccess, setApplicationSuccess] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) return;

    const fetchData = async () => {
      try {
        const token = localStorage.getItem('token');
        if (!token) {
          router.push('/');
          return;
        }

        // Fetch user data
        const userResponse = await api.get<UserResponse>('/users/me/', {
          headers: { Authorization: `Token ${token}` }
        });
        setUser(userResponse.data.user);

        // If user has a current club, redirect to home
        if (userResponse.data.current_club) {
          router.push('/home');
          return;
        }

        // Fetch all clubs - add for_dashboard parameter
        const clubsResponse = await api.get<Club[]>('/clubs/', {
          headers: { Authorization: `Token ${token}` },
          params: { for_dashboard: true }
        });
        setClubs(clubsResponse.data);

        // Fetch user's applications
        const applicationsResponse = await api.get<ClubApplication[]>('/club-applications/', {
          headers: { Authorization: `Token ${token}` }
        });
        setApplications(applicationsResponse.data);

        setLoading(false);
      } catch (error) {
        console.error('Error fetching data:', error);
        setError('Failed to load data. Please try again later.');
        setLoading(false);
      }
    };

    fetchData();
  }, [mounted, router]);

  const handleApply = async (clubId: number) => {
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        router.push('/');
        return;
      }

      setApplyingToClub(null);
      setLoading(true);

      const response = await api.post<ClubApplication>(
        `/clubs/${clubId}/apply/`,
        { message: applicationMessage },
        { headers: { Authorization: `Token ${token}` } }
      );

      // Add the new application to the list
      setApplications([...applications, response.data]);
      setApplicationSuccess('Your application has been submitted successfully!');
      setApplicationMessage('');
      
      // Clear success message after 3 seconds
      setTimeout(() => {
        setApplicationSuccess(null);
      }, 3000);
    } catch (error: any) {
      console.error('Error applying to club:', error);
      setError(error.response?.data?.error || 'Failed to apply to club. Please try again later.');
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    if (mounted) {
      localStorage.removeItem('token');
      router.push('/');
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100">
      <Navigation onLogout={handleLogout} />

      <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="px-4 py-6 sm:px-0">
          <div className="bg-white shadow rounded-lg p-6 mb-6">
            <PageHeading 
              title="Welcome to BowlsHub!" 
              infoText="This is your dashboard. You can find and join bowling clubs here."
              className="text-2xl font-bold mb-4"
            />
            
            <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-md">
              <h2 className="text-lg font-semibold text-blue-800 mb-2">Getting Started</h2>
              <p className="text-gray-700 mb-3">
                Welcome to BowlsHub! To get started, you need to join a bowling club. 
                Browse the list of clubs below and apply to join one that interests you.
              </p>
              <p className="text-gray-700">
                Once your application is approved by the club administrator, you'll be able to 
                participate in competitions, track your scores, and connect with other bowlers.
              </p>
            </div>
          </div>

          {/* Pending Applications */}
          {applications.length > 0 && (
            <div className="bg-white shadow rounded-lg p-6 mb-6">
              <h2 className="text-xl font-semibold mb-4">Your Club Applications</h2>
              <div className="space-y-4">
                {applications.map(app => (
                  <div 
                    key={app.id} 
                    className={`p-4 rounded-md border ${
                      app.status === 'pending' ? 'bg-yellow-50 border-yellow-200' : 
                      app.status === 'approved' ? 'bg-green-50 border-green-200' : 
                      'bg-red-50 border-red-200'
                    }`}
                  >
                    <div className="flex justify-between items-center">
                      <div>
                        <h3 className="font-medium">{app.club_name}</h3>
                        <p className="text-sm text-gray-600">
                          Applied on: {new Date(app.created_at).toLocaleDateString()}
                        </p>
                      </div>
                      <span 
                        className={`px-3 py-1 text-sm rounded-full ${
                          app.status === 'pending' ? 'bg-yellow-100 text-yellow-800' : 
                          app.status === 'approved' ? 'bg-green-100 text-green-800' : 
                          'bg-red-100 text-red-800'
                        }`}
                      >
                        {app.status.charAt(0).toUpperCase() + app.status.slice(1)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Success Message */}
          {applicationSuccess && (
            <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded relative mb-6" role="alert">
              <span className="block sm:inline">{applicationSuccess}</span>
            </div>
          )}

          {/* Error Message */}
          {error && (
            <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative mb-6" role="alert">
              <span className="block sm:inline">{error}</span>
              <button 
                className="absolute top-0 bottom-0 right-0 px-4 py-3"
                onClick={() => setError(null)}
              >
                <span className="text-xl">&times;</span>
              </button>
            </div>
          )}

          {/* Available Clubs */}
          <div className="bg-white shadow rounded-lg p-6">
            <h2 className="text-xl font-semibold mb-4">Available Clubs</h2>
            
            {clubs.length === 0 ? (
              <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-md">
                <h3 className="text-lg font-semibold text-yellow-800 mb-2">No Clubs Available</h3>
                <p className="text-gray-700 mb-3">
                  There are currently no bowling clubs available in the system. Please check back later or contact the administrator.
                </p>
                <p className="text-gray-700">
                  If you're interested in creating a new club, please contact the system administrator.
                </p>
                {user?.is_staff && (
                  <div className="mt-4">
                    <Link 
                      href="/club/create"
                      className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 transition"
                    >
                      Create New Club
                    </Link>
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-4">
                {clubs.map(club => {
                  // Check if user already has an application for this club
                  const hasApplication = applications.some(app => app.club === club.id);
                  
                  return (
                    <div key={club.id} className="border rounded-md p-4 hover:bg-gray-50 transition">
                      <div className="flex justify-between items-start">
                        <div>
                          <h3 className="font-medium text-lg">{club.name}</h3>
                          {club.address && (
                            <p className="text-gray-600 text-sm mt-1">{club.address}</p>
                          )}
                          <p className="text-gray-600 text-sm mt-1">Members: {club.member_count}</p>
                        </div>
                        
                        {hasApplication ? (
                          <span className="px-3 py-1 bg-gray-100 text-gray-600 text-sm rounded-full">
                            Application Submitted
                          </span>
                        ) : (
                          applyingToClub === club.id ? (
                            <div className="flex flex-col space-y-2 w-1/2">
                              <textarea
                                value={applicationMessage}
                                onChange={(e) => setApplicationMessage(e.target.value)}
                                placeholder="Why do you want to join this club? (optional)"
                                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                                rows={3}
                              />
                              <div className="flex justify-end space-x-2">
                                <button
                                  onClick={() => setApplyingToClub(null)}
                                  className="px-3 py-1 bg-gray-200 text-gray-700 rounded hover:bg-gray-300 transition text-sm"
                                >
                                  Cancel
                                </button>
                                <button
                                  onClick={() => handleApply(club.id)}
                                  className="px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 transition text-sm"
                                >
                                  Submit
                                </button>
                              </div>
                            </div>
                          ) : (
                            <button
                              onClick={() => setApplyingToClub(club.id)}
                              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition"
                            >
                              Apply
                            </button>
                          )
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
            
            {user?.is_staff && clubs.length > 0 && (
              <div className="mt-6 flex justify-end">
                <Link 
                  href="/club/create"
                  className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 transition"
                >
                  Create New Club
                </Link>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
} 