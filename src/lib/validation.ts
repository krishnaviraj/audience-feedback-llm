import DOMPurify from 'isomorphic-dompurify';

export interface ValidationResult {
  isValid: boolean;
  error: string | null;  // Changed from optional string to string | null
}

export const validateInputLength = (input: string, minLength: number, maxLength: number): ValidationResult => {
  if (!input.trim()) {
    return { isValid: false, error: 'This field cannot be empty' };
  }
  if (input.trim().length < minLength) {
    return { isValid: false, error: `Must be at least ${minLength} characters long` };
  }
  if (input.trim().length > maxLength) {
    return { isValid: false, error: `Must not exceed ${maxLength} characters` };
  }
  return { isValid: true, error: null };  // Added explicit null
};

export const validateSpecialCharacters = (input: string): ValidationResult => {
  const specialCharsRegex = /[<>{}[\]]/g;  // Removed quotes from regex
  if (specialCharsRegex.test(input)) {
    return { 
      isValid: false, 
      error: 'Special characters <>{}[] are not allowed' 
    };
  }
  return { isValid: true, error: null };
};

export const validateHtmlContent = (input: string): ValidationResult => {
  if (/<[^>]*>/g.test(input)) {
    return { 
      isValid: false, 
      error: 'HTML tags are not allowed' 
    };
  }
  return { isValid: true, error: null };  // Added explicit null
};

export const sanitizeInput = (input: string): string => {
  // Remove any HTML tags and dangerous content
  const cleaned = DOMPurify.sanitize(input.trim(), {
    ALLOWED_TAGS: [], // No HTML tags allowed
    ALLOWED_ATTR: [], // No attributes allowed
  });

  // Only allow alphanumeric characters and basic punctuation
  return cleaned
    .replace(/[<>{}[\]]/g, '') // Remove specific special characters, allowing quotes
    .replace(/\s+/g, ' ')      // Normalize whitespace
    .trim();
};