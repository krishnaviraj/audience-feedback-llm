'use client';

import { useState, useEffect } from 'react';
import BaseLayout from '@/components/layout/BaseLayout';
import { Card, CardHeader, CardContent } from '../ui/card';
import { Button } from '../ui/button';
import { Share2, MessageSquare, LineChart, LockKeyhole } from 'lucide-react';
import { Input } from '../ui/input';
import { useEncryption } from '@/hooks/useEncryption';
import { createClient } from '@supabase/supabase-js';
import { nanoid } from 'nanoid';
import { useRouter } from 'next/navigation';
import { 
  validateInputLength, 
  validateSpecialCharacters, 
  validateHtmlContent,
  sanitizeInput
} from '@/lib/validation';
import styles from './QuestionInput.module.css';
import clsx from 'clsx';
import { checkForSpam } from '@/lib/spam-protection';


const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export default function QuestionInput() {
  const router = useRouter();
  const [question, setQuestion] = useState('');
  const [isGeneratingLink, setIsGeneratingLink] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isDirty, setIsDirty] = useState(false);
  const [lengthTimer, setLengthTimer] = useState<NodeJS.Timeout | null>(null);
  const { generateKeyAndEncrypt } = useEncryption();


  // Function to check for immediate validation errors (HTML/special chars and max length)
  const checkImmediateValidation = (input: string) => {
    // Check for max length first
    if (input.length > 500) {
      return 'Must not exceed 500 characters';
    }

    const htmlValidation = validateHtmlContent(input);
    if (!htmlValidation.isValid) return htmlValidation.error;
    
    const specialCharsValidation = validateSpecialCharacters(input);
    if (!specialCharsValidation.isValid) return specialCharsValidation.error;
    
    return null;
  };

  // Function to check minimum length validation only
  const checkLengthValidation = (input: string) => {
    // Only check minimum length here
    if (input.trim().length < 10) {
      return 'Must be at least 10 characters long';
    }
    return null;
  };

  // Handle all validation when input changes
  useEffect(() => {
    // Clear any existing length validation timer
    if (lengthTimer) {
      clearTimeout(lengthTimer);
      setLengthTimer(null);
    }

    // Always check for immediate validation first
    const immediateError = checkImmediateValidation(question);
    if (immediateError) {
      setValidationError(immediateError);
      return;
    }

    // If we had a special character error and it's now fixed, clear immediately
    if (validationError && (
        validationError.includes('HTML') || 
        validationError.includes('Special characters')
    )) {
      setValidationError(null);
    }

    // For length validation:
    // 1. If length is valid, clear any length errors immediately
    // 2. If length is invalid, wait 3 seconds before showing error
    const lengthError = checkLengthValidation(question);
    if (!lengthError && validationError?.includes('characters')) {
      setValidationError(null);
    } else if (lengthError && isDirty) {
      const timer = setTimeout(() => {
        setValidationError(lengthError);
      }, 3000);
      setLengthTimer(timer);
    }

    return () => {
      if (lengthTimer) {
        clearTimeout(lengthTimer);
      }
    };
  }, [question, isDirty]);

  const handleGenerateLink = async () => {
    if (validationError) return;
    
    setIsGeneratingLink(true);
    setSubmitError(null);

    try {
      // Check for spam patterns
      const spamCheck = checkForSpam(question);
      if (spamCheck.isSpam) {
        throw new Error(`Question rejected: ${spamCheck.reason}`);
      }

      // First sanitize the input
      const sanitizedQuestion = sanitizeInput(question);

       // Then encrypt the sanitized question
       const { encryptedText, keyFragment } = await generateKeyAndEncrypt(sanitizedQuestion);

      const questionId = nanoid(10);
      const { error: insertError } = await supabase
        .from('questions')
        .insert([
          {
            id: questionId,
            question: encryptedText, // Store encrypted sanitized question
            created_at: new Date().toISOString(),
            status: 'active'
          }
        ]);

      if (insertError) throw insertError;
      // Add key fragment to dashboard URL
      router.push(`/dashboard/${questionId}#${keyFragment}`);
      
    } catch (err) {
      console.error('Error:', err);
      setSubmitError(err instanceof Error ? err.message : 'Failed to generate link. Please try again.');
    } finally {
      setIsGeneratingLink(false);
    }
};

return (
  <BaseLayout>
    <div className="max-w-6xl mx-auto px-6">
      <div className="pt-12 pb-16 space-y-16">
        {/* Header section */}
        <div className="text-center space-y-12">
          <div className="space-y-4">
            <h1 className="text-4xl font-bold text-slate-900">
              Get instant feedback from your audience
            </h1>
            <p className="text-lg text-slate-600 max-w-2xl mx-auto">
              Ask a question, share the link, and get AI-powered insights from responses.
            </p>
          </div>

          {/* Search section */}
          <div className="max-w-2xl mx-auto space-y-4">
            <div className="relative">
              <input 
                value={question}
                onChange={(e) => {
                  setQuestion(e.target.value);
                  setSubmitError(null);
                  if (!isDirty) setIsDirty(true);
                }}
                placeholder="What would you like to ask?"
                className={clsx(
                  styles.searchInput,
                  validationError && styles.error
                )}
                aria-invalid={!!validationError}
                aria-describedby={validationError ? "question-error" : undefined}
              />
              {validationError && (
                <div 
                  id="question-error"
                  className="text-red-500 text-sm mt-2 px-4"
                  role="alert"
                >
                  {validationError}
                </div>
              )}
            </div>

            <div className="flex justify-center">
              <Button
                onClick={handleGenerateLink}
                disabled={isGeneratingLink || !question.trim() || !!validationError}
                className={styles.generateButton}
              >
                {isGeneratingLink ? 'Generating...' : 'Generate audience link'}
              </Button>
            </div>
          </div>
        </div>

        {/* Feature cards */}
        <div className="max-w-2xl mx-auto">
          <div className="grid grid-cols-2 gap-4">
            <Card className={styles.featureCard}>
              <Share2 className={clsx(styles.featureIcon, "text-blue-500")} />
              <h3 className={styles.featureTitle}>Share Easily</h3>
              <p className={styles.featureDescription}>
                Get a unique link to share with your audience
              </p>
            </Card>
            <Card className={styles.featureCard}>
              <MessageSquare className={clsx(styles.featureIcon, "text-green-500")} />
              <h3 className={styles.featureTitle}>Collect Responses</h3>
              <p className={styles.featureDescription}>
                Gather feedback from your audience securely
              </p>
            </Card>
            <Card className={styles.featureCard}>
              <LineChart className={clsx(styles.featureIcon, "text-purple-500")} />
              <h3 className={styles.featureTitle}>AI Insights</h3>
              <p className={styles.featureDescription}>
                Get automated summaries and analysis
              </p>
            </Card>
            <Card className={styles.featureCard}>
              <LockKeyhole className={clsx(styles.featureIcon, "text-slate-500")} />
              <h3 className={styles.featureTitle}>End-to-End Encrypted</h3>
              <p className={styles.featureDescription}>
                Your data stays private and secure
              </p>
            </Card>
          </div>
        </div>
      </div>
    </div>
  </BaseLayout>
);
}