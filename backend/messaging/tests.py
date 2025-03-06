from django.test import TestCase
from django.contrib.auth.models import User
from rest_framework.test import APIClient
from rest_framework import status
from .models import Message
from users.models import Club, ClubUser

class MessageModelTestCase(TestCase):
    def setUp(self):
        self.user1 = User.objects.create_user(username='user1', password='password')
        self.user2 = User.objects.create_user(username='user2', password='password')
        self.club = Club.objects.create(name='Test Club')
        
        ClubUser.objects.create(user=self.user1, club=self.club, is_admin=True)
        ClubUser.objects.create(user=self.user2, club=self.club)
        
    def test_message_creation(self):
        message = Message.objects.create(
            sender=self.user1,
            recipient=self.user2,
            club=self.club,
            subject='Test Subject',
            content='Test Content'
        )
        
        self.assertEqual(message.subject, 'Test Subject')
        self.assertEqual(message.content, 'Test Content')
        self.assertEqual(message.sender, self.user1)
        self.assertEqual(message.recipient, self.user2)
        self.assertEqual(message.club, self.club)
        self.assertFalse(message.is_read)
        self.assertFalse(message.is_club_wide)
        
    def test_club_wide_message(self):
        message = Message.objects.create(
            sender=self.user1,
            club=self.club,
            subject='Club Announcement',
            content='This is a club-wide announcement',
            is_club_wide=True
        )
        
        self.assertEqual(message.subject, 'Club Announcement')
        self.assertTrue(message.is_club_wide)
        self.assertIsNone(message.recipient)
        
class MessageAPITestCase(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.user1 = User.objects.create_user(username='user1', password='password')
        self.user2 = User.objects.create_user(username='user2', password='password')
        self.club = Club.objects.create(name='Test Club')
        
        ClubUser.objects.create(user=self.user1, club=self.club, is_admin=True)
        ClubUser.objects.create(user=self.user2, club=self.club)
        
        self.client.force_authenticate(user=self.user1)
        
        # Create messages
        Message.objects.create(
            sender=self.user1,
            recipient=self.user2,
            club=self.club,
            subject='Test Message 1',
            content='Content 1'
        )
        
        Message.objects.create(
            sender=self.user2,
            recipient=self.user1,
            club=self.club,
            subject='Test Message 2',
            content='Content 2'
        )
        
        # Mock current club in session
        session = self.client.session
        session['current_club_id'] = self.club.id
        session.save()
        
    def test_inbox_endpoint(self):
        response = self.client.get('/api/messages/inbox/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 1)
        self.assertEqual(response.data[0]['subject'], 'Test Message 2')
        
    def test_outbox_endpoint(self):
        response = self.client.get('/api/messages/outbox/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 1)
        self.assertEqual(response.data[0]['subject'], 'Test Message 1')