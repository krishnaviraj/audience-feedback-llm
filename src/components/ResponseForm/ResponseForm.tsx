'use client';

import { useState, useEffect } from 'react';
import BaseLayout from '@/components/layout/BaseLayout';
import { Card, CardHeader, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useEncryption } from '@/hooks/useEncryption';
import { createClient } from '@supabase/supabase-js';
import { 
  validateSpecialCharacters, 
  validateHtmlContent,
  sanitizeInput 
} from '@/lib/validation';
import styles from './ResponseForm.module.css';
import clsx from 'clsx';
import { checkForSpam, isDuplicateResponse } from '@/lib/spam-protection';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

type Question = {
  id: string;
  question: string;
  created_at: string;
  status: string;
};

export default function ResponseForm({ question }: { question: Question }) {
  const [response, setResponse] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isDirty, setIsDirty] = useState(false);
  const [lengthTimer, setLengthTimer] = useState<NodeJS.Timeout | null>(null);

  // Get the key fragment from the URL
  const fragment = typeof window !== 'undefined' 
    ? window.location.hash.slice(1) 
    : '';
  
  // Add encryption hook
  const { 
    decryptWithFragment, 
    encryptWithFragment, 
    isReady, 
    error: encryptionError 
  } = useEncryption(fragment);
  
  // Add state for decrypted question
  const [decryptedQuestion, setDecryptedQuestion] = useState<string>('');
  const [decryptError, setDecryptError] = useState<string | null>(null);

  // Decrypt question on load
  useEffect(() => {
    const decryptQuestion = async () => {
      if (!isReady || !question.question) return;
      
      try {
        const decrypted = await decryptWithFragment(question.question);
        setDecryptedQuestion(decrypted);
        setDecryptError(null);
      } catch (err) {
        console.error('Error decrypting question:', err);
        setDecryptError('Unable to decrypt question. Invalid or missing key.');
      }
    };

    decryptQuestion();
  }, [isReady, question.question]);

  // Function to check for immediate validation errors (HTML/special chars and max length)
  const checkImmediateValidation = (input: string) => {
    // Check for max length first
    if (input.length > 2000) {
      return 'Must not exceed 2000 characters';
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
    if (input.trim().length < 1) {
      return 'Response cannot be empty';
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
    const immediateError = checkImmediateValidation(response);
    if (immediateError) {
      setValidationError(immediateError);
      return;
    }

    // If we had a special character error and it's now fixed, clear immediately
    if (validationError && (
        validationError.includes('HTML') || 
        validationError.includes('Special characters') ||
        validationError.includes('exceed')
    )) {
      setValidationError(null);
    }

    // For length validation:
    // 1. If length is valid, clear any length errors immediately
    // 2. If length is invalid, wait 3 seconds before showing error
    const lengthError = checkLengthValidation(response);
    if (!lengthError && validationError?.includes('empty')) {
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
  }, [response, isDirty, validationError]);

  const handleSubmit = async () => {
    if (validationError || !isReady) return;
    setIsSubmitting(true);
    setSubmitError(null);

    try {
      // Get IP first
      let ip = 'anonymous';
      try {
        console.log('Fetching IP address...');
        const ipResponse = await fetch('/api/ip');
        console.log('IP Response status:', ipResponse.status);
        
        if (ipResponse.ok) {
          const ipData = await ipResponse.json();
          console.log('IP Data received:', ipData);
          ip = ipData.ip || 'anonymous';
        }
      } catch (error) {
        console.error('Detailed IP fetch error:', error);
      }

      console.log('Using IP:', ip);

      // Check for spam
      const spamCheck = checkForSpam(response);
      if (spamCheck.isSpam) {
        throw new Error(`Response rejected: ${spamCheck.reason}`);
      }

      // Check for duplicates
      if (isDuplicateResponse(question.id, response, ip)) {
        throw new Error('You have already submitted this response');
      }

      // Sanitize and encrypt the response
      const sanitizedResponse = sanitizeInput(response);
      const encryptedResponse = await encryptWithFragment(sanitizedResponse);

      // Proceed with the submission
      const { error: submitError } = await supabase
        .from('responses')
        .insert([
          {
            question_id: question.id,
            response: encryptedResponse,
            created_at: new Date().toISOString(),
          }
        ]);

      if (submitError) throw submitError;

      setSubmitted(true);
      setResponse('');
      
    } catch (err) {
      console.error('Submission error:', err);
      setSubmitError(err instanceof Error ? err.message : 'Failed to submit response. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
};
 // Early return for submitted state
 if (submitted) {
  return (
    <BaseLayout>
      <div className={styles.contentArea}>
        <Card>
          <CardContent className="py-8 space-y-4">
            <h2 className={styles.successMessage}>Thank you for your response!</h2>
            <div className="flex justify-center">
              <Button
                onClick={() => setSubmitted(false)}
                className={styles.submitAnotherButton}
              >
                Submit another response
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </BaseLayout>
  );
}

// Check if question is valid
if (!question?.id || !question?.question || question.status !== 'active' || decryptError) {
  return (
    <BaseLayout>
      <div className={styles.contentArea}>
        <Card>
          <CardContent className="py-8">
            <h2 className={styles.questionTitle}>
              {decryptError || 'Invalid or Closed Question'}
            </h2>
            <p className={styles.questionText}>
              {decryptError 
                ? 'Please make sure you have the correct link with encryption key.'
                : 'This question is no longer accepting responses.'}
            </p>
          </CardContent>
        </Card>
      </div>
    </BaseLayout>
  );
}

return (
  <BaseLayout>
    <div className={styles.contentArea}>
      <div className="pt-12 pb-16 space-y-8">
        <Card>
          <CardHeader>
            <h2 className={styles.questionText}>
            {isReady ? decryptedQuestion : 'Loading...'}
            </h2>
          </CardHeader>
          
          <CardContent>
            <div className="space-y-6">
              <div className="relative">
                <input
                  value={response}
                  onChange={(e) => {
                    setResponse(e.target.value);
                    setSubmitError(null);
                    if (!isDirty) setIsDirty(true);
                  }}
                  onBlur={() => setIsDirty(true)}
                  placeholder="Your response..."
                  className={clsx(
                    styles.responseInput,
                    validationError && styles.error
                  )}
                  aria-label="Response input"
                  aria-invalid={!!validationError}
                  aria-describedby={validationError ? "response-error" : undefined}
                />
                {validationError && (
                  <div 
                    id="response-error"
                    className={styles.errorText}
                    role="alert"
                  >
                    {validationError}
                  </div>
                )}
              </div>
              
              <div className="flex justify-center">
                <Button
                  onClick={handleSubmit}
                  disabled={isSubmitting || !response.trim() || !!validationError}
                  className={styles.submitButton}
                >
                  {isSubmitting ? 'Submitting...' : 'Submit response'}
                </Button>
              </div>

              {submitError && (
                <div className={styles.errorText} role="alert">
                  {submitError}
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  </BaseLayout>
);
}