import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import GlobalError from '../src/app/error';

describe('GlobalError (T-045)', () => {
  it('renders the error heading and description', () => {
    const reset = vi.fn();
    render(<GlobalError error={new Error('test')} reset={reset} />);
    expect(screen.getByRole('heading', { name: /something went wrong/i })).toBeInTheDocument();
    expect(screen.getByText(/unexpected error/i)).toBeInTheDocument();
  });

  it('renders a Try again button that calls reset on click', () => {
    const reset = vi.fn();
    render(<GlobalError error={new Error('test')} reset={reset} />);
    const btn = screen.getByRole('button', { name: /try again/i });
    fireEvent.click(btn);
    expect(reset).toHaveBeenCalledTimes(1);
  });

  it('logs the error to console.error on mount', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const err = new Error('crash');
    render(<GlobalError error={err} reset={vi.fn()} />);
    expect(spy).toHaveBeenCalledWith(err);
    spy.mockRestore();
  });
});
