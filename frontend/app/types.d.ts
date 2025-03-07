/// <reference types="react" />
/// <reference types="node" />

declare namespace NodeJS {
  interface ProcessEnv {
    NEXT_PUBLIC_API_URL: string;
  }
}

interface Club {
  id: number;
  name: string;
  address?: string;
  created_at: string;
  member_count?: number;
}

interface ClubUser {
  id: number;
  user: number;
  club: number;
  club_name: string;
  is_admin: boolean;
  created_at: string;
  last_login_at: string | null;
  user_details?: {
    id: number;
    username: string;
    display_name: string;
  };
}

interface User {
  id: number;
  username: string;
  email: string;
  first_name: string;
  last_name: string;
  is_active: boolean;
  is_staff: boolean;
  display_name: string;
  search_name: string;
  clubs?: {
    id: number;
    name: string;
    is_admin: boolean;
    last_login_at: string | null;
  }[];
}

interface Competition {
  id: number;
  name: string;
  created_at: string;
  num_players: number;
  creator: number;
  creator_name: string;
  rule_set_id: number;
  is_full: boolean;
  players: CompetitionUser[];
  available_slots: number;
  status: 'open' | 'full' | 'scheduled';
  parallel_matches: number;
  max_rounds: number;
  club: number;
  club_name: string;
}

interface CompetitionUser {
  id: number;
  competition: number;
  user: number | null;
  guest_name: string | null;
  username: string;
  created_at: string;
  order: number;
}

interface AuthState {
  token: string | null;
  user: User | null;
  clubs: Club[];
  currentClub: Club | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
}

interface SocialBowlParticipant {
  id: number;
  user: User;
  joined_at: string;
}

interface SocialBowl {
  id: number;
  title: string;
  description: string;
  date: string;
  time: string;
  location: string;
  club: number;
  created_by: User;
  created_at: string;
  updated_at: string;
  participants: SocialBowlParticipant[];
  participant_count: number;
  is_joined: boolean;
}