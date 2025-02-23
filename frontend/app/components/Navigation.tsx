'use client';

import { useRouter, usePathname } from 'next/navigation';

interface NavigationProps {
  isStaff?: boolean;
}

export default function Navigation({ isStaff = false }: NavigationProps) {
  const router = useRouter();
  const pathname = usePathname();

  const handleLogout = () => {
    localStorage.removeItem('token');
    router.push('/');
  };

  return (
    <nav className="bg-white shadow-lg">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          <div className="flex items-center">
            <button
              onClick={() => router.push('/profile')}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700"
            >
              Profile
            </button>
          </div>
          <div className="flex items-center">
            {isStaff && (
              <button
                onClick={() => router.push('/admin')}
                className="mr-4 px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-md hover:bg-indigo-700"
              >
                Admin Panel
              </button>
            )}
            <button
              onClick={() => router.push('/competition/manage')}
              className="mr-4 px-4 py-2 text-sm font-medium text-white bg-purple-600 rounded-md hover:bg-purple-700"
            >
              Manage Competitions
            </button>
            {pathname === '/competition/manage' && (
              <button
                onClick={() => router.push('/competition/create')}
                className="mr-4 px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-md hover:bg-green-700"
              >
                Create Competition
              </button>
            )}
            <button
              onClick={handleLogout}
              className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-md hover:bg-red-700"
            >
              Logout
            </button>
          </div>
        </div>
      </div>
    </nav>
  );
} 