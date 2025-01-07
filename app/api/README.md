# API Routes Documentation

## Authentication
- `POST /api/auth/[...nextauth]` - NextAuth.js authentication handler
  - Handles login/logout and session management
  - Uses credentials provider with email/password
  - Returns JWT with user id, name, and username

- `POST /api/signup`
  - Creates new user account
  - Validates:
    - Username uniqueness
    - Email uniqueness
    - Name length (max 15 characters)
    - Password strength (min 8 characters)
  - Auto-creates default group if not exists
  - Auto-joins user to default group
  - Returns user ID on success

## Groups
- `GET /api/groups`
  - Lists all groups
  - Sorted by primary status and creation date
  - Requires authentication

- `POST /api/groups`
  - Creates new group
  - Requires authentication
  - Auto-adds creator as first member
  - Returns group details

- `GET /api/groups/member`
  - Lists all groups the authenticated user is a member of
  - Sorted by primary status and creation date
  - Requires authentication

- `GET /api/groups/[id]`
  - Returns group details and member list
  - Includes member join dates
  - Requires authentication

- `GET /api/groups/[id]/members`
  - Lists all members of a specific group
  - Returns user_id and group_id pairs
  - Requires authentication

- `GET /api/groups/[id]/messages`
  - Retrieves last 50 messages for group
  - Includes sender details (name, username)
  - Sorted by creation date
  - Requires authentication

- `POST /api/groups/[id]/messages`
  - Creates new group message
  - Requires authentication
  - Returns created message details

## Messages
- `GET /api/messages`
  - Fetches messages filtered by:
    - `groupId` - Group messages
    - `userId` - Direct messages
  - Returns last 50 messages with sender/receiver details
  - Requires authentication

- `POST /api/messages`
  - Creates new message
  - Supports both group and direct messages
  - Requires either groupId or receiverId (not both)
  - Requires authentication

- `GET /api/messages/contacts`
  - Lists unique users who have exchanged messages with current user
  - Returns user IDs
  - Requires authentication

## Users
- `GET /api/users`
  - Lists all users except current user
  - Returns safe user data (id, name, username)
  - Requires authentication

## Invites
- `GET /api/invites/[inviteId]`
  - Get invite information
  - Returns group name for valid invites
  - Validates invite format
  - Checks expiration
  - No authentication required

- `POST /api/invites/[inviteId]/accept`
  - Accept an invite and join group
  - Requires authentication
  - Validates invite expiration
  - Prevents duplicate memberships

- `POST /api/groups/[id]/invites`
  - Create new invite for a group
  - Requires authentication
  - Validates group membership
  - Sets 7-day expiration
  - Returns invite ID for sharing

## Security
- All routes require authentication except:
  - `/api/auth/[...nextauth]`
  - `/api/signup`
  - `/api/invites/[inviteId]` (GET only)
- Uses NextAuth.js session validation
- Password hashing with bcrypt
- SQL injection protection via parameterized queries