import Link from "next/link";

export default function LoginPage() {
  return (
    <main className="min-h-screen bg-[#f7f3ea] p-8 text-slate-900">
      <Link href="/" className="text-sm font-semibold text-[#8b6b2e]">← Back Home</Link>
      <div className="mx-auto mt-10 max-w-md rounded-[2rem] bg-white p-8 shadow-sm">
        <h1 className="text-3xl font-bold">Member Login</h1>
        <p className="mt-3 text-slate-600">Login will connect to Supabase next.</p>
      </div>
    </main>
  );
}