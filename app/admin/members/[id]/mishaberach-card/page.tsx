import Link from "next/link";
import type { CSSProperties } from "react";
import { notFound } from "next/navigation";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import PrintButton from "./PrintButton";
const logoUrl =
  "https://lh3.googleusercontent.com/sitesv/AA5AbUBOBiJ3ZyHEQsgQeS5AnlHZG6UC7SiEm3dlp3kYOvxEZ3N7_OGZCzaoVfDUtrPonoq7ZPnpK_8vDrkXESrXi5HPm_reVBRY_l0PYxLMrYoa-uFOb3fsypEma8Eo8ubrpN3MFfSSMBs1sifxdtfHZlnin6ql7pTbsF35QCxICEtSUYKxxUqPYGzhqoN2hZb-27RwliyE1vTUbDSQ1b0dGM61Yg6mZUcFp-utkHUH=w1280";

export const dynamic = "force-dynamic";

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
    <div className="mt-1 space-y-1">
      {people.map((person) => (
        <p key={person.id} dir="rtl" className="text-[19px] leading-tight">
          {person.hebrew_name ||
            `${person.first_name} ${person.last_name || ""}`}
        </p>
      ))}
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

  const cardGridStyle: CSSProperties = {
    display: "grid",
    gridTemplateColumns: "130px 1fr 130px",
    columnGap: "34px",
    alignItems: "stretch",
  };

  return (
    <main className="min-h-screen bg-[#f7f3ea] px-4 py-8 text-black print:bg-white print:p-0">
      <div className="mx-auto mb-8 flex max-w-5xl flex-wrap items-center justify-between gap-3 print:hidden">
        <Link
          href={`/admin/members/${member.id}`}
          className="rounded-full bg-white px-5 py-3 text-sm font-bold text-slate-900 shadow-sm"
        >
          ← Back to Member
        </Link>

        <PrintButton />
      </div>

      <section className="mx-auto flex min-h-[70vh] max-w-6xl items-center justify-center print:min-h-0 print:max-w-none">
        <div className="w-[1040px] bg-white p-8 shadow-xl print:w-[10in] print:p-6 print:shadow-none">
          <div style={cardGridStyle}>
            <div className="text-center text-[18px]">
              <p className="border-b-2 border-black pb-2">Other</p>

              {leftAmounts.map((amount) => (
                <div
                  key={amount}
                  className="flex h-[54px] items-center justify-center border-b-2 border-black"
                >
                  {amount}
                </div>
              ))}
            </div>

            <div className="min-h-[400px] text-center">
             <div
  style={{
    width: "62px",
    height: "62px",
    borderRadius: "9999px",
    overflow: "hidden",
    margin: "0 auto",
    background: "white",
  }}
>
  <img
    src={logoUrl}
    alt="Khal Bnei Aliya logo"
    style={{
      width: "62px",
      height: "62px",
      objectFit: "cover",
      objectPosition: "center",
      display: "block",
      borderRadius: "9999px",
    }}
  />
</div>

              <h1 className="mt-4 text-[33px] font-black leading-tight">
                {member.first_name} {member.last_name}
              </h1>

              {member.hebrew_name && (
                <p dir="rtl" className="mt-1 text-[22px] leading-tight">
                  {member.hebrew_name}
                </p>
              )}

              {spouseNames.length > 0 && (
                <div className="mt-2">
                  <h2 className="text-[30px] font-black leading-tight">
                    Spouse
                  </h2>
                  <NameLines people={spouseNames} />
                </div>
              )}

              {childNames.length > 0 && (
                <div className="mt-3">
                  <h2 className="text-[30px] font-black leading-tight">
                    Children
                  </h2>
                  <NameLines people={childNames} />
                </div>
              )}

              {otherNames.length > 0 && (
                <div className="mt-9">
                  <h2 className="text-[30px] font-black leading-tight">
                    Others
                  </h2>
                  <NameLines people={otherNames} />
                </div>
              )}

              {guestOfNames.length > 0 && (
                <div className="mt-6">
                  <h2 className="text-[26px] font-black leading-tight">
                    Guest Of
                  </h2>
                  <NameLines people={guestOfNames} />
                </div>
              )}
            </div>

            <div className="text-center text-[18px]">
              <p dir="rtl" className="border-b-2 border-black pb-2">
                מתנה
              </p>

              {rightAmounts.map((amount) => (
                <div
                  key={amount}
                  className="flex h-[54px] items-center justify-center border-b-2 border-black"
                >
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