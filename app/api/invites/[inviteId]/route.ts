import { NextResponse } from 'next/server';
import db from '@/lib/db';

export async function GET(
  request: Request,
  { params }: { params: { inviteId: string } }
) {
  try {
    // Validate inviteId format
    if (!/^[a-zA-Z0-9-]+$/.test(params.inviteId)) {
      return NextResponse.json({ error: 'Invalid invite format' }, { status: 400 });
    }

    console.log('Attempting to fetch invite:', params.inviteId);
    const result = await db.query(
      `SELECT g.name as group_name
       FROM group_invites gi
       JOIN groups g ON g.id = gi.group_id
       WHERE gi.id = $1 
       AND gi.expires_at > NOW()`,
      [params.inviteId]
    );

    console.log('Query result:', result);

    if (result.rows.length === 0) {
      return NextResponse.json({ error: 'Invalid or expired invite' }, { status: 404 });
    }

    return NextResponse.json({ groupName: result.rows[0].group_name });
  } catch (error) {
    console.error('Error fetching group info:', error);
    if (error instanceof Error) {
      console.error('Error details:', {
        message: error.message,
        stack: error.stack,
        name: error.name
      });
    }
    return NextResponse.json({ error: 'Error fetching group info' }, { status: 500 });
  }
} 