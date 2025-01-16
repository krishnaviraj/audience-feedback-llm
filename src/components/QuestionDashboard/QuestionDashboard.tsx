'use client';

import { useEffect, useState } from 'react';
import BaseLayout from '@/components/layout/BaseLayout';
import { Card, CardHeader, CardContent } from '../ui/card';
import { Button } from '../ui/button';
import { useEncryption } from '@/hooks/useEncryption';
import { createClient } from '@supabase/supabase-js';
import { RefreshCw, Share2, MessageSquare, LineChart } from 'lucide-react';
import ErrorBoundary from '../ErrorBoundary';
import styles from './QuestionDashboard.module.css';
import clsx from 'clsx';


const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

type EncryptedResponse = {
  id: string;
  response: string; // encrypted
  created_at: string;
  question_id: string;
};

type DecryptedResponse = {
  id: string;
  response: string; // decrypted
  created_at: string;
  question_id: string;
};

type StructuredSummary = {
  mainMessage: {
    text: string;
    quotes: string[];
  };
  notablePerspectives: Array<{
    insight: string;
    quote: string;
  }>;
  keyTakeaways: string[];
};

type QuestionDashboardProps = {
  questionId: string;
  question: string;
  onEdit?: () => void;
};

export default function QuestionDashboard({ 
  questionId, 
  question: encryptedQuestion,
  onEdit 
}: QuestionDashboardProps) {
  const [responses, setResponses] = useState<DecryptedResponse[]>([]);
  const [audienceLink, setAudienceLink] = useState('');
  const [summary, setSummary] = useState<StructuredSummary | null>(null);
  const [isGeneratingSummary, setIsGeneratingSummary] = useState(false);
  const [summaryError, setSummaryError] = useState<string | null>(null);
  const [lastSummaryResponseCount, setLastSummaryResponseCount] = useState(0);
  const [copyState, setCopyState] = useState<'idle' | 'copied'>('idle');
  const [currentPage, setCurrentPage] = useState(1);
  
  // Get encryption key from URL fragment
const fragment = typeof window !== 'undefined' 
? window.location.hash.slice(1) 
: '';

const { decryptWithFragment, isReady, error: encryptionError } = useEncryption(fragment);
const [decryptedQuestion, setDecryptedQuestion] = useState<string>('');
const [decryptError, setDecryptError] = useState<string | null>(null);

// Decrypt question on load
useEffect(() => {
  const decryptQuestion = async () => {
    if (!isReady || !encryptedQuestion) return;
    
    try {
      const decrypted = await decryptWithFragment(encryptedQuestion);
      setDecryptedQuestion(decrypted);
      setDecryptError(null);
    } catch (err) {
      console.error('Error decrypting question:', err);
      setDecryptError('Unable to decrypt question. Invalid or missing key.');
    }
  };

  decryptQuestion();
}, [isReady, encryptedQuestion]);

// Handle real-time updates with decryption
useEffect(() => {
  if (!isReady) return;

  const channel = supabase.channel(`responses-${questionId}`)
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'responses'
      },
      async (payload: { new: EncryptedResponse }) => {
        if (payload.new?.question_id === questionId) {
          try {
            // Decrypt new response
            const decryptedResponse = await decryptWithFragment(payload.new.response);
            setResponses(current => [...current, {
              ...payload.new,
              response: decryptedResponse
            }]);
          } catch (err) {
            console.error('Error decrypting new response:', err);
          }
        }
      }
    )
    .subscribe(async (status) => {
      if (status === 'SUBSCRIBED') {
        // Fetch and decrypt initial responses
        const { data, error } = await supabase
          .from('responses')
          .select('*')
          .eq('question_id', questionId)
          .order('created_at', { ascending: true });

        if (error) {
          console.error('Error fetching responses:', error);
          return;
        }

        // Decrypt all responses
        try {
          const decryptedResponses = await Promise.all(
            data.map(async (response: EncryptedResponse) => ({
              ...response,
              response: await decryptWithFragment(response.response)
            }))
          );
          setResponses(decryptedResponses);
        } catch (err) {
          console.error('Error decrypting responses:', err);
          setDecryptError('Unable to decrypt responses. Invalid or missing key.');
        }
      }
    });

  return () => {
    channel.unsubscribe();
  };
}, [questionId, isReady]);

  // Function to generate summary
  const generateSummary = async (batchedResponses?: DecryptedResponse[]) => {
    const responsesToProcess = batchedResponses || responses;
    if (responsesToProcess.length < 3 || isGeneratingSummary) return;

    setIsGeneratingSummary(true);
    setSummaryError(null);

    try {
      const result = await fetch('/api/summarize', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          responses: responsesToProcess.map(r => r.response),
          question: decryptedQuestion,
          questionId: questionId
        }),
      });

      if (!result.ok) {
        throw new Error('Failed to generate summary');
      }

      // Show decryption error if present
  if (decryptError) {
    return (
      <div className={styles.container}>
        <Card className={styles.card}>
          <CardContent className={styles.content}>
            <h2 className={styles.title}>Unable to Load Dashboard</h2>
            <p className={styles.text}>{decryptError}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

      const data = await result.json();
      setSummary(data.summary);
      setLastSummaryResponseCount(responsesToProcess.length);
    } catch (error) {
      console.error('Error generating summary:', error);
      setSummaryError('Failed to generate summary. Please try again.');
    } finally {
      setIsGeneratingSummary(false);
    }
  };

  useEffect(() => {
    setAudienceLink(`${window.location.origin}/respond/${questionId}${window.location.hash}`);
  
    const channel = supabase.channel(`responses-${questionId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'responses'
        },
        (payload: any) => {
          if (payload.new?.question_id === questionId) {
            setResponses(current => [...current, payload.new]);
          }
        }
      )
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          const { data, error } = await supabase
            .from('responses')
            .select('*')
            .eq('question_id', questionId)
            .order('created_at', { ascending: true });
  
          if (error) {
            console.error('Error fetching responses:', error);
            return;
          }
  
          setResponses(data || []);
        }
      });
  
    return () => {
      channel.unsubscribe();
    };
  }, [questionId]);

  useEffect(() => {
    if (responses.length >= 3 && !summary) {
      generateSummary();
    }
  }, [responses.length]);

  const isSummaryOutdated = responses.length > lastSummaryResponseCount;

  return (
    <BaseLayout>
  <div className={styles.container}>
    <div className="relative">
      <div className="flex flex-col md:flex-row gap-8 pt-12 pb-16 w-full">
        {/* Left Panel */}
        <div className="md:w-[40%] md:h-[calc(100vh-6rem)]">
          <div className="md:sticky md:top-8">
            <div className={styles.panel}>
              <ErrorBoundary>
                <Card>
                  <CardHeader>
                    <Share2 className="w-5 h-5 text-blue-500" />
                    <div className="flex-grow">
                      <h2 className={styles.title}>Your question</h2>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    {/* Question section */}
                    <div>
                      <p className={styles.text}>
                        {isReady ? decryptedQuestion : 'Loading...'}
                      </p>
                    </div>

                    {/* Link section */}
                    <div className="space-y-4 border-t border-slate-100 pt-6">
                      <h3 className="text-sm font-semibold text-slate-700">Audience link</h3>
                      <p className={styles.text + " break-all"}>{audienceLink}</p>
                      <Button
                        onClick={() => {
                          navigator.clipboard.writeText(audienceLink);
                          setCopyState('copied');
                          setTimeout(() => setCopyState('idle'), 2000);
                        }}
                        disabled={copyState === 'copied'}
                        className={styles.copyButton}
                      >
                        {copyState === 'copied' ? 'Copied!' : 'Copy Link'}
                      </Button>
                      <p className={styles.subText}>
                        Share this with whoever you want answering your question. 
                      </p>
                    </div>
                  </CardContent>
                </Card>
              </ErrorBoundary>
            </div>
          </div>
        </div>

        {/* Right Panel */}
        <div className="md:w-[60%]">
          <div className={styles.panel}>
            <ErrorBoundary>
              {/* Summary Card */}
              <Card className="overflow-hidden">
              {isSummaryOutdated && summary && !isGeneratingSummary && (
                  <div className={styles.notificationBanner}>
                    <span>{responses.length - lastSummaryResponseCount} new {responses.length - lastSummaryResponseCount === 1 ? 'response has' : 'responses have'} been received.</span>
                    <button
                      onClick={() => generateSummary()}
                      disabled={isGeneratingSummary}
                      className={styles.refreshLink}
                    >
                      Refresh to update your summary
                    </button>
                  </div>
                )}
                <CardHeader>
                  <LineChart className="w-5 h-5 text-purple-500" />
                  <div className="flex-grow">
                    <h2 className={styles.title}>Audience sentiment summary</h2>
                  </div>
                </CardHeader>
                <CardContent>
                  {/* Summary content */}
                  {responses.length < 3 ? (
                    <p className={styles.subText}>
                      A summary will be generated once you have at least 3 responses.
                    </p>
                  ) : summaryError ? (
                    <div className={styles.errorText}>
                      {summaryError}
                    </div>
                  ) : isGeneratingSummary ? (
                    <p className={styles.subText}>
                      Generating summary...
                    </p>
                  ) : summary ? (
                    <div>
                      {/* Main Message */}
                      <div className={styles.summarySection}>
                        <div className={styles.summaryHeader}>The Main Message</div>
                        <p className={styles.text}>{summary.mainMessage.text}</p>
                        <div>
                          {summary.mainMessage.quotes.map((quote, i) => (
                            <div key={i} className={styles.quoteItem}>"{quote}"</div>
                          ))}
                        </div>
                      </div>

                      {/* Notable Perspectives */}
                      <div className={styles.summarySection}>
                        <div className={styles.summaryHeader}>Notable Perspectives</div>
                        {summary.notablePerspectives.map((perspective, i) => (
                          <div key={i} className="mb-4 last:mb-0">
                            <p className={styles.text}>{perspective.insight}</p>
                            <div className={styles.quoteItem}>"{perspective.quote}"</div>
                          </div>
                        ))}
                      </div>

                      {/* Key Takeaways */}
                      <div className={styles.summarySection}>
                        <div className={styles.summaryHeader}>Key Takeaways</div>
                        <ul className={styles.takeawaysList}>
                          {summary.keyTakeaways.map((takeaway, i) => (
                            <li key={i} className={styles.takeawayItem}>{takeaway}</li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  ) : (
                    <p className={styles.subText}>
                      Click refresh to generate a summary.
                    </p>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <MessageSquare className="w-5 h-5 text-green-500" />
                  <div className="flex-grow">
                    <h2 className={styles.title}>
                      Responses ({responses.length})
                    </h2>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className={styles.responseList}>
                    {responses
                      .slice((currentPage - 1) * 10, currentPage * 10)
                      .map((response) => (
                        <Card 
                          key={response.id} 
                          className={styles.responseCard}
                        >
                          <p className={styles.responseText}>{response.response}</p>
                        </Card>
                    ))}
                  </div>
                  
                  {/* Pagination Controls */}
                  {responses.length > 10 && (
                    <div className={styles.pagination}>
                      <Button
                        variant="ghost"
                        onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                        disabled={currentPage === 1}
                        className={styles.paginationButton}
                      >
                        Previous
                      </Button>
                      <span className={styles.paginationText}>
                        Page {currentPage} of {Math.ceil(responses.length / 10)}
                      </span>
                      <Button
                        variant="ghost"
                        onClick={() => setCurrentPage(p => Math.min(Math.ceil(responses.length / 10), p + 1))}
                        disabled={currentPage === Math.ceil(responses.length / 10)}
                        className={styles.paginationButton}
                      >
                        Next
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            </ErrorBoundary>
          </div>
        </div>
      </div>
    </div>
  </div>
</BaseLayout>
  );
}