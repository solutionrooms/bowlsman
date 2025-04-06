'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import api from '../../../../../src/lib/axios';
import Navigation from '../../../../components/Navigation';
import PageHeading from '../../../../components/PageHeading';
import { canManageTeam } from '../../../../../src/utils/permissions';

interface League {
  id: number;
  name: string;
  club: {
    id: number;
    name: string;
  };
  season: string;
  captain: {
    id: number;
    first_name: string;
    last_name: string;
    username: string;
  } | null;
  deputy: {
    id: number;
    first_name: string;
    last_name: string;
    username: string;
  } | null;
}

interface Club {
  id: number;
  name: string;
  is_admin: boolean;
}

interface UserData {
  current_club: Club | null;
  clubs: Club[];
  user: {
    id: number;
    username: string;
    email: string;
    is_staff: boolean;
  };
}

export default function FixturesManagePage() {
  const router = useRouter();
  const params = useParams();
  const [league, setLeague] = useState<League | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [canManage, setCanManage] = useState(false);
  const [userId, setUserId] = useState<number | null>(null);
  const [userClubs, setUserClubs] = useState<Club[]>([]);

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

        // Get user data
        const userResponse = await api.get<UserData>('users/me');
        const userData = userResponse.data;
        const clubs = userData.clubs || [];
        
        setUserClubs(clubs);
        setUserId(userData.user.id);
        
        // Get league details
        const leagueResponse = await api.get<League>(`leagues/${params.id}`);
        const leagueData = leagueResponse.data;
        setLeague(leagueData);
        
        setLoading(false);
      } catch (err: any) {
        console.error('Error fetching data:', err);
        setError('Failed to load data. Please try again later.');
        setLoading(false);
      }
    };

    fetchData();
  }, [params.id]);

  // Check if user can manage the team whenever relevant data changes
  useEffect(() => {
    if (userId && league && userClubs.length > 0) {
      const hasPermission = canManageTeam(userId, league, userClubs);
      setCanManage(hasPermission);
      
      // If user doesn't have permission, redirect
      if (!hasPermission) {
        router.push(`/leagues/${params.id}`);
      }
    }
  }, [userId, league, userClubs, params.id, router]);

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

  if (!league || !canManage) {
    return (
      <div className="min-h-screen bg-gray-100">
        <Navigation onLogout={handleLogout} />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="bg-white shadow overflow-hidden sm:rounded-lg p-6">
            <div className="text-center">
              <h3 className="text-lg font-medium text-gray-900">Access Denied</h3>
              <div className="mt-2">
                <p className="text-sm text-gray-500">You don't have permission to manage fixtures for this team.</p>
              </div>
              <div className="mt-6">
                <Link
                  href={`/leagues/${params.id}`}
                  className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700"
                >
                  Back to Team
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100">
      <Navigation onLogout={handleLogout} />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-6 flex justify-between items-center">
          <PageHeading 
            title={`Manage Fixtures - ${league.name}`}
            infoText="Manage team fixtures and selections"
          />
          <Link
            href={`/leagues/${league.id}`}
            className="inline-flex items-center px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-md text-blue-700 bg-blue-100 hover:bg-blue-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
          >
            ← Back to Team
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

        <div className="bg-white shadow overflow-hidden sm:rounded-lg">
          <div className="px-4 py-5 sm:p-6">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Fixture Management Options</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="p-4 border rounded-lg bg-blue-50">
                <h4 className="font-medium text-blue-800 mb-2">Team Selection</h4>
                <p className="text-sm text-gray-600 mb-4">
                  Manage which players are selected for each fixture. View player availability and make team selections.
                </p>
                <Link
                  href={`/leagues/${league.id}/fixtures/manage/selection`}
                  className="inline-flex items-center px-3 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700"
                >
                  Manage Team Selection
                </Link>
              </div>
              
              <div className="p-4 border rounded-lg bg-green-50">
                <h4 className="font-medium text-green-800 mb-2">Import Fixtures</h4>
                <p className="text-sm text-gray-600 mb-4">
                  Import fixtures from your league website or add fixtures manually.
                </p>
                <Link
                  href={`/leagues/${league.id}/edit`}
                  className="inline-flex items-center px-3 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-green-600 hover:bg-green-700"
                >
                  Edit League Information
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}