'use client';

import { useState, useEffect } from 'react';
import { Card, CardHeader, CardContent } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
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

      const questionId = nanoid(10);
      const { error: insertError } = await supabase
        .from('questions')
        .insert([
          {
            id: questionId,
            question: sanitizeInput(question),
            created_at: new Date().toISOString(),
            status: 'active'
          }
        ]);

      if (insertError) throw insertError;
      router.push(`/dashboard/${questionId}`);
      
    } catch (err) {
      console.error('Error:', err);
      setSubmitError(err instanceof Error ? err.message : 'Failed to generate link. Please try again.');
    } finally {
      setIsGeneratingLink(false);
    }
};

return (
  <div className={styles.container}>
    <Card className={styles.card}>
      <CardHeader className={styles.header}>
        <h1 className={styles.title}>
          Pose your question
        </h1>
      </CardHeader>
      
      <CardContent>
        <div className={styles.content}>
          <div className={styles.inputWrapper}>
            <Input
              value={question}
              onChange={(e) => {
                setQuestion(e.target.value);
                setSubmitError(null);
                if (!isDirty) setIsDirty(true);
              }}
              placeholder="What's your question?"
              className={clsx(styles.input, {
                [styles.inputError]: validationError
              })}
              aria-label="Question input"
              aria-invalid={!!validationError}
              aria-describedby={validationError ? "question-error" : undefined}
            />
            {validationError && (
              <div 
                id="question-error"
                className={styles.errorText}
                role="alert"
              >
                {validationError}
              </div>
            )}
          </div>
          
          <Button
            onClick={handleGenerateLink}
            disabled={isGeneratingLink || !question.trim() || !!validationError}
            className={styles.button}
          >
            {isGeneratingLink ? 'Generating...' : 'Generate audience link'}
          </Button>

          {submitError && (
            <div className={styles.errorText} role="alert">
              {submitError}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  </div>
);
}