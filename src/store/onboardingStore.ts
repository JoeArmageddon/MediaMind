import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

interface OnboardingStore {
  hasSeenTutorial: boolean;
  isTutorialOpen: boolean;
  markSeen: () => void;
  openTutorial: () => void;
  closeTutorial: () => void;
}

// Per-device, not per-account on purpose (same reasoning as themeStore) -
// "have I seen the tutorial" is a UI-state convenience, not data that
// needs to sync across your devices or survive a account switch on a
// shared browser mattering either way.
export const useOnboardingStore = create<OnboardingStore>()(
  persist(
    (set) => ({
      hasSeenTutorial: false,
      isTutorialOpen: false,
      markSeen: () => set({ hasSeenTutorial: true }),
      openTutorial: () => set({ isTutorialOpen: true }),
      closeTutorial: () => set({ isTutorialOpen: false, hasSeenTutorial: true }),
    }),
    {
      name: 'mediamind-onboarding',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({ hasSeenTutorial: state.hasSeenTutorial }),
    }
  )
);
