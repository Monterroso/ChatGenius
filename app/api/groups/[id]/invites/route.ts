import { getServerSession } from "next-auth";
import { NextResponse } from 'next/server';
import db from '@/lib/db';
import { authOptions } from "@/app/api/auth/[...nextauth]/route";

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if user is member of the group
    const memberCheck = await db.query(
      'SELECT 1 FROM group_members WHERE group_id = $1 AND user_id = $2',
      [params.id, session.user.id]
    );

    if (memberCheck.rows.length === 0) {
      return NextResponse.json({ error: 'Not a member of this group' }, { status: 403 });
    }

    // Create or get existing invite
    const result = await db.query(
      `INSERT INTO group_invites (group_id, expires_at)
       VALUES ($1, NOW() + INTERVAL '7 days')
       RETURNING id`,
      [params.id]
    );

    return NextResponse.json({ inviteId: result.rows[0].id });
  } catch (error) {
    console.error('Error creating invite:', error);
    return NextResponse.json({ error: 'Error creating invite' }, { status: 500 });
  }
} 