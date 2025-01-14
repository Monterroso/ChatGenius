import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { getBotInfo } from '@/middleware/botAuth';
import { logFeedback, getBotMetrics, getFeedbackHistory } from '@/lib/feedbackLogger';
import { z } from 'zod';

// Validation schema for feedback submission
const feedbackSchema = z.object({
  conversationId: z.string().uuid(),
  messageIndex: z.number().int().min(0),
  rating: z.number().int().min(1).max(5).optional(),
  feedbackText: z.string().optional(),
  responseTimeMs: z.number().int().min(0).optional(),
  tokenCount: z.number().int().min(0).optional(),
  metadata: z.record(z.unknown()).optional(),
});

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const botInfo = getBotInfo(req);
    if (!botInfo) {
      return NextResponse.json({ error: 'Bot information not found' }, { status: 400 });
    }

    const body = await req.json();
    const validatedData = feedbackSchema.parse(body);

    const feedbackId = await logFeedback({
      botId: botInfo.botId,
      userId: session.user.id,
      ...validatedData,
    });

    return NextResponse.json({ id: feedbackId }, { status: 201 });
  } catch (error) {
    console.error('Error submitting feedback:', error);
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors }, { status: 400 });
    }
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function GET(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const botInfo = getBotInfo(req);
    if (!botInfo) {
      return NextResponse.json({ error: 'Bot information not found' }, { status: 400 });
    }

    const url = new URL(req.url);
    const type = url.searchParams.get('type') || 'metrics';
    const limit = parseInt(url.searchParams.get('limit') || '10');
    const offset = parseInt(url.searchParams.get('offset') || '0');

    if (type === 'metrics') {
      const metrics = await getBotMetrics(botInfo.botId);
      return NextResponse.json(metrics);
    } else if (type === 'history') {
      const history = await getFeedbackHistory(botInfo.botId, limit, offset);
      return NextResponse.json(history);
    }

    return NextResponse.json({ error: 'Invalid type parameter' }, { status: 400 });
  } catch (error) {
    console.error('Error fetching feedback:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
} 