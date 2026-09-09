'use client';

import * as React from 'react';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';

const Dialog = DialogPrimitive.Root;

const DialogTrigger = DialogPrimitive.Trigger;

const DialogPortal = DialogPrimitive.Portal;

const DialogClose = DialogPrimitive.Close;

const DialogOverlay = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Overlay>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Overlay>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Overlay
    ref={ref}
    className={cn(
      'fixed inset-0 z-50 bg-black/80 backdrop-blur-sm data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0',
      className
    )}
    {...props}
  />
));
DialogOverlay.displayName = DialogPrimitive.Overlay.displayName;

interface DialogContentProps extends React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content> {
  // MediaDetail renders its own close X (positioned over the poster,
  // mobile-only) - without this, it stacked with this component's own
  // default close X, showing two overlapping close buttons in the top
  // corner (reported specifically on mobile, where MediaDetail's own X is
  // the one meant to show).
  hideCloseButton?: boolean;
}

const DialogContent = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Content>,
  DialogContentProps
>(({ className, children, hideCloseButton, ...props }, ref) => (
  <DialogPortal>
    <DialogOverlay />
    <DialogPrimitive.Content
      ref={ref}
      className={cn(
        // max-h + overflow-y-auto as a safe default: without it, a dialog
        // taller than a short mobile viewport (Collections' "Create
        // Collection" - title + description + a media checklist - was the
        // one actually reported stuck) renders with its top and/or bottom
        // off-screen and no way to scroll to the close button or actions.
        // Individual call sites (e.g. MediaDetail) can still override this.
        // overflow-y-auto alone makes the browser compute overflow-x as
        // "auto" too (the CSS spec forces the other axis off `visible` once
        // either one isn't `visible`), so any child that doesn't wrap
        // (whitespace-nowrap tab labels, an un-truncated row) silently
        // turned the whole dialog into something you had to scroll
        // sideways to see the rest of - overflow-x-hidden here closes that
        // off everywhere at once, on top of fixing individual offenders.
        //
        // grid-cols-1 (real root cause of the Create Collection dialog
        // bleeding past its own right edge even on a wide desktop
        // viewport): `display:grid` with no explicit grid-template-columns
        // creates a single *implicit* column sized `auto`, and an auto
        // grid track grows to fit its content's max-content size instead
        // of being capped at the container's width - so a deeply nested
        // long line (an untruncated title, a wide row) silently stretched
        // the whole card, not just overflowed within it. grid-cols-1
        // compiles to `minmax(0, 1fr)`, which is what actually makes grid
        // children respect the box's real width - the standard fix for
        // this well-known Tailwind/shadcn dialog footgun.
        'fixed left-[50%] top-[50%] z-50 grid grid-cols-1 w-[calc(100%-2rem)] max-w-lg max-h-[85vh] overflow-y-auto overflow-x-hidden translate-x-[-50%] translate-y-[-50%] gap-4 border p-6 shadow-lg duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[state=closed]:slide-out-to-left-1/2 data-[state=closed]:slide-out-to-top-[48%] data-[state=open]:slide-in-from-left-1/2 data-[state=open]:slide-in-from-top-[48%] rounded-2xl',
        'border-[var(--mm-card-border)] bg-[var(--mm-bg-alt)] text-[var(--mm-text)] backdrop-blur-glass',
        className
      )}
      {...props}
    >
      {children}
      {!hideCloseButton && (
        <DialogPrimitive.Close className="absolute right-4 top-4 rounded-sm opacity-70 transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-[var(--mm-primary)] disabled:pointer-events-none text-[var(--mm-text)]">
          <X className="h-4 w-4" />
          <span className="sr-only">Close</span>
        </DialogPrimitive.Close>
      )}
    </DialogPrimitive.Content>
  </DialogPortal>
));
DialogContent.displayName = DialogPrimitive.Content.displayName;

const DialogHeader = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn(
      'flex flex-col space-y-1.5 text-center sm:text-left',
      className
    )}
    {...props}
  />
);
DialogHeader.displayName = 'DialogHeader';

const DialogFooter = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn(
      'flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2',
      className
    )}
    {...props}
  />
);
DialogFooter.displayName = 'DialogFooter';

const DialogTitle = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Title>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Title
    ref={ref}
    className={cn(
      'text-lg font-semibold leading-none tracking-tight text-[var(--mm-text)]',
      className
    )}
    {...props}
  />
));
DialogTitle.displayName = DialogPrimitive.Title.displayName;

const DialogDescription = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Description>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Description>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Description
    ref={ref}
    className={cn('text-sm text-[var(--mm-text-50)]', className)}
    {...props}
  />
));
DialogDescription.displayName = DialogPrimitive.Description.displayName;

export {
  Dialog,
  DialogPortal,
  DialogOverlay,
  DialogClose,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
};
