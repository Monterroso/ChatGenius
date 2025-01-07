import { getServerSession } from "next-auth";
import { NextResponse } from 'next/server';
import db from '../../../../lib/db';
import { authOptions } from "../../auth/[...nextauth]/route";

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const groupId = params.id;

    // Get group details
    const { rows: [group] } = await db.query(
      'SELECT * FROM groups WHERE id = $1',
      [groupId]
    );

    if (!group) {
      return NextResponse.json({ error: 'Group not found' }, { status: 404 });
    }

    // Get group members
    const { rows: members } = await db.query(`
      SELECT u.id, u.name, u.username, gm.joined_at
      FROM group_members gm
      JOIN users u ON gm.user_id = u.id
      WHERE gm.group_id = $1
    `, [groupId]);

    return NextResponse.json({ group, members });
  } catch (error) {
    console.error('Error fetching group:', error);
    return NextResponse.json({ error: 'Error fetching group' }, { status: 500 });
  }
} 