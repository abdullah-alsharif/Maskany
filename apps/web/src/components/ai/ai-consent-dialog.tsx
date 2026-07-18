'use client';

import { useTranslation } from 'react-i18next';
import { Button } from '../ui/button';

type AiConsentDialogProps = {
  open: boolean;
  onAccept: () => void;
  onDecline: () => void;
};

export function AiConsentDialog({ open, onAccept, onDecline }: AiConsentDialogProps) {
  const { t } = useTranslation();

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
      <div className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-xl">
        <h2 className="text-lg font-semibold text-stone-800 mb-2">{t('ai.consentHeading')}</h2>
        <p className="text-sm text-stone-600 mb-6">{t('ai.consentBody')}</p>
        <div className="flex gap-3">
          <Button variant="primary" onClick={onAccept}>
            {t('ai.consentAccept')}
          </Button>
          <Button variant="ghost" onClick={onDecline}>
            {t('ai.consentDecline')}
          </Button>
        </div>
      </div>
    </div>
  );
}
