import { NextResponse } from 'next/server'
import { Anthropic } from '@anthropic-ai/sdk'
import { trackApiUsage } from '@/lib/rate-limit'

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY!,
})

type SummarizeRequest = {
  responses: string[]
  question: string
  questionId: string
}

interface StructuredSummary {
  mainMessage: {
    text: string
    quotes: string[]
  }
  notablePerspectives: Array<{
    insight: string
    quote: string
  }>
  keyTakeaways: string[]
}

interface SummaryMetrics {
  startTime: number
  endTime: number
  retryCount: number
  responseQuality: number
  tokens?: { input: number; output: number }
}

const MAX_RETRIES = 3
const INITIAL_RETRY_DELAY = 1000

async function generateSummary(
  question: string,
  responses: string[],
  retryCount = 0
): Promise<[StructuredSummary, SummaryMetrics]> {
  const metrics: SummaryMetrics = {
    startTime: Date.now(),
    endTime: 0,
    retryCount,
    responseQuality: 0
  }

  try {
    const formattedResponses = responses.map((r, i) => `Response ${i + 1}: ${r}`).join('\n')
    const message = await anthropic.messages.create({
      model: 'claude-3-sonnet-20240229',
      max_tokens: 1024,
      messages: [{
        role: 'user',
        content: `You are analyzing responses to the following question: "${question}"

Here are the responses:
${formattedResponses}

Analyze these responses and provide a structured summary in valid JSON format exactly as follows:

{
  "mainMessage": {
    "text": "A clear 1-2 sentence summary of the predominant sentiment",
    "quotes": ["1-2 representative quotes that best capture this sentiment"]
  },
  "notablePerspectives": [
    {
      "insight": "A clear statement of a unique or contrasting viewpoint",
      "quote": "The specific quote that expresses this perspective"
    }
  ],
  "keyTakeaways": [
    "Specific, actionable item based on the feedback",
    "Another specific recommendation"
  ]
}

Important:
- Keep "mainMessage" focused on what most people are expressing
- Include only truly unique or valuable perspectives in "notablePerspectives"
- Make "keyTakeaways" specific and actionable
- Use actual quotes from the responses
- Response must be in valid JSON format with no additional text
- Quote actual responses when providing quotes`
      }]
    })

    const summary = message.content[0].type === 'text' ? message.content[0].text : ''
    
    // Parse the JSON response
    const structuredSummary: StructuredSummary = JSON.parse(summary)
    
    metrics.endTime = Date.now()
    metrics.responseQuality = calculateResponseQuality(structuredSummary)
    metrics.tokens = {
      input: message.usage?.input_tokens ?? 0,
      output: message.usage?.output_tokens ?? 0
    }

    return [structuredSummary, metrics]
  } catch (error) {
    console.error('Summary generation error:', error)
    
    if (retryCount < MAX_RETRIES) {
      const delay = INITIAL_RETRY_DELAY * Math.pow(2, retryCount)
      await new Promise(resolve => setTimeout(resolve, delay))
      return generateSummary(question, responses, retryCount + 1)
    }
    throw error
  }
}

function calculateResponseQuality(summary: StructuredSummary): number {
  const qualityMetrics = {
    hasMainMessage: summary.mainMessage.text.length > 0 ? 1 : 0,
    hasQuotes: summary.mainMessage.quotes.length > 0 ? 1 : 0,
    hasNotablePerspectives: summary.notablePerspectives.length > 0 ? 1 : 0,
    hasKeyTakeaways: summary.keyTakeaways.length > 0 ? 1 : 0
  }
  return Object.values(qualityMetrics).reduce((sum, val) => sum + val, 0) / 4
}

export async function POST(request: Request) {
  try {
    console.log('Starting summarize API request')

    if (request.method !== 'POST') {
      return NextResponse.json(
        { error: 'Method not allowed' },
        { status: 405 }
      )
    }

    const body: SummarizeRequest = await request.json()
    const { responses, question, questionId } = body

    console.log('Received request:', {
      questionLength: question?.length,
      responsesCount: responses?.length,
      questionId
    })

    if (!Array.isArray(responses) || responses.length < 3) {
      console.log('Validation failed: insufficient responses')
      return NextResponse.json(
        { error: 'At least 3 responses are required' },
        { status: 400 }
      )
    }

    if (!question || !questionId) {
      console.log('Validation failed: missing required fields')
      return NextResponse.json(
        { error: 'Question and questionId are required' },
        { status: 400 }
      )
    }

    const [summary, metrics] = await generateSummary(question, responses)

    if (metrics.tokens) {
      await trackApiUsage(questionId, metrics.tokens.input + metrics.tokens.output)
    }

    console.log('Summary generation metrics:', {
      duration: metrics.endTime - metrics.startTime,
      retryCount: metrics.retryCount,
      responseQuality: metrics.responseQuality,
      tokens: metrics.tokens,
      timestamp: new Date().toISOString()
    })

    if (metrics.responseQuality < 0.5) {
      console.warn('Low quality summary generated:', {
        quality: metrics.responseQuality,
        summary: JSON.stringify(summary, null, 2)
      })
    }

    return NextResponse.json({ summary, metrics })

  } catch (error: any) {
    console.error('Error in summarize API:', {
      error,
      message: error.message,
      stack: error.stack,
      anthropicError: error.error?.message
    })

    if (error.status === 401) {
      return NextResponse.json(
        { error: 'Invalid API key' },
        { status: 401 }
      )
    }

    return NextResponse.json(
      { error: `Failed to generate summary: ${error.message}` },
      { status: 500 }
    )
  }
}