'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Home,
  Search,
  Calendar,
  BarChart3,
  Clock,
  Settings,
  Sparkles,
  Menu,
  X,
  Film,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useSyncStore } from '@/store/syncStore';

const navItems = [
  { href: '/', icon: Home, label: 'Home' },
  { href: '/search', icon: Search, label: 'Search' },
  { href: '/calendar', icon: Calendar, label: 'Calendar' },
  { href: '/analytics', icon: BarChart3, label: 'Stats' },
  { href: '/timeline', icon: Clock, label: 'Timeline' },
  { href: '/collections', icon: Sparkles, label: 'AI' },
];

export function Sidebar() {
  const pathname = usePathname();
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const { is_online, pending_changes } = useSyncStore();

  useEffect(() => {
    setMounted(true);
  }, []);

  return (
    <>
      {/* Desktop Sidebar */}
      <aside className="fixed left-0 top-0 z-40 hidden h-screen w-20 flex-col bg-[#050505] border-r border-white/5 lg:flex">
        {/* Logo */}
        <div className="flex h-20 items-center justify-center border-b border-white/5">
          <Link href="/" className="flex items-center justify-center">
            <div className="w-10 h-10 rounded-xl bg-indigo-600 flex items-center justify-center">
              <Film className="h-5 w-5 text-white" />
            </div>
          </Link>
        </div>

        {/* Navigation */}
        <nav className="flex-1 py-6 flex flex-col items-center gap-2">
          {navItems.map((item) => {
            const isActive = pathname === item.href || pathname?.startsWith(`${item.href}/`);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'w-12 h-12 rounded-xl flex items-center justify-center transition-all duration-300 relative',
                  isActive
                    ? 'bg-white/10 text-white'
                    : 'text-white/40 hover:bg-white/5 hover:text-white'
                )}
              >
                <item.icon className="h-5 w-5" />
                {isActive && (
                  <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 bg-indigo-500 rounded-r-full" />
                )}
              </Link>
            );
          })}
        </nav>

        {/* Settings at bottom */}
        <div className="p-4 border-t border-white/5">
          <Link
            href="/settings"
            className={cn(
              'w-12 h-12 rounded-xl flex items-center justify-center transition-all',
              pathname === '/settings'
                ? 'bg-white/10 text-white'
                : 'text-white/40 hover:bg-white/5 hover:text-white'
            )}
          >
            <Settings className="h-5 w-5" />
          </Link>
        </div>
      </aside>

      {/* Mobile Bottom Nav */}
      <nav className="fixed bottom-0 left-0 right-0 z-50 h-16 bg-[#050505]/95 backdrop-blur-xl border-t border-white/5 lg:hidden flex items-center justify-around px-2">
        {navItems.slice(0, 5).map((item) => {
          const isActive = pathname === item.href || pathname?.startsWith(`${item.href}/`);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex flex-col items-center justify-center w-14 h-14 rounded-xl transition-all',
                isActive
                  ? 'text-white'
                  : 'text-white/40'
              )}
            >
              <item.icon className="h-5 w-5 mb-1" />
              <span className="text-[10px] font-medium">{item.label}</span>
              {isActive && (
                <div className="absolute bottom-1 w-1 h-1 bg-indigo-500 rounded-full" />
              )}
            </Link>
          );
        })}
      </nav>

      {/* Mobile Header */}
      <header className="fixed left-0 right-0 top-0 z-50 h-14 flex items-center justify-between px-4 lg:hidden bg-[#050505]/95 backdrop-blur border-b border-white/5">
        <Link href="/" className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center">
            <Film className="h-4 w-4 text-white" />
          </div>
          <span className="text-lg font-black text-white tracking-tight">MEDIA MIND</span>
        </Link>

        <div className="flex items-center gap-2">
          {mounted && (
            <div className={cn(
              'w-2 h-2 rounded-full',
              is_online ? 'bg-green-500' : 'bg-yellow-500'
            )} />
          )}
        </div>
      </header>
    </>
  );
}
