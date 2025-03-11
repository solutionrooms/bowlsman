'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Navigation from '../components/Navigation';
import api from '../../src/lib/axios';
import { getApiUrl } from '../../src/lib/axios';

interface ClubUser {
  id: number;
  name: string;
  is_admin: boolean;
  last_login_at?: string;
}

interface User {
  id: number;
  username: string;
  email: string;
  first_name: string;
  last_name: string;
  phone_number?: string;
  notes?: string;
  is_staff: boolean;
  clubs: ClubUser[];
  profile_picture?: string;
  postcode?: string;
}

interface Club {
  id: number;
  name: string;
  is_admin: boolean;
  last_login_at?: string;
}

export default function Profile() {
  const [user, setUser] = useState<User | null>(null);
  const [currentClub, setCurrentClub] = useState<Club | null>(null);
  const [userClubs, setUserClubs] = useState<ClubUser[]>([]);
  const [allClubs, setAllClubs] = useState<Club[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editedUser, setEditedUser] = useState<User | null>(null);
  const [profilePicture, setProfilePicture] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const router = useRouter();
  
  // Get the backend API URL for media files
  const apiUrl = getApiUrl();
  
  // Generate the full image URL using the backend API URL
  const getFullImageUrl = useCallback((imagePath: string | null) => {
    if (!imagePath) return null;
    // Handle both relative and absolute URLs
    if (imagePath.startsWith('http')) {
      return imagePath;
    }
    // Remove leading slash if present
    const cleanPath = imagePath.startsWith('/') ? imagePath.substring(1) : imagePath;
    
    // Use the API URL but remove the '/api' part for media files
    const baseUrl = apiUrl.replace(/\/api\/?$/, '');
    return `${baseUrl}/${cleanPath}`;
  }, [apiUrl]);

  useEffect(() => {
    const fetchUserData = async () => {
      try {
        const token = localStorage.getItem('token');
        if (!token) {
          router.push('/');
          return;
        }

        const response = await api.get<{user: User, current_club: Club | null}>('/users/me/');
        setUser(response.data.user);
        
        if (response.data.current_club) {
          setCurrentClub(response.data.current_club);
        }
        
        if (response.data.user.clubs) {
          setUserClubs(response.data.user.clubs);
        }

        // If user is staff, fetch all clubs
        if (response.data.user.is_staff) {
          const clubsResponse = await api.get<Club[]>('/clubs/', {
            headers: { Authorization: `Token ${token}` }
          });
          setAllClubs(clubsResponse.data);
        }
        
        setLoading(false);
      } catch (error) {
        console.error('Error fetching user data:', error);
        setError('Failed to load user data. Please try again later.');
        setLoading(false);
      }
    };

    fetchUserData();
  }, [router]);

  const handleLogout = () => {
    if (user) {
      localStorage.removeItem('token');
      router.push('/');
    }
  };

  const handleClubChange = async (clubId: number) => {
    try {
      const token = localStorage.getItem('token');
      // Remove any api/ prefix as the axios interceptor adds it automatically
      const endpoint = 'club-users/set_current_club/';
      
      const response = await api.put<{message: string, club: Club}>(
        endpoint,
        { club_id: clubId },
        { headers: { Authorization: `Token ${token}` } }
      );
      
      // Find the club object from userClubs or allClubs
      const selectedClub = userClubs.find(club => club.id === clubId) || 
                          allClubs.find(club => club.id === clubId);
      
      if (selectedClub) {
        localStorage.setItem('currentClub', JSON.stringify(selectedClub));
        setCurrentClub(selectedClub);
        setError(null); // Clear any previous errors
      }
    } catch (error) {
      console.error('Error changing club:', error);
      setError('Failed to change club. Please try again.');
    }
  };

  const handleManageClubs = () => {
    router.push('/club/manage');
  };

  const handleEdit = () => {
    setIsEditing(true);
    if (user) {
      setEditedUser({
        ...user,
        first_name: user.first_name || '',
        last_name: user.last_name || '',
        email: user.email || '',
        phone_number: user.phone_number || '',
        notes: user.notes || '',
        postcode: user.postcode || ''
      });
    }
  };

  const handleProfilePictureChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Validate file type
      if (!file.type.startsWith('image/')) {
        setError('Please upload an image file');
        return;
      }
      
      // Validate file size (max 5MB)
      if (file.size > 5 * 1024 * 1024) {
        setError('Image size should be less than 5MB');
        return;
      }

      setProfilePicture(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setPreviewUrl(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSave = async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        router.push('/');
        return;
      }

      const formData = new FormData();
      if (editedUser) {
        Object.entries(editedUser).forEach(([key, value]) => {
          if (value !== undefined && value !== null && typeof value !== 'object') {
            formData.append(key, value.toString());
          }
        });
      }

      if (profilePicture) {
        formData.append('profile_picture', profilePicture);
      }

      const response = await api.put<User>(
        '/users/me/',
        formData,
        { 
          headers: { 
            Authorization: `Token ${token}`,
            'Content-Type': 'multipart/form-data'
          }
        }
      );

      setUser(response.data);
      setIsEditing(false);
      setProfilePicture(null);
      setPreviewUrl(null);
      setError(null);
    } catch (error) {
      console.error('Error updating profile:', error);
      setError('Failed to update profile. Please try again.');
    }
  };

  const handleCancel = () => {
    setIsEditing(false);
    setEditedUser(null);
    setError(null);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setEditedUser(prev => prev ? { ...prev, [name]: value } : null);
  };

  const handleManageClub = (clubId: number) => {
    router.push(`/club/${clubId}/manage`);
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  if (error || !user) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative" role="alert">
          <div className="font-bold">Error!</div>
          <div className="block sm:inline"> {error || 'User not found'}</div>
        </div>
      </div>
    );
  }

  return (
    <>
      <Navigation onLogout={handleLogout} />
      <div className="min-h-screen bg-gray-50">
        <div className="max-w-4xl mx-auto px-4 py-8">
          <div className="bg-white shadow-xl rounded-2xl overflow-hidden">
            <div className="px-6 py-8">
              <div className="flex items-center justify-between mb-8">
                <div className="flex items-center space-x-4">
                  <div className="relative">
                    <div className="w-32 h-32 rounded-full overflow-hidden bg-gray-200">
                      {previewUrl || (user?.profile_picture && getFullImageUrl(user.profile_picture) ? (
                        <img
                          src={previewUrl || getFullImageUrl(user.profile_picture) || ''}
                          alt="Profile"
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-gray-400">
                          <svg className="w-16 h-16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                          </svg>
                        </div>
                      ))}
                    </div>
                    {isEditing && (
                      <>
                        <label className="absolute bottom-0 right-0 bg-blue-500 text-white p-2 rounded-full cursor-pointer hover:bg-blue-600 transition-colors">
                          <input
                            type="file"
                            accept="image/*"
                            onChange={handleProfilePictureChange}
                            className="hidden"
                          />
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                          </svg>
                        </label>
                        <div className="mt-2 text-center">
                          <label className="text-sm text-blue-600 cursor-pointer hover:text-blue-800">
                            <input
                              type="file"
                              accept="image/*"
                              onChange={handleProfilePictureChange}
                              className="hidden"
                            />
                            Change Photo
                          </label>
                        </div>
                      </>
                    )}
                  </div>
                  <div>
                    <h2 className="text-2xl font-bold text-gray-900">{user.first_name} {user.last_name}</h2>
                    <p className="text-gray-600">{user.email}</p>
                  </div>
                </div>
                {!isEditing && (
                  <button
                    onClick={handleEdit}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors duration-200 flex items-center"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                    Edit Profile
                  </button>
                )}
              </div>
            </div>

            {/* Main Content */}
            <div className="p-6 space-y-8">
              {/* Account Information */}
              <div className="bg-white rounded-xl border border-gray-100 p-6">
                <h2 className="text-xl font-semibold text-gray-800 mb-6 flex items-center">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 mr-2 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                  Account Information
                </h2>
                <div className="space-y-6">
                  {isEditing ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">First Name</label>
                        <input
                          type="text"
                          name="first_name"
                          value={editedUser?.first_name || ''}
                          onChange={handleInputChange}
                          className="w-full px-4 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors duration-200"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Last Name</label>
                        <input
                          type="text"
                          name="last_name"
                          value={editedUser?.last_name || ''}
                          onChange={handleInputChange}
                          className="w-full px-4 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors duration-200"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                        <input
                          type="email"
                          name="email"
                          value={editedUser?.email || ''}
                          onChange={handleInputChange}
                          className="w-full px-4 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors duration-200"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Phone Number</label>
                        <input
                          type="tel"
                          name="phone_number"
                          value={editedUser?.phone_number || ''}
                          onChange={handleInputChange}
                          className="w-full px-4 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors duration-200"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Postcode</label>
                        <input
                          type="text"
                          name="postcode"
                          value={editedUser?.postcode || ''}
                          onChange={handleInputChange}
                          className="w-full px-4 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors duration-200"
                        />
                      </div>
                      <div className="md:col-span-2">
                        <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
                        <textarea
                          name="notes"
                          value={editedUser?.notes || ''}
                          onChange={handleInputChange}
                          rows={3}
                          className="w-full px-4 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors duration-200"
                        />
                      </div>
                      <div className="md:col-span-2 flex justify-end space-x-3">
                        <button
                          onClick={handleCancel}
                          className="px-6 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors duration-200"
                        >
                          Cancel
                        </button>
                        <button
                          onClick={handleSave}
                          className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors duration-200"
                        >
                          Save Changes
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div>
                        <label className="block text-sm font-medium text-gray-500 mb-1">Username</label>
                        <div className="px-4 py-2 bg-gray-50 rounded-lg text-gray-900">{user?.username}</div>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-500 mb-1">Full Name</label>
                        <div className="px-4 py-2 bg-gray-50 rounded-lg text-gray-900">
                          {user?.first_name} {user?.last_name}
                        </div>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-500 mb-1">Email</label>
                        <div className="px-4 py-2 bg-gray-50 rounded-lg text-gray-900">{user?.email}</div>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-500 mb-1">Phone Number</label>
                        <div className="px-4 py-2 bg-gray-50 rounded-lg text-gray-900">
                          {user?.phone_number || 'Not set'}
                        </div>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-500 mb-1">Postcode</label>
                        <div className="px-4 py-2 bg-gray-50 rounded-lg text-gray-900">
                          {user?.postcode || 'Not set'}
                        </div>
                      </div>
                      <div className="md:col-span-2">
                        <label className="block text-sm font-medium text-gray-500 mb-1">Notes</label>
                        <div className="px-4 py-2 bg-gray-50 rounded-lg text-gray-900 whitespace-pre-wrap">
                          {user?.notes || 'No notes'}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Club Membership */}
              <div className="bg-white rounded-xl border border-gray-100 p-6">
                <h2 className="text-xl font-semibold text-gray-800 mb-6 flex items-center">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 mr-2 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                  </svg>
                  Club Membership
                </h2>
                {user?.clubs && user.clubs.length > 0 ? (
                  <div className="space-y-4">
                    {userClubs.map((uc: ClubUser) => (
                      <div key={uc.id} className="flex items-center justify-between bg-gray-50 p-4 rounded-lg hover:bg-gray-100 transition-colors duration-200">
                        <div>
                          <div className="font-medium text-gray-900">{uc.name}</div>
                          <div className="text-sm text-gray-500">
                            {uc.is_admin ? 'Admin' : 'Member'}
                          </div>
                        </div>
                        <div className="space-x-2">
                          {currentClub?.id !== uc.id && (
                            <button
                              onClick={() => handleClubChange(uc.id)}
                              className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition-colors duration-200"
                            >
                              Set as Current
                            </button>
                          )}
                          {currentClub?.id === uc.id && (
                            <span className="px-4 py-2 bg-green-100 text-green-800 text-sm rounded-lg">
                              Current Club
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-md">
                    <h3 className="text-lg font-semibold text-yellow-800 mb-2">No Club Membership</h3>
                    <p className="text-gray-700 mb-3">
                      You are not currently a member of any bowling club. To access all features of BowlsHub, you need to join a club.
                    </p>
                    <p className="text-gray-700 mb-3">
                      Visit the dashboard to browse available clubs and submit membership applications.
                    </p>
                    <div className="mt-4">
                      <button
                        onClick={() => router.push('/dashboard')}
                        className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition"
                      >
                        Go to Dashboard
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* All Clubs (for staff users) */}
              {user?.is_staff && allClubs.length > 0 && (
                <div className="bg-white rounded-xl border border-gray-100 p-6">
                  <h2 className="text-xl font-semibold text-gray-800 mb-6 flex items-center">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 mr-2 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                    </svg>
                    All Clubs (Staff Access)
                  </h2>
                  <div className="space-y-4">
                    {allClubs
                      .filter((club: Club) => !userClubs.some(uc => uc.id === club.id))
                      .map((club: Club) => (
                        <div key={club.id} className="flex items-center justify-between bg-gray-50 p-4 rounded-lg hover:bg-gray-100 transition-colors duration-200">
                          <div>
                            <div className="font-medium text-gray-900">{club.name}</div>
                            <div className="text-sm text-gray-500">Not a member</div>
                          </div>
                          <div className="space-x-2">
                            <button
                              onClick={() => handleClubChange(club.id)}
                              className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition-colors duration-200"
                            >
                              Switch to Club
                            </button>
                          </div>
                        </div>
                      ))}
                  </div>
                </div>
              )}

              {/* Manage Clubs Button - Only show for users with clubs or staff */}
              {(user?.clubs?.length > 0 || user?.is_staff) && (
                <div className="flex justify-end">
                  <button
                    onClick={handleManageClubs}
                    className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors duration-200 flex items-center"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                    Manage Clubs
                  </button>
                </div>
              )}

              {/* Club Management Section */}
              {user?.is_staff && (
                <div className="bg-white rounded-lg shadow-md p-6 mb-6">
                  <h2 className="text-xl font-semibold mb-4">Club Management</h2>
                  <div className="space-y-4">
                    {userClubs.map((uc: ClubUser) => (
                      <div key={uc.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                        <div>
                          <h3 className="font-medium">{uc.name}</h3>
                          <p className="text-sm text-gray-500">
                            {uc.is_admin ? 'Admin' : 'Member'} • Last login: {uc.last_login_at ? new Date(uc.last_login_at).toLocaleDateString() : 'Never'}
                          </p>
                        </div>
                        <button
                          onClick={() => handleManageClub(uc.id)}
                          className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors duration-200"
                        >
                          Manage
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}