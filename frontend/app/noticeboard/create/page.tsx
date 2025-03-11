'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import api from '../../../src/lib/axios';
import Navigation from '../../components/Navigation';
import PageHeading from '../../components/PageHeading';
import pageDescriptions from '../../utils/pageDescriptions';

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

export default function CreateNoticePage() {
  const router = useRouter();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [noticeType, setNoticeType] = useState<'social_bowl' | 'general' | 'for_sale'>('general');
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [location, setLocation] = useState('');
  const [price, setPrice] = useState('');
  const [image, setImage] = useState<File | null>(null);
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentClub, setCurrentClub] = useState<Club | null>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const pdfInputRef = useRef<HTMLInputElement>(null);

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

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setImage(e.target.files[0]);
    }
  };

  const handlePdfChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setPdfFile(e.target.files[0]);
    }
  };

  const clearImage = () => {
    setImage(null);
    if (imageInputRef.current) {
      imageInputRef.current.value = '';
    }
  };

  const clearPdf = () => {
    setPdfFile(null);
    if (pdfInputRef.current) {
      pdfInputRef.current.value = '';
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      if (!currentClub) {
        setError('Please select a club first');
        setLoading(false);
        return;
      }

      // Validate required fields
      if (!title.trim()) {
        setError('Title is required');
        setLoading(false);
        return;
      }

      // Validate fields based on notice type
      if (noticeType === 'social_bowl') {
        if (!date) {
          setError('Date is required for social bowling');
          setLoading(false);
          return;
        }
        if (!time) {
          setError('Time is required for social bowling');
          setLoading(false);
          return;
        }
        if (!location.trim()) {
          setError('Location is required for social bowling');
          setLoading(false);
          return;
        }
      }

      if (noticeType === 'for_sale' && !price.trim()) {
        setError('Price is required for for-sale notices');
        setLoading(false);
        return;
      }

      // Create FormData for file uploads
      const formData = new FormData();
      formData.append('title', title);
      formData.append('description', description);
      formData.append('notice_type', noticeType);
      formData.append('club', currentClub.id.toString());

      // Add fields based on notice type
      if (noticeType === 'social_bowl') {
        formData.append('date', date);
        formData.append('time', time);
        formData.append('location', location);
      } else if (noticeType === 'for_sale') {
        // Ensure price is a valid number
        const numericPrice = parseFloat(price);
        if (!isNaN(numericPrice)) {
          formData.append('price', numericPrice.toString());
        } else {
          formData.append('price', '0');
        }
        if (location.trim()) {
          formData.append('location', location);
        }
      } else if (location.trim()) {
        formData.append('location', location);
      }

      // Add files if selected
      if (image) {
        formData.append('image', image);
      }
      
      if (pdfFile) {
        formData.append('pdf_file', pdfFile);
      }

      type NoticeResponse = {
        id: number;
        title: string;
        notice_type: string;
      };

      const response = await api.post<NoticeResponse>('/notices/', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });
      
      // Redirect to the notice detail page
      router.push(`/noticeboard/${response.data.id}`);
    } catch (err) {
      console.error('Error creating notice:', err);
      setError('Failed to create notice. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (!currentClub) {
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
        <div className="md:flex md:items-center md:justify-between mb-6">
          <div className="flex-1 min-w-0">
            <PageHeading 
              title="Create Notice" 
              infoText={pageDescriptions.createNotice}
            />
          </div>
          <div className="mt-4 flex md:mt-0 md:ml-4">
            <Link
              href="/noticeboard"
              className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              Back to Noticeboard
            </Link>
          </div>
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
            <form onSubmit={handleSubmit}>
              <div className="space-y-6">
                <div>
                  <label htmlFor="notice-type" className="block text-sm font-medium text-gray-700">
                    Notice Type
                  </label>
                  <select
                    id="notice-type"
                    name="notice-type"
                    className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm rounded-md"
                    value={noticeType}
                    onChange={(e) => setNoticeType(e.target.value as any)}
                  >
                    <option value="general">General Notice</option>
                    <option value="social_bowl">Social Bowling</option>
                    <option value="for_sale">For Sale</option>
                  </select>
                </div>

                <div>
                  <label htmlFor="title" className="block text-sm font-medium text-gray-700">
                    Title
                  </label>
                  <input
                    type="text"
                    name="title"
                    id="title"
                    className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                  />
                </div>

                <div>
                  <label htmlFor="description" className="block text-sm font-medium text-gray-700">
                    Description
                  </label>
                  <textarea
                    id="description"
                    name="description"
                    rows={4}
                    className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                  />
                </div>

                {noticeType === 'social_bowl' && (
                  <div className="grid grid-cols-1 gap-y-6 gap-x-4 sm:grid-cols-6">
                    <div className="sm:col-span-3">
                      <label htmlFor="date" className="block text-sm font-medium text-gray-700">
                        Date
                      </label>
                      <input
                        type="date"
                        name="date"
                        id="date"
                        className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                        value={date}
                        onChange={(e) => setDate(e.target.value)}
                      />
                    </div>

                    <div className="sm:col-span-3">
                      <label htmlFor="time" className="block text-sm font-medium text-gray-700">
                        Time
                      </label>
                      <input
                        type="time"
                        name="time"
                        id="time"
                        className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                        value={time}
                        onChange={(e) => setTime(e.target.value)}
                      />
                    </div>
                  </div>
                )}

                <div>
                  <label htmlFor="location" className="block text-sm font-medium text-gray-700">
                    Location
                  </label>
                  <input
                    type="text"
                    name="location"
                    id="location"
                    className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                  />
                </div>

                {noticeType === 'for_sale' && (
                  <div>
                    <label htmlFor="price" className="block text-sm font-medium text-gray-700">
                      Price (£)
                    </label>
                    <div className="mt-1 relative rounded-md shadow-sm">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <span className="text-gray-500 sm:text-sm">£</span>
                      </div>
                      <input
                        type="text"
                        name="price"
                        id="price"
                        className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 pl-7 pr-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                        placeholder="0.00"
                        value={price}
                        onChange={(e) => setPrice(e.target.value)}
                      />
                    </div>
                  </div>
                )}

                {/* Image Upload */}
                <div>
                  <label htmlFor="image" className="block text-sm font-medium text-gray-700">
                    Image (Optional)
                  </label>
                  <div className="mt-1 flex items-center">
                    <input
                      ref={imageInputRef}
                      type="file"
                      name="image"
                      id="image"
                      accept="image/*"
                      className="sr-only"
                      onChange={handleImageChange}
                    />
                    <label
                      htmlFor="image"
                      className="relative cursor-pointer bg-white py-2 px-3 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 hover:bg-gray-50 focus-within:outline-none focus-within:ring-2 focus-within:ring-offset-2 focus-within:ring-blue-500"
                    >
                      <span>Upload an image</span>
                    </label>
                    {image && (
                      <div className="ml-4 flex items-center">
                        <span className="text-sm text-gray-500">{image.name}</span>
                        <button
                          type="button"
                          className="ml-2 text-red-600 hover:text-red-900"
                          onClick={clearImage}
                        >
                          <svg className="h-5 w-5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                          </svg>
                        </button>
                      </div>
                    )}
                  </div>
                  <p className="mt-1 text-sm text-gray-500">
                    Upload an image to display with your notice. PNG, JPG, GIF up to 5MB.
                  </p>
                </div>

                {/* PDF Upload */}
                <div>
                  <label htmlFor="pdf-file" className="block text-sm font-medium text-gray-700">
                    PDF Attachment (Optional)
                  </label>
                  <div className="mt-1 flex items-center">
                    <input
                      ref={pdfInputRef}
                      type="file"
                      name="pdf-file"
                      id="pdf-file"
                      accept=".pdf"
                      className="sr-only"
                      onChange={handlePdfChange}
                    />
                    <label
                      htmlFor="pdf-file"
                      className="relative cursor-pointer bg-white py-2 px-3 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 hover:bg-gray-50 focus-within:outline-none focus-within:ring-2 focus-within:ring-offset-2 focus-within:ring-blue-500"
                    >
                      <span>Upload a PDF</span>
                    </label>
                    {pdfFile && (
                      <div className="ml-4 flex items-center">
                        <span className="text-sm text-gray-500">{pdfFile.name}</span>
                        <button
                          type="button"
                          className="ml-2 text-red-600 hover:text-red-900"
                          onClick={clearPdf}
                        >
                          <svg className="h-5 w-5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                          </svg>
                        </button>
                      </div>
                    )}
                  </div>
                  <p className="mt-1 text-sm text-gray-500">
                    Attach a PDF document to provide additional information. Max 10MB.
                  </p>
                </div>

                <div className="flex justify-end">
                  <Link
                    href="/noticeboard"
                    className="bg-white py-2 px-4 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 mr-3"
                  >
                    Cancel
                  </Link>
                  <button
                    type="submit"
                    disabled={loading}
                    className={`inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white ${
                      loading ? 'bg-blue-400' : 'bg-blue-600 hover:bg-blue-700'
                    } focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500`}
                  >
                    {loading ? (
                      <>
                        <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        Creating...
                      </>
                    ) : (
                      'Create Notice'
                    )}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
} 