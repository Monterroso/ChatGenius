import { getServerSession } from "next-auth";
import { NextResponse } from 'next/server';
import db from '../../../lib/db';
import { authOptions } from "../auth/[...nextauth]/route";

export async function GET() {
  try {
    const session = await getServerSession(authOptions);

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const result = await db.query(
      'SELECT id, name, created_at FROM groups ORDER BY is_primary DESC, created_at DESC'
    );
    return NextResponse.json(result.rows);
  } catch (error) {
    console.error('Error fetching groups:', error);
    return NextResponse.json({ error: 'Error fetching groups' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { name } = await request.json();

    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return NextResponse.json({ error: 'Group name is required' }, { status: 400 });
    }

    // Create the group
    const groupResult = await db.query(
      'INSERT INTO groups (name) VALUES ($1) RETURNING id, name, created_at',
      [name.trim()]
    );
    
    // Add the creator as the first member
    await db.query(
      'INSERT INTO group_members (user_id, group_id) VALUES ($1, $2)',
      [session.user.id, groupResult.rows[0].id]
    );

    return NextResponse.json(groupResult.rows[0]);
  } catch (error) {
    console.error('Error creating group:', error);
    return NextResponse.json({ error: 'Error creating group' }, { status: 500 });
  }
} 