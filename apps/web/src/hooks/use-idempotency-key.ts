import { useRef } from 'react';

function generateUUID(): string {
  return crypto.randomUUID();
}

function hashContent(content: string): string {
  let hash = 0;
  for (let i = 0; i < content.length; i++) {
    const char = content.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash |= 0;
  }
  return Math.abs(hash).toString(36);
}

export type IdempotencyKey = {
  key: string;
  reset: () => void;
  keyFor: (content: string) => string;
};

export function useIdempotencyKey(): IdempotencyKey {
  const keyRef = useRef(generateUUID());

  return {
    get key() {
      return keyRef.current;
    },
    reset: () => {
      keyRef.current = generateUUID();
    },
    keyFor: (content: string) => {
      return `${keyRef.current}-${hashContent(content)}`;
    },
  };
}
