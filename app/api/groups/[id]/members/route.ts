import { getServerSession } from "next-auth";
import { NextResponse } from 'next/server';
import db from '../../../../../lib/db';
import { authOptions } from "../../../auth/[...nextauth]/route";

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const id = params.id;

    // Get group members
    const { rows: members } = await db.query(
      `SELECT user_id, group_id 
       FROM group_members 
       WHERE group_id = $1`,
      [id]
    );

    return NextResponse.json(members);
  } catch (error) {
    console.error('Error fetching group members:', error);
    return NextResponse.json(
      { error: 'Failed to fetch group members' },
      { status: 500 }
    );
  }
} 