import { useRef, useState, useEffect, type ClipboardEvent, type KeyboardEvent } from 'react';

type OtpInputProps = {
  length?: number;
  onComplete: (code: string) => void;
  disabled?: boolean;
  error?: string;
};

export function OtpInput({ length = 6, onComplete, disabled = false, error }: OtpInputProps) {
  const [values, setValues] = useState<string[]>(Array(length).fill(''));
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    inputRefs.current[0]?.focus();
  }, []);

  const focusInput = (index: number) => {
    const target = inputRefs.current[Math.max(0, Math.min(index, length - 1))];
    target?.focus();
    target?.select();
  };

  const handleChange = (index: number, digit: string) => {
    if (!/^\d?$/.test(digit)) return;

    const newValues = [...values];
    newValues[index] = digit;
    setValues(newValues);

    if (digit && index < length - 1) {
      focusInput(index + 1);
    }

    const code = newValues.join('');
    if (code.length === length && newValues.every((v) => v !== '')) {
      onComplete(code);
    }
  };

  const handleKeyDown = (index: number, e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace') {
      if (!values[index] && index > 0) {
        const newValues = [...values];
        newValues[index - 1] = '';
        setValues(newValues);
        focusInput(index - 1);
      } else {
        const newValues = [...values];
        newValues[index] = '';
        setValues(newValues);
      }
    } else if (e.key === 'ArrowLeft') {
      focusInput(index - 1);
    } else if (e.key === 'ArrowRight') {
      focusInput(index + 1);
    }
  };

  const handlePaste = (e: ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, length);
    if (!pasted) return;

    const newValues = [...values];
    for (let i = 0; i < pasted.length; i++) {
      newValues[i] = pasted[i];
    }
    setValues(newValues);

    if (pasted.length === length) {
      onComplete(pasted);
    } else {
      focusInput(pasted.length);
    }
  };

  return (
    <div>
      <div
        className="flex justify-center gap-2.5"
        role="group"
        aria-label="One-time password input"
      >
        {values.map((value, index) => (
          <input
            key={index}
            ref={(el) => {
              inputRefs.current[index] = el;
            }}
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={1}
            value={value}
            disabled={disabled}
            onChange={(e) => handleChange(index, e.target.value)}
            onKeyDown={(e) => handleKeyDown(index, e)}
            onPaste={index === 0 ? handlePaste : undefined}
            onFocus={(e) => e.target.select()}
            className={`
              w-12 h-14 sm:w-14 sm:h-16
              text-center text-xl sm:text-2xl font-bold
              rounded-xl border-2
              transition-shadow transition-colors duration-200
              focus:outline-none
              disabled:opacity-50 disabled:cursor-not-allowed
              ${
                error
                  ? 'border-red-300 text-red-600 bg-red-50 focus:border-red-400 focus:ring-2 focus:ring-red-100'
                  : value
                    ? 'border-terracotta-300 text-stone-900 bg-terracotta-50 focus:border-terracotta-400 focus:ring-2 focus:ring-terracotta-100'
                    : 'border-stone-300 text-stone-900 bg-white focus:border-terracotta-400 focus:ring-2 focus:ring-terracotta-100'
              }
            `}
            aria-label={`Digit ${index + 1}`}
          />
        ))}
      </div>

      {error && (
        <p className="mt-3 text-center text-sm text-red-600 font-medium" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

/* ── Countdown Timer ── */
type CountdownProps = {
  seconds: number;
  onExpired: () => void;
  onResend: () => void;
};

export function OtpCountdown({ seconds, onExpired, onResend }: CountdownProps) {
  const [remaining, setRemaining] = useState(seconds);
  const [canResend, setCanResend] = useState(false);

  useEffect(() => {
    if (remaining <= 0) {
      onExpired();
      return;
    }
    const timer = setInterval(() => {
      setRemaining((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [remaining, onExpired]);

  useEffect(() => {
    const resendTimer = setTimeout(() => setCanResend(true), 30_000);
    return () => clearTimeout(resendTimer);
  }, []);

  const mins = Math.floor(remaining / 60);
  const secs = remaining % 60;

  return (
    <div className="text-center space-y-2">
      <p className="text-sm text-stone-500">
        Code expires in{' '}
        <span className="font-semibold text-stone-700 tabular-nums">
          {mins}:{secs.toString().padStart(2, '0')}
        </span>
      </p>
      {canResend && (
        <button
          onClick={() => {
            onResend();
            setCanResend(false);
            setRemaining(seconds);
          }}
          className="inline-flex items-center justify-center min-h-[44px] px-4 text-sm font-semibold text-terracotta-600 hover:text-terracotta-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-terracotta-100 rounded-lg transition-colors"
        >
          Resend code
        </button>
      )}
    </div>
  );
}
