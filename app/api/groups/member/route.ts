import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import db from "@/lib/db";
import { authOptions } from "../../auth/[...nextauth]/route";

export async function GET() {
  const session = await getServerSession(authOptions);
  
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const userGroups = await db.query(`
      SELECT g.* 
      FROM groups g
      INNER JOIN group_members gm ON g.id = gm.group_id
      WHERE gm.user_id = $1
      ORDER BY g.is_primary DESC, g.created_at DESC
    `, [session.user.id]);

    return NextResponse.json(userGroups.rows);
  } catch (error) {
    console.error('Error fetching user groups:', error);
    return NextResponse.json({ error: "Failed to fetch groups" }, { status: 500 });
  }
} 