import { useEffect } from 'react';
import * as WebBrowser from 'expo-web-browser';

// Clerk's documented pattern for OAuth (Google/Apple/etc) on Expo: warming
// the in-app browser up before the user taps a sign-in button shaves a
// noticeable amount of latency off the actual OAuth redirect, and
// maybeCompleteAuthSession() (called once, at module scope so it only ever
// registers once) is what lets the browser session correctly hand control
// back to the app after the provider redirects back.
WebBrowser.maybeCompleteAuthSession();

export function useWarmUpBrowser() {
  useEffect(() => {
    void WebBrowser.warmUpAsync();
    return () => {
      void WebBrowser.coolDownAsync();
    };
  }, []);
}
