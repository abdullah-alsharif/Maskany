import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { AmenityChips } from '../src/components/amenity-chips';

describe('AmenityChips', () => {
  it('renders a chip for each known amenity with its label', () => {
    render(<AmenityChips amenities={['wifi', 'parking', 'pool']} />);
    expect(screen.getByText('Wi-Fi')).toBeInTheDocument();
    expect(screen.getByText('Parking')).toBeInTheDocument();
    expect(screen.getByText('Pool')).toBeInTheDocument();
  });

  it('renders each chip inside a list for accessibility', () => {
    render(<AmenityChips amenities={['wifi', 'gym']} />);
    const list = screen.getByRole('list', { name: /amenities/i });
    expect(list).toBeInTheDocument();
    const items = screen.getAllByRole('listitem');
    expect(items).toHaveLength(2);
  });

  it('renders an icon beside each known amenity label', () => {
    const { container } = render(<AmenityChips amenities={['wifi']} />);
    const chip = screen.getByText('Wi-Fi').closest('li');
    expect(chip).not.toBeNull();
    expect(chip!.querySelector('svg')).not.toBeNull();
    expect(container.querySelectorAll('li')).toHaveLength(1);
  });

  it('falls back to a humanised label for unknown amenities', () => {
    render(<AmenityChips amenities={['rooftop-bar']} />);
    // unknown keys render with capitalised label and a generic icon
    expect(screen.getByText(/rooftop-bar/i)).toBeInTheDocument();
  });

  it('returns nothing visible when the amenity list is empty', () => {
    const { container } = render(<AmenityChips amenities={[]} />);
    expect(container.querySelector('ul')).toBeNull();
  });

  it('lays chips out as a horizontal wrap via flex-wrap', () => {
    const { container } = render(<AmenityChips amenities={['wifi', 'pool']} />);
    const list = container.querySelector('ul');
    expect(list).not.toBeNull();
    expect(list!.className).toMatch(/flex-wrap/);
  });
});
