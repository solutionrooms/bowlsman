export interface User {
  id: number;
  username: string;
  email: string;
  is_staff: boolean;
  first_name: string;
  last_name: string;
  display_name: string;
  search_name: string;
}

export interface Club {
  id: number;
  name: string;
}

export interface CompetitionUser {
  id: number;
  username: string;
  guest_name: string | null;
  user: number | null;
  order: number;
}

export interface Competition {
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

export interface CompetitionType {
  id: number;
  name: string;
  description: string;
} 