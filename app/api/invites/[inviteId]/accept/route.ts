import { getServerSession } from "next-auth";
import { NextResponse } from 'next/server';
import db from '@/lib/db';
import { authOptions } from "@/app/api/auth/[...nextauth]/route";

export async function POST(
  request: Request,
  { params }: { params: { inviteId: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if invite exists and hasn't expired
    const inviteResult = await db.query(
      `SELECT group_id 
       FROM group_invites 
       WHERE id = $1 
       AND expires_at > NOW()`,
      [params.inviteId]
    );

    if (inviteResult.rows.length === 0) {
      return NextResponse.json({ error: 'Invalid or expired invite' }, { status: 404 });
    }

    const groupId = inviteResult.rows[0].group_id;

    // Check if user is already a member
    const memberCheck = await db.query(
      'SELECT 1 FROM group_members WHERE group_id = $1 AND user_id = $2',
      [groupId, session.user.id]
    );

    if (memberCheck.rows.length > 0) {
      return NextResponse.json({ error: 'Already a member of this group' }, { status: 400 });
    }

    // Add user to group
    await db.query(
      'INSERT INTO group_members (user_id, group_id) VALUES ($1, $2)',
      [session.user.id, groupId]
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error joining group:', error);
    return NextResponse.json({ error: 'Error joining group' }, { status: 500 });
  }
} 