import Link from "next/link";
import type { CSSProperties } from "react";
import { notFound } from "next/navigation";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import PrintButton from "./PrintButton";

export const dynamic = "force-dynamic";

const logoUrl =
  "https://lh3.googleusercontent.com/sitesv/AA5AbUBOBiJ3ZyHEQsgQeS5AnlHZG6UC7SiEm3dlp3kYOvxEZ3N7_OGZCzaoVfDUtrPonoq7ZPnpK_8vDrkXESrXi5HPm_reVBRY_l0PYxLMrYoa-uFOb3fsypEma8Eo8ubrpN3MFfSSMBs1sifxdtfHZlnin6ql7pTbsF35QCxICEtSUYKxxUqPYGzhqoN2hZb-27RwliyE1vTUbDSQ1b0dGM61Yg6mZUcFp-utkHUH=w1280";

type Member = {
  id: string;
  first_name: string;
  last_name: string;
  hebrew_name: string | null;
  tribe_status: string | null;
};

type FamilyMember = {
  id: string;
  first_name: string;
  last_name: string | null;
  hebrew_name: string | null;
  relationship: string | null;
  tribe_status: string | null;
  include_on_mishaberach_card: boolean | null;
};

type PageProps = {
  params: Promise<{
    id: string;
  }>;
};

async function getMember(id: string) {
  const { data, error } = await supabaseAdmin
    .from("members")
    .select("id, first_name, last_name, hebrew_name, tribe_status")
    .eq("id", id)
    .maybeSingle();

  if (error) {
    console.error("Error loading member:", error.message);
    return null;
  }

  return data as Member | null;
}

async function getFamilyMembers(memberId: string) {
  const { data, error } = await supabaseAdmin
    .from("member_family_members")
    .select(
      "id, first_name, last_name, hebrew_name, relationship, tribe_status, include_on_mishaberach_card"
    )
    .eq("member_id", memberId)
    .eq("include_on_mishaberach_card", true)
    .order("created_at", { ascending: true });

  if (error) {
    console.error("Error loading family members:", error.message);
    return [];
  }

  return (data || []) as FamilyMember[];
}

function groupByRelationship(
  familyMembers: FamilyMember[],
  relationship: string
) {
  return familyMembers.filter(
    (person) =>
      (person.relationship || "").toLowerCase() === relationship.toLowerCase()
  );
}

function NameLines({ people }: { people: FamilyMember[] }) {
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
          {person.hebrew_name ||
            `${person.first_name} ${person.last_name || ""}`}
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

export default async function PrintableMishaberachCardPage({
  params,
}: PageProps) {
  const { id } = await params;

  const member = await getMember(id);

  if (!member) {
    notFound();
  }

  const familyMembers = await getFamilyMembers(id);

  const spouseNames = groupByRelationship(familyMembers, "Spouse");
  const childNames = groupByRelationship(familyMembers, "Child");
  const otherNames = groupByRelationship(familyMembers, "Other");
  const guestOfNames = groupByRelationship(familyMembers, "Guest Of");

  const leftAmounts = [360, 300, 250, 225, 200, 180, 150];
  const rightAmounts = [18, 36, 50, 72, 90, 100, 125];

  const pageStyle: CSSProperties = {
    minHeight: "100vh",
    background: "#f7f3ea",
    padding: "32px 16px",
    color: "#000",
  };

  const topBarStyle: CSSProperties = {
    maxWidth: "900px",
    margin: "0 auto 48px",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "12px",
  };

  const cardWrapStyle: CSSProperties = {
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
  };

  // postcard size: 6in x 4in landscape
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
    <main style={pageStyle}>
      <div style={topBarStyle} className="print:hidden">
        <Link
          href={`/admin/members/${member.id}`}
          className="rounded-full bg-white px-5 py-3 text-sm font-bold text-slate-900 shadow-sm"
        >
          ← Back to Member
        </Link>

        <PrintButton />
      </div>

      <section style={cardWrapStyle}>
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
                {member.first_name} {member.last_name}
              </h1>

              {member.hebrew_name && (
                <p
                  dir="rtl"
                  style={{
                    marginTop: "4px",
                    marginBottom: "0",
                    fontSize: "15px",
                    lineHeight: "1.15",
                  }}
                >
                  {member.hebrew_name}
                </p>
              )}

              {member.tribe_status && (
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
                  {member.tribe_status}
                </p>
              )}

              {spouseNames.length > 0 && (
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
              )}

              {childNames.length > 0 && (
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
              )}

              {otherNames.length > 0 && (
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
              )}

              {guestOfNames.length > 0 && (
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
              )}
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
      </section>
    </main>
  );
}