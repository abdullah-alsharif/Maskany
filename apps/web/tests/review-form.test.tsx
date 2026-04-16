import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ReviewForm } from '../src/components/review-form';

describe('ReviewForm', () => {
  it('renders interactive star controls and a comment textarea', () => {
    render(<ReviewForm onSubmit={vi.fn()} />);
    expect(screen.getByRole('radiogroup', { name: /rate this property/i })).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: /comment/i })).toBeInTheDocument();
  });

  it('renders a submit button', () => {
    render(<ReviewForm onSubmit={vi.fn()} />);
    expect(screen.getByRole('button', { name: /submit review/i })).toBeInTheDocument();
  });

  it('shows a validation error when submitting with no rating selected', async () => {
    const onSubmit = vi.fn();
    render(<ReviewForm onSubmit={onSubmit} />);
    fireEvent.click(screen.getByRole('button', { name: /submit review/i }));
    await waitFor(() => {
      expect(screen.getByText(/please select a rating/i)).toBeInTheDocument();
    });
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('calls onSubmit with the selected rating and comment', async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    render(<ReviewForm onSubmit={onSubmit} />);
    const fourStars = screen.getByRole('button', { name: /rate 4 stars/i });
    fireEvent.click(fourStars);
    fireEvent.change(screen.getByRole('textbox', { name: /comment/i }), {
      target: { value: 'Wonderful stay' },
    });
    fireEvent.click(screen.getByRole('button', { name: /submit review/i }));
    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledWith({ rating: 4, comment: 'Wonderful stay' });
    });
  });

  it('sends null for an empty comment', async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    render(<ReviewForm onSubmit={onSubmit} />);
    fireEvent.click(screen.getByRole('button', { name: /rate 5 stars/i }));
    fireEvent.click(screen.getByRole('button', { name: /submit review/i }));
    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledWith({ rating: 5, comment: null });
    });
  });

  it('shows a submitting state on the button while the request is in flight', () => {
    render(<ReviewForm onSubmit={vi.fn()} isSubmitting />);
    const btn = screen.getByRole('button', { name: /submit review/i });
    expect(btn).toBeDisabled();
  });

  it('renders an error message when errorMessage is provided', () => {
    render(<ReviewForm onSubmit={vi.fn()} errorMessage="You already reviewed this property." />);
    expect(screen.getByText(/already reviewed this property/i)).toBeInTheDocument();
  });

  it('pre-fills rating and comment for edit mode', () => {
    render(
      <ReviewForm
        onSubmit={vi.fn()}
        initialRating={3}
        initialComment="Nice"
        submitLabel="Update review"
      />,
    );
    const textarea = screen.getByRole('textbox', { name: /comment/i }) as HTMLTextAreaElement;
    expect(textarea.value).toBe('Nice');
    expect(screen.getByText(/selected:\s*3 out of 5/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /update review/i })).toBeInTheDocument();
  });

  it('invokes onCancel when the cancel button is pressed', () => {
    const onCancel = vi.fn();
    render(<ReviewForm onSubmit={vi.fn()} onCancel={onCancel} />);
    fireEvent.click(screen.getByRole('button', { name: /cancel/i }));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });
});
