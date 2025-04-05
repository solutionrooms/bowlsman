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
  member_count: number;
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
    club_role?: string;
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
    club_role?: string;
  }[];
}

interface Competition {
  id: number;
  name: string;
  created_at: string;
  num_players: number;
  creator: number;
  creator_name: string;
  competition_type: number;
  competition_type_name: string;
  is_full: boolean;
  players: CompetitionUser[];
  available_slots: number;
  status: 'open' | 'full' | 'scheduled' | 'in_progress' | 'completed';
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
  social_bowl: number;
  user: number;
  user_details: {
    id: number;
    username: string;
    display_name: string;
    club_role?: string;
  };
  status: 'confirmed' | 'pending' | 'cancelled';
  created_at: string;
}

interface SocialBowl {
  id: number;
  name: string;
  description: string;
  date: string;
  time: string;
  location: string;
  max_participants: number;
  current_participants: number;
  status: 'open' | 'full' | 'cancelled' | 'completed';
  creator: number;
  creator_name: string;
  club: number;
  club_name: string;
  created_at: string;
  participants: SocialBowlParticipant[];
}

interface PlayerNameMapping {
  id: number;
  roster_first_name: string;
  roster_last_name: string;
  roster_full_name: string;
  user: User;
  created_at: string;
}

interface LeagueMember {
  id: number;
  user: User;
  joined_at: string;
}

interface League {
  id: number;
  name: string;
  club: Club;
  season: string;
  captain: User | null;
  deputy: User | null;
  league_table_link: string | null;
  team_link: string | null;
  created_at: string;
  updated_at: string;
  members_count: number;
  members: LeagueMember[];
  name_mappings: PlayerNameMapping[];
}

interface CompetitionType {
  id: number;
  name: string;
  description: string;
}

interface UserDetails {
  id: number;
  username: string;
  email: string;
  first_name: string;
  last_name: string;
  full_name: string;
  avatar?: string;
  club_role?: string;
  display_name: string;
}

interface ChatMember {
  id: number;
  chat: number;
  user: number;
  user_details: UserDetails;
  is_admin: boolean;
  created_at: string;
  last_read_at: string | null;
}

interface Chat {
  id: number;
  name: string;
  chat_type: 'direct' | 'group';
  created_at: string;
  updated_at: string;
  last_message?: string;
  last_message_at?: string;
  members: ChatMember[];
  unread_count: number;
}

interface ClubMember {
  id: number;
  user: number;
  club: number;
  club_name: string;
  is_admin: boolean;
  club_role?: string;
  created_at: string;
  last_login_at: string | null;
  user_details?: {
    id: number;
    username: string;
    display_name: string;
    club_role?: string;
  };
}