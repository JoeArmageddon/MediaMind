'use client';

import { useEffect } from 'react';
import { useUser } from '@clerk/nextjs';
import { useOnboardingStore } from '@/store/onboardingStore';

// Opens the tutorial once, automatically, the first time a signed-in user
// loads the app on this device - separate from TutorialModal itself so
// the trigger logic (only for signed-in users, only once) stays out of
// the modal's own open/close/step state.
export function TutorialAutoOpen() {
  const { isLoaded, isSignedIn } = useUser();
  const { hasSeenTutorial, openTutorial } = useOnboardingStore();

  useEffect(() => {
    if (!isLoaded || !isSignedIn || hasSeenTutorial) return;
    // Small delay so it opens after the page's own content has settled in,
    // not fighting the initial page load/hydration for attention.
    const t = setTimeout(() => openTutorial(), 600);
    return () => clearTimeout(t);
  }, [isLoaded, isSignedIn, hasSeenTutorial, openTutorial]);

  return null;
}
