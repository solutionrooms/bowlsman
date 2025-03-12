'use client';

import { useState, useEffect } from 'react';
import api from '../../../src/lib/axios';

interface User {
  id: number;
  username: string;
  email: string;
  first_name?: string;
  last_name?: string;
}

interface Club {
  id: number;
  name: string;
  is_admin: boolean;
}

interface ComposeMessageProps {
  onSend: () => void;
  onCancel: () => void;
  clubId: number;
}

export default function ComposeMessage({ onSend, onCancel, clubId }: ComposeMessageProps) {
  const [subject, setSubject] = useState('');
  const [content, setContent] = useState('');
  const [recipient, setRecipient] = useState<number | string>('');
  const [isClubWide, setIsClubWide] = useState(false);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    let isMounted = true;
    
    const loadData = async () => {
      // Run the functions in parallel to improve performance
      await Promise.all([
        fetchClubMembers(isMounted),
        checkAdminStatus(isMounted)
      ]);
    };
    
    loadData();
    
    // Cleanup function to prevent state updates after unmount
    return () => {
      isMounted = false;
    };
  }, [clubId]);

  const fetchClubMembers = async (isMounted = true) => {
    try {
      const response = await api.get(`/club-members/${clubId}/`);
      if (isMounted) {
        setUsers(response.data);
      }
    } catch (err) {
      if (isMounted) {
        console.error('Error fetching club members:', err);
        setError('Failed to load club members');
      }
    }
  };

  const checkAdminStatus = async (isMounted = true) => {
    try {
      const response = await api.get('/users/me/');
      if (!isMounted) return;
      
      const userClubs = response.data.clubs || [];
      const currentClub = userClubs.find((club: Club) => club.id === clubId);
      
      if (currentClub && isMounted) {
        setIsAdmin(currentClub.is_admin || response.data.is_staff);
      }
    } catch (err) {
      if (isMounted) {
        console.error('Error checking admin status:', err);
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!subject.trim() || !content.trim()) {
      setError('Subject and message content are required');
      return;
    }
    
    if (!isClubWide && !recipient) {
      setError('Please select a recipient');
      return;
    }
    
    setLoading(true);
    setError('');
    
    try {
      await api.post(`/messages/?club_id=${clubId}`, {
        subject,
        content,
        recipient: isClubWide ? null : recipient,
        club_id: clubId,
        is_club_wide: isClubWide
      });
      
      onSend();
    } catch (err) {
      console.error('Error sending message:', err);
      const errorData = (err as any).response?.data;
      if (errorData) {
        console.error('Error details:', errorData);
        if (typeof errorData === 'object') {
          const errorMessage = Object.values(errorData).flat().join(', ');
          setError(`Failed to send message: ${errorMessage}`);
        } else {
          setError(`Failed to send message: ${errorData}`);
        }
      } else {
        setError('Failed to send message. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white shadow-md rounded-lg p-6">
      <h2 className="text-xl font-semibold mb-4">Compose Message</h2>
      
      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
          {error}
        </div>
      )}
      
      <form onSubmit={handleSubmit}>
        <div className="mb-4">
          <label className="block text-gray-700 text-sm font-bold mb-2">
            Recipient
          </label>
          
          {isAdmin && (
            <div className="mb-2">
              <label className="inline-flex items-center">
                <input
                  type="checkbox"
                  className="form-checkbox"
                  checked={isClubWide}
                  onChange={() => setIsClubWide(!isClubWide)}
                />
                <span className="ml-2">Send to all club members</span>
              </label>
            </div>
          )}
          
          {!isClubWide && (
            <select
              className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
              value={recipient}
              onChange={(e) => setRecipient(Number(e.target.value))}
              disabled={isClubWide}
            >
              <option value="">Select a recipient</option>
              {users.map(user => (
                <option key={user.id} value={user.id}>
                  {user.first_name && user.last_name 
                    ? `${user.first_name} ${user.last_name} (${user.username})`
                    : user.username}
                </option>
              ))}
            </select>
          )}
        </div>
        
        <div className="mb-4">
          <label className="block text-gray-700 text-sm font-bold mb-2">
            Subject
          </label>
          <input
            type="text"
            className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            required
          />
        </div>
        
        <div className="mb-6">
          <label className="block text-gray-700 text-sm font-bold mb-2">
            Message
          </label>
          <textarea
            className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline h-32"
            value={content}
            onChange={(e) => setContent(e.target.value)}
            required
          />
        </div>
        
        <div className="flex justify-end">
          <button
            type="button"
            onClick={onCancel}
            className="bg-gray-300 hover:bg-gray-400 text-gray-800 font-medium py-2 px-4 rounded mr-2"
          >
            Cancel
          </button>
          <button
            type="submit"
            className="bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded"
            disabled={loading}
          >
            {loading ? 'Sending...' : 'Send Message'}
          </button>
        </div>
      </form>
    </div>
  );
}