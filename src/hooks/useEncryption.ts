import { useState, useEffect } from 'react';
import { EncryptionUtils } from '@/lib/encryption';

interface UseEncryptionReturn {
  // For creating new questions
  generateKeyAndEncrypt: (text: string) => Promise<{
    encryptedText: string;
    keyFragment: string;
  }>;
  
  // For pages that need to decrypt (dashboard/response form)
  decryptWithFragment: (encryptedText: string) => Promise<string>;
  encryptWithFragment: (text: string) => Promise<string>;
  isReady: boolean;
  error: string | null;
}

export function useEncryption(urlFragment?: string): UseEncryptionReturn {
  const [key, setKey] = useState<CryptoKey | null>(null);
  const [error, setError] = useState<string | null>(null);

  // If a URL fragment is provided, import the key on mount
  useEffect(() => {
    const importKey = async () => {
      if (!urlFragment) return;
      
      try {
        const importedKey = await EncryptionUtils.keyFromFragment(urlFragment);
        setKey(importedKey);
        setError(null);
      } catch (err) {
        console.error('Error importing key:', err);
        setError('Invalid encryption key');
      }
    };

    importKey();
  }, [urlFragment]);

  // For creating new encrypted questions
  const generateKeyAndEncrypt = async (text: string) => {
    try {
      const { key: newKey, encoded: keyFragment } = await EncryptionUtils.generateKey();
      const encryptedText = await EncryptionUtils.encrypt(text, newKey);
      return { encryptedText, keyFragment };
    } catch (err) {
      console.error('Error encrypting:', err);
      throw new Error('Failed to encrypt data');
    }
  };

  // For decrypting with existing key from URL fragment
  const decryptWithFragment = async (encryptedText: string) => {
    if (!key) throw new Error('Encryption key not loaded');
    try {
      return await EncryptionUtils.decrypt(encryptedText, key);
    } catch (err) {
      console.error('Error decrypting:', err);
      throw new Error('Failed to decrypt data');
    }
  };

  // For encrypting responses with existing key
  const encryptWithFragment = async (text: string) => {
    if (!key) throw new Error('Encryption key not loaded');
    try {
      return await EncryptionUtils.encrypt(text, key);
    } catch (err) {
      console.error('Error encrypting:', err);
      throw new Error('Failed to encrypt data');
    }
  };

  return {
    generateKeyAndEncrypt,
    decryptWithFragment,
    encryptWithFragment,
    isReady: !!key,
    error
  };
}