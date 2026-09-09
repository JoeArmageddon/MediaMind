import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-all duration-150 active:scale-[0.97] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-violet-600 disabled:pointer-events-none disabled:opacity-50 disabled:active:scale-100',
  {
    variants: {
      variant: {
        default: 'bg-[var(--mm-primary)] text-white hover:bg-[var(--mm-primary-hover)]',
        destructive: 'bg-[var(--mm-danger)] text-white hover:brightness-90',
        outline:
          'border border-[var(--mm-card-border)] bg-transparent text-[var(--mm-text)] hover:bg-[var(--mm-hover-bg)] hover:border-[var(--mm-primary)]',
        secondary: 'bg-[var(--mm-hover-bg-strong)] text-[var(--mm-text)] hover:brightness-125',
        ghost: 'text-[var(--mm-text-70)] hover:bg-[var(--mm-hover-bg)] hover:text-[var(--mm-text)]',
        link: 'text-[var(--mm-primary)] hover:opacity-80 underline-offset-4 hover:underline',
      },
      size: {
        default: 'h-9 px-4 py-2',
        sm: 'h-8 rounded-md px-3 text-xs',
        lg: 'h-10 rounded-md px-8',
        icon: 'h-9 w-9',
        'icon-sm': 'h-8 w-8',
        'icon-lg': 'h-10 w-10',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button';
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    );
  }
);
Button.displayName = 'Button';

export { Button, buttonVariants };
