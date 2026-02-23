import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { AISuggestion, AIRecommendation, AIBurnoutResult, AISmartCollection } from '@/types';

interface AIState {
  // Cache
  suggestionCache: Map<string, AISuggestion[]>;
  recommendationCache: AIRecommendation[] | null;
  burnoutCache: AIBurnoutResult | null;
  smartCollectionCache: AISmartCollection[] | null;
  
  // Loading states
  isLoadingSuggestions: boolean;
  isLoadingRecommendations: boolean;
  isLoadingBurnout: boolean;
  isLoadingCollections: boolean;
  
  // Error states
  error: string | null;
  isAIEnabled: boolean;
  
  // Actions
  setSuggestions: (key: string, suggestions: AISuggestion[]) => void;
  setRecommendations: (recommendations: AIRecommendation[]) => void;
  setBurnoutResult: (result: AIBurnoutResult) => void;
  setSmartCollections: (collections: AISmartCollection[]) => void;
  setLoading: (key: string, loading: boolean) => void;
  setError: (error: string | null) => void;
  setAIEnabled: (enabled: boolean) => void;
  clearCache: () => void;
}

export const useAIStore = create<AIState>()(
  persist(
    (set, get) => ({
      suggestionCache: new Map(),
      recommendationCache: null,
      burnoutCache: null,
      smartCollectionCache: null,
      isLoadingSuggestions: false,
      isLoadingRecommendations: false,
      isLoadingBurnout: false,
      isLoadingCollections: false,
      error: null,
      isAIEnabled: true,

      setSuggestions: (key, suggestions) => {
        set((state) => {
          const newCache = new Map(state.suggestionCache);
          newCache.set(key, suggestions);
          return { suggestionCache: newCache };
        });
      },

      setRecommendations: (recommendations) => {
        set({ recommendationCache: recommendations });
      },

      setBurnoutResult: (result) => {
        set({ burnoutCache: result });
      },

      setSmartCollections: (collections) => {
        set({ smartCollectionCache: collections });
      },

      setLoading: (key, loading) => {
        switch (key) {
          case 'suggestions':
            set({ isLoadingSuggestions: loading });
            break;
          case 'recommendations':
            set({ isLoadingRecommendations: loading });
            break;
          case 'burnout':
            set({ isLoadingBurnout: loading });
            break;
          case 'collections':
            set({ isLoadingCollections: loading });
            break;
        }
      },

      setError: (error) => set({ error }),
      
      setAIEnabled: (enabled) => set({ isAIEnabled: enabled }),

      clearCache: () => {
        set({
          suggestionCache: new Map(),
          recommendationCache: null,
          burnoutCache: null,
          smartCollectionCache: null,
        });
      },
    }),
    {
      name: 'ai-store',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        recommendationCache: state.recommendationCache,
        burnoutCache: state.burnoutCache,
        smartCollectionCache: state.smartCollectionCache,
        isAIEnabled: state.isAIEnabled,
      }),
    }
  )
);
