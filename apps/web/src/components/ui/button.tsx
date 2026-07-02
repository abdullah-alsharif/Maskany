import { forwardRef, type ComponentProps } from 'react';

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'whatsapp' | 'danger';
type ButtonSize = 'sm' | 'md' | 'lg';

type ButtonProps = ComponentProps<'button'> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
};

const variantClasses: Record<ButtonVariant, string> = {
  primary:
    'bg-terracotta-500 text-white hover:bg-terracotta-600 active:bg-terracotta-700 active:shadow-[inset_0_2px_4px_rgba(0,0,0,0.08)] shadow-sm',
  secondary:
    'bg-white text-stone-800 border border-stone-300 hover:bg-stone-50 active:bg-stone-100 active:shadow-[inset_0_2px_4px_rgba(0,0,0,0.06)]',
  ghost:
    'text-stone-600 hover:bg-stone-100 active:bg-stone-200 active:shadow-[inset_0_2px_4px_rgba(0,0,0,0.04)]',
  whatsapp:
    'bg-[#25d366] text-white hover:bg-[#20bd5a] active:bg-[#128c7e] active:shadow-[inset_0_2px_4px_rgba(0,0,0,0.08)] shadow-sm',
  danger:
    'bg-red-600 text-white hover:bg-red-700 active:bg-red-800 active:shadow-[inset_0_2px_4px_rgba(0,0,0,0.08)]',
};

const sizeClasses: Record<ButtonSize, string> = {
  sm: 'h-9 px-3.5 text-sm rounded-lg gap-1.5',
  md: 'h-11 px-5 text-[15px] rounded-xl gap-2',
  lg: 'h-13 px-6 text-base rounded-xl gap-2.5',
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    { variant = 'primary', size = 'md', loading, disabled, className = '', children, ...props },
    ref,
  ) => {
    return (
      <button
        ref={ref}
        disabled={disabled || loading}
        className={`
          inline-flex items-center justify-center font-semibold
          transition-colors transition-transform duration-150 ease-out
          active:scale-[0.96]
          focus-visible:ring-2 focus-visible:ring-terracotta-500 focus-visible:ring-offset-2 focus-visible:outline-none
          disabled:opacity-50 disabled:pointer-events-none disabled:scale-100
          min-w-[44px] min-h-[44px]
          ${variantClasses[variant]}
          ${sizeClasses[size]}
          ${className}
        `}
        {...props}
      >
        {loading && (
          <svg className="animate-spin -ml-1 mr-2 h-4 w-4" viewBox="0 0 24 24" fill="none">
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"
            />
          </svg>
        )}
        {children}
      </button>
    );
  },
);

Button.displayName = 'Button';
