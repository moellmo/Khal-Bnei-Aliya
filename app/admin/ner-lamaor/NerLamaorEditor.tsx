"use client";

import { useState } from "react";

const templates = [
  "/admin-assets/ner-lamaor-template-1.jpeg",
  "/admin-assets/ner-lamaor-template-2.jpeg",
];

export default function NerLamaorEditor() {
  const [template, setTemplate] = useState(templates[0]);
  const [name, setName] = useState("Meir Lehmann");
  const [month, setMonth] = useState("לחודש סיון");

  return (
    <div className="grid gap-6 lg:grid-cols-[360px_minmax(0,1fr)]">
      <div className="rounded-[2rem] border border-[#e3d9c7] bg-white p-6 shadow-sm print:hidden">
        <h2 className="text-xl font-black">Edit Sign</h2>

        <label className="mt-5 block space-y-2">
          <span className="font-semibold">Template</span>
          <select
            value={template}
            onChange={(event) => setTemplate(event.currentTarget.value)}
            className="w-full rounded-xl border border-[#d8cdb7] bg-white px-4 py-3"
          >
            {templates.map((item, index) => (
              <option key={item} value={item}>
                Template {index + 1}
              </option>
            ))}
          </select>
        </label>

        <label className="mt-4 block space-y-2">
          <span className="font-semibold">English Name</span>
          <input
            value={name}
            onChange={(event) => setName(event.currentTarget.value)}
            className="w-full rounded-xl border border-[#d8cdb7] px-4 py-3"
          />
        </label>

        <label className="mt-4 block space-y-2">
          <span className="font-semibold">Hebrew Month Text</span>
          <input
            dir="rtl"
            value={month}
            onChange={(event) => setMonth(event.currentTarget.value)}
            className="w-full rounded-xl border border-[#d8cdb7] px-4 py-3 text-right"
          />
        </label>

        <button
          type="button"
          onClick={() => window.print()}
          className="mt-6 w-full rounded-full bg-[#1d2940] px-5 py-3 text-sm font-bold text-white"
        >
          Print Sign
        </button>
      </div>

      <div className="rounded-[2rem] border border-[#e3d9c7] bg-white p-5 shadow-sm print:border-0 print:p-0 print:shadow-none">
        <div className="relative mx-auto aspect-[1.34/1] max-w-[980px] overflow-hidden bg-white">
          <img
            src={template}
            alt="Ner Lamaor template"
            className="absolute inset-0 h-full w-full object-cover"
          />

          <div
            dir="rtl"
            className="absolute left-[39%] top-[45.8%] w-[22%] -translate-x-1/2 -translate-y-1/2 text-center text-[clamp(18px,3.1vw,42px)] font-black text-black"
          >
            {month}
          </div>

          <div className="absolute left-1/2 top-[64%] w-[52%] -translate-x-1/2 -translate-y-1/2 text-center text-[clamp(26px,5.2vw,68px)] font-black leading-tight text-black">
            {name}
          </div>
        </div>
      </div>
    </div>
  );
}
