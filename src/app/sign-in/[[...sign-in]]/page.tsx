import { SignIn } from '@clerk/nextjs';
import { clerkAppearance } from '@/lib/clerkAppearance';
import { safeRedirectPath } from '@/lib/safeRedirect';

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ redirect_url?: string }>;
}) {
  // Generic "come back here after auth" support - e.g. an invite link
  // (/invite/[code]) hands this through so someone without an account yet
  // lands back on the invite instead of the dashboard once they've signed in.
  const { redirect_url } = await searchParams;

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-[#050505] p-4">
      <div className="mb-8 text-center">
        <h1 className="text-4xl font-black text-white tracking-tighter">MEDIA MIND</h1>
        <p className="text-xs text-indigo-400 font-mono tracking-[0.2em] uppercase mt-1">Intelligence</p>
      </div>
      <SignIn appearance={clerkAppearance} forceRedirectUrl={safeRedirectPath(redirect_url)} />
    </div>
  );
}
