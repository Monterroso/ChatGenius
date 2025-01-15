import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import db from '@/lib/db';
import { unlink } from 'fs/promises';

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const fileId = params.id;

    // Get file metadata and check access permissions
    const result = await db.query(
      `SELECT f.*, g.id as group_id 
       FROM files f
       JOIN groups g ON f.group_id = g.id
       JOIN group_members gm ON g.id = gm.group_id
       WHERE f.id = $1 AND gm.user_id = $2`,
      [fileId, session.user.id]
    );

    if (result.rows.length === 0) {
      return NextResponse.json(
        { error: 'File not found or access denied' },
        { status: 404 }
      );
    }

    const file = result.rows[0];
    
    // Create a download URL
    const downloadUrl = `/uploads/${file.filepath.split('/').pop()}`;

    return NextResponse.json({
      ...file,
      downloadUrl
    });
  } catch (error) {
    console.error('Error fetching file:', error);
    return NextResponse.json(
      { error: 'Error fetching file' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const fileId = params.id;

    // Get file info and verify ownership
    const result = await db.query(
      `SELECT * FROM files 
       WHERE id = $1 AND uploader_id = $2`,
      [fileId, session.user.id]
    );

    if (result.rows.length === 0) {
      return NextResponse.json(
        { error: 'File not found or unauthorized' },
        { status: 404 }
      );
    }

    const file = result.rows[0];

    // Delete file from storage
    await unlink(file.filepath);

    // Delete metadata from database
    await db.query(
      'DELETE FROM files WHERE id = $1',
      [fileId]
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting file:', error);
    return NextResponse.json(
      { error: 'Error deleting file' },
      { status: 500 }
    );
  }
}