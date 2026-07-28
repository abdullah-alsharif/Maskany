import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { CountryCodeSelect } from '../src/components/ui/CountryCodeSelect';

describe('CountryCodeSelect', () => {
  it('renders with label', () => {
    render(<CountryCodeSelect value="+966" onChange={() => {}} label="Country code" />);
    expect(screen.getByLabelText('Country code')).toBeInTheDocument();
  });

  it('renders without label', () => {
    render(<CountryCodeSelect value="+966" onChange={() => {}} />);
    expect(screen.getByRole('combobox')).toBeInTheDocument();
  });

  it('calls onChange when selection changes', () => {
    const onChange = vi.fn();
    render(<CountryCodeSelect value="+966" onChange={onChange} />);
    fireEvent.change(screen.getByRole('combobox'), { target: { value: '+971' } });
    expect(onChange).toHaveBeenCalledWith('+971');
  });

  it('uses custom id', () => {
    render(<CountryCodeSelect value="+966" onChange={() => {}} id="custom-id" label="Code" />);
    expect(screen.getByLabelText('Code')).toHaveAttribute('id', 'custom-id');
  });
});
