interface Club {
  id: number;
  name: string;
  address?: string;
  created_at: string;
}

interface ClubUser {
  id: number;
  user_id: number;
  club_id: number;
  is_admin: boolean;
  last_login_at?: string;
}

interface User {
  id: number;
  username: string;
  email: string;
  first_name?: string;
  last_name?: string;
  is_staff: boolean;
  is_active: boolean;
  date_joined: string;
  clubs?: Array<{
    id: number;
    name: string;
    is_admin: boolean;
    last_login_at?: string;
  }>;
} 