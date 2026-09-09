import * as React from 'react';
import { cn } from '@/lib/utils';

export interface InputProps
  extends React.InputHTMLAttributes<HTMLInputElement> {}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          'flex h-9 w-full rounded-md border transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium disabled:cursor-not-allowed disabled:opacity-50',
          'border-[var(--mm-input-border)] bg-[var(--mm-input-bg)] px-3 py-1 text-sm text-[var(--mm-text)] shadow-sm file:text-[var(--mm-text)] placeholder:text-[var(--mm-text-30)] focus-visible:outline-none focus-visible:border-[var(--mm-primary)]',
          className
        )}
        ref={ref}
        {...props}
      />
    );
  }
);
Input.displayName = 'Input';

export { Input };
