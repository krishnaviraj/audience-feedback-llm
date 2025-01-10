import { Redis } from '@upstash/redis'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

// Initialize Redis client
const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!
})

//Configure question limits (reduced)
const QUESTION_LIMITS = {
  PER_MINUTE: 3,    // Maximum questions per minute
  PER_HOUR: 5,      // Maximum questions per hour
  PER_DAY: 10       // Maximum questions per day
}

// const QUESTION_LIMITS = {
//   PER_MINUTE: 30,    // 10x increase
//   PER_HOUR: 100,     // 20x increase
//   PER_DAY: 200       // 20x increase
// }

// Configure response limits
const RESPONSE_LIMITS = {
  PER_IP: {
    PER_MINUTE: 5,  // Maximum responses per minute per IP
    PER_HOUR: 20,   // Maximum responses per hour per IP
    PER_DAY: 50     // Maximum responses per day per IP
  },
  PER_QUESTION: {
    PER_MINUTE: 100, // Maximum responses per minute per question
    PER_HOUR: 300,   // Maximum responses per hour per question
    PER_DAY: 1000    // Maximum responses per day per question
  }
}

// const RESPONSE_LIMITS = {
//   PER_IP: {
//     PER_MINUTE: 50,   // 10x increase
//     PER_HOUR: 200,    // 10x increase
//     PER_DAY: 500      // 10x increase
//   },
//   PER_QUESTION: {
//     PER_MINUTE: 500,  // 5x increase
//     PER_HOUR: 1500,   // 5x increase
//     PER_DAY: 5000     // 5x increase
//   }
// }

// Usage tracking function
export async function trackApiUsage(questionId: string, tokensUsed: number) {
  try {
    const now = new Date();
    const day = now.toISOString().split('T')[0];
    
    console.log('Tracking API usage:', {
      questionId,
      tokensUsed,
      day
    });

    await redis.hincrby(`usage:${day}`, 'total_tokens', tokensUsed);
    await redis.hincrby(`usage:${day}`, 'total_requests', 1);
    await redis.hincrby(`usage:${day}:questions`, questionId, 1);
    
    console.log('Successfully tracked usage in Redis');

    // Keep usage data for 90 days
    await redis.expire(`usage:${day}`, 90 * 24 * 60 * 60);
    await redis.expire(`usage:${day}:questions`, 90 * 24 * 60 * 60);
  } catch (error) {
    console.error('Usage tracking error:', error);
  }
}

const RATE_LIMIT_WINDOW = 60 * 1000  // 1 minute window

interface RateLimitInfo {
  dailyCount: number
  hourlyCount: number
  windowCount: number
  lastReset: number
}

// Question rate limiting middleware (updated with new limits)
export async function rateLimitMiddleware(
  request: NextRequest,
  config?: {
    windowMs?: number;
    max?: number;
    message?: string;
  }
) {
  const forwardedFor = request.headers.get('x-forwarded-for')
  const clientIp = forwardedFor ? forwardedFor.split(',')[0] : 'anonymous'
  const now = Date.now()
  const key = `rate_limit:questions:${clientIp}`

  // Use config or defaults
  const windowMs = config?.windowMs || RATE_LIMIT_WINDOW;
  const max = config?.max || QUESTION_LIMITS.PER_MINUTE;
  const message = config?.message || 'Rate limit exceeded for question creation';

  try {
    const info = await redis.get(key) as RateLimitInfo | null;
    
    const currentInfo = info || {
      dailyCount: 0,
      hourlyCount: 0,
      windowCount: 0,
      lastReset: now
    };

    // Reset counters if needed
    const hoursPassed = (now - currentInfo.lastReset) / (1000 * 60 * 60)
    if (hoursPassed >= 24) {
      currentInfo.dailyCount = 0
      currentInfo.hourlyCount = 0
      currentInfo.windowCount = 0
    } else if (hoursPassed >= 1) {
      currentInfo.hourlyCount = 0
    }
    
    if (now - currentInfo.lastReset > windowMs) {
      currentInfo.windowCount = 0
      currentInfo.lastReset = now
    }

    // Check limits
    if (currentInfo.windowCount >= max) {
      return new NextResponse(message, {
        status: 429,
        headers: {
          'X-RateLimit-Limit': max.toString(),
          'X-RateLimit-Remaining': '0',
          'X-RateLimit-Reset': new Date(currentInfo.lastReset + windowMs).toISOString()
        }
      })
    }

    currentInfo.windowCount++
    await redis.set(key, currentInfo, { ex: 24 * 60 * 60 })

    return NextResponse.next()

  } catch (error) {
    console.error('Rate limiting error:', error)
    return NextResponse.next()
  }
}

// New function to check response rate limits
export async function checkResponseRateLimit(questionId: string, clientIp: string): Promise<{ 
  allowed: boolean; 
  error?: string;
}> {
  const now = Date.now()
  
  try {
    // Check IP-based limits
    const ipKey = `rate_limit:responses:ip:${clientIp}`
    const ipInfo = await redis.get(ipKey) as RateLimitInfo | null
    
    const currentIpInfo = ipInfo || {
      dailyCount: 0,
      hourlyCount: 0,
      windowCount: 0,
      lastReset: now
    }

    // Check question-based limits
    const questionKey = `rate_limit:responses:question:${questionId}`
    const questionInfo = await redis.get(questionKey) as RateLimitInfo | null
    
    const currentQuestionInfo = questionInfo || {
      dailyCount: 0,
      hourlyCount: 0,
      windowCount: 0,
      lastReset: now
    }

    // Reset IP counters if needed
    const ipHoursPassed = (now - currentIpInfo.lastReset) / (1000 * 60 * 60)
    if (ipHoursPassed >= 24) {
      currentIpInfo.dailyCount = 0
      currentIpInfo.hourlyCount = 0
      currentIpInfo.windowCount = 0
    } else if (ipHoursPassed >= 1) {
      currentIpInfo.hourlyCount = 0
    }
    
    if (now - currentIpInfo.lastReset > RATE_LIMIT_WINDOW) {
      currentIpInfo.windowCount = 0
      currentIpInfo.lastReset = now
    }

    // Reset question counters if needed
    const questionHoursPassed = (now - currentQuestionInfo.lastReset) / (1000 * 60 * 60)
    if (questionHoursPassed >= 24) {
      currentQuestionInfo.dailyCount = 0
      currentQuestionInfo.hourlyCount = 0
      currentQuestionInfo.windowCount = 0
    } else if (questionHoursPassed >= 1) {
      currentQuestionInfo.hourlyCount = 0
    }
    
    if (now - currentQuestionInfo.lastReset > RATE_LIMIT_WINDOW) {
      currentQuestionInfo.windowCount = 0
      currentQuestionInfo.lastReset = now
    }

    // Check IP limits
    if (currentIpInfo.dailyCount >= RESPONSE_LIMITS.PER_IP.PER_DAY) {
      return { allowed: false, error: 'Daily response limit reached' }
    }
    if (currentIpInfo.hourlyCount >= RESPONSE_LIMITS.PER_IP.PER_HOUR) {
      return { allowed: false, error: 'Hourly response limit reached' }
    }
    if (currentIpInfo.windowCount >= RESPONSE_LIMITS.PER_IP.PER_MINUTE) {
      return { allowed: false, error: 'Too many responses, please wait a minute' }
    }

    // Check question limits
    if (currentQuestionInfo.dailyCount >= RESPONSE_LIMITS.PER_QUESTION.PER_DAY) {
      return { allowed: false, error: 'This question has reached its daily response limit' }
    }
    if (currentQuestionInfo.hourlyCount >= RESPONSE_LIMITS.PER_QUESTION.PER_HOUR) {
      return { allowed: false, error: 'This question has reached its hourly response limit' }
    }
    if (currentQuestionInfo.windowCount >= RESPONSE_LIMITS.PER_QUESTION.PER_MINUTE) {
      return { allowed: false, error: 'Too many responses to this question, please wait a minute' }
    }

    // If we get here, increment both counters
    currentIpInfo.dailyCount++
    currentIpInfo.hourlyCount++
    currentIpInfo.windowCount++

    currentQuestionInfo.dailyCount++
    currentQuestionInfo.hourlyCount++
    currentQuestionInfo.windowCount++

    // Update Redis
    await Promise.all([
      redis.set(ipKey, JSON.stringify(currentIpInfo), { ex: 24 * 60 * 60 }),
      redis.set(questionKey, JSON.stringify(currentQuestionInfo), { ex: 24 * 60 * 60 })
    ]);

    return { allowed: true }

  } catch (error) {
    console.error('Response rate limiting error:', error)
    // On error, allow the request but log the issue
    return { allowed: true }
  }
}