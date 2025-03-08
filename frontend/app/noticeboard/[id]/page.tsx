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
      } catch (err) {
        console.error('Error fetching notice:', err);
        setError('Failed to load notice. It may have been removed or you do not have permission to view it.');
      } finally {
        setLoading(false);
      }
    };

    fetchNotice();
  }, [id]);

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
              {notice.notice_type === 'social_bowl' && (
                <div className="mt-2 flex items-center text-sm text-gray-500">
                  <svg className="flex-shrink-0 mr-1.5 h-5 w-5 text-gray-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                    <path d="M13 6a3 3 0 11-6 0 3 3 0 016 0zM18 8a2 2 0 11-4 0 2 2 0 014 0zM14 15a4 4 0 00-8 0v3h8v-3zM6 8a2 2 0 11-4 0 2 2 0 014 0zM16 18v-3a5.972 5.972 0 00-.75-2.906A3.005 3.005 0 0119 15v3h-3zM4.75 12.094A5.973 5.973 0 004 15v3H1v-3a3 3 0 013.75-2.906z" />
                  </svg>
                  {notice.participant_count} participants
                </div>
              )}
              {notice.notice_type === 'for_sale' && notice.price !== undefined && (
                <div className="mt-2 flex items-center text-sm font-medium text-green-600">
                  <svg className="flex-shrink-0 mr-1.5 h-5 w-5 text-green-500" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.736 6.979C9.208 6.193 9.696 6 10 6c.304 0 .792.193 1.264.979a1 1 0 001.715-1.029C12.279 4.784 11.232 4 10 4s-2.279.784-2.979 1.95c-.285.475-.507 1-.67 1.55H6a1 1 0 000 2h.013a9.358 9.358 0 000 1H6a1 1 0 100 2h.351c.163.55.385 1.075.67 1.55C7.721 15.216 8.768 16 10 16s2.279-.784 2.979-1.95a1 1 0 10-1.715-1.029c-.472.786-.96.979-1.264.979-.304 0-.792-.193-1.264-.979a4.265 4.265 0 01-.264-.521H10a1 1 0 100-2H8.017a7.36 7.36 0 010-1H10a1 1 0 100-2H8.472c.08-.185.167-.36.264-.521z" clipRule="evenodd" />
                  </svg>
                  ${typeof notice.price === 'number' ? notice.price.toFixed(2) : parseFloat(String(notice.price || 0)).toFixed(2)}
                </div>
              )}
            </div>
          </div>
          <div className="mt-4 flex md:mt-0 md:ml-4">
            <Link
              href="/noticeboard"
              className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              Back to All
            </Link>
            {notice.notice_type === 'social_bowl' && (
              notice.is_participant ? (
                <button
                  type="button"
                  onClick={() => handleJoinLeave('leave')}
                  disabled={actionLoading}
                  className="ml-3 inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 disabled:opacity-50"
                >
                  {actionLoading ? 'Processing...' : 'Leave Event'}
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => handleJoinLeave('join')}
                  disabled={actionLoading}
                  className="ml-3 inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
                >
                  {actionLoading ? 'Processing...' : 'Join Event'}
                </button>
              )
            )}
          </div>
        </div>

        <div className="bg-white shadow overflow-hidden sm:rounded-lg mb-6">
          <div className="px-4 py-5 sm:p-6">
            <h3 className="text-lg leading-6 font-medium text-gray-900">Description</h3>
            <div className="mt-2 text-sm text-gray-500 whitespace-pre-wrap">
              {notice.description || 'No description provided.'}
            </div>
          </div>
        </div>

        {notice.notice_type === 'social_bowl' && notice.participants.length > 0 && (
          <div className="bg-white shadow overflow-hidden sm:rounded-lg">
            <div className="px-4 py-5 sm:px-6">
              <h3 className="text-lg leading-6 font-medium text-gray-900">Participants</h3>
              <p className="mt-1 max-w-2xl text-sm text-gray-500">
                People who have joined this social bowling event.
              </p>
            </div>
            <div className="border-t border-gray-200">
              <ul className="divide-y divide-gray-200">
                {notice.participants.map((participant) => (
                  <li key={participant.id} className="px-4 py-3 sm:px-6">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-medium text-gray-900">{participant.user.username}</p>
                      <p className="text-sm text-gray-500">
                        Joined {new Date(participant.joined_at).toLocaleDateString()}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}
      </div>
    </div>
  );
} 