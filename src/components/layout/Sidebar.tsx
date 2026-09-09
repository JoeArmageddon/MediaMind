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
  Users,
  BookOpen,
  Moon,
} from 'lucide-react';
import { UserButton } from '@clerk/nextjs';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useSyncStore } from '@/store/syncStore';
import { useThemeStore } from '@/store/themeStore';

const userButtonAppearance = {
  elements: {
    avatarBox: 'h-9 w-9',
    userButtonPopoverCard: 'bg-[#111118] border border-white/10',
  },
};

const navItems = [
  { href: '/', icon: Home, label: 'Home' },
  { href: '/search', icon: Search, label: 'Search' },
  { href: '/calendar', icon: Calendar, label: 'Calendar' },
  { href: '/analytics', icon: BarChart3, label: 'Stats' },
  { href: '/timeline', icon: Clock, label: 'Timeline' },
  { href: '/collections', icon: Sparkles, label: 'AI' },
  { href: '/friends', icon: Users, label: 'Friends' },
];

function ThemeToggle({ className }: { className?: string }) {
  const { theme, toggleTheme } = useThemeStore();
  const isManga = theme === 'manga';
  return (
    <button
      onClick={toggleTheme}
      title={isManga ? 'Switch to dark mode' : 'Switch to manga mode'}
      className={cn(
        'w-12 h-12 rounded-xl flex items-center justify-center transition-all',
        'text-[var(--mm-text-40)] hover:bg-[var(--mm-hover-bg)] hover:text-[var(--mm-text)]',
        className
      )}
    >
      {isManga ? <Moon className="h-5 w-5" /> : <BookOpen className="h-5 w-5" />}
    </button>
  );
}

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
      <aside className="fixed left-0 top-0 z-40 hidden h-screen w-20 flex-col bg-[var(--mm-bg)] border-r border-[var(--mm-card-border)] lg:flex">
        {/* Logo */}
        <div className="flex h-20 items-center justify-center border-b border-[var(--mm-card-border)]">
          <Link href="/" className="flex items-center justify-center">
            <div className="w-10 h-10 rounded-xl bg-[var(--mm-indigo)] flex items-center justify-center">
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
                    ? 'bg-[var(--mm-hover-bg-strong)] text-[var(--mm-text)]'
                    : 'text-[var(--mm-text-40)] hover:bg-[var(--mm-hover-bg)] hover:text-[var(--mm-text)]'
                )}
              >
                <item.icon className="h-5 w-5" />
                {isActive && (
                  <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 bg-[var(--mm-indigo)] rounded-r-full" />
                )}
              </Link>
            );
          })}
        </nav>

        {/* Theme toggle + Settings at bottom */}
        <div className="p-4 border-t border-[var(--mm-card-border)] flex flex-col items-center gap-1">
          <ThemeToggle />
          <Link
            href="/settings"
            className={cn(
              'w-12 h-12 rounded-xl flex items-center justify-center transition-all',
              pathname === '/settings'
                ? 'bg-[var(--mm-hover-bg-strong)] text-[var(--mm-text)]'
                : 'text-[var(--mm-text-40)] hover:bg-[var(--mm-hover-bg)] hover:text-[var(--mm-text)]'
            )}
          >
            <Settings className="h-5 w-5" />
          </Link>
        </div>

        {/* Account */}
        <div className="p-4 pt-0 flex items-center justify-center">
          <UserButton appearance={userButtonAppearance} />
        </div>
      </aside>

      {/* Mobile Bottom Nav */}
      <nav className="fixed bottom-0 left-0 right-0 z-50 h-16 bg-[var(--mm-bg)]/95 backdrop-blur-xl border-t border-[var(--mm-card-border)] lg:hidden flex items-center justify-around px-2">
        {navItems.slice(0, 5).map((item) => {
          const isActive = pathname === item.href || pathname?.startsWith(`${item.href}/`);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex flex-col items-center justify-center w-14 h-14 rounded-xl transition-all',
                isActive ? 'text-[var(--mm-text)]' : 'text-[var(--mm-text-40)]'
              )}
            >
              <item.icon className="h-5 w-5 mb-1" />
              <span className="text-[10px] font-medium">{item.label}</span>
              {isActive && (
                <div className="absolute bottom-1 w-1 h-1 bg-[var(--mm-indigo)] rounded-full" />
              )}
            </Link>
          );
        })}
      </nav>

      {/* Mobile Header */}
      <header className="fixed left-0 right-0 top-0 z-50 h-14 flex items-center justify-between px-4 lg:hidden bg-[var(--mm-bg)]/95 backdrop-blur border-b border-[var(--mm-card-border)]">
        <Link href="/" className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-[var(--mm-indigo)] flex items-center justify-center">
            <Film className="h-4 w-4 text-white" />
          </div>
          <span className="text-lg font-black text-[var(--mm-text)] tracking-tight">MEDIA MIND</span>
        </Link>

        <div className="flex items-center gap-3">
          {mounted && (
            <div className={cn(
              'w-2 h-2 rounded-full',
              is_online ? 'bg-green-500' : 'bg-yellow-500'
            )} />
          )}
          <ThemeToggle className="w-8 h-8" />
          <Link
            href="/friends"
            className={cn(
              'p-1.5 rounded-lg transition-colors',
              pathname === '/friends' ? 'text-[var(--mm-text)] bg-[var(--mm-hover-bg-strong)]' : 'text-[var(--mm-text-50)]'
            )}
          >
            <Users className="h-5 w-5" />
          </Link>
          <UserButton appearance={userButtonAppearance} />
        </div>
      </header>
    </>
  );
}
