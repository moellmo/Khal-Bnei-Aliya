import Link from "next/link";

export default function PortalPage() {
  return (
    <main className="min-h-screen bg-[#f7f3ea] p-8 text-slate-900">
      <Link href="/" className="text-sm font-semibold text-[#8b6b2e]">← Back Home</Link>
      <div className="mx-auto mt-10 max-w-3xl rounded-[2rem] bg-white p-8 shadow-sm">
        <h1 className="text-3xl font-bold">Member Portal</h1>
        <p className="mt-3 text-slate-600">Members will see dues, pledges, payments, and receipts here.</p>
      </div>
    </main>
  );
}