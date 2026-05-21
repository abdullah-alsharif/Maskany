/**
 * PropertyForm — reusable multi-step form for creating or editing a
 * property (T-028, PRD §3.2).
 *
 * Steps:
 *   1. Basics   — title, property type, description
 *   2. Details  — price, price unit, bedrooms, bathrooms, area
 *   3. Location — city, area, country
 *   4. Images   — upload via <ImageUploader> (create mode only)
 *   5. Contact  — WhatsApp number
 *   6. Review   — summary + publish button
 *
 * State is held locally so the component is self-contained. Each step's
 * "Next" button runs lightweight validation before advancing. On the
 * final step the `onSubmit` callback receives the collected payload.
 */
import { type ReactNode, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from './ui/button';
import { ImageUploader } from './image-uploader';

export type PropertyFormValues = {
  title: string;
  summary: string;
  description: string;
  propertyType: string;
  city: string;
  area: string;
  country: string;
  price: string;
  currency: string;
  priceUnit: 'per_night' | 'per_month' | 'per_year' | 'total';
  rooms: number;
  bathrooms: number;
  areaSqm: string;
  amenities: string[];
  whatsappNumber: string;
};

export type PropertyFormSubmitPayload = PropertyFormValues & {
  images: File[];
};

type PropertyFormProps = {
  mode: 'create' | 'edit';
  initialValues?: Partial<PropertyFormValues>;
  onSubmit?: (payload: PropertyFormSubmitPayload) => void;
  submitting?: boolean;
};

const PROPERTY_TYPE_OPTIONS = [
  'APARTMENT',
  'ROOM',
  'CHALET',
  'VILLA',
  'HOUSE',
  'STUDIO',
  'PENTHOUSE',
  'DUPLEX',
  'OTHER',
] as const;

const COMMON_AMENITIES = [
  'wifi',
  'parking',
  'pool',
  'gym',
  'ac',
  'furnished',
  'kitchen',
  'balcony',
];

const DECIMAL_REGEX = /^\d+(\.\d+)?$/;
const PHONE_REGEX = /^\+[1-9]\d{6,14}$/;

const STEP_KEYS = [
  'stepBasics',
  'stepDetails',
  'stepLocation',
  'stepImages',
  'stepContact',
  'stepReview',
] as const;
const TOTAL_STEPS = STEP_KEYS.length;

function defaultValues(initial?: Partial<PropertyFormValues>): PropertyFormValues {
  return {
    title: initial?.title ?? '',
    summary: initial?.summary ?? '',
    description: initial?.description ?? '',
    propertyType: initial?.propertyType ?? 'APARTMENT',
    city: initial?.city ?? '',
    area: initial?.area ?? '',
    country: initial?.country ?? '',
    price: initial?.price ?? '',
    currency: initial?.currency ?? 'SAR',
    priceUnit: initial?.priceUnit ?? 'per_month',
    rooms: initial?.rooms ?? 1,
    bathrooms: initial?.bathrooms ?? 1,
    areaSqm: initial?.areaSqm ?? '',
    amenities: initial?.amenities ?? [],
    whatsappNumber: initial?.whatsappNumber ?? '',
  };
}

function validateStep(
  step: number,
  values: PropertyFormValues,
  t: (key: string) => string,
): string | null {
  switch (step) {
    case 1:
      if (!values.title.trim()) return t('propertyForm.errorTitleRequired');
      return null;
    case 2:
      if (!values.price.trim() || !DECIMAL_REGEX.test(values.price)) {
        return t('propertyForm.errorPriceRequired');
      }
      if (values.rooms < 0) return t('propertyForm.errorBedroomsNegative');
      if (values.bathrooms < 0) return t('propertyForm.errorBathroomsNegative');
      return null;
    case 3:
      if (!values.city.trim()) return t('propertyForm.errorCityRequired');
      return null;
    case 4:
      return null;
    case 5:
      if (!PHONE_REGEX.test(values.whatsappNumber)) {
        return t('propertyForm.errorWhatsappFormat');
      }
      return null;
    default:
      return null;
  }
}

function StepHeader({
  step,
  labelKey,
  t: translate,
}: {
  step: number;
  labelKey: string;
  t: (key: string, options?: Record<string, unknown>) => string;
}) {
  return (
    <header className="space-y-1">
      <p className="text-xs font-semibold uppercase tracking-wide text-terracotta-600">
        {translate('propertyForm.stepOf', { current: step, total: TOTAL_STEPS })}
      </p>
      <h2 className="font-display text-2xl text-stone-950">{translate(labelKey)}</h2>
    </header>
  );
}

function ProgressIndicator({
  currentStep,
  t,
}: {
  currentStep: number;
  t: (key: string, opts?: Record<string, unknown>) => string;
}) {
  return (
    <div
      role="progressbar"
      aria-valuemin={1}
      aria-valuemax={TOTAL_STEPS}
      aria-valuenow={currentStep}
      aria-label={t('propertyForm.stepOf', { current: currentStep, total: TOTAL_STEPS })}
      className="flex items-center gap-1.5"
    >
      {STEP_KEYS.map((key, index) => {
        const stepNumber = index + 1;
        const done = stepNumber < currentStep;
        const active = stepNumber === currentStep;
        return (
          <span
            key={key}
            className={`h-1.5 flex-1 rounded-full transition-colors ${
              done || active ? 'bg-terracotta-500' : 'bg-stone-200'
            }`}
            aria-hidden="true"
          />
        );
      })}
    </div>
  );
}

function Field({ id, label, children }: { id: string; label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col">
      <label htmlFor={id} className="text-xs font-medium text-stone-500 mb-1">
        {label}
      </label>
      {children}
    </div>
  );
}

const inputClass =
  'h-12 w-full rounded-xl border border-stone-300 bg-white px-3 text-base focus:outline-none focus:border-terracotta-400 focus:ring-2 focus:ring-terracotta-100 transition-all duration-200';
const textareaClass =
  'min-h-[120px] w-full rounded-xl border border-stone-300 bg-white p-3 text-base focus:outline-none focus:border-terracotta-400 focus:ring-2 focus:ring-terracotta-100 transition-all duration-200';

export function PropertyForm({ mode, initialValues, onSubmit, submitting }: PropertyFormProps) {
  const { t } = useTranslation();
  const [values, setValues] = useState<PropertyFormValues>(() => defaultValues(initialValues));
  const [images, setImages] = useState<File[]>([]);
  const [step, setStep] = useState(1);
  const [error, setError] = useState<string | null>(null);

  const update = <K extends keyof PropertyFormValues>(key: K, value: PropertyFormValues[K]) => {
    setValues((prev) => ({ ...prev, [key]: value }));
  };

  const handleNext = () => {
    const message = validateStep(step, values, t);
    if (message) {
      setError(message);
      return;
    }
    setError(null);
    setStep((prev) => Math.min(TOTAL_STEPS, prev + 1));
  };

  const handleBack = () => {
    setError(null);
    setStep((prev) => Math.max(1, prev - 1));
  };

  const handlePublish = () => {
    setError(null);
    onSubmit?.({ ...values, images });
  };

  const toggleAmenity = (amenity: string) => {
    setValues((prev) => ({
      ...prev,
      amenities: prev.amenities.includes(amenity)
        ? prev.amenities.filter((a) => a !== amenity)
        : [...prev.amenities, amenity],
    }));
  };

  const reviewSummary = useMemo(
    () => ({
      Title: values.title,
      Type: values.propertyType,
      Price: `${values.currency} ${values.price} ${values.priceUnit}`,
      Rooms: `${values.rooms} bed / ${values.bathrooms} bath`,
      Location: [values.area, values.city, values.country].filter(Boolean).join(', '),
      WhatsApp: values.whatsappNumber,
      Images: mode === 'create' ? `${images.length} selected` : 'Managed separately',
    }),
    [values, images, mode],
  );

  return (
    <div className="space-y-6">
      <ProgressIndicator currentStep={step} t={t} />

      {step === 1 && (
        <section className="space-y-4 animate-fade-in">
          <StepHeader step={1} labelKey="propertyForm.stepBasics" t={t} />
          <Field id="property-title" label={t('propertyForm.title')}>
            <input
              id="property-title"
              type="text"
              value={values.title}
              onChange={(e) => update('title', e.target.value)}
              className={inputClass}
              placeholder={t('propertyForm.titlePlaceholder')}
            />
          </Field>
          <Field id="property-type" label={t('propertyForm.propertyType')}>
            <select
              id="property-type"
              value={values.propertyType}
              onChange={(e) => update('propertyType', e.target.value)}
              className={inputClass}
            >
              {PROPERTY_TYPE_OPTIONS.map((value) => (
                <option key={value} value={value}>
                  {t(`propertyType.${value}`)}
                </option>
              ))}
            </select>
          </Field>
          <Field id="property-description" label={t('propertyForm.description')}>
            <textarea
              id="property-description"
              value={values.description}
              onChange={(e) => update('description', e.target.value)}
              className={textareaClass}
              placeholder={t('propertyForm.descriptionPlaceholder')}
            />
          </Field>
        </section>
      )}

      {step === 2 && (
        <section className="space-y-4 animate-fade-in">
          <StepHeader step={2} labelKey="propertyForm.stepDetails" t={t} />
          <div className="grid grid-cols-2 gap-3">
            <Field id="property-price" label={t('propertyForm.price')}>
              <input
                id="property-price"
                type="text"
                inputMode="decimal"
                value={values.price}
                onChange={(e) => update('price', e.target.value)}
                className={inputClass}
              />
            </Field>
            <Field id="property-price-unit" label={t('propertyForm.billingPeriod')}>
              <select
                id="property-price-unit"
                value={values.priceUnit}
                onChange={(e) =>
                  update('priceUnit', e.target.value as PropertyFormValues['priceUnit'])
                }
                className={inputClass}
              >
                {(['per_night', 'per_month', 'per_year', 'total'] as const).map((value) => (
                  <option key={value} value={value}>
                    {t(`priceUnit.${value}`)}
                  </option>
                ))}
              </select>
            </Field>
            <Field id="property-bedrooms" label={t('propertyForm.bedrooms')}>
              <input
                id="property-bedrooms"
                type="number"
                min={0}
                value={values.rooms}
                onChange={(e) => update('rooms', Number(e.target.value))}
                className={inputClass}
              />
            </Field>
            <Field id="property-bathrooms" label={t('propertyForm.bathrooms')}>
              <input
                id="property-bathrooms"
                type="number"
                min={0}
                value={values.bathrooms}
                onChange={(e) => update('bathrooms', Number(e.target.value))}
                className={inputClass}
              />
            </Field>
            <Field id="property-area-sqm" label={t('propertyForm.area')}>
              <input
                id="property-area-sqm"
                type="text"
                inputMode="decimal"
                value={values.areaSqm}
                onChange={(e) => update('areaSqm', e.target.value)}
                className={inputClass}
              />
            </Field>
            <Field id="property-currency" label={t('propertyForm.currency')}>
              <input
                id="property-currency"
                type="text"
                maxLength={3}
                value={values.currency}
                onChange={(e) => update('currency', e.target.value.toUpperCase())}
                className={inputClass}
              />
            </Field>
          </div>
          <fieldset className="space-y-2">
            <legend className="text-xs font-medium text-stone-500 mb-1">
              {t('propertyForm.amenities')}
            </legend>
            <div className="flex flex-wrap gap-2">
              {COMMON_AMENITIES.map((a) => {
                const active = values.amenities.includes(a);
                return (
                  <button
                    key={a}
                    type="button"
                    onClick={() => toggleAmenity(a)}
                    className={`min-h-[44px] min-w-[44px] px-3 rounded-full border text-sm font-medium capitalize transition-colors ${
                      active
                        ? 'bg-terracotta-500 text-white border-terracotta-500'
                        : 'bg-white text-stone-700 border-stone-200 hover:border-terracotta-400'
                    }`}
                  >
                    {t(`amenity.${a}`)}
                  </button>
                );
              })}
            </div>
          </fieldset>
        </section>
      )}

      {step === 3 && (
        <section className="space-y-4 animate-fade-in">
          <StepHeader step={3} labelKey="propertyForm.stepLocation" t={t} />
          <Field id="property-city" label={t('propertyForm.city')}>
            <input
              id="property-city"
              type="text"
              value={values.city}
              onChange={(e) => update('city', e.target.value)}
              className={inputClass}
            />
          </Field>
          <Field id="property-area" label={t('propertyForm.areaNeighborhood')}>
            <input
              id="property-area"
              type="text"
              value={values.area}
              onChange={(e) => update('area', e.target.value)}
              className={inputClass}
            />
          </Field>
          <Field id="property-country" label={t('propertyForm.country')}>
            <input
              id="property-country"
              type="text"
              value={values.country}
              onChange={(e) => update('country', e.target.value)}
              className={inputClass}
              placeholder={t('propertyForm.countryPlaceholder')}
            />
          </Field>
        </section>
      )}

      {step === 4 && (
        <section className="space-y-4 animate-fade-in">
          <StepHeader step={4} labelKey="propertyForm.stepImages" t={t} />
          {mode === 'edit' ? (
            <p className="text-sm text-stone-600">{t('propertyForm.imagesEditHint')}</p>
          ) : (
            <ImageUploader files={images} onChange={setImages} />
          )}
        </section>
      )}

      {step === 5 && (
        <section className="space-y-4 animate-fade-in">
          <StepHeader step={5} labelKey="propertyForm.stepContact" t={t} />
          <Field id="property-whatsapp" label={t('propertyForm.whatsappNumber')}>
            <input
              id="property-whatsapp"
              type="tel"
              value={values.whatsappNumber}
              onChange={(e) => update('whatsappNumber', e.target.value)}
              className={inputClass}
              placeholder={t('propertyForm.whatsappPlaceholder')}
            />
          </Field>
          <p className="text-xs text-stone-500">{t('propertyForm.whatsappHint')}</p>
        </section>
      )}

      {step === 6 && (
        <section className="space-y-4 animate-fade-in">
          <StepHeader step={6} labelKey="propertyForm.stepReview" t={t} />
          <dl className="rounded-2xl bg-white p-4 shadow-[var(--shadow-card)] divide-y divide-stone-100">
            {Object.entries(reviewSummary).map(([key, value]) => (
              <div key={key} className="flex justify-between gap-4 py-2 first:pt-0 last:pb-0">
                <dt className="text-sm text-stone-500">{key}</dt>
                <dd className="text-sm font-medium text-stone-900 text-right">{value || '—'}</dd>
              </div>
            ))}
          </dl>
        </section>
      )}

      {error && (
        <p role="alert" className="text-sm text-red-600 font-medium">
          {error}
        </p>
      )}

      <div className="flex items-center justify-between gap-3 pt-2">
        <Button
          type="button"
          variant="secondary"
          size="md"
          onClick={handleBack}
          disabled={step === 1}
        >
          {t('propertyForm.back')}
        </Button>
        {step < TOTAL_STEPS ? (
          <Button type="button" size="md" onClick={handleNext}>
            {t('propertyForm.next')}
          </Button>
        ) : (
          <Button type="button" size="md" onClick={handlePublish} loading={submitting}>
            {mode === 'edit' ? t('propertyForm.publishChanges') : t('propertyForm.publishListing')}
          </Button>
        )}
      </div>
    </div>
  );
}
