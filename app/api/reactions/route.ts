import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import db from "@/lib/db";
import { authOptions } from '../auth/[...nextauth]/route';

// POST /api/reactions - Add a reaction
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { messageId, emoji } = await req.json();
    if (!messageId || !emoji) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    // Check if message exists and is not deleted
    const message = await db.query(
      "SELECT id FROM messages WHERE id = $1 AND deleted_at IS NULL",
      [messageId]
    );
    if (!message.rows.length) {
      return NextResponse.json(
        { error: "Message not found or deleted" },
        { status: 404 }
      );
    }

    // Add reaction
    await db.query(
      `INSERT INTO reactions (message_id, user_id, emoji)
       VALUES ($1, $2, $3)
       ON CONFLICT (message_id, user_id, emoji) DO NOTHING`,
      [messageId, session.user.id, emoji]
    );

    // Get updated reactions for the message
    const reactions = await db.query(
      `SELECT r.*, u.name, u.username 
       FROM reactions r
       JOIN users u ON r.user_id = u.id
       WHERE r.message_id = $1
       ORDER BY r.created_at ASC`,
      [messageId]
    );

    return NextResponse.json({ reactions: reactions.rows });
  } catch (error) {
    console.error("Error adding reaction:", error);
    return NextResponse.json(
      { error: "Failed to add reaction" },
      { status: 500 }
    );
  }
}

// DELETE /api/reactions - Remove a reaction
export async function DELETE(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { messageId, emoji } = await req.json();
    if (!messageId || !emoji) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    // Remove reaction
    await db.query(
      `DELETE FROM reactions 
       WHERE message_id = $1 
       AND user_id = $2 
       AND emoji = $3`,
      [messageId, session.user.id, emoji]
    );

    // Get updated reactions for the message
    const reactions = await db.query(
      `SELECT r.*, u.name, u.username 
       FROM reactions r
       JOIN users u ON r.user_id = u.id
       WHERE r.message_id = $1
       ORDER BY r.created_at ASC`,
      [messageId]
    );

    return NextResponse.json({ reactions: reactions.rows });
  } catch (error) {
    console.error("Error removing reaction:", error);
    return NextResponse.json(
      { error: "Failed to remove reaction" },
      { status: 500 }
    );
  }
} 