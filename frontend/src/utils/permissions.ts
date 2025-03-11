/**
 * Utility functions for checking user permissions
 */

interface User {
  id: number;
}

interface League {
  captain?: User | null;
  deputy?: User | null;
  club?: {
    id: number;
  };
}

interface Club {
  id: number;
  is_admin: boolean;
}

/**
 * Check if the current user has permission to manage a team
 * @param userId - The ID of the current user
 * @param league - The league/team object
 * @param userClubs - Array of clubs the user belongs to
 * @returns boolean indicating if the user can manage the team
 */
export const canManageTeam = (
  userId: number,
  league: League,
  userClubs: Club[]
): boolean => {
  if (!userId || !league) return false;

  // Check if user is the team captain
  if (league.captain && league.captain.id === userId) {
    return true;
  }

  // Check if user is the team deputy
  if (league.deputy && league.deputy.id === userId) {
    return true;
  }

  // Check if user is an admin of the club that owns the team
  if (league.club && userClubs) {
    const clubId = league.club.id;
    return userClubs.some(club => club.id === clubId && club.is_admin);
  }

  return false;
}; 