/**
 * `FilterSheet` — mobile bottom-sheet wrapper around FilterPanel (PRD §4.3,
 * T-016 AC).
 *
 * Renders the existing `BottomSheet` with a localized title and the
 * `FilterPanel` inside. `onApply` also closes the sheet so users are
 * returned to the listing after committing filters.
 */
import { useTranslation } from 'react-i18next';
import { BottomSheet } from './ui/bottom-sheet';
import { FilterPanel } from './filter-panel';
import type { Filters } from '../hooks/use-filters';

type FilterSheetProps = {
  open: boolean;
  onClose: () => void;
  value: Filters;
  onApply: (filters: Filters) => void;
  onClear: () => void;
};

export function FilterSheet({ open, onClose, value, onApply, onClear }: FilterSheetProps) {
  const { t } = useTranslation();
  const handleApply = (next: Filters) => {
    onApply(next);
    onClose();
  };

  return (
    <BottomSheet open={open} onClose={onClose} title={t('filter.filters')}>
      <FilterPanel key={open ? 'open' : 'closed'} value={value} onApply={handleApply} onClear={onClear} />
    </BottomSheet>
  );
}
