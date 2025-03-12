'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import api from '../../../src/lib/axios';
import Navigation from '../../components/Navigation';
import Link from 'next/link';

interface User {
  id: number;
  username: string;
  email: string;
  first_name: string;
  last_name: string;
  is_staff: boolean;
}

interface Club {
  id: number;
  name: string;
  is_admin: boolean;
}

interface ClubUser {
  id: number;
  user: User;
  is_admin: boolean;
}

interface UserData {
  user: User;
  current_club: Club | null;
  clubs: Club[];
}

export default function LeagueAdminPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [currentClub, setCurrentClub] = useState<Club | null>(null);
  const [userClubs, setUserClubs] = useState<Club[]>([]);
  const [clubMembers, setClubMembers] = useState<ClubUser[]>([]);
  const [isStaff, setIsStaff] = useState(false);
  
  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('currentClub');
    router.push('/');
  };

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        setError(null);
        
        // Get user data including clubs
        const userResponse = await api.get<UserData>('users/me');
        const userData = userResponse.data;
        const current_club = userData.current_club;
        const clubs = userData.clubs || [];
        
        // Check if user is staff
        setIsStaff(userData.user.is_staff);
        
        if (!userData.user.is_staff) {
          setError('You must be a staff user to access this page');
          setLoading(false);
          return;
        }
        
        setUserClubs(clubs);
        setCurrentClub(current_club);
        
        if (current_club) {
          await fetchClubMembers(current_club.id);
        }
        
        setLoading(false);
      } catch (err: any) {
        console.error('Error fetching data:', err);
        setError('Failed to load data: ' + (err.response?.data?.error || err.message));
        setLoading(false);
      }
    };
    
    fetchData();
  }, []);

  const fetchClubMembers = async (clubId: number) => {
    try {
      const response = await api.get<{user: User, is_admin: boolean}[]>(
        `/clubs/${clubId}/members`,
        {}
      );
      setClubMembers(response.data.map(cu => ({
        id: cu.user.id,
        user: cu.user,
        is_admin: cu.is_admin
      })));
    } catch (error) {
      console.error('Error fetching club members:', error);
      setError('Failed to fetch club members. Please try again.');
    }
  };

  const handleClubChange = async (clubId: number) => {
    try {
      setLoading(true);
      
      // Update current club in backend and localStorage
      await api.put('/club-users/set_current_club', { club_id: clubId });
      
      // Find and set the current club in state
      const selectedClub = userClubs.find(club => club.id === clubId);
      if (selectedClub) {
        setCurrentClub(selectedClub);
        await fetchClubMembers(clubId);
      }
      
      setLoading(false);
    } catch (err: any) {
      console.error('Error changing club:', err);
      setError('Failed to change club: ' + (err.response?.data?.error || err.message));
      setLoading(false);
    }
  };

  const setAdminStatus = async (userId: number, isAdmin: boolean) => {
    if (!currentClub) return;
    
    try {
      setLoading(true);
      setError(null);
      setSuccess(null);
      
      await api.post('club-admin-status', {
        club_id: currentClub.id,
        user_id: userId,
        is_admin: isAdmin
      });
      
      // Refresh club members
      await fetchClubMembers(currentClub.id);
      
      setSuccess(`Admin status updated successfully`);
      setLoading(false);
    } catch (err: any) {
      console.error('Error updating admin status:', err);
      setError('Failed to update admin status: ' + (err.response?.data?.error || err.message));
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-100">
        <Navigation onLogout={handleLogout} />
        <div className="flex justify-center items-center min-h-screen">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100">
      <Navigation onLogout={handleLogout} />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-6 flex justify-between items-center">
          <h1 className="text-2xl font-bold">League Admin Management</h1>
          <Link
            href="/leagues"
            className="inline-flex items-center px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-md text-blue-700 bg-blue-100 hover:bg-blue-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
          >
            ← Back to Leagues
          </Link>
        </div>
        
        {error && (
          <div className="bg-red-50 border-l-4 border-red-400 p-4 mb-6">
            <div className="flex">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="ml-3">
                <p className="text-sm text-red-700">{error}</p>
              </div>
            </div>
          </div>
        )}
        
        {success && (
          <div className="bg-green-50 border-l-4 border-green-400 p-4 mb-6">
            <div className="flex">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5 text-green-400" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="ml-3">
                <p className="text-sm text-green-700">{success}</p>
              </div>
            </div>
          </div>
        )}
        
        {!isStaff ? (
          <div className="bg-white shadow overflow-hidden sm:rounded-lg p-6">
            <div className="text-center">
              <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
              <h3 className="mt-2 text-sm font-medium text-gray-900">Permission Denied</h3>
              <p className="mt-1 text-sm text-gray-500">
                You must be a staff user to access this page.
              </p>
            </div>
          </div>
        ) : (
          <>
            {/* Club selection */}
            {userClubs.length > 0 && (
              <div className="bg-white shadow overflow-hidden sm:rounded-lg mb-6">
                <div className="px-4 py-5 sm:p-6">
                  <h2 className="text-lg font-medium text-gray-900 mb-4">Select Club</h2>
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {userClubs.map(club => (
                      <button
                        key={club.id}
                        onClick={() => handleClubChange(club.id)}
                        className={`relative block w-full p-4 border rounded-lg shadow-sm ${
                          currentClub?.id === club.id
                            ? 'border-blue-500 ring-2 ring-blue-500 bg-blue-50'
                            : 'border-gray-300 hover:border-gray-400'
                        }`}
                      >
                        <span className="block text-sm font-medium text-gray-900">{club.name}</span>
                        {club.is_admin && (
                          <span className="mt-1 block text-xs text-blue-600">(Admin)</span>
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}
            
            {/* Club members list */}
            {currentClub && (
              <div className="bg-white shadow overflow-hidden sm:rounded-lg">
                <div className="px-4 py-5 sm:p-6">
                  <h2 className="text-lg font-medium text-gray-900 mb-4">
                    {`Club Members in ${currentClub.name}`}
                  </h2>
                  
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Name
                          </th>
                          <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Username
                          </th>
                          <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Admin Status
                          </th>
                          <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Actions
                          </th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {clubMembers.map(member => (
                          <tr key={member.user.id}>
                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                              {member.user.first_name} {member.user.last_name}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                              {member.user.username}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                              {member.is_admin ? (
                                <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 text-green-800">
                                  Admin
                                </span>
                              ) : (
                                <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-gray-100 text-gray-800">
                                  Member
                                </span>
                              )}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                              {member.is_admin ? (
                                <button
                                  onClick={() => setAdminStatus(member.user.id, false)}
                                  className="text-red-600 hover:text-red-900"
                                >
                                  Remove Admin
                                </button>
                              ) : (
                                <button
                                  onClick={() => setAdminStatus(member.user.id, true)}
                                  className="text-blue-600 hover:text-blue-900"
                                >
                                  Make Admin
                                </button>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
} 