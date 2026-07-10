import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabaseServer";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import {
  deleteSeasonalPdf,
  deleteWeeklyPdf,
  publishWeeklyPdf,
  toggleSeasonalPdf,
  uploadSeasonalPdf,
  uploadWeeklyPdf,
} from "./actions";

export const dynamic = "force-dynamic";

type PageProps = {
  searchParams?: Promise<{
    weeklyUploaded?: string;
    weeklyPublished?: string;
    weeklyDeleted?: string;
    seasonalUploaded?: string;
    seasonalUpdated?: string;
    seasonalDeleted?: string;
  }>;
};

type WeeklyPdfRow = {
  id: string;
  title: string;
  source_pdf_url: string | null;
  source_pdf_name: string | null;
  is_published: boolean;
  created_at: string;
};

type SeasonalPdfRow = {
  id: string;
  title: string;
  schedule_type: string;
  pdf_url: string;
  pdf_name: string | null;
  is_published: boolean;
  display_on_homepage: boolean;
  created_at: string;
};

async function requireAdminPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: member } = await supabaseAdmin
    .from("members")
    .select("portal_role, portal_status")
    .eq("auth_user_id", user.id)
    .maybeSingle();

  if (
    !member ||
    member.portal_role !== "admin" ||
    member.portal_status !== "active"
  ) {
    redirect("/");
  }
}

async function getWeeklyPdfs(): Promise<
  WeeklyPdfRow[]
> {
  const { data, error } = await supabaseAdmin
    .from("weekly_schedules")
    .select(
      `
      id,
      title,
      source_pdf_url,
      source_pdf_name,
      is_published,
      created_at
      `
    )
    .not("source_pdf_url", "is", null)
    .order("created_at", { ascending: false });

  if (error) {
    console.error(
      "Unable to load weekly PDFs:",
      error.message
    );

    return [];
  }

  return (data || []) as WeeklyPdfRow[];
}

async function getSeasonalPdfs(): Promise<
  SeasonalPdfRow[]
> {
  const { data, error } = await supabaseAdmin
    .from("seasonal_schedules")
    .select(
      `
      id,
      title,
      schedule_type,
      pdf_url,
      pdf_name,
      is_published,
      display_on_homepage,
      created_at
      `
    )
    .order("created_at", { ascending: false });

  if (error) {
    console.error(
      "Unable to load seasonal PDFs:",
      error.message
    );

    return [];
  }

  return (data || []) as SeasonalPdfRow[];
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(value));
}

export default async function AdminDaveningTimesPage({
  searchParams,
}: PageProps) {
  await requireAdminPage();

  const params = await searchParams;

  const [weeklyPdfs, seasonalPdfs] =
    await Promise.all([
      getWeeklyPdfs(),
      getSeasonalPdfs(),
    ]);

  return (
    <main className="min-h-screen bg-[#f7f3ea] text-slate-900">
      <section className="mx-auto max-w-6xl px-5 py-8 sm:px-6">
        <Link
          href="/admin"
          className="text-sm font-semibold text-[#8b6b2e] hover:underline"
        >
          ← Back to Admin
        </Link>

        <div className="mt-8 rounded-[2rem] bg-[#1d2940] p-7 text-white shadow-sm sm:p-8">
          <p className="text-sm font-bold uppercase tracking-[0.25em] text-[#d9bf7a]">
            Admin
          </p>

          <h1 className="mt-3 text-3xl font-bold sm:text-4xl">
            Schedule PDFs
          </h1>

          <p className="mt-4 max-w-2xl leading-7 text-slate-200">
            Upload the current weekly schedule and
            seasonal schedules. No times, dates, or
            Parsha information are required.
          </p>
        </div>

        {params?.weeklyUploaded === "1" && (
          <SuccessMessage>
            Weekly PDF uploaded and published.
          </SuccessMessage>
        )}

        {params?.weeklyPublished === "1" && (
          <SuccessMessage>
            The selected weekly PDF is now live.
          </SuccessMessage>
        )}

        {params?.weeklyDeleted === "1" && (
          <SuccessMessage>
            Weekly PDF deleted.
          </SuccessMessage>
        )}

        {params?.seasonalUploaded === "1" && (
          <SuccessMessage>
            Seasonal PDF uploaded.
          </SuccessMessage>
        )}

        {params?.seasonalUpdated === "1" && (
          <SuccessMessage>
            Seasonal PDF visibility updated.
          </SuccessMessage>
        )}

        {params?.seasonalDeleted === "1" && (
          <SuccessMessage>
            Seasonal PDF deleted.
          </SuccessMessage>
        )}

        <div className="mt-8 grid gap-6 lg:grid-cols-2">
          {/* WEEKLY UPLOAD */}
          <form
            action={uploadWeeklyPdf}
            className="rounded-[2rem] border border-[#e3d9c7] bg-white p-6 shadow-sm sm:p-8"
          >
            <p className="text-xs font-bold uppercase tracking-[0.22em] text-[#8b6b2e]">
              Weekly Schedule
            </p>

            <h2 className="mt-2 text-2xl font-bold">
              Upload This Week’s PDF
            </h2>

            <p className="mt-3 text-sm leading-6 text-slate-600">
              The filename will be used as the title.
              Uploading a new weekly PDF automatically
              makes it the current homepage schedule.
            </p>

            <label className="mt-6 block space-y-2">
              <span className="font-semibold">
                Weekly PDF
              </span>

              <input
                name="weekly_pdf"
                type="file"
                accept="application/pdf"
                required
                className="w-full rounded-xl border border-[#d8cdb7] bg-white px-4 py-3"
              />
            </label>

            <button
              type="submit"
              className="mt-6 w-full rounded-full bg-[#1d2940] px-6 py-3.5 font-bold text-white transition hover:bg-[#10192b]"
            >
              Upload Weekly PDF
            </button>
          </form>

          {/* SEASONAL UPLOAD */}
          <form
            action={uploadSeasonalPdf}
            className="rounded-[2rem] border border-[#e3d9c7] bg-white p-6 shadow-sm sm:p-8"
          >
            <p className="text-xs font-bold uppercase tracking-[0.22em] text-[#8b6b2e]">
              Seasonal Schedule
            </p>

            <h2 className="mt-2 text-2xl font-bold">
              Upload Long-Term PDF
            </h2>

            <p className="mt-3 text-sm leading-6 text-slate-600">
              Use this for a winter, summer, Yom Tov,
              Selichos, or other full schedule.
            </p>

            <div className="mt-6 grid gap-4">
              <label className="space-y-2">
                <span className="font-semibold">
                  Optional Display Title
                </span>

                <input
                  name="seasonal_title"
                  placeholder="Winter Schedule"
                  className="w-full rounded-xl border border-[#d8cdb7] px-4 py-3"
                />
              </label>

              <label className="space-y-2">
                <span className="font-semibold">
                  Type
                </span>

                <select
                  name="seasonal_type"
                  defaultValue="winter"
                  className="w-full rounded-xl border border-[#d8cdb7] bg-white px-4 py-3"
                >
                  <option value="winter">
                    Winter
                  </option>
                  <option value="summer">
                    Summer
                  </option>
                  <option value="yom_tov">
                    Yom Tov
                  </option>
                  <option value="selichos">
                    Selichos
                  </option>
                  <option value="seasonal">
                    Seasonal
                  </option>
                  <option value="special">
                    Special
                  </option>
                </select>
              </label>

              <label className="space-y-2">
                <span className="font-semibold">
                  PDF
                </span>

                <input
                  name="seasonal_pdf"
                  type="file"
                  accept="application/pdf"
                  required
                  className="w-full rounded-xl border border-[#d8cdb7] bg-white px-4 py-3"
                />
              </label>
            </div>

            <button
              type="submit"
              className="mt-6 w-full rounded-full bg-[#8b6b2e] px-6 py-3.5 font-bold text-white transition hover:bg-[#745822]"
            >
              Upload Seasonal PDF
            </button>
          </form>
        </div>

        {/* WEEKLY HISTORY */}
        <section className="mt-8 rounded-[2rem] border border-[#e3d9c7] bg-white p-6 shadow-sm sm:p-8">
          <p className="text-xs font-bold uppercase tracking-[0.22em] text-[#8b6b2e]">
            Previous Uploads
          </p>

          <h2 className="mt-2 text-2xl font-bold">
            Weekly PDFs
          </h2>

          {weeklyPdfs.length === 0 ? (
            <EmptyMessage>
              No weekly PDFs have been uploaded.
            </EmptyMessage>
          ) : (
            <div className="mt-6 space-y-4">
              {weeklyPdfs.map((pdf) => (
                <div
                  key={pdf.id}
                  className="flex flex-col gap-4 rounded-2xl border border-[#e3d9c7] bg-[#fbf8f2] p-5 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="truncate font-bold">
                        {pdf.title}
                      </h3>

                      {pdf.is_published && (
                        <span className="rounded-full bg-green-100 px-3 py-1 text-xs font-bold text-green-800">
                          Current
                        </span>
                      )}
                    </div>

                    <p className="mt-1 text-sm text-slate-500">
                      {formatDate(pdf.created_at)}
                    </p>

                    {pdf.source_pdf_name && (
                      <p className="mt-1 truncate text-xs text-slate-500">
                        {pdf.source_pdf_name}
                      </p>
                    )}
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {pdf.source_pdf_url && (
                      <a
                        href={pdf.source_pdf_url}
                        target="_blank"
                        rel="noreferrer"
                        className="rounded-full border border-[#cbbd9d] bg-white px-4 py-2 text-sm font-bold"
                      >
                        Open
                      </a>
                    )}

                    {!pdf.is_published && (
                      <form action={publishWeeklyPdf}>
                        <input
                          type="hidden"
                          name="schedule_id"
                          value={pdf.id}
                        />

                        <button
                          type="submit"
                          className="rounded-full bg-green-700 px-4 py-2 text-sm font-bold text-white"
                        >
                          Make Current
                        </button>
                      </form>
                    )}

                    <form action={deleteWeeklyPdf}>
                      <input
                        type="hidden"
                        name="schedule_id"
                        value={pdf.id}
                      />

                      <button
                        type="submit"
                        className="rounded-full bg-red-100 px-4 py-2 text-sm font-bold text-red-700"
                      >
                        Delete
                      </button>
                    </form>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* SEASONAL HISTORY */}
        <section className="mt-8 rounded-[2rem] border border-[#e3d9c7] bg-white p-6 shadow-sm sm:p-8">
          <p className="text-xs font-bold uppercase tracking-[0.22em] text-[#8b6b2e]">
            Previous Uploads
          </p>

          <h2 className="mt-2 text-2xl font-bold">
            Seasonal PDFs
          </h2>

          {seasonalPdfs.length === 0 ? (
            <EmptyMessage>
              No seasonal PDFs have been uploaded.
            </EmptyMessage>
          ) : (
            <div className="mt-6 space-y-4">
              {seasonalPdfs.map((pdf) => (
                <div
                  key={pdf.id}
                  className="flex flex-col gap-4 rounded-2xl border border-[#e3d9c7] bg-[#fbf8f2] p-5 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="truncate font-bold">
                        {pdf.title}
                      </h3>

                      <span className="rounded-full bg-[#eee5d5] px-3 py-1 text-xs font-bold capitalize text-[#755a25]">
                        {pdf.schedule_type.replaceAll(
                          "_",
                          " "
                        )}
                      </span>

                      <span
                        className={`rounded-full px-3 py-1 text-xs font-bold ${
                          pdf.is_published
                            ? "bg-green-100 text-green-800"
                            : "bg-slate-200 text-slate-700"
                        }`}
                      >
                        {pdf.is_published
                          ? "Visible"
                          : "Hidden"}
                      </span>
                    </div>

                    <p className="mt-1 text-sm text-slate-500">
                      {formatDate(pdf.created_at)}
                    </p>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <a
                      href={pdf.pdf_url}
                      target="_blank"
                      rel="noreferrer"
                      className="rounded-full border border-[#cbbd9d] bg-white px-4 py-2 text-sm font-bold"
                    >
                      Open
                    </a>

                    <form action={toggleSeasonalPdf}>
                      <input
                        type="hidden"
                        name="schedule_id"
                        value={pdf.id}
                      />

                      <input
                        type="hidden"
                        name="publish"
                        value={
                          pdf.is_published
                            ? "false"
                            : "true"
                        }
                      />

                      <button
                        type="submit"
                        className={`rounded-full px-4 py-2 text-sm font-bold ${
                          pdf.is_published
                            ? "bg-amber-100 text-amber-900"
                            : "bg-green-700 text-white"
                        }`}
                      >
                        {pdf.is_published
                          ? "Hide"
                          : "Show"}
                      </button>
                    </form>

                    <form action={deleteSeasonalPdf}>
                      <input
                        type="hidden"
                        name="schedule_id"
                        value={pdf.id}
                      />

                      <button
                        type="submit"
                        className="rounded-full bg-red-100 px-4 py-2 text-sm font-bold text-red-700"
                      >
                        Delete
                      </button>
                    </form>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </section>
    </main>
  );
}

function SuccessMessage({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="mt-6 rounded-2xl border border-green-200 bg-green-50 p-4 font-semibold text-green-800">
      {children}
    </div>
  );
}

function EmptyMessage({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="mt-6 rounded-2xl border border-dashed border-[#d8cdb7] bg-[#fbf8f2] p-8 text-center text-sm text-slate-600">
      {children}
    </div>
  );
}