import * as React from 'react';
import { cn } from '@/lib/utils';

export interface TextareaProps
  extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {}

const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, ...props }, ref) => {
    return (
      <textarea
        className={cn(
          'flex min-h-[80px] w-full rounded-md border px-3 py-2 text-sm backdrop-blur-sm transition-colors resize-y disabled:cursor-not-allowed disabled:opacity-50',
          'border-[var(--mm-input-border)] bg-[var(--mm-input-bg)] text-[var(--mm-text)] placeholder:text-[var(--mm-text-30)] focus-visible:outline-none focus-visible:border-[var(--mm-primary)]',
          className
        )}
        ref={ref}
        {...props}
      />
    );
  }
);
Textarea.displayName = 'Textarea';

export { Textarea };
