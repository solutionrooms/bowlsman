'use client';

import { ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import PageHeading from '../../components/PageHeading';

interface HelpContentLayoutProps {
  children: ReactNode;
}

export default function HelpContentLayout({ children }: HelpContentLayoutProps) {
  const pathname = usePathname();
  const activeSection = pathname?.split('/').pop() || 'getting-started';

  return (
    <div className="container mx-auto px-4 py-8">
      <PageHeading title="Help Center" />
      
      <div className="flex flex-col md:flex-row gap-8 mt-6">
        {/* Sidebar Navigation */}
        <div className="w-full md:w-1/4 bg-white rounded-lg shadow-md p-4">
          <h2 className="text-xl font-semibold mb-4">Documentation</h2>
          <nav className="space-y-1">
            <Link 
              href="/help/content/getting-started"
              className={`block px-3 py-2 rounded-md text-sm font-medium ${
                activeSection === 'getting-started' ? 'bg-blue-100 text-blue-700' : 'text-gray-700 hover:bg-gray-100'
              }`}
            >
              Getting Started
            </Link>
            <Link 
              href="/help/content/dashboard"
              className={`block px-3 py-2 rounded-md text-sm font-medium ${
                activeSection === 'dashboard' ? 'bg-blue-100 text-blue-700' : 'text-gray-700 hover:bg-gray-100'
              }`}
            >
              Dashboard
            </Link>
            <Link 
              href="/help/content/competitions"
              className={`block px-3 py-2 rounded-md text-sm font-medium ${
                activeSection === 'competitions' ? 'bg-blue-100 text-blue-700' : 'text-gray-700 hover:bg-gray-100'
              }`}
            >
              Competitions
            </Link>
            <Link 
              href="/help/content/scoring"
              className={`block px-3 py-2 rounded-md text-sm font-medium ${
                activeSection === 'scoring' ? 'bg-blue-100 text-blue-700' : 'text-gray-700 hover:bg-gray-100'
              }`}
            >
              Scoring
            </Link>
            <Link 
              href="/help/content/leagues"
              className={`block px-3 py-2 rounded-md text-sm font-medium ${
                activeSection === 'leagues' ? 'bg-blue-100 text-blue-700' : 'text-gray-700 hover:bg-gray-100'
              }`}
            >
              Leagues
            </Link>
            <Link 
              href="/help/content/bowlers"
              className={`block px-3 py-2 rounded-md text-sm font-medium ${
                activeSection === 'bowlers' ? 'bg-blue-100 text-blue-700' : 'text-gray-700 hover:bg-gray-100'
              }`}
            >
              Bowlers
            </Link>
            <Link 
              href="/help/content/messaging"
              className={`block px-3 py-2 rounded-md text-sm font-medium ${
                activeSection === 'messaging' ? 'bg-blue-100 text-blue-700' : 'text-gray-700 hover:bg-gray-100'
              }`}
            >
              Messaging
            </Link>
            <Link 
              href="/help/content/noticeboard"
              className={`block px-3 py-2 rounded-md text-sm font-medium ${
                activeSection === 'noticeboard' ? 'bg-blue-100 text-blue-700' : 'text-gray-700 hover:bg-gray-100'
              }`}
            >
              Noticeboard
            </Link>
            <Link 
              href="/help/content/club-management"
              className={`block px-3 py-2 rounded-md text-sm font-medium ${
                activeSection === 'club-management' ? 'bg-blue-100 text-blue-700' : 'text-gray-700 hover:bg-gray-100'
              }`}
            >
              Club Management
            </Link>
            <Link 
              href="/help/content/profile"
              className={`block px-3 py-2 rounded-md text-sm font-medium ${
                activeSection === 'profile' ? 'bg-blue-100 text-blue-700' : 'text-gray-700 hover:bg-gray-100'
              }`}
            >
              User Profile
            </Link>
            <Link 
              href="/help/content/faq"
              className={`block px-3 py-2 rounded-md text-sm font-medium ${
                activeSection === 'faq' ? 'bg-blue-100 text-blue-700' : 'text-gray-700 hover:bg-gray-100'
              }`}
            >
              FAQ
            </Link>
          </nav>
        </div>
        
        {/* Content Area */}
        <div className="w-full md:w-3/4 bg-white rounded-lg shadow-md p-6">
          <div className="prose max-w-none">
            {children}
          </div>
        </div>
      </div>
    </div>
  );
} 