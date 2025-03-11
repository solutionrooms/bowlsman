'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import api from '../../../../src/lib/axios';
import Navigation from '../../../components/Navigation';
import PageHeading from '../../../components/PageHeading';
import pageDescriptions from '../../../utils/pageDescriptions';

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
  club: number;
  created_by: {
    id: number;
    username: string;
  };
  created_at: string;
  updated_at: string;
  additional_images?: { id: number; image: string }[];
};

export default function EditNoticePage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const id = params.id;
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [noticeType, setNoticeType] = useState<'social_bowl' | 'general' | 'for_sale'>('general');
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [location, setLocation] = useState('');
  const [price, setPrice] = useState('');
  const [images, setImages] = useState<File[]>([]);
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [currentImageUrl, setCurrentImageUrl] = useState<string | null>(null);
  const [additionalImageUrls, setAdditionalImageUrls] = useState<{id: number, image: string}[]>([]);
  const [currentPdfUrl, setCurrentPdfUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentClub, setCurrentClub] = useState<Club | null>(null);
  const [notice, setNotice] = useState<Notice | null>(null);
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

  useEffect(() => {
    const fetchNotice = async () => {
      if (!id) return;
      
      setInitialLoading(true);
      try {
        const response = await api.get<Notice>(`/notices/${id}/`);
        setNotice(response.data);
        
        // Populate form fields with current notice data
        setTitle(response.data.title);
        setDescription(response.data.description);
        setNoticeType(response.data.notice_type);
        
        // Format date string correctly if it exists
        if (response.data.date) {
          setDate(response.data.date);
        }
        
        if (response.data.time) {
          setTime(response.data.time);
        }
        
        if (response.data.location) {
          setLocation(response.data.location);
        }
        
        if (response.data.price) {
          setPrice(response.data.price.toString());
        }
        
        if (response.data.image) {
          setCurrentImageUrl(response.data.image);
        }
        
        if (response.data.pdf_file) {
          setCurrentPdfUrl(response.data.pdf_file);
        }
        
        // Set additional images if they exist
        if (response.data.additional_images && response.data.additional_images.length > 0) {
          setAdditionalImageUrls(response.data.additional_images);
        }
        
        setError(null);
      } catch (err) {
        console.error('Error fetching notice:', err);
        setError('Failed to load notice. It may have been removed or you do not have permission to view it.');
      } finally {
        setInitialLoading(false);
      }
    };

    fetchNotice();
  }, [id]);

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const fileArray = Array.from(e.target.files);
      setImages(prev => [...prev, ...fileArray]);
    }
  };

  const handlePdfChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setPdfFile(e.target.files[0]);
      setCurrentPdfUrl(null); // Clear the current PDF URL if a new file is selected
    }
  };

  const clearImage = () => {
    setImages([]);
    setCurrentImageUrl(null);
    if (imageInputRef.current) {
      imageInputRef.current.value = '';
    }
  };

  const removeImage = (index: number) => {
    setImages(prev => {
      const newImages = [...prev];
      newImages.splice(index, 1);
      return newImages;
    });
  };

  const clearPdf = () => {
    setPdfFile(null);
    setCurrentPdfUrl(null);
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

      if (!notice) {
        setError('Notice not found');
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

      // Add multiple images if selected
      if (images.length > 0) {
        // If we have multiple images, add them with indexed names
        if (images.length === 1 && !additionalImageUrls.length) {
          formData.append('image', images[0]);
        } else {
          images.forEach((img, index) => {
            formData.append(`image_${index}`, img);
          });
          // Add a flag to indicate multiple images
          formData.append('has_multiple_images', 'true');
        }
      } else if (currentImageUrl === null && additionalImageUrls.length === 0) {
        // If currentImageUrl is null and no new image is selected, it means the user wants to remove the image
        formData.append('remove_image', 'true');
      }
      
      // If we're keeping existing additional images
      if (additionalImageUrls.length > 0) {
        formData.append('keep_additional_images', 'true');
        additionalImageUrls.forEach((img, index) => {
          formData.append(`additional_image_id_${index}`, img.id.toString());
        });
      }
      
      if (pdfFile) {
        formData.append('pdf_file', pdfFile);
      } else if (currentPdfUrl === null) {
        // If currentPdfUrl is null and no new PDF is selected, it means the user wants to remove the PDF
        formData.append('remove_pdf', 'true');
      }

      type NoticeResponse = {
        id: number;
        title: string;
        notice_type: string;
      };

      // Use PATCH to update only the changed fields
      const response = await api.patch<NoticeResponse>(`/notices/${id}/`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });
      
      // Redirect to the notice detail page
      router.push(`/noticeboard/${response.data.id}`);
    } catch (err) {
      console.error('Error updating notice:', err);
      setError('Failed to update notice. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (initialLoading) {
    return (
      <div className="min-h-screen bg-gray-100">
        <Navigation onLogout={handleLogout} />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex justify-center">
            <svg className="animate-spin h-10 w-10 text-blue-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
          </div>
        </div>
      </div>
    );
  }

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

  if (!notice) {
    return (
      <div className="min-h-screen bg-gray-100">
        <Navigation onLogout={handleLogout} />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="bg-red-50 border-l-4 border-red-400 p-4 mb-4">
            <div className="flex">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="ml-3">
                <p className="text-sm text-red-700">
                  Notice not found or you don't have permission to edit it.
                </p>
              </div>
            </div>
          </div>
          <div className="mt-4">
            <Link
              href="/noticeboard"
              className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              Back to Noticeboard
            </Link>
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
              title="Edit Notice" 
              infoText="Edit your notice details here. Make your changes and click 'Update Notice' to save them."
            />
          </div>
          <div className="mt-4 flex md:mt-0 md:ml-4">
            <Link
              href={`/noticeboard/${id}`}
              className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              Back to Notice
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
                    Images (Optional)
                  </label>
                  {currentImageUrl && (
                    <div className="mt-2 mb-4">
                      <p className="text-sm text-gray-500 mb-2">Current image:</p>
                      <img 
                        src={currentImageUrl} 
                        alt="Current notice image" 
                        className="max-w-xs h-auto rounded-md shadow-sm"
                      />
                    </div>
                  )}
                  <div className="mt-1 flex items-center">
                    <label htmlFor="image" className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 cursor-pointer">
                      <svg className="h-5 w-5 mr-2" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                      <span>Upload images</span>
                    </label>
                    <input
                      type="file"
                      id="image"
                      accept="image/*"
                      multiple
                      className="sr-only"
                      ref={imageInputRef}
                      onChange={handleImageChange}
                    />
                  </div>
                  <div className="mt-3">
                    {/* Display existing main image if there is one */}
                    {currentImageUrl && (
                      <div className="mb-4">
                        <div className="flex items-center mb-2">
                          <h4 className="text-sm font-medium text-gray-700">Current Main Image:</h4>
                          <button
                            type="button"
                            className="ml-4 text-sm text-red-600 hover:text-red-900"
                            onClick={() => setCurrentImageUrl(null)}
                          >
                            Remove
                          </button>
                        </div>
                        <div className="w-40 h-40 relative">
                          <img 
                            src={currentImageUrl} 
                            alt="Current notice" 
                            className="w-full h-full object-cover rounded border"
                          />
                        </div>
                      </div>
                    )}
                    
                    {/* Display existing additional images */}
                    {additionalImageUrls.length > 0 && (
                      <div className="mb-4">
                        <div className="flex items-center mb-2">
                          <h4 className="text-sm font-medium text-gray-700">Additional Images:</h4>
                          <button
                            type="button"
                            className="ml-4 text-sm text-red-600 hover:text-red-900"
                            onClick={() => setAdditionalImageUrls([])}
                          >
                            Remove All
                          </button>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                          {additionalImageUrls.map((img, index) => (
                            <div key={img.id} className="w-full relative">
                              <img 
                                src={img.image} 
                                alt={`Additional image ${index + 1}`} 
                                className="w-full h-32 object-cover rounded border"
                              />
                              <button
                                type="button"
                                className="absolute top-1 right-1 bg-white rounded-full p-1 shadow text-red-600 hover:text-red-900"
                                onClick={() => {
                                  setAdditionalImageUrls(prev => prev.filter(i => i.id !== img.id));
                                }}
                              >
                                <svg className="h-5 w-5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                                  <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                                </svg>
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    
                    {/* Display newly uploaded images */}
                    {images.length > 0 && (
                      <div className="mt-3">
                        <div className="flex items-center mb-2">
                          <h4 className="text-sm font-medium text-gray-700">New Uploads:</h4>
                          <button
                            type="button"
                            className="ml-4 text-sm text-red-600 hover:text-red-900"
                            onClick={clearImage}
                          >
                            Clear all
                          </button>
                        </div>
                        
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          {images.map((img, index) => (
                            <div key={index} className="flex items-center p-2 border rounded">
                              <span className="text-sm text-gray-500 truncate mr-auto">{img.name}</span>
                              <button
                                type="button"
                                className="ml-2 text-red-600 hover:text-red-900"
                                onClick={() => removeImage(index)}
                              >
                                <svg className="h-5 w-5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                                  <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                                </svg>
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* PDF Upload */}
                <div>
                  <label htmlFor="pdf-file" className="block text-sm font-medium text-gray-700">
                    PDF Attachment (Optional)
                  </label>
                  {currentPdfUrl && (
                    <div className="mt-2 mb-2">
                      <p className="text-sm text-gray-500 mb-1">Current PDF:</p>
                      <a 
                        href={currentPdfUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 hover:text-blue-800 underline inline-flex items-center"
                      >
                        <svg className="h-5 w-5 mr-1" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M6 2a2 2 0 00-2 2v12a2 2 0 002 2h8a2 2 0 002-2V7.414A2 2 0 0015.414 6L12 2.586A2 2 0 0010.586 2H6zm5 6a1 1 0 10-2 0v3.586l-1.293-1.293a1 1 0 10-1.414 1.414l3 3a1 1 0 001.414 0l3-3a1 1 0 00-1.414-1.414L13 11.586V8z" clipRule="evenodd" />
                        </svg>
                        View current PDF
                      </a>
                    </div>
                  )}
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
                      <span>{currentPdfUrl ? 'Replace PDF' : 'Upload a PDF'}</span>
                    </label>
                    {(pdfFile || currentPdfUrl) && (
                      <button
                        type="button"
                        className="ml-4 text-red-600 hover:text-red-900"
                        onClick={clearPdf}
                      >
                        <span className="mr-2">Remove PDF</span>
                        <svg className="inline-block h-5 w-5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                        </svg>
                      </button>
                    )}
                  </div>
                  <p className="mt-1 text-sm text-gray-500">
                    Attach a PDF document to provide additional information. Max 10MB.
                  </p>
                </div>

                <div className="flex justify-end">
                  <Link
                    href={`/noticeboard/${id}`}
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
                        Updating...
                      </>
                    ) : (
                      'Update Notice'
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