'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import api from '../../../src/lib/axios';
import Navigation from '../../components/Navigation';
import PageHeading from '../../components/PageHeading';
import pageDescriptions from '../../utils/pageDescriptions';

type Notice = {
  id: number;
  title: string;
  description: string;
  notice_type: 'social_bowl' | 'general' | 'for_sale';
  date?: string;
  time?: string;
  location?: string;
  price?: number;
  image?: string;
  pdf_file?: string;
  participant_count: number;
  is_participant: boolean;
  participants: {
    id: number;
    user: {
      id: number;
      username: string;
    };
    joined_at: string;
  }[];
  created_by: {
    id: number;
    username: string;
  };
  created_at: string;
  updated_at: string;
};

type Club = {
  id: number;
  name: string;
  is_admin?: boolean;
};

type User = {
  id: number;
  username: string;
  email: string;
  is_staff: boolean;
};

export default function NoticeDetailPage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const [notice, setNotice] = useState<Notice | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<boolean>(false);
  const [currentClub, setCurrentClub] = useState<Club | null>(null);
  const [chatLoading, setChatLoading] = useState<boolean>(false);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [canEdit, setCanEdit] = useState<boolean>(false);
  const id = params.id;

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('currentClub');
    router.push('/');
  };

  useEffect(() => {
    // Check for mounted state to prevent SSR localStorage issues
    let isMounted = true;
    
    const fetchCurrentClub = async () => {
      try {
        if (typeof window !== 'undefined') {
          const storedClub = localStorage.getItem('currentClub');
          if (storedClub) {
            setCurrentClub(JSON.parse(storedClub));
          } else {
            // If no club is set, try to fetch from the server
            const response = await api.get<{user: User, current_club: Club | null}>('/users/me/');
            if (isMounted && response.data.current_club) {
              setCurrentClub(response.data.current_club);
              setCurrentUser(response.data.user);
              localStorage.setItem('currentClub', JSON.stringify(response.data.current_club));
            }
          }
        }
      } catch (err) {
        if (isMounted) {
          console.error('Error fetching current club:', err);
          setError('Error loading club. Please try again.');
        }
      }
    };

    fetchCurrentClub();
    
    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    const fetchNotice = async () => {
      setLoading(true);
      try {
        const response = await api.get<Notice>(`/notices/${id}/`);
        setNotice(response.data);
        setError(null);
        
        // Also fetch current user if not already fetched
        if (!currentUser) {
          const userResponse = await api.get<{user: User, current_club: Club | null}>('/users/me/');
          setCurrentUser(userResponse.data.user);
          
          // Check if user is admin of the club
          if (userResponse.data.current_club) {
            const adminCheckResponse = await api.get<{club_id: number, is_admin: boolean, username: string}>(
              `club-admin-status?club_id=${userResponse.data.current_club.id}`
            );
            
            const isAdmin = adminCheckResponse.data.is_admin;
            const isCreator = response.data.created_by.id === userResponse.data.user.id;
            
            setCanEdit(isAdmin || isCreator);
          }
        } else {
          // Check if current user is the creator or an admin
          const isCreator = response.data.created_by.id === currentUser.id;
          
          // Check if user is admin of the club
          if (currentClub) {
            const adminCheckResponse = await api.get<{club_id: number, is_admin: boolean, username: string}>(
              `club-admin-status?club_id=${currentClub.id}`
            );
            
            const isAdmin = adminCheckResponse.data.is_admin;
            setCanEdit(isAdmin || isCreator);
          } else {
            setCanEdit(isCreator);
          }
        }
      } catch (err) {
        console.error('Error fetching notice:', err);
        setError('Failed to load notice. It may have been removed or you do not have permission to view it.');
      } finally {
        setLoading(false);
      }
    };

    fetchNotice();
  }, [id, currentUser, currentClub]);

  const formatDateTime = (date?: string, time?: string) => {
    if (!date) return 'No date specified';
    
    const formattedDate = new Date(date).toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
    
    if (!time) return formattedDate;
    
    return `${formattedDate} at ${time}`;
  };

  const handleJoinLeave = async (action: 'join' | 'leave') => {
    setActionLoading(true);
    try {
      const response = await api.post<Notice>(`/notices/${id}/${action}/`);
      setNotice(response.data);
    } catch (err) {
      console.error(`Error ${action === 'join' ? 'joining' : 'leaving'} notice:`, err);
      setError(`Failed to ${action} the social bowling session. Please try again.`);
    } finally {
      setActionLoading(false);
    }
  };

  const getNoticeTypeLabel = (type: string) => {
    switch (type) {
      case 'social_bowl': return 'Social Bowling';
      case 'general': return 'General Notice';
      case 'for_sale': return 'For Sale';
      default: return type;
    }
  };

  const handleStartChat = async () => {
    if (!notice || !notice.created_by) return;
    
    setChatLoading(true);
    try {
      // Create a direct chat with the notice creator
      const response = await api.post('/chats/', {
        chat_type: 'direct',
        club: currentClub?.id,
        members: [notice.created_by.id]
      });
      
      // Redirect to the chat page
      router.push(`/messages/${response.data.id}`);
    } catch (err) {
      console.error('Error creating chat:', err);
      setError('Failed to start chat. Please try again.');
      setChatLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-100">
        <Navigation onLogout={handleLogout} />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="animate-pulse">
            <div className="h-8 bg-gray-200 rounded w-1/4 mb-4"></div>
            <div className="h-4 bg-gray-200 rounded w-3/4 mb-8"></div>
            <div className="space-y-4">
              <div className="h-4 bg-gray-200 rounded w-1/2"></div>
              <div className="h-4 bg-gray-200 rounded w-2/3"></div>
              <div className="h-4 bg-gray-200 rounded w-1/3"></div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error || !notice) {
    return (
      <div className="min-h-screen bg-gray-100">
        <Navigation onLogout={handleLogout} />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="bg-red-50 border-l-4 border-red-400 p-4">
            <div className="flex">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="ml-3">
                <p className="text-sm text-red-700">{error || 'Notice not found'}</p>
                <p className="mt-2">
                  <button 
                    onClick={() => router.push('/noticeboard')}
                    className="text-red-700 hover:text-red-600 font-medium"
                  >
                    Go back to noticeboard
                  </button>
                </p>
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
        <div className="md:flex md:items-center md:justify-between mb-6">
          <div className="flex-1 min-w-0">
            <div className="flex items-center">
              <PageHeading 
                title={notice.title}
                infoText={pageDescriptions.noticeDetails}
                className="text-2xl font-bold leading-7 text-gray-900 sm:text-3xl sm:truncate mr-2"
              />
              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                notice.notice_type === 'social_bowl' ? 'bg-blue-100 text-blue-800' : 
                notice.notice_type === 'for_sale' ? 'bg-green-100 text-green-800' : 
                'bg-gray-100 text-gray-800'
              }`}>
                {getNoticeTypeLabel(notice.notice_type)}
              </span>
            </div>
            <div className="mt-1 flex flex-col sm:flex-row sm:flex-wrap sm:mt-0 sm:space-x-6">
              {notice.date && (
                <div className="mt-2 flex items-center text-sm text-gray-500">
                  <svg className="flex-shrink-0 mr-1.5 h-5 w-5 text-gray-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M6 2a1 1 0 00-1 1v1H4a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-1V3a1 1 0 10-2 0v1H7V3a1 1 0 00-1-1zm0 5a1 1 0 000 2h8a1 1 0 100-2H6z" clipRule="evenodd" />
                  </svg>
                  {formatDateTime(notice.date, notice.time)}
                </div>
              )}
              {notice.location && (
                <div className="mt-2 flex items-center text-sm text-gray-500">
                  <svg className="flex-shrink-0 mr-1.5 h-5 w-5 text-gray-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd" />
                  </svg>
                  {notice.location}
                </div>
              )}
              <div className="mt-2 flex items-center text-sm text-gray-500">
                <svg className="flex-shrink-0 mr-1.5 h-5 w-5 text-gray-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
                </svg>
                Posted by {notice.created_by.username}
              </div>
              <div className="mt-2 flex items-center text-sm text-gray-500">
                <svg className="flex-shrink-0 mr-1.5 h-5 w-5 text-gray-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M6 2a1 1 0 00-1 1v1H4a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-1V3a1 1 0 10-2 0v1H7V3a1 1 0 00-1-1zm0 5a1 1 0 000 2h8a1 1 0 100-2H6z" clipRule="evenodd" />
                </svg>
                Posted on {new Date(notice.created_at).toLocaleDateString()}
              </div>
            </div>
          </div>
          <div className="mt-5 flex lg:mt-0 lg:ml-4">
            <span className="hidden sm:block ml-3">
              <Link
                href="/noticeboard"
                className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              >
                Back to Noticeboard
              </Link>
            </span>
            
            {canEdit && (
              <span className="sm:ml-3">
                <Link
                  href={`/noticeboard/${id}/edit`}
                  className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                >
                  <svg className="-ml-1 mr-2 h-5 w-5 text-gray-500" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                    <path d="M13.586 3.586a2 2 0 112.828 2.828l-10 10a2 2 0 01-1.414.586H4a1 1 0 01-1-1v-1a2 2 0 01.586-1.414l10-10z" />
                  </svg>
                  Edit Notice
                </Link>
              </span>
            )}
            
            <span className="sm:ml-3">
              <button
                type="button"
                onClick={handleStartChat}
                disabled={chatLoading}
                className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              >
                {chatLoading ? (
                  <>
                    <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Starting chat...
                  </>
                ) : (
                  <>
                    <svg className="-ml-1 mr-2 h-5 w-5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M18 10c0 3.866-3.582 7-8 7a8.841 8.841 0 01-4.083-.98L2 17l1.338-3.123C2.493 12.767 2 11.434 2 10c0-3.866 3.582-7 8-7s8 3.134 8 7zM7 9H5v2h2V9zm8 0h-2v2h2V9zM9 9h2v2H9V9z" clipRule="evenodd" />
                    </svg>
                    Chat with {notice.created_by.username}
                  </>
                )}
              </button>
            </span>
          </div>
        </div>

        <div className="bg-white shadow overflow-hidden sm:rounded-lg mb-6">
          <div className="px-4 py-5 sm:p-6">
            <div className="prose max-w-none">
              {notice.description.split('\n').map((paragraph, index) => (
                <p key={index}>{paragraph}</p>
              ))}
            </div>

            {/* Display uploaded image if available */}
            {notice.image && (
              <div className="mt-6">
                <h3 className="text-lg font-medium text-gray-900 mb-3">Attached Image</h3>
                <div className="mt-2 flex justify-center">
                  <img 
                    src={notice.image} 
                    alt="Notice attachment" 
                    className="max-w-full h-auto rounded-lg shadow-md max-h-96 object-contain"
                  />
                </div>
              </div>
            )}

            {/* Display PDF link if available */}
            {notice.pdf_file && (
              <div className="mt-6">
                <h3 className="text-lg font-medium text-gray-900 mb-3">Attached Document</h3>
                <div className="mt-2">
                  <a 
                    href={notice.pdf_file} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="inline-flex items-center px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                  >
                    <svg className="-ml-1 mr-2 h-5 w-5 text-gray-500" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4zm2 6a1 1 0 011-1h6a1 1 0 110 2H7a1 1 0 01-1-1zm1 3a1 1 0 100 2h6a1 1 0 100-2H7z" clipRule="evenodd" />
                    </svg>
                    View PDF Document
                  </a>
                </div>
              </div>
            )}

            {notice.notice_type === 'for_sale' && notice.price !== null && (
              <div className="mt-6">
                <h3 className="text-lg font-medium text-gray-900">Price</h3>
                <p className="mt-2 text-3xl font-bold text-gray-900">£{typeof notice.price === 'number' ? notice.price.toFixed(2) : notice.price}</p>
              </div>
            )}

            {notice.notice_type === 'social_bowl' && (
              <div className="mt-6">
                <h3 className="text-lg font-medium text-gray-900">Participants ({notice.participant_count})</h3>
                <div className="mt-2">
                  {notice.participants.length > 0 ? (
                    <ul className="divide-y divide-gray-200">
                      {notice.participants.map((participant) => (
                        <li key={participant.id} className="py-4 flex">
                          <div className="ml-3">
                            <p className="text-sm font-medium text-gray-900">{participant.user.username}</p>
                            <p className="text-sm text-gray-500">Joined on {new Date(participant.joined_at).toLocaleDateString()}</p>
                          </div>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-sm text-gray-500">No participants yet. Be the first to join!</p>
                  )}
                </div>

                <div className="mt-6">
                  {notice.is_participant ? (
                    <button
                      type="button"
                      onClick={() => handleJoinLeave('leave')}
                      disabled={actionLoading}
                      className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
                    >
                      {actionLoading ? 'Processing...' : 'Leave Social Bowl'}
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => handleJoinLeave('join')}
                      disabled={actionLoading}
                      className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                    >
                      {actionLoading ? 'Processing...' : 'Join Social Bowl'}
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
} 