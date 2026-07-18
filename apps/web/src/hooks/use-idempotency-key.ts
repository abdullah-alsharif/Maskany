import { useRef } from 'react';

function generateUUID(): string {
  return crypto.randomUUID();
}

export function useIdempotencyKey(): { key: string; reset: () => void } {
  const keyRef = useRef(generateUUID());

  return {
    get key() {
      return keyRef.current;
    },
    reset: () => {
      keyRef.current = generateUUID();
    },
  };
}
