import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import db from '../../../lib/db';

const DEFAULT_GROUP_NAME = process.env.DEFAULT_GROUP_NAME || 'general';

export async function POST(req: Request) {
  const { name, username, email, password } = await req.json();

  try {
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

    await db.query('BEGIN');

    // Insert the new user
    const userResult = await db.query(
      'INSERT INTO users (name, username, email, password) VALUES ($1, $2, $3, $4) RETURNING id',
      [name, username, email, hashedPassword]
    );
    
    // Find the primary group
    const primaryGroup = await db.query(
      'SELECT id FROM groups WHERE is_primary = TRUE'
    );
    
    if (primaryGroup.rows.length === 0) {
      await db.query('ROLLBACK');
      return NextResponse.json(
        { error: 'No primary group found in the system' },
        { status: 500 }
      );
    }

    // Add user to the primary group
    await db.query(
      'INSERT INTO group_members (user_id, group_id) VALUES ($1, $2)',
      [userResult.rows[0].id, primaryGroup.rows[0].id]
    );

    await db.query('COMMIT');

    return NextResponse.json({ message: 'User created successfully', userId: userResult.rows[0].id }, { status: 201 });
  } catch (error) {
    await db.query('ROLLBACK');
    console.error('Error creating user:', error);
    return NextResponse.json({ error: 'Error creating user' }, { status: 500 });
  }
}

