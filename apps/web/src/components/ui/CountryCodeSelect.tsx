import { COUNTRY_CODES, DEFAULT_COUNTRY_CODE } from '../../constants/country-codes';

export { COUNTRY_CODES, DEFAULT_COUNTRY_CODE };

interface CountryCodeSelectProps {
  value: string;
  onChange: (value: string) => void;
  label?: string;
  id?: string;
}

export function CountryCodeSelect({
  value,
  onChange,
  label,
  id = 'country-code',
}: CountryCodeSelectProps) {
  return (
    <div className="flex flex-col">
      {label && (
        <label htmlFor={id} className="text-xs font-medium text-stone-500 mb-1">
          {label}
        </label>
      )}
      <select
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-12 min-w-[88px] rounded-xl border border-stone-300 bg-white px-3 text-sm focus:outline-none focus:border-terracotta-400 focus:ring-2 focus:ring-terracotta-100 transition-shadow duration-200"
      >
        {COUNTRY_CODES.map((c) => (
          <option key={c.code} value={c.code}>
            {c.flag} {c.code}
          </option>
        ))}
      </select>
    </div>
  );
}
