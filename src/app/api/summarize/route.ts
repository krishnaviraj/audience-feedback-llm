import { NextResponse } from 'next/server';
import { Anthropic } from '@anthropic-ai/sdk';
import { trackApiUsage } from '@/lib/rate-limit';


// Initialize Anthropic client
const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY!,
});

// Type for the request body
type SummarizeRequest = {
  responses: string[];
  question: string;
  questionId: string;
};

export async function POST(request: Request) {
  try {
    console.log('Starting summarize API request');

    if (request.method !== 'POST') {
      return NextResponse.json(
        { error: 'Method not allowed' },
        { status: 405 }
      );
    }

    const body: SummarizeRequest = await request.json();
    console.log('Received request body:', {
      questionLength: body.question?.length,
      responsesCount: body.responses?.length,
      questionId: body.questionId
    });

    const { responses, question, questionId } = body;

    // Validate input
    if (!Array.isArray(responses) || responses.length < 3) {
      console.log('Validation failed: insufficient responses');
      return NextResponse.json(
        { error: 'At least 3 responses are required' },
        { status: 400 }
      );
    }

    if (!question) {
      console.log('Validation failed: no question provided');
      return NextResponse.json(
        { error: 'Question is required' },
        { status: 400 }
      );
    }

    if (!questionId) {
      console.log('Validation failed: no questionId provided');
      return NextResponse.json(
        { error: 'Question ID is required' },
        { status: 400 }
      );
    }

    // Format responses for better context
    const formattedResponses = responses.map((r, i) => `Response ${i + 1}: ${r}`).join('\n');

    // Create the message for Claude
    const message = await anthropic.messages.create({
      model: 'claude-3-sonnet-20240229',
      max_tokens: 1024,
      messages: [{
        role: 'user',
        content: `You are analyzing responses to the following question: "${question}"

Here are the responses:
${formattedResponses}

Please provide:
1. A concise summary of the key themes and sentiments expressed in these responses
2. Any notable patterns or unique perspectives
3. A general categorization of the responses if possible

Keep your analysis concise but insightful.`
      }]
    });

    console.log('Successfully received Anthropic response');

    // Track API usage
    if (message.usage) {
      await trackApiUsage(
        questionId,
        message.usage.input_tokens + message.usage.output_tokens
      );
    }

    // Extract the content from the response
    const content = message.content[0].type === 'text' ? message.content[0].text : '';

    return NextResponse.json({
      summary: content
    });

  } catch (error: any) {
    console.error('Detailed error in summarize API:', {
      error: error,
      message: error.message,
      stack: error.stack,
      anthropicError: error.error?.message
    });

    if (error.status === 401) {
      return NextResponse.json(
        { error: 'Invalid API key' },
        { status: 401 }
      );
    }

    return NextResponse.json(
      { error: `Failed to generate summary: ${error.message}` },
      { status: 500 }
    );
  }
}