'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Navigation from '../../components/Navigation';
import PageHeading from '../../components/PageHeading';
import pageDescriptions from '../../utils/pageDescriptions';
import api from '../../utils/api';

// Define types needed for this component
interface CompetitionType {
  id: number;
  name: string;
  description: string;
}

export default function CreateCompetition() {
  const [numPlayers, setNumPlayers] = useState<number>(4);
  const [name, setName] = useState<string>('');
  const [error, setError] = useState<string>('');
  const [user, setUser] = useState<User | null>(null);
  const [clubs, setClubs] = useState<Club[]>([]);
  const [currentClub, setCurrentClub] = useState<Club | null>(null);
  const [competitionTypes, setCompetitionTypes] = useState<CompetitionType[]>([]);
  const [selectedCompetitionType, setSelectedCompetitionType] = useState<number>(1);
  const [parallelMatches, setParallelMatches] = useState<number>(1);
  const [maxRounds, setMaxRounds] = useState<number>(5);
  const router = useRouter();

  useEffect(() => {
    const fetchUserData = async () => {
      try {
        const token = localStorage.getItem('token');
        if (!token) {
          console.error('No token found in localStorage');
          router.push('/');
          return;
        }

        try {
          const response = await api.get<User>('/users/me/');
          console.log('User data:', response.data);
          setUser(response.data);
        } catch (err) {
          console.error('Error fetching user data:', err);
          router.push('/');
          return;
        }

        // Fetch user's clubs
        try {
          const clubsResponse = await api.get<Club[]>('/clubs/');
          console.log('Clubs data:', clubsResponse.data);
          setClubs(clubsResponse.data as Club[]);

          if (clubsResponse.data && clubsResponse.data.length > 0) {
            setCurrentClub(clubsResponse.data[0] as Club);
          }
        } catch (err) {
          console.error('Error fetching clubs:', err);
          // Don't redirect here, just log the error
        }
        
        // Fetch competition types
        try {
          console.log('Fetching competition types...');
          const typesResponse = await api.get<CompetitionType[]>('/competition-types/');
          console.log('Competition types data:', typesResponse.data);
          setCompetitionTypes(typesResponse.data as CompetitionType[]);
          if (typesResponse.data && typesResponse.data.length > 0) {
            setSelectedCompetitionType((typesResponse.data[0] as CompetitionType).id);
          }
        } catch (err) {
          console.error('Error fetching competition types:', err);
          setError('Failed to load competition types. Please try again later.');
          // Don't redirect here, just show an error
        }
      } catch (error) {
        console.error('Unexpected error in fetchUserData:', error);
        router.push('/');
      }
    };

    fetchUserData();
  }, [router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (numPlayers < 4 || numPlayers > 40) {
      setError('Number of players must be between 4 and 40');
      return;
    }

    if (!name.trim()) {
      setError('Competition name is required');
      return;
    }
    
    if (!currentClub) {
      setError('You must be a member of a club to create a competition');
      return;
    }

    if (!selectedCompetitionType) {
      setError('You must select a competition type');
      return;
    }

    try {
      console.log('Submitting competition with data:', {
        name,
        num_players: numPlayers,
        competition_type: selectedCompetitionType,
        parallel_matches: parallelMatches,
        max_rounds: maxRounds,
        club: currentClub.id
      });
      
      const response = await api.post('/competitions/', {
        name,
        num_players: numPlayers,
        competition_type: selectedCompetitionType,
        parallel_matches: parallelMatches,
        max_rounds: maxRounds,
        club: currentClub.id
      });
      
      console.log('Competition created successfully:', response.data);
      router.push('/competition/manage');
    } catch (error: any) {
      console.error('Error creating competition:', error);
      console.error('Error response:', error.response?.data);
      
      // Display detailed error information
      if (error.response?.data?.non_field_errors) {
        console.error('Error details:', error.response.data.non_field_errors);
        setError(error.response.data.non_field_errors[0]);
      } else if (error.response?.data?.creator) {
        // Handle creator field errors specifically
        const creatorErrors = Array.isArray(error.response.data.creator) 
          ? error.response.data.creator.join(', ')
          : error.response.data.creator;
        setError(`Creator error: ${creatorErrors}`);
      } else if (error.response?.data?.error) {
        setError(error.response.data.error);
      } else if (error.response?.data) {
        // Handle any field errors by converting the error object to a readable string
        const errorMessages = Object.entries(error.response.data)
          .map(([field, errors]) => {
            const errorText = Array.isArray(errors) ? errors.join(', ') : errors;
            return `${field}: ${errorText}`;
          })
          .join('; ');
        setError(`Validation errors: ${errorMessages}`);
      } else if (error.message) {
        setError(`Failed to create competition: ${error.message}`);
      } else {
        setError('Failed to create competition');
      }
    }
  };

  // Add a handleLogout function for the Navigation component
  const handleLogout = () => {
    localStorage.removeItem('token');
    router.push('/');
  };

  if (!user) {
    return <div>Loading...</div>;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Navigation user={user} onLogout={handleLogout} />
      <PageHeading title="Create Competition" infoText={pageDescriptions.createCompetition} />
      <div className="max-w-4xl mx-auto px-4 py-8">
        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
            {error}
          </div>
        )}
        <form onSubmit={handleSubmit} className="bg-white shadow-md rounded px-8 pt-6 pb-8 mb-4">
          <div className="mb-6">
            <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="name">
              Competition Name
            </label>
            <input
              id="name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
              required
            />
          </div>
          <div className="mb-6">
            <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="numPlayers">
              Number of Players
            </label>
            <input
              id="numPlayers"
              type="number"
              min={4}
              max={40}
              value={numPlayers}
              onChange={(e) => setNumPlayers(parseInt(e.target.value))}
              className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
              required
            />
            <p className="text-gray-600 text-xs italic">Must be between 4 and 40</p>
          </div>
          
          {competitionTypes.length > 0 && (
            <div className="mb-6">
              <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="competitionType">
                Competition Type
              </label>
              <select
                id="competitionType"
                value={selectedCompetitionType}
                onChange={(e) => setSelectedCompetitionType(parseInt(e.target.value))}
                className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
                required
              >
                {competitionTypes.map(type => (
                  <option key={type.id} value={type.id}>
                    {type.name}
                  </option>
                ))}
              </select>
              <p className="text-gray-600 text-xs italic">Select the type of competition</p>
            </div>
          )}
          
          <div className="mb-6">
            <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="parallelMatches">
              Parallel Matches
            </label>
            <input
              id="parallelMatches"
              type="number"
              min={1}
              max={10}
              value={parallelMatches}
              onChange={(e) => setParallelMatches(parseInt(e.target.value))}
              className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
              required
            />
            <p className="text-gray-600 text-xs italic">Number of matches to run simultaneously (1-10)</p>
          </div>
          
          <div className="mb-6">
            <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="maxRounds">
              Maximum Rounds
            </label>
            <input
              id="maxRounds"
              type="number"
              min={1}
              max={20}
              value={maxRounds}
              onChange={(e) => setMaxRounds(parseInt(e.target.value))}
              className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
              required
            />
            <p className="text-gray-600 text-xs italic">Maximum number of rounds to generate (1-20)</p>
          </div>
          {clubs.length > 0 && (
            <div className="mb-6">
              <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="club">
                Club
              </label>
              <select
                id="club"
                value={currentClub?.id || ''}
                onChange={(e) => {
                  const selectedClub = clubs.find(club => club.id === parseInt(e.target.value));
                  setCurrentClub(selectedClub || null);
                }}
                className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
                required
              >
                {clubs.map(club => (
                  <option key={club.id} value={club.id}>
                    {club.name}
                  </option>
                ))}
              </select>
            </div>
          )}
          <div className="flex items-center justify-between">
            <button
              type="submit"
              className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline"
            >
              Create Competition
            </button>
          </div>
        </form>
        
        {process.env.NODE_ENV === 'development' && (
          <div className="mt-8 p-4 border border-gray-300 rounded">
            <h3 className="text-lg font-bold">Debug Info</h3>
            <div className="mt-2">
              <p><strong>Competition Types:</strong> {competitionTypes.length}</p>
              <p><strong>Selected Type:</strong> {selectedCompetitionType}</p>
              <p><strong>User:</strong> {user ? user.username : 'Not loaded'}</p>
              <p><strong>Clubs:</strong> {clubs.length}</p>
              <p><strong>Current Club:</strong> {currentClub ? currentClub.name : 'Not selected'}</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
} 