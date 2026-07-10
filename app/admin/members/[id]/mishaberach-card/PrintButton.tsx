"use client";

export default function PrintButton() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="rounded-full bg-[#1d2940] px-5 py-3 text-sm font-bold text-white shadow-sm"
    >
      Print Card
    </button>
  );
}