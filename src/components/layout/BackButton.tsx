'use client';

import { useRouter, usePathname } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface BackButtonProps {
  className?: string;
}

export function BackButton({ className }: BackButtonProps) {
  const router = useRouter();
  const pathname = usePathname();

  // Don't show on home page
  if (pathname === '/') return null;

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={() => router.back()}
      className={cn(
        'flex items-center gap-2 text-white/70 hover:text-white hover:bg-white/10',
        className
      )}
    >
      <ArrowLeft className="h-4 w-4" />
      <span className="hidden sm:inline">Back</span>
    </Button>
  );
}
