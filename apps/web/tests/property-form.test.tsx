/**
 * T-028 — PropertyForm multi-step form unit tests.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { PropertyForm } from '../src/components/property-form';

beforeEach(() => {
  Object.defineProperty(URL, 'createObjectURL', {
    configurable: true,
    value: (_file: File) => `blob:preview`,
  });
  Object.defineProperty(URL, 'revokeObjectURL', {
    configurable: true,
    value: () => undefined,
  });
});

function renderForm(onSubmit = vi.fn()) {
  return render(<PropertyForm mode="create" onSubmit={onSubmit} />);
}

describe('PropertyForm', () => {
  it('renders step 1 (basics) by default with title, type, and description inputs', () => {
    renderForm();
    expect(screen.getByRole('heading', { name: /basics/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/title/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/property type/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/description/i)).toBeInTheDocument();
  });

  it('shows a progress indicator with six steps and highlights the current one', () => {
    renderForm();
    const progress = screen.getByRole('progressbar');
    expect(progress).toHaveAttribute('aria-valuemin', '1');
    expect(progress).toHaveAttribute('aria-valuemax', '6');
    expect(progress).toHaveAttribute('aria-valuenow', '1');
  });

  it('prevents advancing from step 1 when the title is empty', () => {
    renderForm();
    fireEvent.click(screen.getByRole('button', { name: /next/i }));
    expect(screen.getByRole('alert')).toHaveTextContent(/title/i);
    expect(screen.getByRole('heading', { name: /basics/i })).toBeInTheDocument();
  });

  it('advances step by step through basics → details → location → images → contact → review', () => {
    renderForm();

    // Step 1: basics
    fireEvent.change(screen.getByLabelText(/title/i), { target: { value: 'Sunlit Loft' } });
    fireEvent.change(screen.getByLabelText(/property type/i), { target: { value: 'APARTMENT' } });
    fireEvent.change(screen.getByLabelText(/description/i), {
      target: { value: 'A sun-drenched loft in the old quarter.' },
    });
    fireEvent.click(screen.getByRole('button', { name: /next/i }));

    // Step 2: details
    expect(screen.getByRole('heading', { name: /details/i })).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText(/price/i), { target: { value: '1200' } });
    fireEvent.change(screen.getByLabelText(/bedrooms/i), { target: { value: '2' } });
    fireEvent.change(screen.getByLabelText(/bathrooms/i), { target: { value: '1' } });
    fireEvent.click(screen.getByRole('button', { name: /next/i }));

    // Step 3: location
    expect(screen.getByRole('heading', { name: /location/i })).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText(/city/i), { target: { value: 'Riyadh' } });
    fireEvent.change(screen.getByLabelText(/area/i), { target: { value: 'Al Olaya' } });
    fireEvent.change(screen.getByLabelText(/country/i), { target: { value: 'SA' } });
    fireEvent.click(screen.getByRole('button', { name: /next/i }));

    // Step 4: images
    expect(screen.getByRole('heading', { name: /images/i })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /next/i }));

    // Step 5: contact
    expect(screen.getByRole('heading', { name: /contact/i })).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText(/whatsapp number/i), {
      target: { value: '+966500000000' },
    });
    fireEvent.click(screen.getByRole('button', { name: /next/i }));

    // Step 6: review
    expect(screen.getByRole('heading', { name: /review/i })).toBeInTheDocument();
    expect(screen.getByText(/sunlit loft/i)).toBeInTheDocument();
    expect(screen.getByText(/riyadh/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /publish/i })).toBeInTheDocument();
  });

  it('blocks advancing from step 2 when price is missing', () => {
    renderForm();
    fireEvent.change(screen.getByLabelText(/title/i), { target: { value: 'Villa' } });
    fireEvent.click(screen.getByRole('button', { name: /next/i }));

    fireEvent.click(screen.getByRole('button', { name: /next/i }));
    expect(screen.getByRole('alert')).toHaveTextContent(/price/i);
    expect(screen.getByRole('heading', { name: /details/i })).toBeInTheDocument();
  });

  it('blocks advancing from step 3 when city is missing', () => {
    renderForm();
    fireEvent.change(screen.getByLabelText(/title/i), { target: { value: 'Villa' } });
    fireEvent.click(screen.getByRole('button', { name: /next/i }));
    fireEvent.change(screen.getByLabelText(/price/i), { target: { value: '1000' } });
    fireEvent.click(screen.getByRole('button', { name: /next/i }));

    fireEvent.click(screen.getByRole('button', { name: /next/i }));
    expect(screen.getByRole('alert')).toHaveTextContent(/city/i);
    expect(screen.getByRole('heading', { name: /location/i })).toBeInTheDocument();
  });

  it('blocks advancing from step 5 when WhatsApp number is invalid', () => {
    renderForm();
    fireEvent.change(screen.getByLabelText(/title/i), { target: { value: 'Villa' } });
    fireEvent.click(screen.getByRole('button', { name: /next/i }));
    fireEvent.change(screen.getByLabelText(/price/i), { target: { value: '1000' } });
    fireEvent.click(screen.getByRole('button', { name: /next/i }));
    fireEvent.change(screen.getByLabelText(/city/i), { target: { value: 'Riyadh' } });
    fireEvent.click(screen.getByRole('button', { name: /next/i }));
    fireEvent.click(screen.getByRole('button', { name: /next/i }));

    fireEvent.change(screen.getByLabelText(/whatsapp number/i), {
      target: { value: 'not-a-phone' },
    });
    fireEvent.click(screen.getByRole('button', { name: /next/i }));
    expect(screen.getByRole('alert')).toHaveTextContent(/whatsapp/i);
  });

  it('invokes onSubmit with the collected payload when publish is clicked', () => {
    const onSubmit = vi.fn();
    renderForm(onSubmit);

    fireEvent.change(screen.getByLabelText(/title/i), { target: { value: 'Sunlit Loft' } });
    fireEvent.change(screen.getByLabelText(/property type/i), { target: { value: 'APARTMENT' } });
    fireEvent.change(screen.getByLabelText(/description/i), {
      target: { value: 'Gorgeous loft.' },
    });
    fireEvent.click(screen.getByRole('button', { name: /next/i }));

    fireEvent.change(screen.getByLabelText(/price/i), { target: { value: '1500' } });
    fireEvent.change(screen.getByLabelText(/bedrooms/i), { target: { value: '2' } });
    fireEvent.change(screen.getByLabelText(/bathrooms/i), { target: { value: '1' } });
    fireEvent.click(screen.getByRole('button', { name: /next/i }));

    fireEvent.change(screen.getByLabelText(/city/i), { target: { value: 'Riyadh' } });
    fireEvent.change(screen.getByLabelText(/area/i), { target: { value: 'Al Olaya' } });
    fireEvent.click(screen.getByRole('button', { name: /next/i }));

    fireEvent.click(screen.getByRole('button', { name: /next/i }));

    fireEvent.change(screen.getByLabelText(/whatsapp number/i), {
      target: { value: '+966500000000' },
    });
    fireEvent.click(screen.getByRole('button', { name: /next/i }));

    fireEvent.click(screen.getByRole('button', { name: /publish/i }));

    expect(onSubmit).toHaveBeenCalledTimes(1);
    const payload = onSubmit.mock.calls[0][0] as {
      title: string;
      propertyType: string;
      price: string;
      rooms: number;
      city: string;
      whatsappNumber: string;
      images: File[];
    };
    expect(payload.title).toBe('Sunlit Loft');
    expect(payload.propertyType).toBe('APARTMENT');
    expect(payload.price).toBe('1500');
    expect(payload.rooms).toBe(2);
    expect(payload.city).toBe('Riyadh');
    expect(payload.whatsappNumber).toBe('+966500000000');
    expect(Array.isArray(payload.images)).toBe(true);
  });

  it('allows going back to earlier steps via the back button', () => {
    renderForm();
    fireEvent.change(screen.getByLabelText(/title/i), { target: { value: 'Villa' } });
    fireEvent.click(screen.getByRole('button', { name: /next/i }));
    expect(screen.getByRole('heading', { name: /details/i })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /back/i }));
    expect(screen.getByRole('heading', { name: /basics/i })).toBeInTheDocument();
    expect((screen.getByLabelText(/title/i) as HTMLInputElement).value).toBe('Villa');
  });

  it('pre-fills fields when given initialValues in edit mode and renders an update button', () => {
    render(
      <PropertyForm
        mode="edit"
        onSubmit={() => undefined}
        initialValues={{
          title: 'Prefilled Villa',
          summary: '',
          description: 'Nice view',
          propertyType: 'VILLA',
          city: 'Jeddah',
          area: 'Corniche',
          country: 'SA',
          price: '3000',
          currency: 'SAR',
          priceUnit: 'per_month',
          rooms: 4,
          bathrooms: 3,
          areaSqm: '250',
          amenities: ['pool'],
          whatsappNumber: '+966500000000',
        }}
      />,
    );
    expect((screen.getByLabelText(/title/i) as HTMLInputElement).value).toBe('Prefilled Villa');
    expect((screen.getByLabelText(/property type/i) as HTMLSelectElement).value).toBe('VILLA');
  });

  it('toggles an amenity on and off', () => {
    renderForm();
    fireEvent.change(screen.getByLabelText(/title/i), { target: { value: 'Villa' } });
    fireEvent.click(screen.getByRole('button', { name: /next/i }));

    const wifiBtn = screen.getByRole('button', { name: /^wi-fi$/i });
    expect(wifiBtn).toHaveClass('bg-white');
    fireEvent.click(wifiBtn);
    expect(wifiBtn).toHaveClass('bg-terracotta-500');
    fireEvent.click(wifiBtn);
    expect(wifiBtn).toHaveClass('bg-white');
  });

  it('disables the back button on step 1', () => {
    renderForm();
    expect(screen.getByRole('button', { name: /back/i })).toBeDisabled();
  });

  it('blocks advancing when rooms is negative', () => {
    renderForm();
    fireEvent.change(screen.getByLabelText(/title/i), { target: { value: 'Villa' } });
    fireEvent.click(screen.getByRole('button', { name: /next/i }));
    fireEvent.change(screen.getByLabelText(/price/i), { target: { value: '1000' } });
    fireEvent.change(screen.getByLabelText(/bedrooms/i), { target: { value: '-1' } });
    fireEvent.click(screen.getByRole('button', { name: /next/i }));
    expect(screen.getByRole('alert')).toHaveTextContent(/bedrooms/i);
  });

  it('blocks advancing when bathrooms is negative', () => {
    renderForm();
    fireEvent.change(screen.getByLabelText(/title/i), { target: { value: 'Villa' } });
    fireEvent.click(screen.getByRole('button', { name: /next/i }));
    fireEvent.change(screen.getByLabelText(/price/i), { target: { value: '1000' } });
    fireEvent.change(screen.getByLabelText(/bathrooms/i), { target: { value: '-1' } });
    fireEvent.click(screen.getByRole('button', { name: /next/i }));
    expect(screen.getByRole('alert')).toHaveTextContent(/bathrooms/i);
  });

  it('blocks advancing when areaSqm is not a valid decimal', () => {
    renderForm();
    fireEvent.change(screen.getByLabelText(/title/i), { target: { value: 'Villa' } });
    fireEvent.click(screen.getByRole('button', { name: /next/i }));
    fireEvent.change(screen.getByLabelText(/price/i), { target: { value: '1000' } });
    fireEvent.change(screen.getByLabelText(/area \(m²\)/i), { target: { value: 'abc' } });
    fireEvent.click(screen.getByRole('button', { name: /next/i }));
    expect(screen.getByRole('alert')).toHaveTextContent(/area/i);
  });

  it('blocks advancing when currency is not 3 letters', () => {
    renderForm();
    fireEvent.change(screen.getByLabelText(/title/i), { target: { value: 'Villa' } });
    fireEvent.click(screen.getByRole('button', { name: /next/i }));
    fireEvent.change(screen.getByLabelText(/price/i), { target: { value: '1000' } });
    fireEvent.change(screen.getByLabelText(/currency/i), { target: { value: 'ABCD' } });
    fireEvent.click(screen.getByRole('button', { name: /next/i }));
    expect(screen.getByRole('alert')).toHaveTextContent(/currency/i);
  });

  it('shows edit hint on step 4 when mode is edit', () => {
    render(
      <PropertyForm
        mode="edit"
        onSubmit={() => undefined}
        initialValues={
          {
            title: 'Villa',
            price: '1000',
            city: 'Riyadh',
            whatsappNumber: '+966500000000',
          } as Record<string, never>
        }
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: /next/i }));
    fireEvent.click(screen.getByRole('button', { name: /next/i }));
    fireEvent.click(screen.getByRole('button', { name: /next/i }));
    expect(screen.getByText(/images can be managed/i)).toBeInTheDocument();
  });

  it('normalizes whatsapp number by stripping non-digits after + prefix', () => {
    const onSubmit = vi.fn();
    renderForm(onSubmit);
    fireEvent.change(screen.getByLabelText(/title/i), { target: { value: 'Loft' } });
    fireEvent.click(screen.getByRole('button', { name: /next/i }));
    fireEvent.change(screen.getByLabelText(/price/i), { target: { value: '1000' } });
    fireEvent.click(screen.getByRole('button', { name: /next/i }));
    fireEvent.change(screen.getByLabelText(/city/i), { target: { value: 'Riyadh' } });
    fireEvent.click(screen.getByRole('button', { name: /next/i }));
    fireEvent.click(screen.getByRole('button', { name: /next/i }));
    fireEvent.change(screen.getByLabelText(/whatsapp number/i), {
      target: { value: '+966 (500) 000-000' },
    });
    fireEvent.click(screen.getByRole('button', { name: /next/i }));
    fireEvent.click(screen.getByRole('button', { name: /publish/i }));
    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({ whatsappNumber: '+966500000000' }),
    );
  });

  describe('translation in create mode', () => {
    function renderAndGoToReview(onSubmit = vi.fn()) {
      renderForm(onSubmit);
      fireEvent.change(screen.getByLabelText(/title/i), { target: { value: 'Sunlit Loft' } });
      fireEvent.click(screen.getByRole('button', { name: /next/i }));
      fireEvent.change(screen.getByLabelText(/price/i), { target: { value: '1500' } });
      fireEvent.click(screen.getByRole('button', { name: /next/i }));
      fireEvent.change(screen.getByLabelText(/city/i), { target: { value: 'Riyadh' } });
      fireEvent.click(screen.getByRole('button', { name: /next/i }));
      fireEvent.click(screen.getByRole('button', { name: /next/i }));
      fireEvent.change(screen.getByLabelText(/whatsapp number/i), {
        target: { value: '+966500000000' },
      });
      fireEvent.click(screen.getByRole('button', { name: /next/i }));
    }

    it('shows the translation section on step 6 in create mode', () => {
      renderAndGoToReview();
      expect(screen.getAllByText(/translation/i).length).toBeGreaterThan(0);
      expect(screen.getByRole('button', { name: /add translation/i })).toBeInTheDocument();
    });

    it('opens translation input fields when add translation is clicked', () => {
      renderAndGoToReview();
      fireEvent.click(screen.getByRole('button', { name: /add translation/i }));
      expect(screen.getByText(/Hide/)).toBeInTheDocument();
      const transSection = screen.getAllByText(/translation/i)[0].closest('section')!;
      const inputs = within(transSection).getAllByRole('textbox');
      expect(inputs.length).toBeGreaterThan(0);
    });

    it('includes translation in payload when fields are filled', () => {
      const onSubmit = vi.fn();
      renderAndGoToReview(onSubmit);
      fireEvent.click(screen.getByRole('button', { name: /add translation/i }));

      const transSection = screen.getAllByText(/translation/i)[0].closest('section')!;
      const inputs = within(transSection).getAllByRole('textbox');
      fireEvent.change(inputs[0], { target: { value: 'منزل مشمس' } });
      fireEvent.change(inputs[2], { target: { value: 'الرياض' } });

      fireEvent.click(screen.getByRole('button', { name: /publish/i }));
      expect(onSubmit).toHaveBeenCalledWith(
        expect.objectContaining({
          translation: expect.objectContaining({ title: 'منزل مشمس', city: 'الرياض' }),
        }),
      );
    });

    it('passes null translation when fields are empty', () => {
      const onSubmit = vi.fn();
      renderAndGoToReview(onSubmit);
      fireEvent.click(screen.getByRole('button', { name: /publish/i }));
      expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ translation: null }));
    });
  });
});
