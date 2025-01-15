import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import db from '@/lib/db';
import { readFile } from 'fs/promises';
import { join } from 'path';
import logger from '@/lib/logger';

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      logger.api(401, 'Unauthorized download attempt');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const fileId = params.id;
    logger.debug(`Attempting to download file: ${fileId}`);

    // Get file metadata and check access permissions
    const result = await db.query(
      `SELECT f.*, g.id as group_id 
       FROM files f
       LEFT JOIN groups g ON f.group_id = g.id
       LEFT JOIN group_members gm ON g.id = gm.group_id AND gm.user_id = $2
       WHERE f.id = $1 
       AND (
         gm.user_id IS NOT NULL 
         OR f.uploader_id = $2 
         OR f.receiver_id = $2
       )`,
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
    
    // Read the file
    const fileBuffer = await readFile(file.filepath);

    // Create response with proper headers for download
    const response = new NextResponse(fileBuffer);
    response.headers.set('Content-Type', file.filetype);
    response.headers.set('Content-Disposition', `attachment; filename="${file.filename}"`);
    response.headers.set('Content-Length', file.filesize.toString());

    logger.api(200, `File downloaded successfully: ${fileId}`);
    return response;
  } catch (error) {
    logger.api(500, 'Error downloading file:', error);
    return NextResponse.json(
      { error: 'Error downloading file' },
      { status: 500 }
    );
  }
} 