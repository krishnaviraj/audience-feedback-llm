'use client';

import { useEncryption } from '@/hooks/useEncryption';
import { useEffect, useState } from 'react';
import { Card, CardHeader, CardContent } from '../ui/card';
import { Button } from '../ui/button';
import { createClient } from '@supabase/supabase-js';
import { RefreshCw } from 'lucide-react';
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
    <div className={styles.container}>
      <div className={styles.grid}>
        {/* Left Panel */}
        <div className={styles.panel}>
          <ErrorBoundary>
            <Card className={styles.card}>
              <CardHeader>
                <h2 className={styles.title}>Your question</h2>
              </CardHeader>
              <CardContent>
              <p className={styles.text}>
                  {isReady ? decryptedQuestion : 'Loading...'}
                </p>
                <Button
                  onClick={onEdit}
                  variant="link"
                  className={styles.linkText}
                >
                  Edit
                </Button>
              </CardContent>
            </Card>

            <Card className={styles.card}>
              <CardHeader>
                <h2 className={styles.title}>Audience link</h2>
              </CardHeader>
              <CardContent>
                <div className={styles.content}>
                  <p className={styles.text}>{audienceLink}</p>
                  <Button
                    onClick={() => navigator.clipboard.writeText(audienceLink)}
                    className={styles.copyButton}
                  >
                    Copy Link
                  </Button>
                  <p className={styles.subText}>
                    Share this with whoever you want answering your question
                  </p>
                </div>
              </CardContent>
            </Card>
          </ErrorBoundary>
        </div>

        {/* Right Panel */}
        <div className={styles.panel}>
          <ErrorBoundary>
            <Card className={styles.card}>
              <CardHeader className={styles.header}>
                <h2 className={styles.title}>Audience sentiment summary</h2>
                {responses.length >= 3 && (
                  <Button 
                    onClick={() => generateSummary()}
                    disabled={isGeneratingSummary}
                    variant="ghost"
                    className={styles.refreshButton}
                  >
                    <RefreshCw className={clsx(styles.spinner, {
                      [styles.spinnerActive]: isGeneratingSummary
                    })} />
                    Refresh
                  </Button>
                )}
              </CardHeader>
              <CardContent>
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
                      <div className={styles.summaryList}>
                        {summary.mainMessage.quotes.map((quote, i) => (
                          <div key={i} className={styles.quoteItem}>"{quote}"</div>
                        ))}
                      </div>
                    </div>

                    {/* Notable Perspectives */}
                    <div className={styles.summarySection}>
                      <div className={styles.summaryHeader}>Notable Perspectives</div>
                      {summary.notablePerspectives.map((perspective, i) => (
                        <div key={i} className={styles.perspectiveItem}>
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

                    {isSummaryOutdated && (
                      <p className={styles.warningText}>
                        New responses have been received. Click refresh to update the summary.
                      </p>
                    )}
                  </div>
                ) : (
                  <p className={styles.subText}>
                    Click refresh to generate a summary of the responses.
                  </p>
                )}
              </CardContent>
            </Card>
          </ErrorBoundary>
          
          <ErrorBoundary>
            <Card className={styles.card}>
              <CardHeader>
                <h2 className={styles.title}>
                  Responses ({responses.length})
                </h2>
              </CardHeader>
              <CardContent>
                {responses.length === 0 ? (
                  <p className={styles.subText}>None so far</p>
                ) : (
                  <div className={styles.responseList}>
                    {responses.map((response) => (
                      <Card 
                        key={response.id} 
                        className={styles.responseCard}
                      >
                        <CardContent>
                          <p className={styles.responseText}>{response.response}</p>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </ErrorBoundary>
        </div>
      </div>
    </div>
  );
}