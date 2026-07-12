"use client";

import { useState } from "react";

const template = "/admin-assets/ner-lamaor-template-tamuz.png";

export default function NerLamaorEditor() {
  const [month, setMonth] = useState("לחודש תמוז");
  const [name, setName] = useState("Jacobovits Family");
  const [honorTitle, setHonorTitle] = useState("In Honor Of:");
  const [honorLine, setHonorLine] = useState(
    "The Hatzlacha of the shul and Rabbi Gutnicki"
  );

  return (
    <div className="grid gap-6 lg:grid-cols-[360px_minmax(0,1fr)]">
      <div className="rounded-[2rem] border border-[#e3d9c7] bg-white p-6 shadow-sm print:hidden">
        <h2 className="text-xl font-black">Edit Monthly Sign</h2>

        <label className="mt-5 block space-y-2">
          <span className="font-semibold">Hebrew Month</span>
          <input
            dir="rtl"
            value={month}
            onChange={(event) => setMonth(event.currentTarget.value)}
            className="w-full rounded-xl border border-[#d8cdb7] px-4 py-3 text-right text-lg"
          />
        </label>

        <label className="mt-4 block space-y-2">
          <span className="font-semibold">Name</span>
          <input
            value={name}
            onChange={(event) => setName(event.currentTarget.value)}
            className="w-full rounded-xl border border-[#d8cdb7] px-4 py-3"
          />
        </label>

        <label className="mt-4 block space-y-2">
          <span className="font-semibold">Honor Label</span>
          <input
            value={honorTitle}
            onChange={(event) => setHonorTitle(event.currentTarget.value)}
            className="w-full rounded-xl border border-[#d8cdb7] px-4 py-3"
          />
        </label>

        <label className="mt-4 block space-y-2">
          <span className="font-semibold">Honor Line</span>
          <textarea
            value={honorLine}
            onChange={(event) => setHonorLine(event.currentTarget.value)}
            rows={3}
            className="w-full rounded-xl border border-[#d8cdb7] px-4 py-3"
          />
        </label>

        <div className="mt-6 flex flex-col gap-3">
          <button
            type="button"
            onClick={() => window.print()}
            className="w-full rounded-full bg-[#1d2940] px-5 py-3 text-sm font-bold text-white"
          >
            Print / Save PDF
          </button>

          <a
            href="/admin-assets/ner-lamaor-template-tamuz.pdf"
            target="_blank"
            rel="noreferrer"
            className="text-center text-sm font-bold text-[#8b6b2e] underline"
          >
            Open original Tamuz PDF
          </a>
        </div>
      </div>

      <div className="rounded-[2rem] border border-[#e3d9c7] bg-white p-5 shadow-sm print:border-0 print:p-0 print:shadow-none">
        <div className="relative mx-auto aspect-[11/8.5] max-w-[1100px] overflow-hidden bg-white print:max-w-none">
          <img
            src={template}
            alt="Ner Lamaor PDF template"
            className="absolute inset-0 h-full w-full object-cover"
          />

          <div className="absolute left-[42.1%] top-[49.6%] h-[5.2%] w-[17%] -translate-x-1/2 -translate-y-1/2 bg-[#d7ad4a]" />
          <div
            dir="rtl"
            className="absolute left-[42.1%] top-[49.4%] w-[22%] -translate-x-1/2 -translate-y-1/2 text-center text-[clamp(16px,2.5vw,36px)] font-black leading-none text-black"
            style={{ textShadow: "0 2px 3px rgba(0,0,0,0.22)" }}
          >
            {month}
          </div>

          <div className="absolute left-1/2 top-[62.9%] h-[10.8%] w-[58%] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#c29a31]" />
          <div className="absolute left-1/2 top-[63%] w-[54%] -translate-x-1/2 -translate-y-1/2 text-center text-[clamp(24px,5vw,66px)] font-black leading-tight text-black">
            {name}
          </div>

          <div className="absolute left-1/2 top-[78.9%] h-[8.3%] w-[60%] -translate-x-1/2 -translate-y-1/2 bg-[#d8d2c6]" />
          <div className="absolute left-1/2 top-[77.7%] w-[58%] -translate-x-1/2 -translate-y-1/2 text-center text-[clamp(14px,2.2vw,30px)] font-black leading-tight text-black">
            {honorTitle}
          </div>
          <div className="absolute left-1/2 top-[82.2%] w-[62%] -translate-x-1/2 -translate-y-1/2 text-center text-[clamp(12px,2vw,26px)] font-medium leading-tight text-black">
            {honorLine}
          </div>
        </div>
      </div>
    </div>
  );
}
