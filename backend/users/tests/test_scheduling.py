from django.test import TestCase
from users.scheduling import create_round_robin_schedule


class TestRoundRobinSchedule(TestCase):
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