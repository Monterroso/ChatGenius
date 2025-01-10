# Database Schema Documentation

## Tables Overview

### Users
Stores user account information
- `id`: UUID (Primary Key)
- `name`: VARCHAR(255)
- `username`: VARCHAR(255) (Unique)
- `email`: VARCHAR(255) (Unique)
- `password`: VARCHAR(255)
- `created_at`: TIMESTAMP
- `updated_at`: TIMESTAMP

### User Status
Tracks user presence and status information
- `user_id`: UUID (Primary Key, references users.id)
- `manual_status`: TEXT (User-set status message)
- `auto_status`: TEXT (System-determined status: online/offline/away)
- `invisible`: BOOLEAN (Whether user appears offline to others)
- `last_seen`: TIMESTAMP
- `devices`: JSONB (Connected devices information)
- `updated_at`: TIMESTAMP

### Groups
Manages chat groups
- `id`: UUID (Primary Key)
- `name`: VARCHAR(255)
- `created_at`: TIMESTAMP
- `is_primary`: BOOLEAN (Only one group can be primary)

### Messages
Stores chat messages
- `id`: UUID (Primary Key)
- `content`: TEXT
- `created_at`: TIMESTAMP
- `sender_id`: UUID (references users.id)
- `receiver_id`: UUID (references users.id)
- `group_id`: UUID (references groups.id)

### Group Members
Tracks group membership
- `id`: UUID (Primary Key)
- `user_id`: UUID (references users.id)
- `group_id`: UUID (references groups.id)
- `joined_at`: TIMESTAMP
- Unique constraint on (user_id, group_id)

### Group Invites
Manages invitations to groups
- `id`: UUID (Primary Key)
- `group_id`: UUID (references groups.id)
- `created_at`: TIMESTAMP
- `expires_at`: TIMESTAMP

## Special Features

### Automatic Timestamp Updates
- User status updates automatically track `last_seen` and `updated_at`
- Trigger `update_user_status_timestamp` handles this automatically

### Invite Cleanup
- Function `cleanup_expired_invites()` removes expired group invites

### Primary Group Constraint
- Only one group can be marked as primary using a unique index

### Device Tracking
- The `devices` JSONB field in user_status allows tracking multiple sessions/devices per user
- Useful for managing websocket connections across different browsers/devices

## Common Status Values

### Auto Status
- "online"
- "offline"
- "away"
- "idle"

### Manual Status
- Custom text set by user
- Can be null 