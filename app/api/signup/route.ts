import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import db from '@/lib/db';

const DEFAULT_GROUP_NAME = process.env.DEFAULT_GROUP_NAME || 'general';

// Helper function to ensure primary group exists
async function ensurePrimaryGroupExists() {
  const primaryGroup = await db.query(
    'SELECT id FROM groups WHERE is_primary = TRUE',
    []
  );

  if (primaryGroup.rows.length === 0) {
    // Create the primary group if it doesn't exist
    const newPrimaryGroup = await db.query(
      'INSERT INTO groups (name, is_primary) VALUES ($1, TRUE) RETURNING id',
      [DEFAULT_GROUP_NAME]
    );
    return newPrimaryGroup.rows[0].id;
  }
  
  return primaryGroup.rows[0].id;
}

export async function POST(req: Request) {
  try {
    const { name, username, email, password } = await req.json();

    // Validate input exists
    if (!name || !username || !email || !password) {
      return NextResponse.json(
        { error: 'All fields are required' },
        { status: 400 }
      );
    }

    // Validate name length (maximum 15 characters)
    if (name.length > 15) {
      return NextResponse.json(
        { error: 'Name must not exceed 15 characters' },
        { status: 400 }
      );
    }

    // Check if email already exists
    const existingEmail = await db.query(
      'SELECT * FROM users WHERE email = $1',
      [email]
    );

    if (existingEmail.rows.length > 0) {
      return NextResponse.json(
        { error: 'This email address is already registered' },
        { status: 400 }
      );
    }

    // Check if username already exists
    const existingUsername = await db.query(
      'SELECT * FROM users WHERE username = $1',
      [username]
    );

    if (existingUsername.rows.length > 0) {
      return NextResponse.json(
        { error: 'This username is already taken' },
        { status: 400 }
      );
    }

    // Validate password strength (minimum 8 characters)
    if (password.length < 8) {
      return NextResponse.json(
        { error: 'Password must be at least 8 characters long' },
        { status: 400 }
      );
    }

    // Hash the password and create user
    const hashedPassword = await bcrypt.hash(password, 10);

    await db.query('BEGIN', []);

    // Ensure primary group exists before creating user
    const primaryGroupId = await ensurePrimaryGroupExists();

    // Insert the new user
    const userResult = await db.query(
      'INSERT INTO users (name, username, email, password) VALUES ($1, $2, $3, $4) RETURNING id',
      [name, username, email, hashedPassword]
    );

    // Add user to the primary group
    await db.query(
      'INSERT INTO group_members (user_id, group_id) VALUES ($1, $2)',
      [userResult.rows[0].id, primaryGroupId]
    );

    // Create initial status record for the user
    await db.query(
      'INSERT INTO user_status (user_id) VALUES ($1)',
      [userResult.rows[0].id]
    );

    await db.query('COMMIT', []);

    return NextResponse.json({ 
      message: 'User created successfully', 
      userId: userResult.rows[0].id 
    }, { status: 201 });

  } catch (error) {
    await db.query('ROLLBACK', []);
    console.error('Error creating user:', error);
    
    // More specific error messages
    if (error instanceof Error) {
      return NextResponse.json({ 
        error: 'Error creating user', 
        details: error.message 
      }, { status: 500 });
    }
    
    return NextResponse.json({ 
      error: 'Error creating user' 
    }, { status: 500 });
  }
}

