# Database Schema Documentation

## Tables Overview

### Users
Primary user account information storage
- `id`: UUID (Primary Key, auto-generated)
- `name`: VARCHAR(255) - User's full name
- `username`: VARCHAR(255) (Unique) - Unique username for login
- `email`: VARCHAR(255) (Unique) - User's email address
- `password`: VARCHAR(255) - Hashed password
- `created_at`: TIMESTAMP WITH TIME ZONE - Account creation timestamp
- `updated_at`: TIMESTAMP WITH TIME ZONE - Last update timestamp

### User Status
Tracks user presence and status information
- `user_id`: UUID (Primary Key, references users.id)
- `manual_status`: TEXT - User-defined status message
- `auto_status`: TEXT - System status (Enum: 'online', 'away', 'dnd', 'offline')
- `invisible`: BOOLEAN - Whether user appears offline to others (Default: false)
- `last_seen`: TIMESTAMP WITH TIME ZONE - Last activity timestamp
- `devices`: JSONB - Connected devices information (Default: '[]')
- `created_at`: TIMESTAMP WITH TIME ZONE
- `updated_at`: TIMESTAMP WITH TIME ZONE

### User Moods
Stores user mood information
- `id`: UUID (Primary Key, auto-generated)
- `user_id`: UUID (references users.id, Unique)
- `mood`: TEXT - User's current mood
- `created_at`: TIMESTAMP WITH TIME ZONE
- `updated_at`: TIMESTAMP WITH TIME ZONE

### Groups
Manages chat groups/rooms
- `id`: UUID (Primary Key, auto-generated)
- `name`: VARCHAR(255) - Group name
- `created_at`: TIMESTAMP WITH TIME ZONE
- `is_primary`: BOOLEAN - Indicates if this is a primary group (Default: false)

### Messages
Stores all chat messages
- `id`: UUID (Primary Key, auto-generated)
- `content`: TEXT - Message content
- `created_at`: TIMESTAMP WITH TIME ZONE
- `sender_id`: UUID (references users.id)
- `receiver_id`: UUID (references users.id) - For direct messages
- `group_id`: UUID (references groups.id) - For group messages

### Group Members
Manages group membership
- `id`: UUID (Primary Key, auto-generated)
- `user_id`: UUID (references users.id)
- `group_id`: UUID (references groups.id)
- `joined_at`: TIMESTAMP WITH TIME ZONE
- Unique constraint on (user_id, group_id)

### Group Invites
Handles group invitation system
- `id`: UUID (Primary Key, auto-generated)
- `group_id`: UUID (references groups.id)
- `created_at`: TIMESTAMP WITH TIME ZONE
- `expires_at`: TIMESTAMP WITH TIME ZONE

### Files
Stores metadata for uploaded files
- `id`: UUID (Primary Key, auto-generated)
- `group_id`: UUID (Foreign Key) - References the group the file is shared with
- `receiver_id`: UUID (Foreign Key) - References the user the file is sent to in direct messages
- `uploader_id`: UUID (Foreign Key) - References the user who uploaded the file
- `filename`: VARCHAR(255) - Name of the file
- `filepath`: VARCHAR(255) - Path to the file in storage
- `filetype`: VARCHAR(50) - MIME type of the file
- `filesize`: BIGINT - Size of the file in bytes
- `uploaded_at`: TIMESTAMP WITH TIME ZONE - Time the file was uploaded
- `created_at`: TIMESTAMP WITH TIME ZONE - Record creation timestamp
- `updated_at`: TIMESTAMP WITH TIME ZONE - Last update timestamp

#### Constraints
- Either `group_id` or `receiver_id` must be set, but not both.

## Special Features

### Automatic Timestamp Management
- Trigger `