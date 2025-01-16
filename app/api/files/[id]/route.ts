import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import db from '@/lib/db';
import logger from '@/lib/logger';

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      logger.api(401, 'Unauthorized file metadata request');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const fileId = params.id;

    // Get file metadata and check access permissions
    const result = await db.query(
      `SELECT 
        f.id,
        f.filename,
        f.filetype,
        f.filesize,
        f.uploaded_at,
        f.uploader_id,
        f.group_id,
        f.receiver_id,
        g.id as group_id 
       FROM files f
       JOIN groups g ON f.group_id = g.id
       JOIN group_members gm ON g.id = gm.group_id
       WHERE f.id = $1 AND gm.user_id = $2`,
      [fileId, session.user.id]
    );

    if (result.rows.length === 0) {
      logger.api(404, `File not found or access denied: ${fileId}`);
      return NextResponse.json(
        { error: 'File not found or access denied' },
        { status: 404 }
      );
    }

    const file = result.rows[0];
    
    // Create a download URL that points to our download endpoint
    const downloadUrl = `/api/files/${file.id}/download`;

    return NextResponse.json({
      ...file,
      downloadUrl
    });
  } catch (error) {
    logger.api(500, 'Error fetching file:', error);
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
      logger.api(401, 'Unauthorized file deletion attempt');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const fileId = params.id;

    // Delete file from database and verify ownership in one query
    const result = await db.query(
      `DELETE FROM files 
       WHERE id = $1 AND uploader_id = $2
       RETURNING id`,
      [fileId, session.user.id]
    );

    if (result.rows.length === 0) {
      logger.api(404, `File not found or unauthorized: ${fileId}`);
      return NextResponse.json(
        { error: 'File not found or unauthorized' },
        { status: 404 }
      );
    }

    logger.api(200, `File deleted successfully: ${fileId}`);
    return NextResponse.json({ success: true });
  } catch (error) {
    logger.api(500, 'Error deleting file:', error);
    return NextResponse.json(
      { error: 'Error deleting file' },
      { status: 500 }
    );
  }
}