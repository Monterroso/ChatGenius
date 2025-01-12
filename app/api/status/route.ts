import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import db from '@/lib/db';
import { calculateEffectiveStatus } from '@/lib/status';
import { authOptions } from '../auth/[...nextauth]/route';

export async function GET() {
  console.log('[Status API] GET request received');
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    console.log('[Status API] GET - Unauthorized access');
    return new NextResponse('Unauthorized', { status: 401 });
  }

  try {
    const { rows: [status] } = await db.query(`
      SELECT * FROM user_status WHERE user_id = $1
    `, [session.user.id]);

    if (!status) {
      console.log('[Status API] GET - No status found for user:', session.user.id);
      return new NextResponse('Status not found', { status: 404 });
    }

    console.log('[Status API] GET - Success for user:', session.user.id);
    return NextResponse.json(calculateEffectiveStatus(status));
  } catch (error) {
    console.error('[Status API] GET - Error:', error);
    return new NextResponse('Internal Server Error', { status: 500 });
  }
}

export async function PUT(req: Request) {
  console.log('[Status API] PUT request received');
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    console.log('[Status API] PUT - Unauthorized access');
    return new NextResponse('Unauthorized', { status: 401 });
  }

  try {
    const body = await req.json();
    console.log('[Status API] PUT - Request body:', body);

    // Handle simple status update (existing functionality)
    if ('status' in body) {
      const { status } = body;
      const { rows: [result] } = await db.query(`
        INSERT INTO user_status (user_id, manual_status, last_seen)
        VALUES ($1, $2, CURRENT_TIMESTAMP)
        ON CONFLICT (user_id) 
        DO UPDATE SET manual_status = $2, last_seen = CURRENT_TIMESTAMP
        RETURNING *
      `, [session.user.id, status]);

      console.log('[Status API] PUT - Success for user:', session.user.id);
      return NextResponse.json(calculateEffectiveStatus(result));
    }

    // Handle device-aware status update
    const { autoStatus, manualStatus, deviceId, userAgent } = body;

    // Validate autoStatus against the CHECK constraint in the schema
    if (autoStatus && !['online', 'away', 'dnd', 'offline'].includes(autoStatus)) {
      return new NextResponse('Invalid auto_status value', { status: 400 });
    }

    const { rows: [result] } = await db.query(`
      INSERT INTO user_status (
        user_id,
        auto_status,
        manual_status,
        last_seen,
        devices
      ) VALUES (
        $1,
        $2,
        $3,
        CURRENT_TIMESTAMP,
        COALESCE(
          jsonb_build_array(
            jsonb_build_object(
              'id', $4,
              'lastActive', to_char(CURRENT_TIMESTAMP, 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
              'userAgent', $5
            )
          ),
          '[]'::jsonb
        )
      )
      ON CONFLICT (user_id) DO UPDATE SET
        auto_status = $2,
        manual_status = CASE 
          WHEN $3 IS NOT NULL THEN $3 
          ELSE user_status.manual_status 
        END,
        last_seen = CURRENT_TIMESTAMP,
        devices = CASE
          WHEN user_status.devices ? $4 THEN 
            jsonb_set(
              user_status.devices,
              format('{%s}', (
                SELECT position - 1 
                FROM jsonb_array_elements(user_status.devices) WITH ORDINALITY AS arr(obj, position) 
                WHERE obj->>'id' = $4
              )::text)::text[],
              jsonb_build_object(
                'id', $4,
                'lastActive', to_char(CURRENT_TIMESTAMP, 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
                'userAgent', $5
              )
            )
          ELSE
            user_status.devices || jsonb_build_object(
              'id', $4,
              'lastActive', to_char(CURRENT_TIMESTAMP, 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
              'userAgent', $5
            )
        END
      RETURNING *
    `, [
      session.user.id,
      autoStatus,
      manualStatus,
      deviceId,
      userAgent
    ]);

    console.log('[Status API] PUT - Success for user:', session.user.id);
    return NextResponse.json(calculateEffectiveStatus(result));
  } catch (error) {
    console.error('[Status API] PUT - Error:', error);
    return new NextResponse('Internal Server Error', { status: 500 });
  }
}

export async function POST(req: Request) {
  console.log('[Status API] POST request received');
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    console.log('[Status API] POST - Unauthorized access');
    return new NextResponse('Unauthorized', { status: 401 });
  }

  try {
    const body = await req.json();
    console.log('[Status API] POST - Request body:', body);

    const { manual_status, auto_status, invisible } = body;

    const { rows: [result] } = await db.query(`
      INSERT INTO user_status (
        user_id,
        manual_status,
        auto_status,
        invisible,
        last_seen,
        devices
      ) VALUES (
        $1, $2, $3, $4, CURRENT_TIMESTAMP, '[]'::jsonb
      )
      RETURNING *
    `, [
      session.user.id,
      manual_status || null,
      auto_status || 'online',
      invisible || false
    ]);

    const effectiveStatus = calculateEffectiveStatus(result);

    console.log('[Status API] POST - Success for user:', session.user.id);
    return NextResponse.json(effectiveStatus);
  } catch (error) {
    console.error('[Status API] POST - Error:', error);
    return new NextResponse('Internal Server Error', { status: 500 });
  }
} 