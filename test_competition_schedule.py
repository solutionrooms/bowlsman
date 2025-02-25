import unittest
import sys
import os

# Add the backend directory to Python path
backend_dir = os.path.join(os.path.dirname(__file__), 'backend')
if os.path.exists(backend_dir):
    sys.path.append(backend_dir)

from users.scheduling import create_round_robin_schedule


class TestRoundRobinSchedule(unittest.TestCase):
    def test_8_players(self):
        """Test scheduling with exactly 8 players (4v4)"""
        players = [{"id": i} for i in range(1, 9)]
        schedule = create_round_robin_schedule(1, players, max_rounds=10, team_size=4)
        # With 8 players, we should get 7 rounds with 1 match each
        self.assertEqual(len(schedule), 7)
        # Each match should have 8 unique players
        for match in schedule:
            players_in_match = {
                match['side_1_player_1'], match['side_1_player_2'],
                match['side_1_player_3'], match['side_1_player_4'],
                match['side_2_player_1'], match['side_2_player_2'],
                match['side_2_player_3'], match['side_2_player_4']
            }
            # Remove None values for partially filled teams
            players_in_match.discard(None)
            self.assertEqual(len(players_in_match), 8)

    def test_4_players_2v2(self):
        """Test scheduling with 4 players in 2v2 format"""
        players = [{"id": i} for i in range(1, 5)]
        schedule = create_round_robin_schedule(1, players, team_size=2)
        
        # Check that only positions 1-2 are filled
        for match in schedule:
            self.assertIsNotNone(match['side_1_player_1'])
            self.assertIsNotNone(match['side_1_player_2'])
            self.assertIsNone(match['side_1_player_3'])
            self.assertIsNone(match['side_1_player_4'])
            self.assertIsNotNone(match['side_2_player_1'])
            self.assertIsNotNone(match['side_2_player_2'])
            self.assertIsNone(match['side_2_player_3'])
            self.assertIsNone(match['side_2_player_4'])

    def test_max_rounds(self):
        """Test that max_rounds parameter is respected"""
        players = [{"id": i} for i in range(1, 17)]  # 16 players
        schedule = create_round_robin_schedule(1, players, max_rounds=3, team_size=4)
        # Should only get 3 rounds even though 16 players would allow for more
        rounds = {match['round'] for match in schedule}
        self.assertEqual(max(rounds), 3)

    def test_less_than_minimum_players(self):
        """Test handling of insufficient players for a match"""
        players = [{"id": i} for i in range(1, 3)]  # Only 2 players
        schedule = create_round_robin_schedule(1, players, team_size=2)
        self.assertEqual(len(schedule), 0)

    def test_odd_number_players(self):
        """Test handling of odd number of players"""
        players = [{"id": i} for i in range(1, 6)]  # 5 players
        schedule = create_round_robin_schedule(1, players, team_size=2)
        # Should still create valid 2v2 matches, excluding one player each round
        for match in schedule:
            filled_positions = [
                match['side_1_player_1'], match['side_1_player_2'],
                match['side_2_player_1'], match['side_2_player_2']
            ]
            filled_positions = [p for p in filled_positions if p is not None]
            self.assertEqual(len(filled_positions), 4)  # Should always have 4 players in 2v2

    def test_team_size_limits(self):
        """Test that team size is properly clamped between 1 and 4"""
        players = [{"id": i} for i in range(1, 9)]
        
        # Test with team_size > 4 (should clamp to 4)
        schedule = create_round_robin_schedule(1, players, team_size=6)
        for match in schedule:
            self.assertIsNotNone(match['side_1_player_4'])
            self.assertIsNotNone(match['side_2_player_4'])
        
        # Test with team_size < 1 (should clamp to 1)
        schedule = create_round_robin_schedule(1, players, team_size=0)
        for match in schedule:
            self.assertIsNotNone(match['side_1_player_1'])
            self.assertIsNone(match['side_1_player_2'])
            self.assertIsNotNone(match['side_2_player_1'])
            self.assertIsNone(match['side_2_player_2'])

    def test_parallel_matches(self):
        """Test scheduling with parallel matches"""
        players = [{"id": i} for i in range(1, 17)]  # 16 players
        schedule = create_round_robin_schedule(1, players, team_size=2, parallel_matches=2)
        
        # Group matches by round and sub_round
        matches_by_round = {}
        for match in schedule:
            round_key = (match['round'], match['sub_round'])
            if round_key not in matches_by_round:
                matches_by_round[round_key] = []
            matches_by_round[round_key].append(match)
        
        # Check that no sub-round has more than 2 matches
        for matches in matches_by_round.values():
            self.assertLessEqual(len(matches), 2)
        
        # Check that players don't appear in multiple matches in the same sub-round
        for matches in matches_by_round.values():
            players_in_subround = set()
            for match in matches:
                match_players = {
                    match['side_1_player_1'], match['side_1_player_2'],
                    match['side_2_player_1'], match['side_2_player_2']
                }
                match_players.discard(None)
                # Check for no overlap with previous players in this sub-round
                self.assertEqual(len(players_in_subround & match_players), 0)
                players_in_subround.update(match_players)


def display_schedule(players: list, max_rounds: int = 5, team_size: int = 2, parallel_matches: int = 1):
    """Display the schedule in a readable format"""
    print(f"\nSchedule for {len(players)} players (max {max_rounds} rounds, team size {team_size}, {parallel_matches} parallel matches):")
    schedule = create_round_robin_schedule(1, players, max_rounds, team_size, parallel_matches)
    
    current_round = None
    current_sub_round = None
    
    for match in schedule:
        if match['round'] != current_round:
            current_round = match['round']
            print(f"\nRound {current_round}:")
            current_sub_round = None
            
        if match['sub_round'] != current_sub_round:
            current_sub_round = match['sub_round']
            print(f"  Sub-round {current_sub_round}:")
        
        team1 = [match[f'side_1_player_{i}'] for i in range(1, 5)]
        team2 = [match[f'side_2_player_{i}'] for i in range(1, 5)]
        # Filter out None values for cleaner display
        team1 = [p for p in team1 if p is not None]
        team2 = [p for p in team2 if p is not None]
        print(f"    Team 1: {team1} vs Team 2: {team2}")


if __name__ == "__main__":
    # Run tests first
    unittest.main(exit=False)
    
    # Generate example schedules
    print("\nExample Schedules:")
    test_cases = [
        (8, 4, 1),    # 8 players, 4v4, sequential matches
        (8, 4, 2),    # 8 players, 4v4, 2 parallel matches
        (16, 2, 4),   # 16 players, 2v2, 4 parallel matches
        (12, 2, 3),   # 12 players (with BYE), 2v2, 3 parallel matches
    ]
    
    for num_players, team_size, parallel in test_cases:
        players = [{"id": i} for i in range(1, num_players + 1)]
        display_schedule(players, team_size=team_size, parallel_matches=parallel) 