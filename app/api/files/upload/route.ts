import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import db from '@/lib/db';
import logger from '@/lib/logger';

const MAX_FILE_SIZE = process.env.MAX_FILE_SIZE_BYTES ? parseInt(process.env.MAX_FILE_SIZE_BYTES) : 5242880; // 5MB default
const ALLOWED_TYPES = [
  'image/jpeg',
  'image/png',
  'image/gif',
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
];

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      logger.api(401, 'Unauthorized file upload attempt');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const formData = await req.formData();
    const file = formData.get('file') as File;
    const groupId = formData.get('groupId') as string;
    const receiverId = formData.get('receiverId') as string;

    if (!file) {
      logger.api(400, 'No file provided in upload request');
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    if (!groupId && !receiverId) {
      return NextResponse.json({ error: 'No destination provided' }, { status: 400 });
    }

    if (groupId && receiverId) {
      return NextResponse.json({ error: 'Invalid destination' }, { status: 400 });
    }

    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      logger.api(400, `File too large: ${file.size} bytes`);
      return NextResponse.json({ error: 'File too large' }, { status: 400 });
    }

    // Validate file type
    if (!ALLOWED_TYPES.includes(file.type)) {
      logger.api(400, `Invalid file type: ${file.type}`);
      return NextResponse.json({ error: 'Invalid file type' }, { status: 400 });
    }

    // Get file data as buffer
    const fileBuffer = Buffer.from(await file.arrayBuffer());

    // Save file data and metadata to database
    const result = await db.query(
      `INSERT INTO files (
        group_id,
        receiver_id,
        uploader_id,
        filename,
        filepath,
        filetype,
        filesize,
        file_data
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING id, filename, filetype, filesize, uploaded_at`,
      [
        groupId || null,
        receiverId || null,
        session.user.id,
        file.name,
        'deprecated', // Keep filepath for backward compatibility
        file.type,
        file.size,
        fileBuffer
      ]
    );

    logger.api(201, `File uploaded successfully: ${file.name}`);
    return NextResponse.json(result.rows[0]);
  } catch (error) {
    logger.api(500, 'File upload error:', error);
    return NextResponse.json(
      { error: 'Error uploading file' },
      { status: 500 }
    );
  }
}