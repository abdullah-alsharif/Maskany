import { type ComponentProps } from 'react';

type BadgeVariant = 'terracotta' | 'olive' | 'stone' | 'sand' | 'error' | 'success';

type BadgeProps = ComponentProps<'span'> & {
  variant?: BadgeVariant;
};

const variantClasses: Record<BadgeVariant, string> = {
  terracotta: 'bg-terracotta-100 text-terracotta-700',
  olive: 'bg-olive-100 text-olive-700',
  stone: 'bg-stone-200 text-stone-700',
  sand: 'bg-sand-300 text-stone-700',
  error: 'bg-red-100 text-red-700',
  success: 'bg-green-100 text-green-700',
};

export function Badge({ variant = 'stone', className = '', children, ...props }: BadgeProps) {
  return (
    <span
      className={`
        inline-flex items-center px-2.5 py-0.5 rounded-full
        text-xs font-semibold tracking-wide uppercase
        ${variantClasses[variant]}
        ${className}
      `}
      {...props}
    >
      {children}
    </span>
  );
}
