import Link from "next/link";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const dynamic = "force-dynamic";

type RequestRow = {
  id: string;
  family_id_number: number;
  contact_name: string | null;
  email: string | null;
  phone: string | null;
  total_people_in_family: number;
  children_ages_3_8_rosh_hashanah: number;
  children_ages_3_8_first_days_sukkos: number;
  children_ages_3_8_shemini_atzeres: number;
  children_ages_9_13_rosh_hashanah: number;
  children_ages_9_13_first_days_sukkos: number;
  children_ages_9_13_shemini_atzeres: number;
  age_14_plus_rosh_hashanah: number;
  age_14_plus_first_days_sukkos: number;
  age_14_plus_shemini_atzeres: number;
  total_points: number;
  notes: string | null;
  status: string;
  created_at: string;
};

function formatDate(value: string) {
  return new Date(value).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

async function getRequests() {
  const { data, error } = await supabaseAdmin
    .from("yom_tov_assistance_requests")
    .select(
      "id, family_id_number, contact_name, email, phone, total_people_in_family, children_ages_3_8_rosh_hashanah, children_ages_3_8_first_days_sukkos, children_ages_3_8_shemini_atzeres, children_ages_9_13_rosh_hashanah, children_ages_9_13_first_days_sukkos, children_ages_9_13_shemini_atzeres, age_14_plus_rosh_hashanah, age_14_plus_first_days_sukkos, age_14_plus_shemini_atzeres, total_points, notes, status, created_at"
    )
    .order("family_id_number", { ascending: true });

  return {
    rows: (data || []) as RequestRow[],
    error: error?.message || null,
  };
}

export default async function AdminYomTovAssistancePage() {
  const { rows, error } = await getRequests();
  const totalPeople = rows.reduce(
    (sum, row) => sum + Number(row.total_people_in_family || 0),
    0
  );
  const totalPoints = rows.reduce(
    (sum, row) => sum + Number(row.total_points || 0),
    0
  );

  return (
    <main className="min-h-screen bg-[#f7f3ea] text-slate-900">
      <section className="mx-auto max-w-7xl px-5 py-8 sm:px-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Link href="/admin" className="text-sm font-semibold text-[#8b6b2e] hover:underline">
            ← Admin Home
          </Link>
          <Link href="/yom-tov-assistance" className="text-sm font-semibold text-[#8b6b2e] hover:underline">
            Open Private Form
          </Link>
        </div>

        <div className="mt-8 rounded-[2rem] bg-[#1d2940] p-7 text-white shadow-sm sm:p-8">
          <p className="text-sm font-bold uppercase tracking-[0.25em] text-[#d9bf7a]">
            Confidential Admin View
          </p>
          <h1 className="mt-3 text-3xl font-black sm:text-4xl">
            Yom Tov Assistance Requests
          </h1>
          <p className="mt-3 max-w-2xl text-slate-200">
            This screen intentionally shows family ID numbers and responses only.
            Family names are included only in the protected CSV download.
          </p>
        </div>

        {error ? (
          <div className="mt-6 rounded-2xl bg-red-50 p-4 font-bold text-red-800">
            {error}
          </div>
        ) : null}

        <div className="mt-6 grid gap-4 sm:grid-cols-3">
          <div className="rounded-2xl border border-[#e3d9c7] bg-white p-5">
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">Families</p>
            <p className="mt-1 text-3xl font-black">{rows.length}</p>
          </div>
          <div className="rounded-2xl border border-[#e3d9c7] bg-white p-5">
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">Total People</p>
            <p className="mt-1 text-3xl font-black">{totalPeople}</p>
          </div>
          <div className="rounded-2xl border border-[#e3d9c7] bg-white p-5">
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">Total Points</p>
            <p className="mt-1 text-3xl font-black">{totalPoints.toFixed(2)}</p>
          </div>
        </div>

        <div className="mt-6 flex flex-wrap gap-3">
          <a
            href="/api/admin/yom-tov-assistance/export"
            className="rounded-full bg-[#1d2940] px-5 py-3 text-sm font-bold text-white"
          >
            Download CSV with Family Names
          </a>
        </div>

        <div className="mt-6 overflow-x-auto rounded-[2rem] border border-[#e3d9c7] bg-white p-4 shadow-sm">
          <table className="w-full min-w-[1180px] border-separate border-spacing-y-2 text-left text-sm">
            <thead className="text-xs uppercase tracking-[0.08em] text-slate-500">
              <tr>
                <th className="px-3 py-2">Family ID</th>
                <th className="px-3 py-2">Contact</th>
                <th className="px-3 py-2">Total People</th>
                <th className="px-3 py-2">Ages 3–8</th>
                <th className="px-3 py-2">Ages 9–13</th>
                <th className="px-3 py-2">Age 14+</th>
                <th className="px-3 py-2">Total Points</th>
                <th className="px-3 py-2">Notes</th>
                <th className="px-3 py-2">Submitted</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id} className="bg-[#fbf8f2] align-top">
                  <td className="rounded-l-2xl px-3 py-3 text-lg font-black">{row.family_id_number}</td>
                  <td className="px-3 py-3 text-slate-600">
                    <p className="font-bold">{row.contact_name || "—"}</p>
                    <p>{row.email || "—"}</p>
                    <p>{row.phone || "—"}</p>
                  </td>
                  <td className="px-3 py-3 text-xl font-black">{row.total_people_in_family}</td>
                  <td className="px-3 py-3">{row.children_ages_3_8_rosh_hashanah} · {row.children_ages_3_8_first_days_sukkos} · {row.children_ages_3_8_shemini_atzeres}</td>
                  <td className="px-3 py-3">{row.children_ages_9_13_rosh_hashanah} · {row.children_ages_9_13_first_days_sukkos} · {row.children_ages_9_13_shemini_atzeres}</td>
                  <td className="px-3 py-3">{row.age_14_plus_rosh_hashanah} · {row.age_14_plus_first_days_sukkos} · {row.age_14_plus_shemini_atzeres}</td>
                  <td className="px-3 py-3 text-lg font-black">{Number(row.total_points || 0).toFixed(2)}</td>
                  <td className="max-w-xs px-3 py-3 text-slate-600">{row.notes || "—"}</td>
                  <td className="rounded-r-2xl px-3 py-3 text-slate-600">{formatDate(row.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {rows.length === 0 ? (
            <p className="p-10 text-center text-slate-500">No requests yet.</p>
          ) : null}
        </div>
      </section>
    </main>
  );
}
