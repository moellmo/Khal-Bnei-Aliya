"use client";

import { useMemo, useState } from "react";

type MemberOption = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
};

type Props = {
  members: MemberOption[];
};

function memberLabel(member: MemberOption) {
  const name = [member.first_name, member.last_name]
    .filter(Boolean)
    .join(" ")
    .trim();

  return `${name || member.email || "Unnamed member"}${
    member.email ? ` - ${member.email}` : ""
  }`;
}

function normalize(value: string) {
  return value.toLowerCase().replace(/\s+/g, " ").trim();
}

export function QuickChargeMemberPicker({ members }: Props) {
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState("");
  const [isOpen, setIsOpen] = useState(false);

  const filteredMembers = useMemo(() => {
    const normalizedQuery = normalize(query);
    const matches = normalizedQuery
      ? members.filter((member) => {
          const label = normalize(memberLabel(member));
          return label.includes(normalizedQuery);
        })
      : members;

    return matches.slice(0, 12);
  }, [members, query]);

  return (
    <div className="relative space-y-2 text-sm font-bold text-slate-700">
      <span>Select Member</span>
      <input type="hidden" name="member_id" value={selectedId} />
      <input type="hidden" name="member_search" value={query} />
      <input
        value={query}
        onChange={(event) => {
          setQuery(event.target.value);
          setSelectedId("");
          setIsOpen(true);
        }}
        onFocus={() => setIsOpen(true)}
        className="w-full rounded-xl border border-[#d8cdb7] bg-white px-3 py-3 text-sm text-slate-900"
        placeholder="Type a member name or email"
        autoComplete="off"
      />

      {isOpen ? (
        <div className="absolute z-20 mt-1 max-h-72 w-full overflow-y-auto rounded-2xl border border-[#d8cdb7] bg-white p-1 shadow-lg">
          {filteredMembers.length ? (
            filteredMembers.map((member) => (
              <button
                key={member.id}
                type="button"
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => {
                  setSelectedId(member.id);
                  setQuery(memberLabel(member));
                  setIsOpen(false);
                }}
                className="block w-full rounded-xl px-3 py-2 text-left text-sm font-semibold text-slate-900 hover:bg-[#fbf8f2]"
              >
                {memberLabel(member)}
              </button>
            ))
          ) : (
            <p className="px-3 py-2 text-sm font-semibold text-slate-500">
              No matching members
            </p>
          )}
        </div>
      ) : null}

      <p className="text-xs font-semibold text-slate-500">
        Start typing, then tap the member to attach the charge.
      </p>
    </div>
  );
}
