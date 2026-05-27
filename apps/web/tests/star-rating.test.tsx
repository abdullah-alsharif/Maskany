import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { StarRating } from '../src/components/star-rating';

function countByFill(container: HTMLElement, fill: 'full' | 'half' | 'empty') {
  return container.querySelectorAll(`svg[data-fill="${fill}"]`).length;
}

describe('StarRating — display mode', () => {
  it('renders 5 full stars for a value of 5', () => {
    const { container } = render(<StarRating value={5} />);
    expect(countByFill(container, 'full')).toBe(5);
    expect(countByFill(container, 'half')).toBe(0);
    expect(countByFill(container, 'empty')).toBe(0);
  });

  it('renders 3 full + 1 half + 1 empty for a value of 3.5', () => {
    const { container } = render(<StarRating value={3.5} />);
    expect(countByFill(container, 'full')).toBe(3);
    expect(countByFill(container, 'half')).toBe(1);
    expect(countByFill(container, 'empty')).toBe(1);
  });

  it('renders 2 full + 1 half + 2 empty for a value of 2.5', () => {
    const { container } = render(<StarRating value={2.5} />);
    expect(countByFill(container, 'full')).toBe(2);
    expect(countByFill(container, 'half')).toBe(1);
    expect(countByFill(container, 'empty')).toBe(2);
  });

  it('renders 4 full + 1 empty for a value of 4 (integer)', () => {
    const { container } = render(<StarRating value={4} />);
    expect(countByFill(container, 'full')).toBe(4);
    expect(countByFill(container, 'half')).toBe(0);
    expect(countByFill(container, 'empty')).toBe(1);
  });

  it('renders 5 empty stars for a value of 0', () => {
    const { container } = render(<StarRating value={0} />);
    expect(countByFill(container, 'empty')).toBe(5);
  });

  it('shows rating number and review count text in display mode', () => {
    render(<StarRating value={4.2} reviewCount={128} />);
    expect(screen.getByText('4.2')).toBeInTheDocument();
    expect(screen.getByText('(128 reviews)')).toBeInTheDocument();
  });

  it('uses singular "review" when reviewCount is 1', () => {
    render(<StarRating value={4} reviewCount={1} />);
    expect(screen.getByText('(1 review)')).toBeInTheDocument();
  });

  it('omits review count text when reviewCount is 0', () => {
    render(<StarRating value={4} reviewCount={0} />);
    expect(screen.queryByText(/review/)).toBeNull();
  });

  it('hides numeric value when showValue is false', () => {
    render(<StarRating value={4.2} showValue={false} />);
    expect(screen.queryByText('4.2')).toBeNull();
  });

  it('exposes an aria-label describing the rating value', () => {
    render(<StarRating value={4} />);
    const group = screen.getByRole('img');
    expect(group.getAttribute('aria-label')).toMatch(/4 out of 5 stars/);
  });
});

describe('StarRating — interactive mode', () => {
  it('fires onChange with the clicked star value (right half = full star)', () => {
    const handleChange = vi.fn();
    render(<StarRating value={0} onChange={handleChange} />);
    const rateFour = screen.getByRole('button', { name: /^rate 4 stars$/i });
    fireEvent.click(rateFour);
    expect(handleChange).toHaveBeenCalledTimes(1);
    expect(handleChange).toHaveBeenCalledWith(4);
  });

  it('fires onChange with half-star precision when left half is clicked', () => {
    const handleChange = vi.fn();
    render(<StarRating value={0} onChange={handleChange} />);
    const rateHalfThree = screen.getByRole('button', { name: /^rate 2\.5 stars$/i });
    fireEvent.click(rateHalfThree);
    expect(handleChange).toHaveBeenCalledWith(2.5);
  });

  it('fires onChange with 1 for the first star right-half click', () => {
    const handleChange = vi.fn();
    render(<StarRating value={0} onChange={handleChange} />);
    const rateOne = screen.getByRole('button', { name: /^rate 1 star$/i });
    fireEvent.click(rateOne);
    expect(handleChange).toHaveBeenCalledWith(1);
  });

  it('exposes radiogroup role with the prompt aria-label', () => {
    render(<StarRating value={0} onChange={() => {}} />);
    const group = screen.getByRole('radiogroup');
    expect(group.getAttribute('aria-label')).toMatch(/rate/i);
  });

  it('shows the selected rating text below the stars when a value is chosen', () => {
    render(<StarRating value={3} onChange={() => {}} />);
    expect(screen.getByText(/selected:\s*3\s*out of 5/i)).toBeInTheDocument();
  });

  it('shows hover preview when the user hovers over a star half', () => {
    const { container } = render(<StarRating value={0} onChange={() => {}} />);
    const rateFour = screen.getByRole('button', { name: /^rate 4 stars$/i });
    fireEvent.mouseEnter(rateFour);
    expect(countByFill(container, 'full')).toBe(4);
    expect(countByFill(container, 'empty')).toBe(1);
  });

  it('applies a scale animation class to interactive star halves', () => {
    render(<StarRating value={0} onChange={() => {}} />);
    const rateOne = screen.getByRole('button', { name: /^rate 1 star$/i });
    expect(rateOne.className).toMatch(/scale/);
  });

  it('shows hover preview on focus and resets on blur', () => {
    const { container } = render(<StarRating value={0} onChange={() => {}} />);
    const rateFour = screen.getByRole('button', { name: /^rate 4 stars$/i });
    fireEvent.focus(rateFour);
    expect(countByFill(container, 'full')).toBe(4);
    expect(countByFill(container, 'empty')).toBe(1);
    fireEvent.blur(rateFour);
    expect(countByFill(container, 'full')).toBe(0);
    expect(countByFill(container, 'empty')).toBe(5);
  });

  it('resets hover preview on mouse leave', () => {
    const { container } = render(<StarRating value={0} onChange={() => {}} />);
    const rateFour = screen.getByRole('button', { name: /^rate 4 stars$/i });
    fireEvent.mouseEnter(rateFour);
    expect(countByFill(container, 'full')).toBe(4);
    const starsRow = container.querySelector('[role="radiogroup"] > div')!;
    fireEvent.mouseLeave(starsRow);
    expect(countByFill(container, 'full')).toBe(0);
  });

  it('handles right-half click on last star to set rating to 5', () => {
    const handleChange = vi.fn();
    render(<StarRating value={0} onChange={handleChange} />);
    const rateFive = screen.getByRole('button', { name: /^rate 5 stars$/i });
    fireEvent.click(rateFive);
    expect(handleChange).toHaveBeenCalledWith(5);
  });

  it('shows half-star hover preview on left-half focus', () => {
    const { container } = render(<StarRating value={0} onChange={() => {}} />);
    const leftHalfTwo = screen.getByRole('button', { name: /^rate 1\.5 stars$/i });
    fireEvent.focus(leftHalfTwo);
    expect(countByFill(container, 'full')).toBe(1);
    expect(countByFill(container, 'half')).toBe(1);
  });
});
