interface SpamCheckResult {
    isSpam: boolean;
    reason?: string;
  }
  
  export function checkForSpam(content: string): SpamCheckResult {
    // Check for repeated characters
    const repeatedChars = /(.)\1{9,}/;
    if (repeatedChars.test(content)) {
      return { isSpam: true, reason: 'Too many repeated characters' };
    }
  
    // Check for excessive URLs
    const urlCount = (content.match(/https?:\/\//g) || []).length;
    if (urlCount > 3) {
      return { isSpam: true, reason: 'Too many URLs' };
    }
  
    // Check for identical word repetition
    const words = content.toLowerCase().split(/\s+/);
    const wordFreq = new Map<string, number>();
    words.forEach(word => {
      wordFreq.set(word, (wordFreq.get(word) || 0) + 1);
    });
    
    const maxWordRepetition = Math.max(...Array.from(wordFreq.values()));
    if (maxWordRepetition > 5 && words.length > 10) {
      return { isSpam: true, reason: 'Excessive word repetition' };
    }
  
    return { isSpam: false };
  }
  
  // Store recent responses per IP
  const recentResponsesByIP = new Map<string, Map<string, Set<string>>>();
  
  export function isDuplicateResponse(questionId: string, response: string, ip: string): boolean {
    if (!recentResponsesByIP.has(ip)) {
      recentResponsesByIP.set(ip, new Map());
    }
  
    const userResponses = recentResponsesByIP.get(ip)!;
    if (!userResponses.has(questionId)) {
      userResponses.set(questionId, new Set());
    }
  
    const responseSet = userResponses.get(questionId)!;
    const normalizedResponse = response.toLowerCase().trim();
    
    if (responseSet.has(normalizedResponse)) {
      return true;
    }
  
    responseSet.add(normalizedResponse);
  
    // Keep only recent responses
    if (responseSet.size > 100) {
      const entries = Array.from(responseSet);
      userResponses.set(questionId, new Set(entries.slice(-100)));
    }
  
    return false;
  }