# API Routes Documentation

## Authentication
- `POST /api/auth/[...nextauth]` - NextAuth.js authentication handler
  - Handles login/logout and session management
  - Uses credentials provider with email/password
  - Returns JWT with user id, name, and username

- `POST /api/signup`
  - Creates new user account
  - Auto-joins default group
  - Validates username uniqueness and password strength

## Groups
- `GET /api/groups`
  - Lists all groups, sorted by primary status and creation date

- `GET /api/groups/[id]`
  - Returns group details and member list

- `GET /api/groups/[id]/members`
  - Lists all members of a specific group

- `GET /api/groups/[id]/messages`
  - Retrieves last 50 messages for group
  - Includes sender details
- `POST /api/groups/[id]/messages`
  - Creates new group message

## Messages
- `GET /api/messages`
  - Fetches messages filtered by:
    - `groupId` - Group messages
    - `userId` - Direct messages
  - Returns last 50 messages with sender/receiver details

- `POST /api/messages`
  - Creates new message
  - Supports both group and direct messages
  - Requires either groupId or receiverId

- `GET /api/messages/contacts`
  - Lists unique users who have exchanged messages with current user

## Users
- `GET /api/users`
  - Lists all users except current user
  - Returns safe user data (id, name, username)

## Security
- All routes require authentication except:
  - `/api/auth/[...nextauth]`
  - `/api/signup`
- Uses NextAuth.js session validation
- Password hashing with bcrypt 

## Invites
- `GET /api/invites/[inviteId]` - Get invite information
  - Returns group name for valid invites
  - Checks expiration and usage limits

- `POST /api/invites/[inviteId]/accept` - Accept an invite and join group
  - Requires authentication
  - Validates invite before joining
  - Prevents duplicate memberships

- `POST /api/groups/[id]/invites` - Create new invite for a group
  - Requires authentication
  - Validates group membership
  - Returns invite ID for sharing