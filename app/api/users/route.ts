import { getServerSession } from "next-auth";
import { NextResponse } from 'next/server';
import db from '../../../lib/db';
import { authOptions } from "../auth/[...nextauth]/route";

export async function GET(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    console.log(session, "Session")
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const result = await db.query('SELECT id, name, username FROM users WHERE id != $1', [session.user.id]);
    return NextResponse.json(result.rows);
  } catch (error) {
    console.error('Error fetching users:', error);
    return NextResponse.json({ error: 'Error fetching users' }, { status: 500 });
  }
}

