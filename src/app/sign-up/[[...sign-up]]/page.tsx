import { SignUp } from '@clerk/nextjs';

export default function SignUpPage() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-[#050505] p-4">
      <div className="mb-8 text-center">
        <h1 className="text-4xl font-black text-white tracking-tighter">MEDIA MIND</h1>
        <p className="text-xs text-indigo-400 font-mono tracking-[0.2em] uppercase mt-1">Intelligence</p>
      </div>
      <SignUp />
    </div>
  );
}
