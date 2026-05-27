import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { Header } from '../src/components/layout/header';
import { useRouter } from 'next/navigation';

describe('Header (T-054)', () => {
  it('renders the Maskany logo when showBack is false', () => {
    render(<Header />);
    expect(screen.getByText('Maskany')).toBeInTheDocument();
  });

  it('renders a back button when showBack is true', () => {
    render(<Header showBack />);
    expect(screen.getByRole('button', { name: /go back/i })).toBeInTheDocument();
    expect(screen.queryByText('Maskany')).not.toBeInTheDocument();
  });

  it('renders a title when provided', () => {
    render(<Header showBack title="Property Detail" />);
    expect(screen.getByText('Property Detail')).toBeInTheDocument();
  });

  it('renders a share button when showShare is true', () => {
    render(<Header showShare />);
    expect(screen.getByRole('button', { name: /share/i })).toBeInTheDocument();
  });

  it('calls the custom onShare handler when provided', () => {
    const onShare = vi.fn();
    render(<Header showShare onShare={onShare} />);
    fireEvent.click(screen.getByRole('button', { name: /share/i }));
    expect(onShare).toHaveBeenCalledTimes(1);
  });

  it('uses navigator.share when no onShare provided', async () => {
    const shareMock = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'share', {
      configurable: true,
      value: shareMock,
    });
    render(<Header showShare />);
    fireEvent.click(screen.getByRole('button', { name: /share/i }));
    expect(shareMock).toHaveBeenCalledTimes(1);
  });

  it('falls back to clipboard when navigator.share is not available', async () => {
    Object.defineProperty(navigator, 'share', {
      configurable: true,
      value: undefined,
    });
    const clipboardMock = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText: clipboardMock },
    });
    render(<Header showShare />);
    fireEvent.click(screen.getByRole('button', { name: /share/i }));
    expect(clipboardMock).toHaveBeenCalledWith('http://localhost:3000/');
  });

  it('renders actions slot', () => {
    render(<Header actions={<button data-testid="action-btn">Action</button>} />);
    expect(screen.getByTestId('action-btn')).toBeInTheDocument();
  });

  it('applies transparent styling when transparent prop is true', () => {
    const { container } = render(<Header showBack transparent />);
    const header = container.querySelector('header');
    expect(header?.className).toContain('bg-transparent');
  });

  it('calls router.back() when the back button is clicked', () => {
    const router = useRouter();
    const backSpy = vi.spyOn(router, 'back');
    render(<Header showBack />);
    fireEvent.click(screen.getByRole('button', { name: /go back/i }));
    expect(backSpy).toHaveBeenCalledTimes(1);
    backSpy.mockRestore();
  });
});
