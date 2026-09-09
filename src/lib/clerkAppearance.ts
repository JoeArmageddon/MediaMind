import type { Appearance } from '@clerk/types';

// Clerk's <SignIn>/<SignUp> were rendering completely unthemed (Clerk's own
// default light-mode card - white background, black text) dropped into an
// otherwise all-dark app. That mismatch is exactly what produced the
// "black text in the input boxes" bug: depending on browser/OS dark-mode
// handling of un-styled form controls, Clerk's default black input text
// could end up rendering against a background that wasn't the plain white
// Clerk assumes. The real fix is matching Clerk's actual color variables to
// the app's palette (see globals.css's --bg-primary/--bg-card and the
// indigo-600 accent used everywhere else) rather than leaving it default.
export const clerkAppearance: Appearance = {
  variables: {
    colorPrimary: '#4f46e5', // indigo-600, matches every other primary button in the app
    colorBackground: '#0a0a0a',
    colorInputBackground: '#000000',
    colorInputText: '#ffffff',
    colorText: '#ffffff',
    colorTextSecondary: 'rgba(255,255,255,0.5)',
    colorTextOnPrimaryBackground: '#ffffff',
    colorDanger: '#ef4444',
    colorSuccess: '#22c55e',
    colorNeutral: '#ffffff',
    borderRadius: '0.75rem',
    fontFamily: 'system-ui, -apple-system, sans-serif',
  },
  elements: {
    rootBox: 'w-full flex justify-center',
    card: 'bg-[#0a0a0a] border border-white/10 shadow-2xl rounded-[28px]',
    headerTitle: 'text-white',
    headerSubtitle: 'text-white/50',
    socialButtonsBlockButton: 'bg-white/5 border border-white/10 hover:bg-white/10 text-white',
    socialButtonsBlockButtonText: 'text-white',
    dividerLine: 'bg-white/10',
    dividerText: 'text-white/40',
    formFieldLabel: 'text-white/70',
    formFieldInput:
      'bg-black border border-white/10 text-white placeholder:text-white/30 focus:border-indigo-500',
    formButtonPrimary: 'bg-indigo-600 hover:bg-indigo-700 text-white normal-case',
    footerActionText: 'text-white/50',
    footerActionLink: 'text-indigo-400 hover:text-indigo-300',
    identityPreviewText: 'text-white',
    identityPreviewEditButton: 'text-indigo-400',
    formFieldInputShowPasswordButton: 'text-white/40 hover:text-white',
    otpCodeFieldInput: 'bg-black border border-white/10 text-white',
    formResendCodeLink: 'text-indigo-400',
    alertText: 'text-white',
    formFieldSuccessText: 'text-green-400',
    formFieldErrorText: 'text-red-400',
  },
};
