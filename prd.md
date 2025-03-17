# Bowlsman Project Requirements Document

## 1. Authentication

### Login
**Overview:**
User authentication system that allows users to log in to the application with their credentials.

**Frontend Route:** `/`

**Features:**
- User login with username and password
- Club selection for users who belong to multiple clubs
- Remember me functionality
- Error handling for invalid credentials

**Access Requirements:**
- Login page: All users
- Club selection interface: All users (only displayed for users with multiple club memberships)

**Underlying API Calls:**
- `POST /api/users/login/`
  - Request: `{ username, password, club_id (optional) }`
  - Response: User details, authentication token, and club information
- `POST /api/logout/`
  - Request: Authentication token in header
  - Response: Confirmation of logout

### Registration
**Overview:**
System to allow new users to create an account on the platform.

**Frontend Route:** `/` (shared with login)

**Features:**
- User registration with username, email, first name, last name, and postcode
- Password creation with strength validation
- Privacy policy acceptance requirement
- Error handling for registration issues
- Toggle between login and registration screens

**Access Requirements:**
- Registration page: All users

**Underlying API Calls:**
- `POST /api/users/register/`
  - Request: `{ username, password, email, first_name, last_name, postcode }`
  - Response: Confirmation of successful registration

### Reset Password
**Overview:**
System to allow users to reset their password if forgotten.

**Frontend Route:** `/reset-password`

**Features:**
- Request password reset via email
- Secure token-based password reset
- New password confirmation

**Access Requirements:**
- Password reset request page: All users
- Password reset confirmation page: All users (with valid token)

**Underlying API Calls:**
- `POST /api/reset-password-request/`
  - Request: `{ email }`
  - Response: Confirmation of reset email sent
- `GET /api/validate-reset-token/{token}/`
  - Response: Token validity status
- `POST /api/reset-password/`
  - Request: `{ token, new_password }`
  - Response: Password reset confirmation

## 2. Dashboard

**Overview:**
The main landing page after login, providing an overview of user activities and important information.

**Frontend Route:** `/dashboard`

**Features:**
- Overview of upcoming competitions and events
- Recent game scores and statistics
- Quick access to frequently used features
- Notifications and alerts

**Access Requirements:**
- Dashboard page: All authenticated users
- Administrative alerts/notices: Club admins, members with leadership role, is_staff users

**Underlying API Calls:**
- `GET /api/users/{user_id}/`
  - Response: User profile information
- `GET /api/competitions/`
  - Response: List of upcoming competitions
- `GET /api/game-scores/`
  - Response: Recent game scores
- `GET /api/notices/`
  - Response: Club notifications and announcements

## 3. Club Management

### Club List
**Overview:**
Displays all clubs the user is a member of.

**Frontend Route:** `/club`

**Features:**
- List of clubs with basic information
- Club selection for users with multiple memberships
- Quick access to club details

**Access Requirements:**
- Club list page: All authenticated users
- Create new club button: All authenticated users

**Underlying API Calls:**
- `GET /api/clubs/`
  - Response: List of clubs the user is a member of
- `GET /api/clubs/search/`
  - Request: `{ search_term }`
  - Response: List of clubs matching search criteria

### Club Details
**Overview:**
Detailed view of a specific club, including its members and activities.

**Frontend Route:** `/club/[id]`

**Features:**
- Club information and statistics
- Member list and roles
- Club activities and events

**Access Requirements:**
- Basic club details: All club members
- Member list view: All club members
- Edit club information button: Club admins, members with leadership role
- View sensitive statistics: Club admins, members with leadership role

**Underlying API Calls:**
- `GET /api/clubs/{club_id}/`
  - Response: Detailed information about the club
- `GET /api/clubs/{club_id}/members/`
  - Response: List of club members with roles
- `PATCH /api/clubs/{club_id}/`
  - Request: Updated club information
  - Response: Modified club details

### Club Creation
**Overview:**
Interface for creating a new bowling club.

**Frontend Route:** `/club/create`

**Features:**
- Club name and description input
- Club logo upload
- Initial admin settings

**Access Requirements:**
- Club creation page: All authenticated users
- Advanced configuration options: is_staff users

**Underlying API Calls:**
- `POST /api/clubs/create/`
  - Request: `{ name, description, other_club_details }`
  - Response: Newly created club details

### Club Member Management
**Overview:**
Interface for managing club members, including adding, removing, and changing roles.

**Frontend Route:** `/club/manage`

**Features:**
- Add new members to the club
- Remove existing members
- Change member roles and permissions
- Search and filter members

**Access Requirements:**
- View member list: All club members
- Add new members: Club admins, members with leadership role
- Remove members: Club admins
- Modify member roles: Club admins
- Promote to admin: Club admins
- Search/filter members: All club members

**Underlying API Calls:**
- `POST /api/clubs/{club_id}/add_user/`
  - Request: User details to add
  - Response: Added member information
- `POST /api/clubs/{club_id}/remove_user/`
  - Request: User to remove
  - Response: Confirmation of member removal
- `PATCH /api/club-users/{club_user_id}/`
  - Request: Updated member information
  - Response: Modified member details
- `GET /api/users/search/`
  - Request: Search parameters
  - Response: List of users matching criteria

## 4. Competition Management

### Competition List
**Overview:**
Lists all competitions within a club.

**Frontend Route:** `/competition`

**Features:**
- View all upcoming and past competitions
- Filter and search competitions
- Quick access to competition details

**Access Requirements:**
- Competition list page: All club members
- Create competition button: Club admins, members with leadership role

**Underlying API Calls:**
- `GET /api/competitions/`
  - Request: Optional filter parameters
  - Response: List of competitions based on filters

### Create Competition
**Overview:**
Interface for creating a new bowling competition within a club.

**Frontend Route:** `/competition/create`

**Features:**
- Set competition name, type, and description
- Configure participant settings
- Set up competition schedule
- Define scoring rules

**Access Requirements:**
- Competition creation page: Club admins, members with leadership role
- Advanced configuration options: Club admins

**Underlying API Calls:**
- `GET /api/competition-types/`
  - Response: List of available competition types
- `POST /api/competitions/`
  - Request: Competition details
  - Response: Created competition data
- `POST /api/competitions/{competition_id}/create_schedule/`
  - Request: Schedule configuration
  - Response: Created schedule details

### Manage Competition
**Overview:**
Interface for managing an existing competition, including participants and schedules.

**Frontend Route:** `/competition/manage`

**Features:**
- Edit competition details
- Manage competition participants
- Update competition schedule
- Track competition status

**Access Requirements:**
- Basic competition details view: All club members
- Edit competition details: Club admins, competition creators
- Manage participants: Club admins, competition creators
- Update schedule: Club admins, competition creators
- Cancel competition button: Club admins, competition creators

**Underlying API Calls:**
- `GET /api/competitions/{competition_id}/`
  - Response: Competition details
- `PATCH /api/competitions/{competition_id}/`
  - Request: Updated competition details
  - Response: Modified competition information
- `POST /api/competitions/{competition_id}/add_player/`
  - Request: Player to add
  - Response: Updated participant list
- `DELETE /api/competitions/{competition_id}/remove_player/`
  - Request: Player to remove
  - Response: Updated participant list
- `POST /api/competitions/{competition_id}/replace_player/`
  - Request: Players to swap
  - Response: Updated participant list
- `DELETE /api/competitions/{competition_id}/delete_schedule/`
  - Response: Confirmation of schedule deletion
- `POST /api/competitions/{competition_id}/start_competition/`
  - Response: Competition status update

### Competition Scoring
**Overview:**
System for recording and tracking scores during a competition.

**Frontend Route:** `/competition/scoring`

**Features:**
- Input scores for each player
- Real-time score updates
- Score validation and error handling
- Score history and tracking

**Access Requirements:**
- View scores: All club members
- Input/update scores: Club admins, members with leadership role, designated scorekeepers
- Delete/modify submitted scores: Club admins, competition creators
- Export score data: Club admins, members with leadership role

**Underlying API Calls:**
- `GET /api/game-scores/`
  - Request: Filter by competition
  - Response: All scores for the competition
- `POST /api/game-scores/`
  - Request: New score details
  - Response: Created score record
- `PATCH /api/game-scores/{score_id}/`
  - Request: Updated score information
  - Response: Modified score record
- `DELETE /api/game-scores/{score_id}/`
  - Response: Confirmation of score deletion

### Competition Results
**Overview:**
Displays competition results, including rankings and statistics.

**Frontend Route:** `/competition/results`

**Features:**
- Final rankings and positions
- Detailed player statistics
- Score comparisons
- Historical performance data

**Access Requirements:**
- View results: All club members
- Generate detailed reports: Club admins, members with leadership role
- Export results: Club admins, members with leadership role

**Underlying API Calls:**
- `GET /api/competitions/{competition_id}/`
  - Response: Competition data including results
- `GET /api/player-stats/{competition_id}/`
  - Response: Detailed player statistics for the competition

## 5. Player Profiles

**Overview:**
Personal profiles for all bowlers in the system.

**Frontend Route:** `/profile` (own profile), `/bowlers/{user_id}` (other profiles)

**Features:**
- User information and statistics
- Performance history
- Club memberships
- Profile editing capabilities

**Access Requirements:**
- View own profile: All authenticated users
- Edit own profile: All authenticated users
- View other profiles: All club members (for members of same club)
- Edit other profiles: Club admins (limited to members of their club)
- View comprehensive statistics: Profile owner, club admins

**Underlying API Calls:**
- `GET /api/users/{user_id}/`
  - Response: User profile information
- `PATCH /api/users/{user_id}/`
  - Request: Updated profile information
  - Response: Modified profile data
- `GET /api/game-scores/`
  - Request: Filter by user
  - Response: User's game history

## 6. Leagues

**Overview:**
Management system for bowling leagues.

**Frontend Route:** `/leagues`

**Features:**
- League creation and management
- League membership handling
- League schedules and results
- Player name mappings across leagues

**Access Requirements:**
- View leagues: All club members
- Create leagues: Club admins, members with leadership role
- Edit league details: League creators, club admins
- Manage league members: League creators, club admins
- View league statistics: All club members
- Edit player name mappings: Club admins, league administrators

**Underlying API Calls:**
- `GET /api/leagues/`
  - Response: List of leagues
- `POST /api/leagues/`
  - Request: New league details
  - Response: Created league data
- `PATCH /api/leagues/{league_id}/`
  - Request: Updated league information
  - Response: Modified league data
- `GET /api/league-members/`
  - Request: Filter by league
  - Response: List of league members
- `POST /api/league-members/`
  - Request: Member to add
  - Response: Added member data
- `GET /api/player-stats/{league_id}/`
  - Response: League statistics

## 7. Social Features

### Noticeboard
**Overview:**
Social space for club announcements and community interaction.

**Frontend Route:** `/noticeboard`

**Features:**
- Club announcements and notices
- Event promotions
- Commenting and interaction
- Image uploads

**Access Requirements:**
- View noticeboard: All club members
- Create announcements: Club admins, members with leadership role
- Edit announcements: Post creators, club admins
- Delete announcements: Post creators, club admins
- Comment on posts: All club members
- Upload images: All club members (with potential size/quantity limits)
- Pin important notices: Club admins

**Underlying API Calls:**
- `GET /api/notices/`
  - Response: List of notices/announcements
- `POST /api/notices/`
  - Request: New notice content
  - Response: Created notice data
- `PATCH /api/notices/{notice_id}/`
  - Request: Updated notice content
  - Response: Modified notice data
- `DELETE /api/notices/{notice_id}/`
  - Response: Confirmation of deletion

### Messaging
**Overview:**
Private messaging system between users.

**Frontend Route:** `/messaging`

**Features:**
- One-on-one messaging
- Group chats
- Message history
- Notifications for new messages

**Access Requirements:**
- Access messaging: All authenticated users
- Create one-on-one chats: All authenticated users
- Create group chats: All authenticated users
- Add members to group chats: Chat creators, designated chat admins
- Remove members from group chats: Chat creators, designated chat admins
- Delete messages: Message senders, chat admins (their own messages only)
- Delete entire conversations: Both/all participants must agree

**Underlying API Calls:**
- `GET /api/chats/`
  - Response: List of user's chats
- `POST /api/chats/`
  - Request: New chat details
  - Response: Created chat data
- `GET /api/chats/{chat_id}/messages/`
  - Response: Messages in the chat
- `POST /api/messages/`
  - Request: New message content
  - Response: Sent message data
- `POST /api/read-message/{message_id}/`
  - Response: Message marked as read
- `GET /api/unread-count/`
  - Response: Count of unread messages
- `GET /api/search-users/`
  - Request: Search parameters
  - Response: Users matching search criteria

## 8. Games and Scoring

**Overview:**
System for tracking individual game scores outside of competitions.

**Frontend Route:** `/games`

**Features:**
- Record game scores
- Track performance over time
- Statistical analysis of game data
- Score history

**Access Requirements:**
- Record own scores: All authenticated users
- View own score history: All authenticated users
- Edit own scores: All authenticated users (potentially with time restrictions)
- View club member scores: All club members
- Generate statistical reports: Profile owner, club admins
- Export score data: Profile owner, club admins

**Underlying API Calls:**
- `GET /api/game-scores/`
  - Request: Filter parameters
  - Response: Game scores based on filters
- `POST /api/game-scores/`
  - Request: New score details
  - Response: Created score record
- `PATCH /api/game-scores/{score_id}/`
  - Request: Updated score information
  - Response: Modified score record
- `DELETE /api/game-scores/{score_id}/`
  - Response: Confirmation of score deletion

## 9. Admin Interface

**Overview:**
Administrative tools for system management.

**Frontend Route:** `/admin`

**Features:**
- User management
- Club oversight
- System configuration
- Access control

**Access Requirements:**
- Access admin interface: is_staff users
- User management functions: is_staff users
- Club oversight tools: is_staff users
- System configuration: is_staff users
- Access control management: is_staff users
- View system logs: is_staff users

**Underlying API Calls:**
- `GET /api/admin/*`
  - Various admin-specific endpoints
- `GET /api/log/page-view/`
  - Analytics and logging data
- `GET /api/schema/`
  - API schema information
- `GET /api/docs/`
  - API documentation

## 10. Help and Support

**Overview:**
Documentation and support resources for users.

**Frontend Route:** `/help`

**Features:**
- User guides and documentation
- FAQs
- Contact information for support
- Troubleshooting resources

**Access Requirements:**
- View help documentation: All users
- Access FAQs: All users
- Contact support: All authenticated users
- Access advanced troubleshooting: Club admins, is_staff users
- Update help documentation: is_staff users

**Underlying API Calls:**
- Primarily static content with minimal API requirements

## 11. Future Enhancements & Roadmap

**Near-term Enhancements (0-3 months):**
- Mobile responsive design optimization
- Enhanced statistics and performance analytics
- Improved competition scheduling system
- Expanded notification capabilities and preferences

**Mid-term Goals (3-6 months):**
- Integration with external bowling scoring systems
- Advanced tournament management features
- Enhanced social features including photo sharing
- Performance optimization and scalability improvements

**Long-term Vision (6+ months):**
- Mobile application development
- AI-powered scoring and performance predictions
- Live competition updates and streaming capabilities
- Integration with bowling venue management systems
- International localization and multi-language support

## 12. Non-Functional Requirements (NFRs)

**Performance:**
- Page load times should not exceed 2 seconds
- API response times should be under 500ms for 95% of requests
- System should handle at least 1000 concurrent users without degradation

**Security:**
- All communication must use HTTPS
- Password storage must use strong hashing algorithms
- Regular security audits and penetration testing
- GDPR and data privacy compliance

**Availability:**
- System uptime target of 99.9%
- Scheduled maintenance windows outside of peak usage hours
- Automatic monitoring and alerting for system issues

**Scalability:**
- Horizontal scaling capability for handling growth
- Database design optimized for future expansion
- Efficient caching mechanisms

**Usability:**
- Intuitive user interface requiring minimal training
- Responsive design for all device types
- Accessibility compliance with WCAG 2.1 AA standards
- Clear error messaging and recovery paths

**Maintainability:**
- Comprehensive test coverage
- Consistent coding standards and documentation
- Modular architecture supporting easy feature additions
- Automated deployment and testing processes

## 13. Access Summary

This section provides a consolidated view of the permissions and access rights for each role in the system.

### Role Definitions

- **All Users**: Unauthenticated users who have not logged in
- **Normal Club Members**: Basic authenticated users who belong to a club
- **Club Members with Leadership**: Club members who have been assigned leadership privileges
- **Club Admins**: Users with administrative privileges for a specific club
- **is_staff Users**: System administrators with global privileges

### Permissions Matrix

| Feature | All Users | Normal Club Members | Club Members with Leadership | Club Admins | is_staff Users |
|---------|:---------:|:-------------------:|:----------------------------:|:-----------:|:--------------:|
| **Authentication & Onboarding** |||||
| Login/Logout | ✅ | ✅ | ✅ | ✅ | ✅ |
| Reset Password | ✅ | ✅ | ✅ | ✅ | ✅ |
| **Dashboard & Navigation** |||||
| View Dashboard | ❌ | ✅ | ✅ | ✅ | ✅ |
| View Administrative Alerts | ❌ | ❌ | ✅ | ✅ | ✅ |
| **Club Management** |||||
| View Club List | ❌ | ✅ | ✅ | ✅ | ✅ |
| Create New Club | ❌ | ✅ | ✅ | ✅ | ✅ |
| View Club Details | ❌ | ✅ | ✅ | ✅ | ✅ |
| Edit Club Information | ❌ | ❌ | ✅ | ✅ | ✅ |
| View Sensitive Club Statistics | ❌ | ❌ | ✅ | ✅ | ✅ |
| View Member List | ❌ | ✅ | ✅ | ✅ | ✅ |
| Add New Members | ❌ | ❌ | ✅ | ✅ | ✅ |
| Remove Members | ❌ | ❌ | ❌ | ✅ | ✅ |
| Modify Member Roles | ❌ | ❌ | ❌ | ✅ | ✅ |
| Promote to Admin | ❌ | ❌ | ❌ | ✅ | ✅ |
| Advanced Club Configuration | ❌ | ❌ | ❌ | ❌ | ✅ |
| **Competition Management** |||||
| View Competitions | ❌ | ✅ | ✅ | ✅ | ✅ |
| Create Competition | ❌ | ❌ | ✅ | ✅ | ✅ |
| Edit Competition Details | ❌ | ❌ | ✅* | ✅ | ✅ |
| Manage Competition Participants | ❌ | ❌ | ✅* | ✅ | ✅ |
| Update Competition Schedule | ❌ | ❌ | ✅* | ✅ | ✅ |
| Cancel Competition | ❌ | ❌ | ✅* | ✅ | ✅ |
| View Scores | ❌ | ✅ | ✅ | ✅ | ✅ |
| Input/Update Scores | ❌ | ❌ | ✅ | ✅ | ✅ |
| Delete/Modify Submitted Scores | ❌ | ❌ | ❌ | ✅ | ✅ |
| Export Score Data | ❌ | ❌ | ✅ | ✅ | ✅ |
| Generate Detailed Reports | ❌ | ❌ | ✅ | ✅ | ✅ |
| **Player Profiles** |||||
| View Own Profile | ❌ | ✅ | ✅ | ✅ | ✅ |
| Edit Own Profile | ❌ | ✅ | ✅ | ✅ | ✅ |
| View Other Profiles (Same Club) | ❌ | ✅ | ✅ | ✅ | ✅ |
| Edit Other Profiles | ❌ | ❌ | ❌ | ✅ | ✅ |
| View Comprehensive Statistics | ❌ | ❌ | ❌ | ✅ | ✅ |
| **Leagues** |||||
| View Leagues | ❌ | ✅ | ✅ | ✅ | ✅ |
| Create League | ❌ | ❌ | ✅ | ✅ | ✅ |
| Edit League Details | ❌ | ❌ | ✅* | ✅ | ✅ |
| Manage League Members | ❌ | ❌ | ✅* | ✅ | ✅ |
| Edit Player Name Mappings | ❌ | ❌ | ✅* | ✅ | ✅ |
| **Social Features** |||||
| View Noticeboard | ❌ | ✅ | ✅ | ✅ | ✅ |
| Create Announcements | ❌ | ❌ | ✅ | ✅ | ✅ |
| Edit Announcements | ❌ | ❌ | ✅* | ✅ | ✅ |
| Delete Announcements | ❌ | ❌ | ✅* | ✅ | ✅ |
| Comment on Posts | ❌ | ✅ | ✅ | ✅ | ✅ |
| Upload Images | ❌ | ✅ | ✅ | ✅ | ✅ |
| Pin Important Notices | ❌ | ❌ | ❌ | ✅ | ✅ |
| Access Messaging | ❌ | ✅ | ✅ | ✅ | ✅ |
| Create Individual/Group Chats | ❌ | ✅ | ✅ | ✅ | ✅ |
| Manage Chat Members | ❌ | ✅† | ✅† | ✅† | ✅† |
| Delete Messages | ❌ | ✅‡ | ✅‡ | ✅‡ | ✅‡ |
| **Games and Scoring** |||||
| Record Own Scores | ❌ | ✅ | ✅ | ✅ | ✅ |
| View Own Score History | ❌ | ✅ | ✅ | ✅ | ✅ |
| Edit Own Scores | ❌ | ✅ | ✅ | ✅ | ✅ |
| View Club Member Scores | ❌ | ✅ | ✅ | ✅ | ✅ |
| Generate Statistical Reports | ❌ | ❌ | ❌ | ✅ | ✅ |
| Export Score Data | ❌ | ❌ | ❌ | ✅ | ✅ |
| **Administration** |||||
| Access Admin Interface | ❌ | ❌ | ❌ | ❌ | ✅ |
| User Management | ❌ | ❌ | ❌ | ❌ | ✅ |
| Club Oversight | ❌ | ❌ | ❌ | ❌ | ✅ |
| System Configuration | ❌ | ❌ | ❌ | ❌ | ✅ |
| View System Logs | ❌ | ❌ | ❌ | ❌ | ✅ |
| **Help and Support** |||||
| View Help Documentation | ✅ | ✅ | ✅ | ✅ | ✅ |
| Access FAQs | ✅ | ✅ | ✅ | ✅ | ✅ |
| Contact Support | ❌ | ✅ | ✅ | ✅ | ✅ |
| Access Advanced Troubleshooting | ❌ | ❌ | ❌ | ✅ | ✅ |
| Update Help Documentation | ❌ | ❌ | ❌ | ❌ | ✅ |

\* Only if they are the creator of the entity  
† Only for chats where they are the creator or designated admin  
‡ Users can only delete their own messages
