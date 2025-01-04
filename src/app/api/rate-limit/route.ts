// src/app/api/rate-limit/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { checkResponseRateLimit } from '@/lib/rate-limit';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const questionId = searchParams.get('questionId');
  const ip = searchParams.get('ip');

  if (!questionId || !ip) {
    return NextResponse.json(
      { error: 'Missing required parameters' },
      { status: 400 }
    );
  }

  try {
    const result = await checkResponseRateLimit(questionId, ip);
    if (!result.allowed) {
      return NextResponse.json(
        { error: result.error },
        { status: 429 }
      );
    }

    return NextResponse.json({ allowed: true });
  } catch (error) {
    console.error('Rate limit check error:', error);
    return NextResponse.json(
      { error: 'Failed to check rate limit' },
      { status: 500 }
    );
  }
}