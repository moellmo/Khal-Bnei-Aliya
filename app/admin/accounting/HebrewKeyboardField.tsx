"use client";

import { useRef, useState } from "react";
import type { ChangeEvent } from "react";

type HebrewKeyboardFieldProps = {
  name: string;
  defaultValue?: string;
  placeholder?: string;
  className?: string;
  rows?: number;
  "aria-label"?: string;
};

const hebrewKeys = [
  "א",
  "ב",
  "ג",
  "ד",
  "ה",
  "ו",
  "ז",
  "ח",
  "ט",
  "י",
  "כ",
  "ל",
  "מ",
  "נ",
  "ס",
  "ע",
  "פ",
  "צ",
  "ק",
  "ר",
  "ש",
  "ת",
  "ך",
  "ם",
  "ן",
  "ף",
  "ץ",
  "׳",
  "״",
];

export default function HebrewKeyboardField({
  name,
  defaultValue = "",
  placeholder,
  className,
  rows,
  "aria-label": ariaLabel,
}: HebrewKeyboardFieldProps) {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState(defaultValue);
  const inputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  function insertText(text: string) {
    const field = rows ? textareaRef.current : inputRef.current;
    const start = field?.selectionStart ?? value.length;
    const end = field?.selectionEnd ?? value.length;
    const nextValue = `${value.slice(0, start)}${text}${value.slice(end)}`;

    setValue(nextValue);

    window.requestAnimationFrame(() => {
      field?.focus();
      field?.setSelectionRange(start + text.length, start + text.length);
    });
  }

  function handleChange(
    event: ChangeEvent<HTMLInputElement> | ChangeEvent<HTMLTextAreaElement>
  ) {
    setValue(event.currentTarget.value);
  }

  return (
    <div className="relative">
      {rows ? (
        <textarea
          ref={textareaRef}
          name={name}
          value={value}
          placeholder={placeholder}
          dir="auto"
          className={className}
          aria-label={ariaLabel}
          rows={rows}
          onChange={handleChange}
        />
      ) : (
        <input
          ref={inputRef}
          name={name}
          value={value}
          placeholder={placeholder}
          dir="auto"
          className={className}
          aria-label={ariaLabel}
          onChange={handleChange}
        />
      )}

      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        className="mt-2 rounded-full border border-[#cbbd9d] bg-white px-3 py-1.5 text-xs font-black text-[#1d2940] hover:bg-[#fbf8f2]"
      >
        Hebrew Keyboard
      </button>

      {open ? (
        <div className="absolute z-20 mt-2 min-w-[260px] max-w-sm rounded-2xl border border-[#d8cdb7] bg-white p-3 shadow-lg">
          <div className="grid grid-cols-7 gap-1" dir="rtl">
            {hebrewKeys.map((letter) => (
              <button
                key={letter}
                type="button"
                onClick={() => insertText(letter)}
                className="h-9 rounded-lg border border-[#eadfce] bg-[#fbf8f2] text-lg font-black text-slate-900 hover:bg-[#f0e5ca]"
              >
                {letter}
              </button>
            ))}
          </div>

          <div className="mt-2 grid grid-cols-3 gap-1">
            <button
              type="button"
              onClick={() => insertText(" ")}
              className="rounded-lg border border-[#eadfce] px-2 py-1.5 text-xs font-bold"
            >
              Space
            </button>
            <button
              type="button"
              onClick={() => insertText("\n")}
              className="rounded-lg border border-[#eadfce] px-2 py-1.5 text-xs font-bold"
            >
              New Line
            </button>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="rounded-lg bg-[#1d2940] px-2 py-1.5 text-xs font-bold text-white"
            >
              Done
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
