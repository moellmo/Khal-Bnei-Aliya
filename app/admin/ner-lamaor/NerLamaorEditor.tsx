"use client";

import { useEffect, useState } from "react";
import type { ChangeEvent, Dispatch, SetStateAction } from "react";

const defaultTemplateUrl = "/admin-assets/ner-lamaor-blank-template.png";

export default function NerLamaorEditor() {
  const [templateUrl, setTemplateUrl] = useState(defaultTemplateUrl);
  const [month, setMonth] = useState("לחודש תמוז");
  const [name, setName] = useState("");
  const [honorTitle, setHonorTitle] = useState("In Honor Of:");
  const [honorLine, setHonorLine] = useState("");
  const [monthSize, setMonthSize] = useState(30);
  const [nameSize, setNameSize] = useState(56);
  const [honorTitleSize, setHonorTitleSize] = useState(24);
  const [honorLineSize, setHonorLineSize] = useState(22);
  const sizeControls: Array<[
    string,
    number,
    Dispatch<SetStateAction<number>>,
    number,
    number,
  ]> = [
    ["Month Size", monthSize, setMonthSize, 18, 44],
    ["Name Size", nameSize, setNameSize, 24, 76],
    ["Honor Label Size", honorTitleSize, setHonorTitleSize, 14, 34],
    ["Honor Line Size", honorLineSize, setHonorLineSize, 12, 32],
  ];

  useEffect(() => {
    return () => {
      if (templateUrl.startsWith("blob:")) {
        URL.revokeObjectURL(templateUrl);
      }
    };
  }, [templateUrl]);

  function handleTemplateUpload(
    event: ChangeEvent<HTMLInputElement>
  ) {
    const file = event.currentTarget.files?.[0];

    if (!file) {
      return;
    }

    if (templateUrl.startsWith("blob:")) {
      URL.revokeObjectURL(templateUrl);
    }

    setTemplateUrl(URL.createObjectURL(file));
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[360px_minmax(0,1fr)]">
      <div className="rounded-[2rem] border border-[#e3d9c7] bg-white p-6 shadow-sm print:hidden">
        <h2 className="text-xl font-black">Edit Monthly Sign</h2>

        <label className="mt-5 block space-y-2">
          <span className="font-semibold">Blank Sign Image</span>
          <input
            type="file"
            accept="image/png,image/jpeg,image/webp"
            onChange={handleTemplateUpload}
            className="w-full rounded-xl border border-[#d8cdb7] bg-white px-4 py-3"
          />
        </label>

        <p className="mt-2 text-xs leading-5 text-slate-500">
          The blank Tamuz artwork is loaded by default. Upload a PNG or JPG
          here only when you want to override it for one print.
        </p>

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
            placeholder="Sponsor name"
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
            placeholder="Dedication line"
            className="w-full rounded-xl border border-[#d8cdb7] px-4 py-3"
          />
        </label>

        <div className="mt-5 grid gap-4">
          {sizeControls.map(([label, value, setter, min, max]) => (
            <label key={String(label)} className="space-y-2">
              <span className="text-sm font-semibold">
                {label}: {String(value)}px
              </span>
              <input
                type="range"
                min={Number(min)}
                max={Number(max)}
                value={Number(value)}
                onChange={(event) =>
                  setter(Number(event.currentTarget.value))
                }
                className="w-full"
              />
            </label>
          ))}
        </div>

        <button
          type="button"
          onClick={() => window.print()}
          disabled={!templateUrl}
          className="mt-6 w-full rounded-full bg-[#1d2940] px-5 py-3 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-45"
        >
          Print / Save PDF
        </button>
      </div>

      <div className="rounded-[2rem] border border-[#e3d9c7] bg-white p-5 shadow-sm print:border-0 print:p-0 print:shadow-none">
        <div className="relative mx-auto aspect-[11/8.5] max-w-[1100px] overflow-hidden bg-white print:max-w-none">
          {templateUrl ? (
            <img
              src={templateUrl}
              alt="Blank Ner Lamaor template"
              className="absolute inset-0 h-full w-full object-cover"
            />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center bg-[#fbf8f2] p-8 text-center text-slate-500">
              <div>
                <p className="text-xl font-black text-slate-900">
                  Blank template unavailable
                </p>
                <p className="mt-2 max-w-md text-sm leading-6">
                  Refresh the page or upload a replacement image.
                </p>
              </div>
            </div>
          )}

          {templateUrl ? (
            <>
              <div
                dir="rtl"
                className="absolute left-[50%] top-[48.6%] w-[26%] -translate-x-1/2 -translate-y-1/2 text-center font-black leading-none text-black"
                style={{
                  fontSize: `${monthSize}px`,
                  textShadow: "0 2px 3px rgba(0,0,0,0.22)",
                }}
              >
                {month}
              </div>

              <div
                className="absolute left-1/2 top-[63.4%] w-[57%] -translate-x-1/2 -translate-y-1/2 overflow-hidden text-center font-black leading-tight text-black"
                style={{ fontSize: `${nameSize}px` }}
              >
                {name || "Sponsor Name"}
              </div>

              <div
                className="absolute left-1/2 top-[77.4%] w-[62%] -translate-x-1/2 -translate-y-1/2 overflow-hidden text-center font-black leading-tight text-black"
                style={{ fontSize: `${honorTitleSize}px` }}
              >
                {honorTitle}
              </div>

              <div
                className="absolute left-1/2 top-[82.2%] w-[66%] -translate-x-1/2 -translate-y-1/2 overflow-hidden text-center font-medium leading-tight text-black"
                style={{ fontSize: `${honorLineSize}px` }}
              >
                {honorLine || "Dedication line"}
              </div>
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}
