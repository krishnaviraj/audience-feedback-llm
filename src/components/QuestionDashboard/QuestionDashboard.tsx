'use client';

import { useEffect, useState } from 'react';
import { Card, CardHeader, CardContent } from '../ui/card';
import { Button } from '../ui/button';
import { createClient, RealtimePostgresChangesPayload } from '@supabase/supabase-js';
import { RefreshCw } from 'lucide-react';
import ErrorBoundary from '../ErrorBoundary';
import styles from './QuestionDashboard.module.css';
import clsx from 'clsx';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

type Response = {
  id: string;
  response: string;
  created_at: string;
  question_id: string;
};

type QuestionDashboardProps = {
  questionId: string;
  question: string;
  onEdit?: () => void;
};

type ResponsePayload = RealtimePostgresChangesPayload<{
  id: string;
  response: string;
  created_at: string;
  question_id: string;
}>;

export default function QuestionDashboard({ 
  questionId, 
  question,
  onEdit 
}: QuestionDashboardProps) {
  const [responses, setResponses] = useState<Response[]>([]);
  const [audienceLink, setAudienceLink] = useState('');
  const [summary, setSummary] = useState<string | null>(null);
  const [isGeneratingSummary, setIsGeneratingSummary] = useState(false);
  const [summaryError, setSummaryError] = useState<string | null>(null);
  const [lastSummaryResponseCount, setLastSummaryResponseCount] = useState(0);


  // Function to generate summary
  const generateSummary = async (batchedResponses?: Response[]) => {
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
          question: question,
          questionId: questionId
        }),
      });

      if (!result.ok) {
        throw new Error('Failed to generate summary');
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
    console.log('Setting up dashboard for question:', questionId);
      
    setAudienceLink(`${window.location.origin}/respond/${questionId}`);
  
    const channel = supabase.channel(`responses-${questionId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'responses'
        },
        (payload: any) => {
          console.log('Response received:', payload);
          
          if (payload.new?.question_id === questionId) {
            console.log('Matching response found, updating state');
            setResponses(current => [...current, payload.new]);
          }
        }
      )
      .subscribe(async (status) => {
        console.log(`Subscription status for ${questionId}:`, status);
        
        if (status === 'SUBSCRIBED') {
          console.log('Fetching initial responses for:', questionId);
          const { data, error } = await supabase
            .from('responses')
            .select('*')
            .eq('question_id', questionId)
            .order('created_at', { ascending: true });
  
          if (error) {
            console.error('Error fetching responses:', error);
            return;
          }
  
          console.log('Fetched responses:', data);
          setResponses(data || []);
        }
      });
  
    return () => {
      console.log('Unsubscribing from:', questionId);
      channel.unsubscribe();
    };
  }, [questionId]);

  // Effect to trigger summary generation when response count hits 3
  useEffect(() => {
    if (responses.length >= 3 && !summary) {
      generateSummary();
    }
  }, [responses.length]);

  // Check if summary is outdated
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
                <p className={styles.text}>{question}</p>
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
                  <div className={styles.text}>
                    {/* Key themes section */}
                    <div className={styles.summarySection}>
                      <div className={styles.summaryHeader}>Key themes and sentiments:</div>
                      <div className={styles.summaryList}>
                        {summary.split('\n')
                          .filter(line => line.includes('Response') && !line.includes('Key themes'))
                          .slice(0, 3)
                          .map((line, i) => (
                            <div key={i} className={styles.summaryItem}>{line.replace(/^-\s*/, '')}</div>
                          ))}
                      </div>
                    </div>

                    {/* Notable patterns section */}
                    <div className={styles.summarySection}>
                      <div className={styles.summaryHeader}>Notable patterns or unique perspectives:</div>
                      <div className={styles.summaryList}>
                        {summary.split('\n')
                          .filter(line => line.includes('Response') && (line.includes('While') || line.includes('bland')))
                          .map((line, i) => (
                            <div key={i} className={styles.summaryItem}>{line.replace(/^-\s*/, '')}</div>
                          ))}
                      </div>
                    </div>

                    {/* General categorization section */}
                    <div className={styles.summarySection}>
                      <div className={styles.summaryHeader}>General categorization of responses:</div>
                      <div className={styles.summaryList}>
                        {summary.split('\n')
                          .filter(line => line.includes('Response') && (line.includes('Neutral') || line.includes('sentiment')))
                          .map((line, i) => (
                            <div key={i} className={styles.summaryItem}>{line.replace(/^-\s*/, '')}</div>
                          ))}
                      </div>
                    </div>

                    {/* Conclusion */}
                    <div className={styles.summaryConclusion}>
                      {summary.split('\n')
                        .find(line => line.includes('Overall'))}
                    </div>
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