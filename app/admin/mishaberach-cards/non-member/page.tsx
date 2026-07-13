import Link from "next/link";
import type { CSSProperties } from "react";
import PrintButton from "../../members/[id]/mishaberach-card/PrintButton";

export const dynamic = "force-dynamic";

const logoUrl = "/kba-logo.png";

type PageProps = {
  searchParams?: Promise<{
    first_name?: string;
    last_name?: string;
    hebrew_name?: string;
    tribe_status?: string;
    spouse_names?: string;
    child_names?: string;
    other_names?: string;
    guest_of_names?: string;
  }>;
};

type NameLine = {
  id: string;
  hebrew_name: string;
};

function clean(value: string | undefined) {
  return String(value || "").trim();
}

function parseNames(value: string | undefined, prefix: string): NameLine[] {
  return clean(value)
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line, index) => ({
      id: `${prefix}-${index}`,
      hebrew_name: line,
    }));
}

function NameLines({ people }: { people: NameLine[] }) {
  if (people.length === 0) return null;

  return (
    <div style={{ marginTop: "4px" }}>
      {people.map((person) => (
        <p
          key={person.id}
          dir="rtl"
          style={{
            fontSize: "13px",
            lineHeight: "1.15",
            margin: "3px 0 0",
          }}
        >
          {person.hebrew_name}
        </p>
      ))}
    </div>
  );
}

function Logo() {
  return (
    <div
      style={{
        width: "54px",
        height: "54px",
        margin: "0 auto",
        borderRadius: "9999px",
        overflow: "hidden",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "#fff",
        border: "1px solid #d4d4d4",
      }}
    >
      <img
        src={logoUrl}
        alt="Khal Bnei Aliya logo"
        style={{
          width: "54px",
          height: "54px",
          objectFit: "cover",
          display: "block",
        }}
      />
    </div>
  );
}

function TextareaField({
  label,
  name,
  defaultValue,
  placeholder,
}: {
  label: string;
  name: string;
  defaultValue: string;
  placeholder: string;
}) {
  return (
    <label className="block text-sm font-bold text-slate-700">
      {label}
      <textarea
        name={name}
        defaultValue={defaultValue}
        rows={3}
        className="mt-2 w-full rounded-2xl border border-[#d8cdb7] bg-white px-4 py-3 text-sm text-slate-900"
        placeholder={placeholder}
      />
    </label>
  );
}

export default async function NonMemberMishaberachCardPage({
  searchParams,
}: PageProps) {
  const params = await searchParams;
  const firstName = clean(params?.first_name);
  const lastName = clean(params?.last_name);
  const hebrewName = clean(params?.hebrew_name);
  const tribeStatus = clean(params?.tribe_status) || "Yisroel";
  const spouseNames = parseNames(params?.spouse_names, "spouse");
  const childNames = parseNames(params?.child_names, "child");
  const otherNames = parseNames(params?.other_names, "other");
  const guestOfNames = parseNames(params?.guest_of_names, "guest");
  const hasCardContent = Boolean(
    firstName ||
      lastName ||
      hebrewName ||
      spouseNames.length ||
      childNames.length ||
      otherNames.length ||
      guestOfNames.length
  );

  const leftAmounts = [360, 300, 250, 225, 200, 180, 150];
  const rightAmounts = [18, 36, 50, 72, 90, 100, 125];

  const cardWrapStyle: CSSProperties = {
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
  };

  const cardStyle: CSSProperties = {
    width: "6in",
    height: "4in",
    background: "#fff",
    padding: "20px 18px",
    boxShadow: "0 12px 24px rgba(0,0,0,0.10)",
    boxSizing: "border-box",
  };

  const gridStyle: CSSProperties = {
    display: "grid",
    gridTemplateColumns: "92px 1fr 92px",
    columnGap: "16px",
    alignItems: "stretch",
    height: "100%",
  };

  const sideColumnStyle: CSSProperties = {
    textAlign: "center",
    fontSize: "10px",
    display: "flex",
    flexDirection: "column",
    justifyContent: "space-between",
  };

  const sideHeaderStyle: CSSProperties = {
    borderBottom: "2px solid black",
    paddingBottom: "4px",
    margin: "0",
    fontSize: "10px",
    fontWeight: 600,
  };

  const amountRowStyle: CSSProperties = {
    height: "28px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    borderBottom: "2px solid black",
    fontSize: "10px",
  };

  const centerStyle: CSSProperties = {
    textAlign: "center",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "flex-start",
    minHeight: "100%",
    overflow: "hidden",
  };

  return (
    <main className="min-h-screen bg-[#f7f3ea] px-5 py-8 text-slate-900 sm:px-6">
      <section className="mx-auto max-w-6xl print:hidden">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <Link
            href="/admin/mishaberach-cards"
            className="text-sm font-semibold text-[#8b6b2e] hover:underline"
          >
            ← Back to Mishaberach Cards
          </Link>

          {hasCardContent ? <PrintButton /> : null}
        </div>

        <div className="mt-8 rounded-[2rem] bg-[#1d2940] p-7 text-white shadow-sm sm:p-8">
          <p className="text-sm font-bold uppercase tracking-[0.25em] text-[#d9bf7a]">
            Admin
          </p>
          <h1 className="mt-3 text-3xl font-bold sm:text-4xl">
            Non-member Mishaberach Card
          </h1>
          <p className="mt-4 max-w-2xl text-slate-200">
            Create a one-time printable card without adding a member record.
          </p>
        </div>

        <form
          method="GET"
          className="mt-8 grid gap-5 rounded-[2rem] border border-[#e3d9c7] bg-white p-6 shadow-sm sm:p-8 lg:grid-cols-2"
        >
          <label className="block text-sm font-bold text-slate-700">
            English First Name
            <input
              name="first_name"
              defaultValue={firstName}
              className="mt-2 w-full rounded-2xl border border-[#d8cdb7] bg-white px-4 py-3 text-sm text-slate-900"
              placeholder="Guest"
            />
          </label>

          <label className="block text-sm font-bold text-slate-700">
            English Last Name
            <input
              name="last_name"
              defaultValue={lastName}
              className="mt-2 w-full rounded-2xl border border-[#d8cdb7] bg-white px-4 py-3 text-sm text-slate-900"
              placeholder="Family"
            />
          </label>

          <label className="block text-sm font-bold text-slate-700">
            Main Hebrew Name
            <input
              name="hebrew_name"
              dir="rtl"
              defaultValue={hebrewName}
              className="mt-2 w-full rounded-2xl border border-[#d8cdb7] bg-white px-4 py-3 text-right text-sm text-slate-900"
              placeholder="שם בן שם"
            />
          </label>

          <label className="block text-sm font-bold text-slate-700">
            Status
            <select
              name="tribe_status"
              defaultValue={tribeStatus}
              className="mt-2 w-full rounded-2xl border border-[#d8cdb7] bg-white px-4 py-3 text-sm text-slate-900"
            >
              <option>Yisroel</option>
              <option>Kohen</option>
              <option>Levi</option>
            </select>
          </label>

          <TextareaField
            label="Spouse Names"
            name="spouse_names"
            defaultValue={clean(params?.spouse_names)}
            placeholder="One Hebrew name per line"
          />

          <TextareaField
            label="Children Names"
            name="child_names"
            defaultValue={clean(params?.child_names)}
            placeholder="One Hebrew name per line"
          />

          <TextareaField
            label="Other Names"
            name="other_names"
            defaultValue={clean(params?.other_names)}
            placeholder="One Hebrew name per line"
          />

          <TextareaField
            label="Guest Of Names"
            name="guest_of_names"
            defaultValue={clean(params?.guest_of_names)}
            placeholder="One Hebrew name per line"
          />

          <div className="flex flex-wrap gap-3 lg:col-span-2">
            <button
              type="submit"
              className="rounded-full bg-[#1d2940] px-6 py-3 text-sm font-bold text-white transition hover:bg-[#10192b]"
            >
              Preview Card
            </button>

            <Link
              href="/admin/mishaberach-cards/non-member"
              className="rounded-full border border-[#cbbd9d] bg-white px-6 py-3 text-sm font-bold transition hover:bg-[#f2eadc]"
            >
              Clear Form
            </Link>
          </div>
        </form>
      </section>

      {hasCardContent ? (
        <section className="mx-auto mt-8 max-w-6xl print:mt-0">
          <div style={cardWrapStyle}>
            <div style={cardStyle}>
              <div style={gridStyle}>
                <div style={sideColumnStyle}>
                  <p style={sideHeaderStyle}>Other</p>
                  {leftAmounts.map((amount) => (
                    <div key={amount} style={amountRowStyle}>
                      {amount}
                    </div>
                  ))}
                </div>

                <div style={centerStyle}>
                  <Logo />

                  <h1
                    style={{
                      marginTop: "14px",
                      marginBottom: "0",
                      fontSize: "22px",
                      fontWeight: 900,
                      lineHeight: "1.1",
                    }}
                  >
                    {[firstName, lastName].filter(Boolean).join(" ") ||
                      "Non-member"}
                  </h1>

                  {hebrewName ? (
                    <p
                      dir="rtl"
                      style={{
                        marginTop: "4px",
                        marginBottom: "0",
                        fontSize: "15px",
                        lineHeight: "1.15",
                      }}
                    >
                      {hebrewName}
                    </p>
                  ) : null}

                  {tribeStatus ? (
                    <p
                      style={{
                        marginTop: "4px",
                        marginBottom: "0",
                        fontSize: "11px",
                        fontWeight: 700,
                        letterSpacing: "0.04em",
                        textTransform: "uppercase",
                        color: "#475569",
                      }}
                    >
                      {tribeStatus}
                    </p>
                  ) : null}

                  {spouseNames.length > 0 ? (
                    <div style={{ marginTop: "8px" }}>
                      <h2
                        style={{
                          fontSize: "18px",
                          fontWeight: 900,
                          lineHeight: "1.1",
                          margin: 0,
                        }}
                      >
                        Spouse
                      </h2>
                      <NameLines people={spouseNames} />
                    </div>
                  ) : null}

                  {childNames.length > 0 ? (
                    <div style={{ marginTop: "8px" }}>
                      <h2
                        style={{
                          fontSize: "18px",
                          fontWeight: 900,
                          lineHeight: "1.1",
                          margin: 0,
                        }}
                      >
                        Children
                      </h2>
                      <NameLines people={childNames} />
                    </div>
                  ) : null}

                  {otherNames.length > 0 ? (
                    <div style={{ marginTop: "10px" }}>
                      <h2
                        style={{
                          fontSize: "18px",
                          fontWeight: 900,
                          lineHeight: "1.1",
                          margin: 0,
                        }}
                      >
                        Others
                      </h2>
                      <NameLines people={otherNames} />
                    </div>
                  ) : null}

                  {guestOfNames.length > 0 ? (
                    <div style={{ marginTop: "10px" }}>
                      <h2
                        style={{
                          fontSize: "16px",
                          fontWeight: 900,
                          lineHeight: "1.1",
                          margin: 0,
                        }}
                      >
                        Guest Of
                      </h2>
                      <NameLines people={guestOfNames} />
                    </div>
                  ) : null}
                </div>

                <div style={sideColumnStyle}>
                  <p dir="rtl" style={sideHeaderStyle}>
                    מתנה
                  </p>
                  {rightAmounts.map((amount) => (
                    <div key={amount} style={amountRowStyle}>
                      {amount}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>
      ) : null}
    </main>
  );
}
