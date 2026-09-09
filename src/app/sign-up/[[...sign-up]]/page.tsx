import Link from 'next/link';
import { SignUp } from '@clerk/nextjs';
import { clerkAppearance } from '@/lib/clerkAppearance';
import { safeRedirectPath } from '@/lib/safeRedirect';

export default async function SignUpPage({
  searchParams,
}: {
  searchParams: Promise<{ redirect_url?: string }>;
}) {
  const { redirect_url } = await searchParams;

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-[#050505] p-4">
      <div className="mb-8 text-center">
        <h1 className="text-4xl font-black text-white tracking-tighter">MEDIA MIND</h1>
        <p className="text-xs text-indigo-400 font-mono tracking-[0.2em] uppercase mt-1">Intelligence</p>
      </div>
      <SignUp appearance={clerkAppearance} forceRedirectUrl={safeRedirectPath(redirect_url)} />
      <Link
        href="/privacy"
        className="mt-6 text-xs text-white/30 hover:text-white/60 transition-colors"
      >
        Privacy Policy
      </Link>
    </div>
  );
}
