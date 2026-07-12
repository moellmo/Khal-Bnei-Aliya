"use client";

import { useEffect, useMemo, useState } from "react";

type Seat = {
  id: number;
  name: string;
  section: string;
  row: string;
  seat: string;
  note: string;
};

const storageKey = "kba-seating-chart-editor";

const initialSeats: Seat[] = Array.from({ length: 36 }, (_, index) => ({
  id: index + 1,
  name: "",
  section: index < 18 ? "Left" : "Right",
  row: String(Math.floor((index % 18) / 6) + 1),
  seat: String((index % 6) + 1),
  note: "",
}));

export default function SeatingChartEditor() {
  const [seats, setSeats] = useState<Seat[]>(() => {
    if (typeof window === "undefined") {
      return initialSeats;
    }

    const saved = window.localStorage.getItem(storageKey);

    if (!saved) {
      return initialSeats;
    }

    try {
      return JSON.parse(saved) as Seat[];
    } catch {
      return initialSeats;
    }
  });
  const [filter, setFilter] = useState("");

  useEffect(() => {
    window.localStorage.setItem(storageKey, JSON.stringify(seats));
  }, [seats]);

  const visibleSeats = useMemo(() => {
    const normalizedFilter = filter.trim().toLowerCase();

    if (!normalizedFilter) {
      return seats;
    }

    return seats.filter((seat) =>
      [seat.name, seat.section, seat.row, seat.seat, seat.note]
        .join(" ")
        .toLowerCase()
        .includes(normalizedFilter)
    );
  }, [filter, seats]);

  function updateSeat(id: number, key: keyof Seat, value: string) {
    setSeats((currentSeats) =>
      currentSeats.map((seat) =>
        seat.id === id ? { ...seat, [key]: value } : seat
      )
    );
  }

  function addSeat() {
    setSeats((currentSeats) => [
      ...currentSeats,
      {
        id: Math.max(...currentSeats.map((seat) => seat.id), 0) + 1,
        name: "",
        section: "Additional",
        row: "",
        seat: "",
        note: "",
      },
    ]);
  }

  return (
    <div className="space-y-6">
      <div className="rounded-[2rem] border border-[#e3d9c7] bg-white p-6 shadow-sm print:hidden">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <label className="min-w-[260px] flex-1 space-y-2">
            <span className="font-semibold">Search Seats</span>
            <input
              value={filter}
              onChange={(event) => setFilter(event.currentTarget.value)}
              className="w-full rounded-xl border border-[#d8cdb7] px-4 py-3"
              placeholder="Name, section, row, note..."
            />
          </label>

          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={addSeat}
              className="rounded-full border border-[#cbbd9d] bg-white px-5 py-3 text-sm font-bold"
            >
              Add Seat
            </button>

            <button
              type="button"
              onClick={() => window.print()}
              className="rounded-full bg-[#1d2940] px-5 py-3 text-sm font-bold text-white"
            >
              Print Chart
            </button>
          </div>
        </div>

        <p className="mt-4 text-sm leading-6 text-slate-500">
          Changes save in this browser while you edit. Use the attached PDF
          below as the source copy and this editable grid for updates.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_420px]">
        <div className="rounded-[2rem] border border-[#e3d9c7] bg-white p-5 shadow-sm">
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {visibleSeats.map((seat) => (
              <div
                key={seat.id}
                className="break-inside-avoid rounded-xl border border-[#e3d9c7] bg-[#fbf8f2] p-4"
              >
                <div className="grid grid-cols-3 gap-2">
                  <input
                    value={seat.section}
                    onChange={(event) =>
                      updateSeat(seat.id, "section", event.currentTarget.value)
                    }
                    className="rounded-lg border border-[#d8cdb7] px-2 py-2 text-sm"
                    aria-label="Section"
                  />
                  <input
                    value={seat.row}
                    onChange={(event) =>
                      updateSeat(seat.id, "row", event.currentTarget.value)
                    }
                    className="rounded-lg border border-[#d8cdb7] px-2 py-2 text-sm"
                    aria-label="Row"
                  />
                  <input
                    value={seat.seat}
                    onChange={(event) =>
                      updateSeat(seat.id, "seat", event.currentTarget.value)
                    }
                    className="rounded-lg border border-[#d8cdb7] px-2 py-2 text-sm"
                    aria-label="Seat"
                  />
                </div>

                <input
                  value={seat.name}
                  onChange={(event) =>
                    updateSeat(seat.id, "name", event.currentTarget.value)
                  }
                  className="mt-3 w-full rounded-lg border border-[#d8cdb7] px-3 py-2 font-bold"
                  placeholder="Name"
                  aria-label="Name"
                />

                <input
                  value={seat.note}
                  onChange={(event) =>
                    updateSeat(seat.id, "note", event.currentTarget.value)
                  }
                  className="mt-2 w-full rounded-lg border border-[#d8cdb7] px-3 py-2 text-sm"
                  placeholder="Note"
                  aria-label="Note"
                />
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-[2rem] border border-[#e3d9c7] bg-white p-5 shadow-sm print:hidden">
          <h2 className="text-xl font-black">Attached Seating PDF</h2>
          <iframe
            src="/admin-assets/kba-seating-chart-shabbos-morning-2026-06-01.pdf#toolbar=1&navpanes=0"
            className="mt-4 h-[620px] w-full rounded-xl border border-[#e3d9c7]"
            title="KBA Seating Chart Source PDF"
          />
        </div>
      </div>
    </div>
  );
}
