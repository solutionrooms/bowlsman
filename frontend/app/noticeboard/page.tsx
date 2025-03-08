'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import api from '../../src/lib/axios';
import { useRouter } from 'next/navigation';
import Navigation from '../components/Navigation';
import PageHeading from '../components/PageHeading';
import pageDescriptions from '../utils/pageDescriptions';

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
  created_by: {
    id: number;
    username: string;
  };
  created_at: string;
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

export default function NoticeboardPage() {
  const [notices, setNotices] = useState<Notice[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [currentClub, setCurrentClub] = useState<Club | null>(null);
  const [activeTab, setActiveTab] = useState<'all' | 'social_bowl' | 'general' | 'for_sale'>('all');
  const router = useRouter();

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
            } else if (isMounted) {
              setError('Please select a club first');
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
    if (!currentClub) return;

    const fetchNotices = async () => {
      setLoading(true);
      try {
        const params: Record<string, string> = { club: currentClub.id.toString() };
        
        // Add notice_type filter if not showing all
        if (activeTab !== 'all') {
          params.notice_type = activeTab;
        }
        
        const response = await api.get<Notice[]>('/notices/', { params });
        setNotices(response.data);
        setError(null);
      } catch (err) {
        console.error('Error fetching notices:', err);
        setError('Failed to load notices. Please try again.');
      } finally {
        setLoading(false);
      }
    };

    fetchNotices();
  }, [currentClub, activeTab]);

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

  const handleJoinLeave = async (noticeId: number, action: 'join' | 'leave') => {
    try {
      const response = await api.post<Notice>(`/notices/${noticeId}/${action}/`);
      
      // Update the notice in the list
      setNotices(prev => 
        prev.map(notice => 
          notice.id === noticeId ? response.data : notice
        )
      );
    } catch (err) {
      console.error(`Error ${action === 'join' ? 'joining' : 'leaving'} notice:`, err);
      setError(`Failed to ${action} the social bowling session. Please try again.`);
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

  const renderNoticeCard = (notice: Notice) => {
    return (
      <div key={notice.id} className="bg-white overflow-hidden shadow rounded-lg">
        <div className="p-5">
          <div className="flex justify-between">
            <h3 className="text-lg leading-6 font-medium text-gray-900">{notice.title}</h3>
            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
              notice.notice_type === 'social_bowl' ? 'bg-blue-100 text-blue-800' : 
              notice.notice_type === 'for_sale' ? 'bg-green-100 text-green-800' : 
              'bg-gray-100 text-gray-800'
            }`}>
              {getNoticeTypeLabel(notice.notice_type)}
            </span>
          </div>
          <p className="mt-2 text-sm text-gray-500 line-clamp-2">{notice.description}</p>
          
          {notice.notice_type === 'social_bowl' && (
            <div className="mt-3">
              <div className="flex items-center text-sm text-gray-500">
                <svg className="flex-shrink-0 mr-1.5 h-5 w-5 text-gray-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M6 2a1 1 0 00-1 1v1H4a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-1V3a1 1 0 10-2 0v1H7V3a1 1 0 00-1-1zm0 5a1 1 0 000 2h8a1 1 0 100-2H6z" clipRule="evenodd" />
                </svg>
                {formatDateTime(notice.date, notice.time)}
              </div>
              <div className="mt-1 flex items-center text-sm text-gray-500">
                <svg className="flex-shrink-0 mr-1.5 h-5 w-5 text-gray-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd" />
                </svg>
                {notice.location}
              </div>
              <div className="mt-1 flex items-center text-sm text-gray-500">
                <svg className="flex-shrink-0 mr-1.5 h-5 w-5 text-gray-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                  <path d="M13 6a3 3 0 11-6 0 3 3 0 016 0zM18 8a2 2 0 11-4 0 2 2 0 014 0zM14 15a4 4 0 00-8 0v3h8v-3zM6 8a2 2 0 11-4 0 2 2 0 014 0zM16 18v-3a5.972 5.972 0 00-.75-2.906A3.005 3.005 0 0119 15v3h-3zM4.75 12.094A5.973 5.973 0 004 15v3H1v-3a3 3 0 013.75-2.906z" />
                </svg>
                {notice.participant_count} participants
              </div>
            </div>
          )}
          
          {notice.notice_type === 'for_sale' && notice.price !== undefined && (
            <div className="mt-3 flex items-center text-sm font-medium text-green-600">
              <svg className="flex-shrink-0 mr-1.5 h-5 w-5 text-green-500" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.736 6.979C9.208 6.193 9.696 6 10 6c.304 0 .792.193 1.264.979a1 1 0 001.715-1.029C12.279 4.784 11.232 4 10 4s-2.279.784-2.979 1.95c-.285.475-.507 1-.67 1.55H6a1 1 0 000 2h.013a9.358 9.358 0 000 1H6a1 1 0 100 2h.351c.163.55.385 1.075.67 1.55C7.721 15.216 8.768 16 10 16s2.279-.784 2.979-1.95a1 1 0 10-1.715-1.029c-.472.786-.96.979-1.264.979-.304 0-.792-.193-1.264-.979a4.265 4.265 0 01-.264-.521H10a1 1 0 100-2H8.017a7.36 7.36 0 010-1H10a1 1 0 100-2H8.472c.08-.185.167-.36.264-.521z" clipRule="evenodd" />
              </svg>
              ${typeof notice.price === 'number' ? notice.price.toFixed(2) : parseFloat(String(notice.price || 0)).toFixed(2)}
            </div>
          )}
          
          <div className="mt-4 flex justify-between items-center">
            <span className="text-xs text-gray-500">
              Posted by {notice.created_by.username} on {new Date(notice.created_at).toLocaleDateString()}
            </span>
            <Link 
              href={`/noticeboard/${notice.id}`}
              className="inline-flex items-center px-3 py-1 border border-transparent text-sm font-medium rounded text-blue-700 bg-blue-100 hover:bg-blue-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              View Details
            </Link>
          </div>
          
          {notice.notice_type === 'social_bowl' && (
            <div className="mt-3 flex justify-end">
              {notice.is_participant ? (
                <button
                  onClick={() => handleJoinLeave(notice.id, 'leave')}
                  className="inline-flex items-center px-3 py-1 border border-transparent text-sm font-medium rounded text-red-700 bg-red-100 hover:bg-red-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
                >
                  Leave
                </button>
              ) : (
                <button
                  onClick={() => handleJoinLeave(notice.id, 'join')}
                  className="inline-flex items-center px-3 py-1 border border-transparent text-sm font-medium rounded text-green-700 bg-green-100 hover:bg-green-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
                >
                  Join
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    );
  };

  if (error && error === 'Please select a club first') {
    return (
      <div className="min-h-screen bg-gray-100">
        <Navigation onLogout={handleLogout} />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 mb-4">
            <div className="flex">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5 text-yellow-400" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="ml-3">
                <p className="text-sm text-yellow-700">
                  Please select a club from the dropdown in the navigation bar first.
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
        <div className="flex justify-between items-center mb-6">
          <PageHeading 
            title="Noticeboard" 
            infoText={pageDescriptions.noticeboard}
          />
          <Link 
            href="/noticeboard/create" 
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
          >
            Create Notice
          </Link>
        </div>

        {/* Tabs */}
        <div className="mb-6">
          <div className="sm:hidden">
            <label htmlFor="tabs" className="sr-only">Select a tab</label>
            <select
              id="tabs"
              name="tabs"
              className="block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm rounded-md"
              value={activeTab}
              onChange={(e) => setActiveTab(e.target.value as any)}
            >
              <option value="all">All Notices</option>
              <option value="social_bowl">Social Bowling</option>
              <option value="general">General Notices</option>
              <option value="for_sale">For Sale</option>
            </select>
          </div>
          <div className="hidden sm:block">
            <div className="border-b border-gray-200">
              <nav className="-mb-px flex space-x-8" aria-label="Tabs">
                <button
                  onClick={() => setActiveTab('all')}
                  className={`${
                    activeTab === 'all'
                      ? 'border-blue-500 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm`}
                >
                  All Notices
                </button>
                <button
                  onClick={() => setActiveTab('social_bowl')}
                  className={`${
                    activeTab === 'social_bowl'
                      ? 'border-blue-500 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm`}
                >
                  Social Bowling
                </button>
                <button
                  onClick={() => setActiveTab('general')}
                  className={`${
                    activeTab === 'general'
                      ? 'border-blue-500 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm`}
                >
                  General Notices
                </button>
                <button
                  onClick={() => setActiveTab('for_sale')}
                  className={`${
                    activeTab === 'for_sale'
                      ? 'border-blue-500 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm`}
                >
                  For Sale
                </button>
              </nav>
            </div>
          </div>
        </div>

        {error && error !== 'Please select a club first' && (
          <div className="bg-red-50 border-l-4 border-red-400 p-4 mb-4">
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

        {loading ? (
          <div className="flex justify-center items-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
          </div>
        ) : notices.length === 0 ? (
          <div className="text-center py-12">
            <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
            <h3 className="mt-2 text-lg font-medium text-gray-900">No notices found</h3>
            <p className="mt-1 text-sm text-gray-500">
              Create a new notice to get started.
            </p>
            <div className="mt-6">
              <Link 
                href="/noticeboard/create"
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              >
                Create Notice
              </Link>
            </div>
          </div>
        ) :
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {notices.map(renderNoticeCard)}
          </div>
        }
      </div>
    </div>
  );
} 