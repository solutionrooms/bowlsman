'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Navigation from '../components/Navigation';
import PageHeading from '../components/PageHeading';
import pageDescriptions from '../utils/pageDescriptions';
import api from '../../src/lib/axios';
import Link from 'next/link';

interface User {
  id: number;
  username: string;
  email: string;
  is_staff: boolean;
  is_superuser: boolean;
  club_memberships?: ClubUser[];
}

interface Club {
  id: number;
  name: string;
  member_count?: number;
}

interface ClubUser {
  id: number;
  club: number;
  club_name: string;
  is_admin: boolean;
  club_role: string;
}

interface ClubMember {
  id: number;
  user: any;
  club: number;
  club_name: string;
  is_admin: boolean;
  club_role: string;
  created_at: string;
  last_login_at: string | null;
  user_details: {
    id: number;
    username: string;
    display_name: string;
  };
}

interface UserResponse {
  user: User;
  current_club: Club | null;
}

export default function Home() {
  const [user, setUser] = useState<User | null>(null);
  const [currentClub, setCurrentClub] = useState<Club | null>(null);
  const [clubMembership, setClubMembership] = useState<ClubUser | null>(null);
  const [clubMembers, setClubMembers] = useState<ClubMember[]>([]);
  const [memberCount, setMemberCount] = useState<number>(0);
  const [mounted, setMounted] = useState(false);
  const router = useRouter();

  // Set mounted to true after component mounts
  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    // Only run if the component is mounted to avoid localStorage errors
    if (!mounted) return;

    const fetchUser = async () => {
      try {
        const token = localStorage.getItem('token');
        if (!token) {
          router.push('/');
          return;
        }

        // Fetch user data
        const response = await api.get<UserResponse>('/users/me/', {
          headers: { Authorization: `Token ${token}` }
        });
        setUser(response.data.user);
        setCurrentClub(response.data.current_club);
        
        if (response.data.current_club) {
          // Find user's membership for current club
          if (response.data.user.club_memberships) {
            const membership = response.data.user.club_memberships.find(
              (m: ClubUser) => m.club === response.data.current_club!.id
            );
            setClubMembership(membership || null);
          }
          
          // Fetch club details
          const clubResponse = await api.get<Club>(`/clubs/${response.data.current_club.id}/`, {
            headers: { Authorization: `Token ${token}` }
          });
          if (clubResponse.data.member_count !== undefined) {
            setMemberCount(clubResponse.data.member_count);
          }
          
          // Fetch club members - using the exact same format as the club detail page
          const membersResponse = await api.get<ClubMember[]>(`/club-users/?club=${response.data.current_club.id}`, {
            headers: { Authorization: `Token ${token}` }
          });
          console.log('Club members:', membersResponse.data);
          
          // Sort members
          const sortedMembers = [...membersResponse.data].sort((a, b) => {
            if (a.is_admin && !b.is_admin) return -1;
            if (!a.is_admin && b.is_admin) return 1;
            
            const aHasRole = a.club_role && a.club_role !== '';
            const bHasRole = b.club_role && b.club_role !== '';
            if (aHasRole && !bHasRole) return -1;
            if (!aHasRole && bHasRole) return 1;
            
            const aName = a.user_details?.display_name || '';
            const bName = b.user_details?.display_name || '';
            return aName.localeCompare(bName);
          });
          
          setClubMembers(sortedMembers);
        }
      } catch (error) {
        console.error('Error fetching data:', error);
        localStorage.removeItem('token');
        router.push('/');
      }
    };

    fetchUser();
  }, [mounted, router]);

  const handleLogout = () => {
    localStorage.removeItem('token');
    router.push('/');
  };
  
  const startChat = (userId: number) => {
    if (!currentClub) return;
    
    // Create a direct chat with the user
    router.push(`/messaging?newChat=true&userId=${userId}&clubId=${currentClub.id}`);
  };

  if (!user) {
    return <div>Loading...</div>;
  }

  return (
    <div className="min-h-screen bg-gray-100">
      <Navigation onLogout={handleLogout} />

      <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="px-4 py-6 sm:px-0">
          <div className="bg-white shadow rounded-lg p-6 mb-6">
            <PageHeading 
              title={`Welcome, ${user.username}!`} 
              infoText={pageDescriptions.home}
              className="text-2xl font-bold mb-4"
            />
            <div className="mt-4">
              <p className="text-gray-600">Email: {user.email}</p>
              <p className="text-gray-600">Role: {user.is_staff ? 'Admin' : 'User'}</p>
              
              {/* Debug Information */}
              {currentClub && (
                <p className="text-gray-600">Current Club: {currentClub.name}</p>
              )}
              
              {user?.is_staff && (
                <p className="text-gray-600">Staff: Yes</p>
              )}
              
              {user?.is_superuser && (
                <p className="text-gray-600">Superuser: Yes</p>
              )}
              
              {clubMembership?.is_admin && (
                <p className="text-gray-600">Club Admin: Yes</p>
              )}
              
              {currentClub && (
                <p className="text-gray-600">Club Role: {clubMembership?.club_role || "Player"}</p>
              )}
            </div>
          </div>
          
          {/* Current Club Section */}
          {currentClub && (
            <div className="bg-white shadow rounded-lg p-6 mb-6">
              <div className="flex justify-between items-center mb-4">
                <PageHeading 
                  title={`${currentClub.name}`} 
                  className="text-2xl font-bold"
                />
                <Link 
                  href={`/club/${currentClub.id}`}
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
                >
                  View Club
                </Link>
              </div>
              
              <div className="mb-4 flex items-center">
                <p className="text-gray-700 font-medium mr-2">Members: {memberCount}</p>
                <Link 
                  href="/bowlers"
                  className="text-blue-600 hover:text-blue-800 hover:underline font-medium"
                >
                  View Bowlers
                </Link>
              </div>
              
              <div className="mb-4">
                <h3 className="text-lg font-semibold mb-2">Club Leadership</h3>
                <div className="space-y-3">
                  {clubMembers.filter(member => member.is_admin || member.club_role).length > 0 ? (
                    clubMembers
                      .filter(member => member.is_admin || member.club_role)
                      .map(member => (
                        <div key={member.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-md">
                          <div>
                            <span className="font-medium">{member.user_details.display_name}</span>
                            <div className="flex space-x-2 mt-1">
                              {member.is_admin && (
                                <span className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded-full">
                                  Admin
                                </span>
                              )}
                              {member.club_role && (
                                <span className="px-2 py-1 bg-green-100 text-green-800 text-xs rounded-full">
                                  {member.club_role}
                                </span>
                              )}
                            </div>
                          </div>
                          <button
                            onClick={() => startChat(member.user_details.id)}
                            className="p-2 text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded-full transition-colors"
                            title={`Chat with ${member.user_details.display_name}`}
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                            </svg>
                          </button>
                        </div>
                      ))
                  ) : (
                    <p className="text-gray-500 italic">No club leadership assigned yet.</p>
                  )}
                </div>
              </div>
            </div>
          )}
          
          {/* Welcome Message */}
          <div className="bg-white shadow rounded-lg p-6 mb-6">
            <PageHeading 
              title="About Bowlsman" 
              className="text-2xl font-bold mb-4"
            />
            <p className="text-gray-700 mb-4">
              Bowlsman is your all-in-one platform for managing bowling competitions and tournaments. 
              Whether you're organizing a casual league or a professional tournament, our app helps you 
              create and manage competitions, track players, generate schedules, and more.
            </p>
            <p className="text-gray-700">
              With Bowlsman, you can easily add players to your competitions, create round-robin schedules, 
              replace players when needed, and keep everything organized in one place.
            </p>
          </div>
        </div>
      </main>
    </div>
  );
} 