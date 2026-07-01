import { describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { OtpInput, OtpCountdown } from '../src/components/auth/otp-input';

describe('OtpInput (T-055)', () => {
  it('renders 6 digit input boxes by default', () => {
    render(<OtpInput onComplete={vi.fn()} />);
    const inputs = screen.getAllByLabelText(/digit \d/i);
    expect(inputs).toHaveLength(6);
  });

  it('renders custom length when provided', () => {
    render(<OtpInput length={4} onComplete={vi.fn()} />);
    const inputs = screen.getAllByLabelText(/digit \d/i);
    expect(inputs).toHaveLength(4);
  });

  it('calls onComplete when all digits are entered', () => {
    const onComplete = vi.fn();
    render(<OtpInput length={4} onComplete={onComplete} />);
    const inputs = screen.getAllByLabelText(/digit \d/i) as HTMLInputElement[];
    fireEvent.change(inputs[0], { target: { value: '1' } });
    fireEvent.change(inputs[1], { target: { value: '2' } });
    fireEvent.change(inputs[2], { target: { value: '3' } });
    fireEvent.change(inputs[3], { target: { value: '4' } });
    expect(onComplete).toHaveBeenCalledWith('1234');
  });

  it('rejects non-digit input', () => {
    const onComplete = vi.fn();
    render(<OtpInput length={4} onComplete={onComplete} />);
    const input = screen.getAllByLabelText(/digit \d/i)[0] as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'a' } });
    expect(input.value).toBe('');
    expect(onComplete).not.toHaveBeenCalled();
  });

  it('disables inputs when disabled prop is true', () => {
    render(<OtpInput disabled onComplete={vi.fn()} />);
    const inputs = screen.getAllByLabelText(/digit \d/i) as HTMLInputElement[];
    inputs.forEach((input) => expect(input.disabled).toBe(true));
  });

  it('displays error message when error prop is provided', () => {
    render(<OtpInput error="Invalid code" onComplete={vi.fn()} />);
    expect(screen.getByRole('alert')).toHaveTextContent('Invalid code');
  });

  it('moves focus to next input on digit entry', () => {
    render(<OtpInput length={3} onComplete={vi.fn()} />);
    const inputs = screen.getAllByLabelText(/digit \d/i) as HTMLInputElement[];
    fireEvent.change(inputs[0], { target: { value: '1' } });
    expect(document.activeElement).toBe(inputs[1]);
  });

  it('handles Backspace on a filled input to clear it', () => {
    render(<OtpInput length={3} onComplete={vi.fn()} />);
    const inputs = screen.getAllByLabelText(/digit \d/i) as HTMLInputElement[];

    fireEvent.change(inputs[0], { target: { value: '1' } });
    expect(inputs[0].value).toBe('1');

    fireEvent.keyDown(inputs[0], { key: 'Backspace' });
    expect(inputs[0].value).toBe('');
  });

  it('moves focus back on Backspace when current input is empty', () => {
    render(<OtpInput length={3} onComplete={vi.fn()} />);
    const inputs = screen.getAllByLabelText(/digit \d/i) as HTMLInputElement[];

    fireEvent.change(inputs[0], { target: { value: '1' } });
    fireEvent.change(inputs[1], { target: { value: '2' } });
    fireEvent.keyDown(inputs[1], { key: 'Backspace' });

    expect(inputs[1].value).toBe('');
    expect(inputs[0].value).toBe('1');
  });

  it('handles ArrowLeft and ArrowRight key navigation', () => {
    render(<OtpInput length={3} onComplete={vi.fn()} />);
    const inputs = screen.getAllByLabelText(/digit \d/i) as HTMLInputElement[];

    fireEvent.keyDown(inputs[1], { key: 'ArrowLeft' });
    expect(document.activeElement).toBe(inputs[0]);

    fireEvent.keyDown(inputs[0], { key: 'ArrowRight' });
    expect(document.activeElement).toBe(inputs[1]);
  });
});

describe('OtpCountdown (T-056)', () => {
  it('renders countdown timer with correct format', () => {
    render(<OtpCountdown seconds={65} onExpired={vi.fn()} onResend={vi.fn()} />);
    expect(screen.getByText(/code expires in/i)).toBeInTheDocument();
    expect(screen.getByText(/1:05/)).toBeInTheDocument();
  });

  it('shows resend button after 30 seconds', () => {
    vi.useFakeTimers();
    render(<OtpCountdown seconds={120} onExpired={vi.fn()} onResend={vi.fn()} />);
    expect(screen.queryByRole('button', { name: /resend code/i })).not.toBeInTheDocument();
    act(() => {
      vi.advanceTimersByTime(31_000);
    });
    expect(screen.getByRole('button', { name: /resend code/i })).toBeInTheDocument();
    vi.useRealTimers();
  });

  it('calls onExpired when countdown reaches 0', () => {
    vi.useFakeTimers();
    const onExpired = vi.fn();
    render(<OtpCountdown seconds={2} onExpired={onExpired} onResend={vi.fn()} />);
    act(() => {
      vi.advanceTimersByTime(3000);
    });
    expect(onExpired).toHaveBeenCalled();
    vi.useRealTimers();
  });

  it('calls onResend and resets timer when resend button clicked', () => {
    vi.useFakeTimers();
    const onResend = vi.fn();
    render(<OtpCountdown seconds={120} onExpired={vi.fn()} onResend={onResend} />);
    act(() => {
      vi.advanceTimersByTime(31_000);
    });

    fireEvent.click(screen.getByRole('button', { name: /resend code/i }));
    expect(onResend).toHaveBeenCalledTimes(1);
    vi.useRealTimers();
  });
});
