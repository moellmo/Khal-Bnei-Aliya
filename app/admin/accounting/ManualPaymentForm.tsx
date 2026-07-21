"use client";

import { useMemo, useState } from "react";
import { recordManualPaymentAllocations } from "./actions";

type MemberOption = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
};

type OpenChargeOption = {
  id: string;
  label: string;
  balance: number;
  dueDate: string;
};

type Props = {
  month: number;
  year: number;
  openCharges: OpenChargeOption[];
  members: MemberOption[];
  today: string;
};

type AllocationRow = {
  key: string;
  type: "existing" | "new";
  chargeId: string;
  chargeQuery: string;
  memberId: string;
  memberQuery: string;
  chargeType: string;
  description: string;
  amount: string;
};

function formatMoney(amount: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(Number(amount || 0));
}

function normalize(value: string) {
  return value.toLowerCase().replace(/\s+/g, " ").trim();
}

function memberLabel(member: MemberOption) {
  const name = [member.first_name, member.last_name]
    .filter(Boolean)
    .join(" ")
    .trim();

  return `${name || member.email || "Unnamed member"}${
    member.email ? ` - ${member.email}` : ""
  }`;
}

function makeAllocationRow(): AllocationRow {
  return {
    key:
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random()}`,
    type: "existing",
    chargeId: "",
    chargeQuery: "",
    memberId: "",
    memberQuery: "",
    chargeType: "Donation",
    description: "",
    amount: "",
  };
}

function SearchPicker({
  name,
  value,
  query,
  placeholder,
  emptyText,
  helperText,
  options,
  onChange,
}: {
  name: string;
  value: string;
  query: string;
  placeholder: string;
  emptyText: string;
  helperText: string;
  options: Array<{
    id: string;
    label: string;
    detail?: string;
  }>;
  onChange: (next: { id: string; query: string }) => void;
}) {
  const [open, setOpen] = useState(false);
  const filteredOptions = useMemo(() => {
    const normalizedQuery = normalize(query);

    if (!normalizedQuery) {
      return options.slice(0, 8);
    }

    return options
      .filter((option) =>
        normalize(`${option.label} ${option.detail || ""}`).includes(
          normalizedQuery
        )
      )
      .slice(0, 10);
  }, [options, query]);

  const selectedOption = options.find((option) => option.id === value);

  return (
    <div className="relative">
      <input type="hidden" name={name} value={value} />
      <input
        value={query}
        onChange={(event) => {
          onChange({ id: "", query: event.currentTarget.value });
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        placeholder={placeholder}
        className="w-full rounded-xl border border-[#d8cdb7] bg-white px-4 py-3"
        autoComplete="off"
      />

      <p className="mt-1 text-xs font-semibold text-slate-500">
        {selectedOption?.detail || helperText}
      </p>

      {open ? (
        <div className="absolute z-30 mt-1 max-h-80 w-full overflow-y-auto rounded-2xl border border-[#d8cdb7] bg-white p-1 shadow-lg">
          {filteredOptions.length ? (
            filteredOptions.map((option) => (
              <button
                key={option.id}
                type="button"
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => {
                  onChange({ id: option.id, query: option.label });
                  setOpen(false);
                }}
                className="block w-full rounded-xl px-3 py-2 text-left text-sm font-semibold text-slate-900 hover:bg-[#fbf8f2]"
              >
                <span className="block truncate">{option.label}</span>
                {option.detail ? (
                  <span className="mt-0.5 block text-xs font-semibold text-slate-500">
                    {option.detail}
                  </span>
                ) : null}
              </button>
            ))
          ) : (
            <p className="px-3 py-2 text-sm font-semibold text-slate-500">
              {emptyText}
            </p>
          )}
        </div>
      ) : null}
    </div>
  );
}

export default function ManualPaymentForm({
  month,
  year,
  openCharges,
  members,
  today,
}: Props) {
  const [rows, setRows] = useState<AllocationRow[]>([makeAllocationRow()]);
  const allocationTotal = rows.reduce(
    (sum, row) => sum + Number(row.amount || 0),
    0
  );
  const chargeOptions = useMemo(
    () =>
      openCharges.map((charge) => ({
        id: charge.id,
        label: charge.label,
        detail: `Balance ${formatMoney(charge.balance)}${
          charge.dueDate ? ` - Due ${charge.dueDate}` : ""
        }`,
      })),
    [openCharges]
  );
  const memberOptions = useMemo(
    () =>
      members.map((member) => ({
        id: member.id,
        label: memberLabel(member),
      })),
    [members]
  );

  function updateRow(key: string, next: Partial<AllocationRow>) {
    setRows((current) =>
      current.map((row) => (row.key === key ? { ...row, ...next } : row))
    );
  }

  return (
    <form
      action={recordManualPaymentAllocations}
      className="min-w-0 rounded-[2rem] border border-[#e3d9c7] bg-white p-6 shadow-sm xl:col-span-2"
    >
      <input type="hidden" name="month" value={month} />
      <input type="hidden" name="year" value={year} />

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold">Record Check / Cash / Other</h2>
          <p className="mt-1 text-sm text-slate-500">
            Enter the payment once, then allocate it to existing invoices or
            new charges that were not billed yet.
          </p>
        </div>

        <span className="rounded-full bg-[#fbf8f2] px-4 py-2 text-sm font-bold text-slate-700">
          Allocated {formatMoney(allocationTotal)}
        </span>
      </div>

      <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <label className="min-w-0 space-y-2">
          <span className="font-semibold">Payment Method</span>
          <select
            name="payment_method"
            defaultValue="Check"
            className="w-full min-w-0 rounded-xl border border-[#d8cdb7] bg-white px-4 py-3"
          >
            <option value="Check">Check</option>
            <option value="Cash">Cash</option>
            <option value="Zelle">Zelle</option>
            <option value="Other">Other</option>
          </select>
        </label>

        <label className="min-w-0 space-y-2">
          <span className="font-semibold">Total Payment</span>
          <input
            name="total_payment"
            type="number"
            min="0.01"
            step="0.01"
            required
            className="w-full rounded-xl border border-[#d8cdb7] px-4 py-3"
          />
        </label>

        <label className="min-w-0 space-y-2">
          <span className="font-semibold">Paid Date</span>
          <input
            name="paid_date"
            type="date"
            required
            defaultValue={today}
            className="w-full rounded-xl border border-[#d8cdb7] px-4 py-3"
          />
        </label>

        <label className="min-w-0 space-y-2">
          <span className="font-semibold">Receipt Email</span>
          <input
            name="payer_email"
            type="email"
            placeholder="Optional"
            className="w-full rounded-xl border border-[#d8cdb7] px-4 py-3"
          />
        </label>
      </div>

      <div className="mt-5 rounded-2xl border border-[#e3d9c7] bg-[#fbf8f2] p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="font-bold">Payment Allocations</p>
            <p className="mt-1 text-xs font-semibold text-slate-500">
              Each row can match an open invoice or create a new paid charge.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setRows((current) => [...current, makeAllocationRow()])}
            className="rounded-full border border-[#cbbd9d] bg-white px-5 py-2.5 text-sm font-bold text-[#1d2940]"
          >
            Add Allocation
          </button>
        </div>

        <div className="mt-4 space-y-3">
          {rows.map((row, index) => (
            <div key={row.key} className="rounded-2xl bg-white p-4">
              <input type="hidden" name="allocation_type" value={row.type} />

              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="font-black">Allocation {index + 1}</p>
                <div className="flex flex-wrap items-center gap-2">
                  <div className="grid grid-cols-2 rounded-full bg-[#fbf8f2] p-1 text-xs font-bold">
                    <button
                      type="button"
                      onClick={() => updateRow(row.key, { type: "existing" })}
                      className={
                        row.type === "existing"
                          ? "rounded-full bg-[#1d2940] px-3 py-1.5 text-white"
                          : "rounded-full px-3 py-1.5 text-slate-600"
                      }
                    >
                      Existing
                    </button>
                    <button
                      type="button"
                      onClick={() => updateRow(row.key, { type: "new" })}
                      className={
                        row.type === "new"
                          ? "rounded-full bg-[#1d2940] px-3 py-1.5 text-white"
                          : "rounded-full px-3 py-1.5 text-slate-600"
                      }
                    >
                      New
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={() =>
                      setRows((current) =>
                        current.length > 1
                          ? current.filter(
                              (candidate) => candidate.key !== row.key
                            )
                          : current
                      )
                    }
                    className="rounded-full border border-[#cbbd9d] bg-white px-3 py-1.5 text-xs font-bold text-[#1d2940]"
                  >
                    Remove
                  </button>
                </div>
              </div>

              <div className="mt-3 grid gap-3 lg:grid-cols-[minmax(0,1fr)_150px]">
                {row.type === "existing" ? (
                  <div className="min-w-0">
                    <span className="text-xs font-bold uppercase tracking-[0.12em] text-slate-500">
                      Open Invoice
                    </span>
                    <SearchPicker
                      name="allocation_charge_id"
                      value={row.chargeId}
                      query={row.chargeQuery}
                      placeholder="Search member, amount, type, description..."
                      emptyText="No matching open invoices"
                      helperText="Type a name or invoice detail, then select the exact invoice."
                      options={chargeOptions}
                      onChange={(next) =>
                        updateRow(row.key, {
                          chargeId: next.id,
                          chargeQuery: next.query,
                        })
                      }
                    />
                    <input type="hidden" name="allocation_member_id" value="" />
                    <input type="hidden" name="allocation_charge_type" value="" />
                    <input type="hidden" name="allocation_description" value="" />
                  </div>
                ) : (
                  <div className="grid min-w-0 gap-3 lg:grid-cols-[minmax(0,1fr)_170px_minmax(0,1fr)]">
                    <div className="min-w-0">
                      <span className="text-xs font-bold uppercase tracking-[0.12em] text-slate-500">
                        Member
                      </span>
                      <SearchPicker
                        name="allocation_member_id"
                        value={row.memberId}
                        query={row.memberQuery}
                        placeholder="Search member name or email..."
                        emptyText="No matching members"
                        helperText="Choose who this new paid charge belongs to."
                        options={memberOptions}
                        onChange={(next) =>
                          updateRow(row.key, {
                            memberId: next.id,
                            memberQuery: next.query,
                          })
                        }
                      />
                      <input type="hidden" name="allocation_charge_id" value="" />
                    </div>

                    <label className="min-w-0 space-y-1">
                      <span className="text-xs font-bold uppercase tracking-[0.12em] text-slate-500">
                        Type
                      </span>
                      <input
                        name="allocation_charge_type"
                        value={row.chargeType}
                        onChange={(event) =>
                          updateRow(row.key, {
                            chargeType: event.currentTarget.value,
                          })
                        }
                        className="w-full rounded-xl border border-[#d8cdb7] px-3 py-3"
                      />
                    </label>

                    <label className="min-w-0 space-y-1">
                      <span className="text-xs font-bold uppercase tracking-[0.12em] text-slate-500">
                        Description
                      </span>
                      <input
                        name="allocation_description"
                        value={row.description}
                        onChange={(event) =>
                          updateRow(row.key, {
                            description: event.currentTarget.value,
                          })
                        }
                        placeholder="General donation, Kiddush..."
                        className="w-full rounded-xl border border-[#d8cdb7] px-3 py-3"
                      />
                    </label>
                  </div>
                )}

                <label className="min-w-0 space-y-1">
                  <span className="text-xs font-bold uppercase tracking-[0.12em] text-slate-500">
                    Apply
                  </span>
                  <input
                    name="allocation_amount"
                    type="number"
                    min="0"
                    step="0.01"
                    value={row.amount}
                    onChange={(event) =>
                      updateRow(row.key, {
                        amount: event.currentTarget.value,
                      })
                    }
                    placeholder="0.00"
                    className="w-full rounded-xl border border-[#d8cdb7] px-3 py-3"
                  />
                </label>
              </div>
            </div>
          ))}
        </div>
      </div>

      <label className="mt-4 block min-w-0 space-y-2">
        <span className="font-semibold">Note</span>
        <textarea
          name="payment_note"
          rows={3}
          placeholder="Check number, payer name, memo..."
          className="w-full rounded-xl border border-[#d8cdb7] px-4 py-3"
        />
      </label>

      <label className="mt-4 flex items-center gap-2 rounded-2xl bg-[#fbf8f2] p-3 text-sm font-bold text-slate-700">
        <input
          name="send_receipt"
          type="checkbox"
          defaultChecked
          className="h-4 w-4"
        />
        Send receipt email if an email is available
      </label>

      <button
        type="submit"
        className="mt-5 rounded-full bg-[#1d2940] px-6 py-3 font-bold text-white"
      >
        Record Payment
      </button>
    </form>
  );
}
