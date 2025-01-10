/** User record in the database
 * @property {string} username - Unique username
 * @property {string} email - Unique email address
 * @property {string} password - Hashed password
 */
export type DBUser = {
    id: string;                    // PRIMARY KEY UUID
    name: string | null;          
    username: string;              // UNIQUE NOT NULL
    email: string;                 // UNIQUE NOT NULL
    password: string;              // NOT NULL
    created_at: string;            // TIMESTAMP WITH TIME ZONE
    updated_at: string;            // TIMESTAMP WITH TIME ZONE
    last_seen: Date;
    status: string | null;
  }
  
  /** Message record in the database
   * @property {string} sender_id - References users(id)
   * @property {string | null} receiver_id - References users(id), null for group messages
   * @property {string | null} group_id - References groups(id), null for direct messages
   */
  export type DBMessage = {
    id: string;                    // PRIMARY KEY UUID
    content: string;               // NOT NULL
    created_at: string;            // TIMESTAMP WITH TIME ZONE
    sender_id: string;             // FOREIGN KEY
    receiver_id: string | null;    // FOREIGN KEY
    group_id: string | null;       // FOREIGN KEY
  }
  
  /** Group record in the database
   * @property {boolean} is_primary - Only one group can have is_primary=true
   */
  export type DBGroup = {
    id: string;                    // PRIMARY KEY UUID
    name: string;                  // NOT NULL
    created_at: string;            // TIMESTAMP WITH TIME ZONE
    is_primary: boolean;           // Constrained by single_primary_group
  }
  
  /** Group membership record in the database
   * @property {string} user_id - Part of composite UNIQUE constraint with group_id
   * @property {string} group_id - Part of composite UNIQUE constraint with user_id
   */
  export type DBGroupMember = {
    id: string;                    // PRIMARY KEY UUID
    user_id: string;               // FOREIGN KEY
    group_id: string;              // FOREIGN KEY
    joined_at: string;             // TIMESTAMP WITH TIME ZONE
  }
  
  // Frontend-specific types that extend the database types
  export type SafeUser = Omit<DBUser, 'password' | 'email'>;
  
  export type Conversation = {
    id: string;
    type: 'group' | 'direct';
    name: string;
  }

  export type AutoStatus = 'online' | 'away' | 'dnd' | 'offline';

  export interface UserDevice {
    id: string;
    lastActive: string;
    userAgent: string;
  }

  export interface UserStatus {
    userId: string;
    manualStatus?: string | null;
    autoStatus: AutoStatus;
    invisible: boolean;
    lastSeen: string;
    devices: UserDevice[];
  }

  export interface EffectiveStatus {
    userId: string;
    status: string;
    isOnline: boolean;
    lastSeen: string;
  }