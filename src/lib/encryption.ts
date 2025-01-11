/**
 * Handles client-side encryption/decryption of questions and responses
 * using the Web Crypto API with AES-GCM
 */

// Type for our encryption key bundle
export interface EncryptionKeyBundle {
    key: CryptoKey;      // The actual CryptoKey object for encryption/decryption
    encoded: string;     // Base64 encoded version for URL fragments
  }
  
  export class EncryptionUtils {
    /**
     * Generates a new encryption key for a question
     */
    static async generateKey(): Promise<EncryptionKeyBundle> {
      // Generate a random 256-bit AES key
      const key = await window.crypto.subtle.generateKey(
        {
          name: 'AES-GCM',
          length: 256
        },
        true,  // extractable
        ['encrypt', 'decrypt']
      );
  
      // Export the key to raw format
      const rawKey = await window.crypto.subtle.exportKey('raw', key);
      
      // Convert to base64 for URL
      const encoded = btoa(String.fromCharCode(...new Uint8Array(rawKey)))
        .replace(/\+/g, '-')  // URL-safe base64
        .replace(/\//g, '_')
        .replace(/=+$/, '');
  
      return { key, encoded };
    }
  
    /**
     * Recreates a CryptoKey from a URL fragment
     */
    static async keyFromFragment(fragment: string): Promise<CryptoKey> {
      // Decode URL-safe base64
      const normalized = fragment
        .replace(/-/g, '+')
        .replace(/_/g, '/');
      
      const rawKey = Uint8Array.from(atob(normalized), c => c.charCodeAt(0));
  
      // Import as CryptoKey
      return window.crypto.subtle.importKey(
        'raw',
        rawKey,
        { name: 'AES-GCM', length: 256 },
        true,
        ['encrypt', 'decrypt']
      );
    }
  
    /**
     * Encrypts text using the provided key
     */
    static async encrypt(text: string, key: CryptoKey): Promise<string> {
      // Generate a random IV for each encryption
      const iv = window.crypto.getRandomValues(new Uint8Array(12));
      
      // Encode the text
      const encoded = new TextEncoder().encode(text);
  
      // Encrypt
      const ciphertext = await window.crypto.subtle.encrypt(
        {
          name: 'AES-GCM',
          iv
        },
        key,
        encoded
      );
  
      // Combine IV and ciphertext
      const combined = new Uint8Array(iv.length + ciphertext.byteLength);
      combined.set(iv);
      combined.set(new Uint8Array(ciphertext), iv.length);
  
      // Convert to URL-safe base64
      return btoa(String.fromCharCode(...combined))
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/, '');
    }
  
    /**
     * Decrypts text using the provided key
     */
    static async decrypt(encrypted: string, key: CryptoKey): Promise<string> {
      try {
        // Decode from URL-safe base64
        const normalized = encrypted
          .replace(/-/g, '+')
          .replace(/_/g, '/');
        
        const combined = Uint8Array.from(atob(normalized), c => c.charCodeAt(0));
  
        // Split IV and ciphertext
        const iv = combined.slice(0, 12);
        const ciphertext = combined.slice(12);
  
        // Decrypt
        const decrypted = await window.crypto.subtle.decrypt(
          {
            name: 'AES-GCM',
            iv
          },
          key,
          ciphertext
        );
  
        // Decode the result
        return new TextDecoder().decode(decrypted);
      } catch (error) {
        throw new Error('Failed to decrypt data. Invalid key or corrupted data.');
      }
    }
  }