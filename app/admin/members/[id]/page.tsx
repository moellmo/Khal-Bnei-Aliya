import Link from "next/link";
import { notFound } from "next/navigation";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import {
  addCharge,
  addFamilyMember,
  deleteCharge,
  deleteFamilyMember,
  markChargePaid,
  toggleFamilyMemberOnCard,
  updateMember,
} from "./actions";

export const dynamic = "force-dynamic";

type Member = {
  id: string;
  first_name: string;
  last_name: string;
  hebrew_name: string | null;
  tribe_status: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  membership_type: string | null;
  custom_dues_amount: number | null;
  status: string | null;
  seating_location: string | null;
  notes: string | null;
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

type Charge = {
  id: string;
  charge_type: string;
  description: string | null;
  amount: number;
  status: string | null;
  due_date: string | null;
  payment_method: string | null;
  paid_at: string | null;
};

type PageProps = {
  params: Promise<{
    id: string;
  }>;
  searchParams?: Promise<{
    memberUpdated?: string;
    familyAdded?: string;
    familyDeleted?: string;
    familyUpdated?: string;
    chargeAdded?: string;
    chargePaid?: string;
    chargeDeleted?: string;
  }>;
};

async function getMember(id: string) {
  const { data, error } = await supabaseAdmin
    .from("members")
    .select(
      "id, first_name, last_name, hebrew_name, tribe_status, email, phone, address, membership_type, custom_dues_amount, status, seating_location, notes"
    )
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
    .order("created_at", { ascending: true });

  if (error) {
    console.error("Error loading family members:", error.message);
    return [];
  }

  return (data || []) as FamilyMember[];
}

async function getCharges(memberId: string) {
  const { data, error } = await supabaseAdmin
    .from("member_charges")
    .select(
      "id, charge_type, description, amount, status, due_date, payment_method, paid_at"
    )
    .eq("member_id", memberId)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Error loading charges:", error.message);
    return [];
  }

  return (data || []) as Charge[];
}

function formatMoney(amount: number | null | undefined) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(Number(amount || 0));
}

function displayTribe(value: string | null | undefined) {
  return value || "Yisroel";
}

function groupFamilyMembers(familyMembers: FamilyMember[], relationship: string) {
  return familyMembers.filter(
    (person) =>
      person.include_on_mishaberach_card &&
      (person.relationship || "").toLowerCase() === relationship.toLowerCase()
  );
}

function formatDate(value: string | null | undefined) {
  if (!value) return "—";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export default async function MemberDetailPage({
  params,
  searchParams,
}: PageProps) {
  const { id } = await params;
  const query = await searchParams;

  const member = await getMember(id);

  if (!member) {
    notFound();
  }

  const familyMembers = await getFamilyMembers(id);
  const charges = await getCharges(id);

  const unpaidTotal = charges
    .filter((charge) => charge.status !== "paid")
    .reduce((sum, charge) => sum + Number(charge.amount || 0), 0);

  const paidTotal = charges
    .filter((charge) => charge.status === "paid")
    .reduce((sum, charge) => sum + Number(charge.amount || 0), 0);

  const spouseNames = groupFamilyMembers(familyMembers, "Spouse");
  const childNames = groupFamilyMembers(familyMembers, "Child");
  const otherNames = groupFamilyMembers(familyMembers, "Other");
  const guestOfNames = groupFamilyMembers(familyMembers, "Guest Of");

  const addFamilyMemberAction = addFamilyMember.bind(null, id);
  const addChargeAction = addCharge.bind(null, id);

  return (
    <main className="min-h-screen bg-[#f7f3ea] text-slate-900">
      <section className="mx-auto max-w-7xl px-6 py-8">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <Link
            href="/admin/members"
            className="text-sm font-semibold text-[#8b6b2e]"
          >
            ← Back to Members
          </Link>

          <Link href="/admin" className="text-sm font-semibold text-[#8b6b2e]">
            Admin Home
          </Link>
        </div>

        <div className="mt-8 rounded-[2rem] bg-[#1d2940] p-8 text-white shadow-sm">
          <p className="text-sm font-bold uppercase tracking-[0.25em] text-[#d9bf7a]">
            Member File
          </p>

          <h1 className="mt-3 text-4xl font-bold">
            {member.first_name} {member.last_name}
          </h1>

          {member.hebrew_name && (
            <p dir="rtl" className="mt-3 text-right text-2xl font-bold">
              {member.hebrew_name}
            </p>
          )}

          <div
            className="mt-5 grid gap-3 text-sm text-slate-200"
            style={{ gridTemplateColumns: "repeat(5, minmax(0, 1fr))" }}
          >
            <div>
              <p className="text-slate-400">Kohen / Levi / Yisroel</p>
              <p className="font-bold">{displayTribe(member.tribe_status)}</p>
            </div>

            <div>
              <p className="text-slate-400">Email</p>
              <p className="font-bold">{member.email || "—"}</p>
            </div>

            <div>
              <p className="text-slate-400">Phone</p>
              <p className="font-bold">{member.phone || "—"}</p>
            </div>

            <div>
              <p className="text-slate-400">Balance Owed</p>
              <p className="font-bold text-[#f0d99a]">
                {formatMoney(unpaidTotal)}
              </p>
            </div>

            <div>
              <p className="text-slate-400">Paid Total</p>
              <p className="font-bold text-green-300">
                {formatMoney(paidTotal)}
              </p>
            </div>
          </div>
        </div>

        {query?.memberUpdated === "1" && (
          <div className="mt-6 rounded-2xl border border-green-200 bg-green-50 p-4 font-semibold text-green-800">
            Member details were updated successfully.
          </div>
        )}

        {query?.familyAdded === "1" && (
          <div className="mt-6 rounded-2xl border border-green-200 bg-green-50 p-4 font-semibold text-green-800">
            Mishaberach/card name was added successfully.
          </div>
        )}

        {query?.familyUpdated === "1" && (
          <div className="mt-6 rounded-2xl border border-green-200 bg-green-50 p-4 font-semibold text-green-800">
            Mishaberach/card name was updated.
          </div>
        )}

        {query?.familyDeleted === "1" && (
          <div className="mt-6 rounded-2xl border border-red-200 bg-red-50 p-4 font-semibold text-red-800">
            Mishaberach/card name was deleted.
          </div>
        )}

        {query?.chargeAdded === "1" && (
          <div className="mt-6 rounded-2xl border border-green-200 bg-green-50 p-4 font-semibold text-green-800">
            Charge was added successfully.
          </div>
        )}

        {query?.chargePaid === "1" && (
          <div className="mt-6 rounded-2xl border border-green-200 bg-green-50 p-4 font-semibold text-green-800">
            Charge was marked as paid.
          </div>
        )}

        {query?.chargeDeleted === "1" && (
          <div className="mt-6 rounded-2xl border border-red-200 bg-red-50 p-4 font-semibold text-red-800">
            Charge was deleted.
          </div>
        )}

        <div
          className="mt-8 grid gap-8"
          style={{
            gridTemplateColumns: "minmax(0, 0.9fr) minmax(0, 1.1fr)",
          }}
        >
          <div className="space-y-8">
            <div className="rounded-[2rem] border border-[#e3d9c7] bg-white p-6 shadow-sm">
              <h2 className="text-2xl font-bold">Member Details</h2>

              <div className="mt-5 space-y-4 text-sm">
                <div>
                  <p className="font-semibold text-slate-500">Family Name</p>
                  <p className="font-bold">{member.last_name}</p>
                </div>

                <div>
                  <p className="font-semibold text-slate-500">
                    Main Hebrew Name
                  </p>
                  <p dir="rtl" className="text-right text-lg">
                    {member.hebrew_name || "—"}
                  </p>
                </div>

                <div>
                  <p className="font-semibold text-slate-500">
                    Kohen / Levi / Yisroel
                  </p>
                  <p>{displayTribe(member.tribe_status)}</p>
                </div>

                <div>
                  <p className="font-semibold text-slate-500">Address</p>
                  <p>{member.address || "—"}</p>
                </div>

                <div>
                  <p className="font-semibold text-slate-500">
                    Membership Type
                  </p>
                  <p>{member.membership_type || "—"}</p>
                </div>

                <div>
                  <p className="font-semibold text-slate-500">
                    Custom Dues Amount
                  </p>
                  <p>{formatMoney(member.custom_dues_amount)}</p>
                </div>

                <div>
                  <p className="font-semibold text-slate-500">
                    Seat / Location
                  </p>
                  <p>{member.seating_location || "—"}</p>
                </div>

                <div>
                  <p className="font-semibold text-slate-500">Notes</p>
                  <p>{member.notes || "—"}</p>
                </div>
              </div>

              <form
                action={updateMember.bind(null, id)}
                className="mt-8 space-y-5 border-t border-[#e3d9c7] pt-6"
              >
                <h3 className="text-xl font-bold">Edit Member Details</h3>

                <div
                  className="grid gap-4"
                  style={{ gridTemplateColumns: "1fr 1fr" }}
                >
                  <label className="space-y-2">
                    <span className="font-semibold">First Name</span>
                    <input
                      name="first_name"
                      required
                      defaultValue={member.first_name}
                      className="w-full rounded-xl border border-[#d8cdb7] px-4 py-3"
                    />
                  </label>

                  <label className="space-y-2">
                    <span className="font-semibold">Last / Family Name</span>
                    <input
                      name="last_name"
                      required
                      defaultValue={member.last_name}
                      className="w-full rounded-xl border border-[#d8cdb7] px-4 py-3"
                    />
                  </label>
                </div>

                <label className="block space-y-2">
                  <span className="font-semibold">Hebrew Name</span>
                  <input
                    name="hebrew_name"
                    dir="rtl"
                    defaultValue={member.hebrew_name || ""}
                    className="w-full rounded-xl border border-[#d8cdb7] px-4 py-3 text-right text-lg"
                  />
                </label>

                <div
                  className="grid gap-4"
                  style={{ gridTemplateColumns: "1fr 1fr" }}
                >
                  <label className="space-y-2">
                    <span className="font-semibold">
                      Kohen / Levi / Yisroel
                    </span>
                    <select
                      name="tribe_status"
                      defaultValue={member.tribe_status || "Yisroel"}
                      className="w-full rounded-xl border border-[#d8cdb7] bg-white px-4 py-3"
                    >
                      <option value="Yisroel">Yisroel</option>
                      <option value="Kohen">Kohen</option>
                      <option value="Levi">Levi</option>
                    </select>
                  </label>

                  <label className="space-y-2">
                    <span className="font-semibold">Status</span>
                    <select
                      name="status"
                      defaultValue={member.status || "active"}
                      className="w-full rounded-xl border border-[#d8cdb7] bg-white px-4 py-3"
                    >
                      <option value="active">Active</option>
                      <option value="pending">Pending</option>
                      <option value="inactive">Inactive</option>
                    </select>
                  </label>
                </div>

                <div
                  className="grid gap-4"
                  style={{ gridTemplateColumns: "1fr 1fr" }}
                >
                  <label className="space-y-2">
                    <span className="font-semibold">Email</span>
                    <input
                      name="email"
                      type="email"
                      defaultValue={member.email || ""}
                      className="w-full rounded-xl border border-[#d8cdb7] px-4 py-3"
                    />
                  </label>

                  <label className="space-y-2">
                    <span className="font-semibold">Phone</span>
                    <input
                      name="phone"
                      defaultValue={member.phone || ""}
                      className="w-full rounded-xl border border-[#d8cdb7] px-4 py-3"
                    />
                  </label>
                </div>

                <label className="block space-y-2">
                  <span className="font-semibold">Address</span>
                  <input
                    name="address"
                    defaultValue={member.address || ""}
                    className="w-full rounded-xl border border-[#d8cdb7] px-4 py-3"
                  />
                </label>

                <div
                  className="grid gap-4"
                  style={{ gridTemplateColumns: "1fr 1fr" }}
                >
                  <label className="space-y-2">
                    <span className="font-semibold">Membership Type</span>
                    <select
                      name="membership_type"
                      defaultValue={member.membership_type || "Family"}
                      className="w-full rounded-xl border border-[#d8cdb7] bg-white px-4 py-3"
                    >
                      <option value="Family">Family</option>
                      <option value="Single">Single</option>
                      <option value="Associate">Associate</option>
                      <option value="Custom">Custom</option>
                    </select>
                  </label>

                  <label className="space-y-2">
                    <span className="font-semibold">Custom Dues Amount</span>
                    <input
                      name="custom_dues_amount"
                      type="number"
                      step="0.01"
                      min="0"
                      defaultValue={member.custom_dues_amount || 0}
                      className="w-full rounded-xl border border-[#d8cdb7] px-4 py-3"
                    />
                  </label>
                </div>

                <label className="block space-y-2">
                  <span className="font-semibold">Seat / Location</span>
                  <input
                    name="seating_location"
                    defaultValue={member.seating_location || ""}
                    className="w-full rounded-xl border border-[#d8cdb7] px-4 py-3"
                  />
                </label>

                <label className="block space-y-2">
                  <span className="font-semibold">Notes</span>
                  <textarea
                    name="notes"
                    defaultValue={member.notes || ""}
                    className="min-h-24 w-full rounded-xl border border-[#d8cdb7] px-4 py-3"
                  />
                </label>

                <button
                  type="submit"
                  className="rounded-full bg-[#1d2940] px-6 py-3 font-semibold text-white"
                >
                  Save Member Changes
                </button>
              </form>
            </div>

            <form
              action={addFamilyMemberAction}
              className="space-y-5 rounded-[2rem] border border-[#e3d9c7] bg-white p-6 shadow-sm"
            >
              <div>
                <h2 className="text-2xl font-bold">Add Mishaberach Name</h2>
                <p className="mt-1 text-sm text-slate-500">
                  Add spouse, children, other names, or guest-of names for the
                  printable Mishaberach card.
                </p>
              </div>

              <div
                className="grid gap-4"
                style={{ gridTemplateColumns: "1fr 1fr" }}
              >
                <label className="space-y-2">
                  <span className="font-semibold">English First Name</span>
                  <input
                    name="first_name"
                    required
                    className="w-full rounded-xl border border-[#d8cdb7] px-4 py-3"
                    placeholder="Faigy"
                  />
                </label>

                <label className="space-y-2">
                  <span className="font-semibold">Family / Last Name</span>
                  <input
                    name="last_name"
                    className="w-full rounded-xl border border-[#d8cdb7] px-4 py-3"
                    placeholder={member.last_name}
                    defaultValue={member.last_name}
                  />
                </label>
              </div>

              <label className="block space-y-2">
                <span className="font-semibold">Hebrew Name</span>
                <input
                  name="hebrew_name"
                  dir="rtl"
                  className="w-full rounded-xl border border-[#d8cdb7] px-4 py-3 text-right text-lg"
                  placeholder="נעכא דבורה בת דוב רפאל"
                />
              </label>

              <div
                className="grid gap-4"
                style={{ gridTemplateColumns: "1fr 1fr" }}
              >
                <label className="block space-y-2">
                  <span className="font-semibold">Relationship / Section</span>
                  <select
                    name="relationship"
                    className="w-full rounded-xl border border-[#d8cdb7] bg-white px-4 py-3"
                    defaultValue="Spouse"
                  >
                    <option value="Spouse">Spouse</option>
                    <option value="Child">Child</option>
                    <option value="Other">Other</option>
                    <option value="Guest Of">Guest Of</option>
                  </select>
                </label>

                <label className="block space-y-2">
                  <span className="font-semibold">Kohen / Levi / Yisroel</span>
                  <select
                    name="tribe_status"
                    className="w-full rounded-xl border border-[#d8cdb7] bg-white px-4 py-3"
                    defaultValue="Yisroel"
                  >
                    <option value="Yisroel">Yisroel</option>
                    <option value="Kohen">Kohen</option>
                    <option value="Levi">Levi</option>
                  </select>
                </label>
              </div>

              <label className="flex items-center gap-3 rounded-xl bg-[#f8f4eb] p-4 font-semibold">
                <input
                  name="include_on_mishaberach_card"
                  type="checkbox"
                  defaultChecked
                  className="h-5 w-5"
                />
                Include on Mishaberach card
              </label>

              <button
                type="submit"
                className="rounded-full bg-[#8b6b2e] px-6 py-3 font-semibold text-white"
              >
                Add Name
              </button>
            </form>

            <form
              action={addChargeAction}
              className="space-y-5 rounded-[2rem] border border-[#e3d9c7] bg-white p-6 shadow-sm"
            >
              <div>
                <h2 className="text-2xl font-bold">Add Charge / Pledge</h2>
                <p className="mt-1 text-sm text-slate-500">
                  Dues, Mishaberach pledge, aliyah pledge, donation, or custom
                  charge.
                </p>
              </div>

              <label className="block space-y-2">
                <span className="font-semibold">Charge Type</span>
                <select
                  name="charge_type"
                  className="w-full rounded-xl border border-[#d8cdb7] bg-white px-4 py-3"
                  defaultValue="Mishaberach"
                >
                  <option value="Membership Dues">Membership Dues</option>
                  <option value="Mishaberach">Mishaberach</option>
                  <option value="Aliyah">Aliyah</option>
                  <option value="Donation">Donation</option>
                  <option value="Other">Other</option>
                </select>
              </label>

              <label className="block space-y-2">
                <span className="font-semibold">Description</span>
                <input
                  name="description"
                  className="w-full rounded-xl border border-[#d8cdb7] px-4 py-3"
                  placeholder="Mishaberach pledge, annual dues, donation..."
                />
              </label>

              <div
                className="grid gap-4"
                style={{ gridTemplateColumns: "1fr 1fr" }}
              >
                <label className="space-y-2">
                  <span className="font-semibold">Amount</span>
                  <input
                    name="amount"
                    type="number"
                    step="0.01"
                    min="0"
                    required
                    className="w-full rounded-xl border border-[#d8cdb7] px-4 py-3"
                    placeholder="360"
                  />
                </label>

                <label className="space-y-2">
                  <span className="font-semibold">Due Date</span>
                  <input
                    name="due_date"
                    type="date"
                    className="w-full rounded-xl border border-[#d8cdb7] px-4 py-3"
                  />
                </label>
              </div>

              <button
                type="submit"
                className="rounded-full bg-[#1d2940] px-6 py-3 font-semibold text-white"
              >
                Add Charge
              </button>
            </form>
          </div>

          <div className="space-y-8">
            <div className="rounded-[2rem] border border-[#e3d9c7] bg-white p-6 shadow-sm">
              <h2 className="text-2xl font-bold">Saved Mishaberach Names</h2>

              <div className="mt-6 space-y-3">
                {familyMembers.map((person) => (
                  <div
                    key={person.id}
                    className="rounded-2xl bg-[#fbf8f2] p-4"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#8b6b2e]">
                          {person.relationship || "Other"} ·{" "}
                          {displayTribe(person.tribe_status)}
                        </p>

                        <p className="mt-1 font-bold">
                          {person.first_name} {person.last_name || ""}
                        </p>

                        {person.hebrew_name && (
                          <p dir="rtl" className="mt-1 text-right text-lg">
                            {person.hebrew_name}
                          </p>
                        )}
                      </div>

                      <div className="flex flex-col items-end gap-2">
                        <span className="rounded-full bg-white px-3 py-1 text-xs font-bold">
                          {person.include_on_mishaberach_card
                            ? "On card"
                            : "Hidden"}
                        </span>

                        <div className="flex flex-wrap justify-end gap-2">
                          {person.include_on_mishaberach_card ? (
                            <form
                              action={toggleFamilyMemberOnCard.bind(
                                null,
                                id,
                                person.id,
                                false
                              )}
                            >
                              <button
                                type="submit"
                                className="rounded-full bg-slate-700 px-3 py-1.5 text-xs font-bold text-white"
                              >
                                Hide
                              </button>
                            </form>
                          ) : (
                            <form
                              action={toggleFamilyMemberOnCard.bind(
                                null,
                                id,
                                person.id,
                                true
                              )}
                            >
                              <button
                                type="submit"
                                className="rounded-full bg-green-700 px-3 py-1.5 text-xs font-bold text-white"
                              >
                                Show
                              </button>
                            </form>
                          )}

                          <form
                            action={deleteFamilyMember.bind(
                              null,
                              id,
                              person.id
                            )}
                          >
                            <button
                              type="submit"
                              className="rounded-full bg-red-700 px-3 py-1.5 text-xs font-bold text-white"
                            >
                              Delete
                            </button>
                          </form>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}

                {familyMembers.length === 0 && (
                  <div className="rounded-2xl bg-[#fbf8f2] p-8 text-center text-slate-500">
                    No Mishaberach names added yet.
                  </div>
                )}
              </div>
            </div>

            <div className="rounded-[2rem] border border-[#e3d9c7] bg-white p-6 shadow-sm">
              <div className="flex flex-wrap items-end justify-between gap-4">
                <div>
                  <h2 className="text-2xl font-bold">Charges / Pledges</h2>
                  <p className="mt-1 text-sm text-slate-500">
                    Unpaid total:{" "}
                    <span className="font-bold text-slate-900">
                      {formatMoney(unpaidTotal)}
                    </span>
                  </p>
                  <p className="mt-1 text-sm text-slate-500">
                    Paid total:{" "}
                    <span className="font-bold text-green-700">
                      {formatMoney(paidTotal)}
                    </span>
                  </p>
                </div>
              </div>

              <div className="mt-6 space-y-3">
                {charges.map((charge) => (
                  <div
                    key={charge.id}
                    className="rounded-2xl bg-[#fbf8f2] p-4"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <p className="font-bold">{charge.charge_type}</p>
                        <p className="text-sm text-slate-500">
                          {charge.description || "—"}
                        </p>
                        <p className="mt-1 text-xs text-slate-500">
                          Due: {formatDate(charge.due_date)}
                        </p>
                        {charge.paid_at && (
                          <p className="mt-1 text-xs text-green-700">
                            Paid: {formatDate(charge.paid_at)} ·{" "}
                            {charge.payment_method || "manual"}
                          </p>
                        )}
                      </div>

                      <div className="text-right">
                        <p className="font-black">
                          {formatMoney(charge.amount)}
                        </p>

                        <p
                          className={
                            charge.status === "paid"
                              ? "text-xs font-bold capitalize text-green-700"
                              : "text-xs font-bold capitalize text-red-700"
                          }
                        >
                          {charge.status || "unpaid"}
                        </p>

                        <div className="mt-3 flex flex-wrap justify-end gap-2">
                          {charge.status !== "paid" && (
                            <form
                              action={markChargePaid.bind(
                                null,
                                id,
                                charge.id
                              )}
                            >
                              <button
                                type="submit"
                                className="rounded-full bg-green-700 px-3 py-1.5 text-xs font-bold text-white"
                              >
                                Mark Paid
                              </button>
                            </form>
                          )}

                          <form
                            action={deleteCharge.bind(null, id, charge.id)}
                          >
                            <button
                              type="submit"
                              className="rounded-full bg-red-700 px-3 py-1.5 text-xs font-bold text-white"
                            >
                              Delete
                            </button>
                          </form>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}

                {charges.length === 0 && (
                  <div className="rounded-2xl bg-[#fbf8f2] p-8 text-center text-slate-500">
                    No charges or pledges added yet.
                  </div>
                )}
              </div>
            </div>

            <div className="rounded-[2rem] border border-[#e3d9c7] bg-white p-6 shadow-sm">
              <h2 className="text-2xl font-bold">Mishaberach Card Preview</h2>
              <p className="mt-1 text-sm text-slate-500">
                Preview based on your Canva sample.
              </p>

              <div className="mt-6 overflow-x-auto">
                <div className="mx-auto w-[640px] bg-white p-6 shadow-sm">
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "90px 1fr 90px",
                      columnGap: "22px",
                      alignItems: "stretch",
                    }}
                  >
                    <div className="text-center text-sm">
                      <p className="border-b-2 border-black pb-2">Other</p>
                      {[360, 300, 250, 225, 200, 180, 150].map((amount) => (
                        <div
                          key={amount}
                          className="flex h-[38px] items-center justify-center border-b-2 border-black"
                        >
                          {amount}
                        </div>
                      ))}
                    </div>

                    <div className="min-h-[280px] text-center">
                      <div className="mx-auto flex h-[48px] w-[48px] items-center justify-center rounded-full bg-black text-[8px] font-black leading-tight text-white">
                        KBA
                      </div>

                      <h3 className="mt-4 text-2xl font-black">
                        {member.first_name} {member.last_name}
                      </h3>

                      {member.hebrew_name && (
                        <p dir="rtl" className="mt-1 text-lg">
                          {member.hebrew_name}
                        </p>
                      )}

                      {spouseNames.length > 0 && (
                        <div className="mt-3">
                          <h4 className="text-xl font-black">Spouse</h4>
                          {spouseNames.map((person) => (
                            <p key={person.id} dir="rtl" className="text-base">
                              {person.hebrew_name ||
                                `${person.first_name} ${person.last_name || ""}`}
                            </p>
                          ))}
                        </div>
                      )}

                      {childNames.length > 0 && (
                        <div className="mt-3">
                          <h4 className="text-xl font-black">Children</h4>
                          {childNames.map((person) => (
                            <p key={person.id} dir="rtl" className="text-base">
                              {person.hebrew_name ||
                                `${person.first_name} ${person.last_name || ""}`}
                            </p>
                          ))}
                        </div>
                      )}

                      {otherNames.length > 0 && (
                        <div className="mt-6">
                          <h4 className="text-xl font-black">Others</h4>
                          {otherNames.map((person) => (
                            <p key={person.id} dir="rtl" className="text-base">
                              {person.hebrew_name ||
                                `${person.first_name} ${person.last_name || ""}`}
                            </p>
                          ))}
                        </div>
                      )}

                      {guestOfNames.length > 0 && (
                        <div className="mt-6">
                          <h4 className="text-xl font-black">Guest Of</h4>
                          {guestOfNames.map((person) => (
                            <p key={person.id} dir="rtl" className="text-base">
                              {person.hebrew_name ||
                                `${person.first_name} ${person.last_name || ""}`}
                            </p>
                          ))}
                        </div>
                      )}
                    </div>

                    <div className="text-center text-sm">
                      <p dir="rtl" className="border-b-2 border-black pb-2">
                        מתנה
                      </p>
                      {[18, 36, 50, 72, 90, 100, 125].map((amount) => (
                        <div
                          key={amount}
                          className="flex h-[38px] items-center justify-center border-b-2 border-black"
                        >
                          {amount}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-5">
                <Link
                  href={`/admin/members/${member.id}/mishaberach-card`}
                  className="inline-flex rounded-full bg-[#1d2940] px-5 py-3 text-sm font-bold text-white"
                >
                  Open Printable Card
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}