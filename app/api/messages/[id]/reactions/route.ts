import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import db from "@/lib/db";
import { authOptions } from '../../../auth/[...nextauth]/route';

// GET /api/messages/[id]/reactions
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const messageId = params.id;
    if (!messageId) {
      return NextResponse.json(
        { error: "Message ID is required" },
        { status: 400 }
      );
    }

    // Get all reactions for the message with user details
    const reactions = await db.query(
      `SELECT r.*, u.name, u.username 
       FROM reactions r
       JOIN users u ON r.user_id = u.id
       WHERE r.message_id = $1
       ORDER BY r.created_at ASC`,
      [messageId]
    );

    // Group reactions by emoji
    const groupedReactions = reactions.rows.reduce((acc, reaction) => {
      const { emoji, user_id, name, username } = reaction;
      if (!acc[emoji]) {
        acc[emoji] = [];
      }
      acc[emoji].push({ userId: user_id, name, username });
      return acc;
    }, {} as Record<string, Array<{ userId: string; name: string; username: string }>>);

    return NextResponse.json({ reactions: groupedReactions });
  } catch (error) {
    console.error("Error fetching reactions:", error);
    return NextResponse.json(
      { error: "Failed to fetch reactions" },
      { status: 500 }
    );
  }
} 