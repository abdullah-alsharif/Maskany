import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { BottomSheet } from '../src/components/ui/bottom-sheet';

describe('BottomSheet (T-062)', () => {
  it('returns null when open is false', () => {
    const { container } = render(
      <BottomSheet open={false} onClose={vi.fn()}>
        <div>Content</div>
      </BottomSheet>,
    );
    expect(container.innerHTML).toBe('');
  });

  it('renders content when open is true', () => {
    render(
      <BottomSheet open onClose={vi.fn()}>
        <div data-testid="content">Sheet content</div>
      </BottomSheet>,
    );
    expect(screen.getByTestId('content')).toBeInTheDocument();
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('renders title when provided', () => {
    render(
      <BottomSheet open onClose={vi.fn()} title="Filters">
        <div>Content</div>
      </BottomSheet>,
    );
    expect(screen.getByRole('heading', { level: 2, name: /filters/i })).toBeInTheDocument();
  });

  it('calls onClose when backdrop is clicked', () => {
    const onClose = vi.fn();
    render(
      <BottomSheet open onClose={onClose}>
        <div>Content</div>
      </BottomSheet>,
    );
    const backdrop = document.querySelector('.bg-black\\/40');
    // Use parent access — the first child of dialog that's aria-hidden
    const dialog = screen.getByRole('dialog');
    const firstChild = dialog.firstChild;
    if (firstChild) {
      fireEvent.click(firstChild);
      expect(onClose).toHaveBeenCalledTimes(1);
    }
  });

  it('calls onClose when Escape key is pressed', () => {
    const onClose = vi.fn();
    render(
      <BottomSheet open onClose={onClose}>
        <div>Content</div>
      </BottomSheet>,
    );
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('locks body scroll when open', () => {
    render(
      <BottomSheet open onClose={vi.fn()}>
        <div>Content</div>
      </BottomSheet>,
    );
    expect(document.body.style.overflow).toBe('hidden');
  });

  it('restores body scroll on close', () => {
    const { rerender } = render(
      <BottomSheet open onClose={vi.fn()}>
        <div>Content</div>
      </BottomSheet>,
    );
    rerender(
      <BottomSheet open={false} onClose={vi.fn()}>
        <div>Content</div>
      </BottomSheet>,
    );
    expect(document.body.style.overflow).toBe('');
  });

  it('does not call onClose for non-Escape key presses', () => {
    const onClose = vi.fn();
    render(
      <BottomSheet open onClose={onClose}>
        <div>Content</div>
      </BottomSheet>,
    );
    fireEvent.keyDown(document, { key: 'Enter' });
    expect(onClose).not.toHaveBeenCalled();
  });

  it('handles touch start on the sheet', () => {
    const onClose = vi.fn();
    render(
      <BottomSheet open onClose={onClose}>
        <div>Content</div>
      </BottomSheet>,
    );
    const sheet = screen.getByRole('dialog').lastElementChild;
    if (sheet) {
      fireEvent.touchStart(sheet, { touches: [{ clientX: 0, clientY: 100 }] });
      fireEvent.touchMove(sheet, { touches: [{ clientX: 0, clientY: 250 }] });
    }
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('closes when touch ends with drag delta > 100px', () => {
    const onClose = vi.fn();
    render(
      <BottomSheet open onClose={onClose}>
        <div>Content</div>
      </BottomSheet>,
    );
    const sheet = screen.getByRole('dialog').lastElementChild;
    if (sheet) {
      fireEvent.touchStart(sheet, { touches: [{ clientX: 0, clientY: 100 }] });
      fireEvent.touchMove(sheet, { touches: [{ clientX: 0, clientY: 250 }] });
      fireEvent.touchEnd(sheet);
    }
    expect(onClose).toHaveBeenCalled();
  });

  it('does not close when touch drag delta is below threshold', () => {
    const onClose = vi.fn();
    render(
      <BottomSheet open onClose={onClose}>
        <div>Content</div>
      </BottomSheet>,
    );
    const sheet = screen.getByRole('dialog').lastElementChild;
    if (sheet) {
      fireEvent.touchStart(sheet, { touches: [{ clientX: 0, clientY: 100 }] });
      fireEvent.touchMove(sheet, { touches: [{ clientX: 0, clientY: 150 }] });
      fireEvent.touchEnd(sheet);
    }
    expect(onClose).not.toHaveBeenCalled();
  });
});
