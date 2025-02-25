from typing import List, Dict, Any, Optional
import logging


def create_round_robin_schedule(competition_id: int, players: List[Dict[str, Any]], 
                              max_rounds: int = 5, team_size: int = 2,
                              parallel_matches: int = 1) -> List[Dict[str, Any]]:
    """
    Generate a round-robin schedule with team assignments.
    Returns a list of dicts compatible with CompetitionSchedule model.
    
    Args:
        competition_id: ID of the competition
        players: List of player dicts with 'id' field
        max_rounds: Maximum number of rounds to generate
        team_size: Number of active players per team (1-4), defaults to 2
        parallel_matches: Number of matches that can be played simultaneously in each round
    """
    logger = logging.getLogger(__name__)
    
    if not players:
        return []
    
    # Validate team size and parallel matches
    team_size = max(1, min(4, team_size))
    parallel_matches = max(1, parallel_matches)
    min_players = team_size * 2  # Minimum players needed for a match
    
    logger.info(f"Creating schedule for {len(players)} players, team_size={team_size}, parallel_matches={parallel_matches}")
    
    # Need at least enough players for one match
    if len(players) < min_players:
        return []
    
    # Work on a copy of player IDs
    player_ids = [p['id'] for p in players]
    n = len(player_ids)
    
    # If not divisible by (team_size * 2), add dummy players
    while n % (team_size * 2) != 0:
        player_ids.append(f"BYE_{n}")
        n += 1
    
    rounds = []
    # Generate min(n-1, max_rounds) rounds
    num_rounds = min(n - 1, max_rounds)
    logger.info(f"Will generate {num_rounds} rounds")
    
    for i in range(num_rounds):
        round_matches = []
        # In each round, create n/(team_size*2) matches
        for j in range(0, n, team_size * 2):
            team1 = player_ids[j:j+team_size]
            team2 = player_ids[j+team_size:j+team_size*2]
            # Only include match if no BYE players
            if not any(isinstance(p, str) for p in team1 + team2):
                round_matches.append((team1, team2))
        if round_matches:  # Only add round if it has valid matches
            rounds.append(round_matches)
            logger.info(f"Round {i+1} has {len(round_matches)} matches")
        # Rotate players for next round: keep first player fixed, move last to second, shift rest
        player_ids = [player_ids[0]] + [player_ids[-1]] + player_ids[1:-1]
    
    # Convert rounds into CompetitionSchedule format with parallel matches
    competition_schedules = []
    seen_keys = set()  # Track unique combinations of round and sub_round
    
    for round_num, round_matches in enumerate(rounds, 1):
        num_sub_rounds = (len(round_matches) + parallel_matches - 1) // parallel_matches
        logger.info(f"Round {round_num} will have {num_sub_rounds} sub-rounds for {len(round_matches)} matches")
        
        # Group matches into sub-rounds
        for sub_round_num in range(1, num_sub_rounds + 1):
            # Get matches for this sub-round
            start_idx = (sub_round_num - 1) * parallel_matches
            end_idx = min(start_idx + parallel_matches, len(round_matches))
            sub_round_matches = round_matches[start_idx:end_idx]
            
            logger.info(f"Round {round_num}.{sub_round_num} will have {len(sub_round_matches)} matches")
            
            # Create schedule entries for each match in this sub-round
            for match in sub_round_matches:
                team1, team2 = match
                # Pad teams with None for empty slots
                team1 = team1 + [None] * (4 - len(team1))
                team2 = team2 + [None] * (4 - len(team2))
                
                key = (round_num, sub_round_num)
                if key in seen_keys:
                    logger.error(f"Duplicate key found: round {round_num}, sub_round {sub_round_num}")
                    continue
                seen_keys.add(key)
                
                schedule_entry = {
                    'competition': competition_id,
                    'round': round_num,
                    'sub_round': sub_round_num,
                    'side_1_player_1': team1[0],
                    'side_1_player_2': team1[1],
                    'side_1_player_3': team1[2],
                    'side_1_player_4': team1[3],
                    'side_2_player_1': team2[0],
                    'side_2_player_2': team2[1],
                    'side_2_player_3': team2[2],
                    'side_2_player_4': team2[3]
                }
                competition_schedules.append(schedule_entry)
                logger.info(f"Created entry for round {round_num}.{sub_round_num} with teams: {team1[:team_size]} vs {team2[:team_size]}")
    
    logger.info(f"Generated {len(competition_schedules)} total schedule entries")
    return competition_schedules 