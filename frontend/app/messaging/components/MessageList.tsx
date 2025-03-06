'use client';

import { useState } from 'react';
import { format } from 'date-fns';

interface Message {
  id: number;
  subject: string;
  content: string;
  is_read: boolean;
  created_at: string;
  sender_name: string;
  sender_full_name: string;
  recipient_name: string;
  recipient_full_name: string | null;
  is_club_wide: boolean;
}

interface MessageListProps {
  messages: Message[];
  activeTab: string;
  onMarkAsRead: (id: number) => void;
}

export default function MessageList({ messages, activeTab, onMarkAsRead }: MessageListProps) {
  const [selectedMessage, setSelectedMessage] = useState<Message | null>(null);

  const handleSelectMessage = (message: Message) => {
    setSelectedMessage(message);
    
    // Mark as read if unread and in inbox
    if (activeTab === 'inbox' && !message.is_read) {
      onMarkAsRead(message.id);
    }
  };

  const closeMessage = () => {
    setSelectedMessage(null);
  };

  if (messages.length === 0) {
    return (
      <div className="text-center py-10">
        <p className="text-gray-500">No messages found</p>
        <p className="text-gray-400 mt-2 text-sm">
          {activeTab === 'inbox' ? 'Your inbox is empty.' : 'You haven\'t sent any messages yet.'}
        </p>
      </div>
    );
  }

  return (
    <div>
      {selectedMessage ? (
        <div className="bg-white shadow rounded-lg p-6">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-xl font-semibold">{selectedMessage.subject}</h3>
            <button 
              onClick={closeMessage}
              className="text-gray-500 hover:text-gray-700"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          
          <div className="mb-4 text-sm text-gray-600">
            <p>
              <span className="font-semibold">From:</span> {selectedMessage.sender_full_name}
            </p>
            <p>
              <span className="font-semibold">To:</span> {
                selectedMessage.is_club_wide 
                  ? 'All club members' 
                  : (selectedMessage.recipient_full_name || selectedMessage.recipient_name)
              }
            </p>
            <p>
              <span className="font-semibold">Date:</span> {
                format(new Date(selectedMessage.created_at), 'PPP p')
              }
            </p>
          </div>
          
          <div className="border-t pt-4 whitespace-pre-wrap">
            {selectedMessage.content}
          </div>
        </div>
      ) : (
        <div className="overflow-hidden shadow border-b border-gray-200 sm:rounded-lg">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  {activeTab === 'inbox' ? 'From' : 'To'}
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Subject
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Date
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {messages.map((message) => (
                <tr 
                  key={message.id}
                  onClick={() => handleSelectMessage(message)}
                  className={`hover:bg-gray-50 cursor-pointer ${
                    activeTab === 'inbox' && !message.is_read ? 'font-semibold bg-blue-50' : ''
                  }`}
                >
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900">
                      {activeTab === 'inbox' 
                        ? message.sender_full_name
                        : (message.is_club_wide ? 'All club members' : (message.recipient_full_name || message.recipient_name))
                      }
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900 flex items-center">
                      {!message.is_read && activeTab === 'inbox' && (
                        <span className="inline-block h-2 w-2 mr-2 bg-blue-600 rounded-full"></span>
                      )}
                      {message.subject}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {format(new Date(message.created_at), 'PP')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}