"use client";

import Script from "next/script";
import { useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";

const IFIELDS_VERSION = "2.9.2109.2701";
const IFIELDS_BASE = `https://cdn.cardknox.com/ifields/${IFIELDS_VERSION}`;
const presetAmounts = [18, 36, 72, 100, 180, 360];

declare global {
  interface Window {
    setAccount?: (
      key: string,
      softwareName: string,
      softwareVersion: string
    ) => void;
    getTokens?: (
      onSuccess: () => void,
      onError: () => void,
      timeout: number
    ) => void;
    setIfieldStyle?: (
      field: string,
      style: Record<string, string>
    ) => void;
    enableAutoFormatting?: (separator?: string) => void;
    clearIfield?: (field: string) => void;
    ApplePaySession?: unknown;
  }
}

type DonationResult = {
  approved?: boolean;
  reference?: string;
  receiptGenerated?: boolean;
  receiptError?: string | null;
  error?: string;
};

export default function DonationForm() {
  const cardTokenRef = useRef<HTMLInputElement>(null);
  const cvvTokenRef = useRef<HTMLInputElement>(null);
  const formRef = useRef<HTMLFormElement>(null);

  const [amount, setAmount] = useState("100");
  const [scriptReady, setScriptReady] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState("");
  const [success, setSuccess] = useState(false);

  const applePayAvailable =
    typeof window !== "undefined" && Boolean(window.ApplePaySession);
  const applePayConfigured =
    process.env.NEXT_PUBLIC_SOLA_APPLE_PAY_ENABLED === "true";
  const googlePayConfigured =
    process.env.NEXT_PUBLIC_SOLA_GOOGLE_PAY_ENABLED === "true";

  function configureIFields() {
    const key = process.env.NEXT_PUBLIC_SOLA_IFIELDS_KEY;

    if (!key || !window.setAccount) {
      setMessage("Card payments are not configured yet.");
      return;
    }

    window.setAccount(key, "Khal Bnei Aliya Donate", "1.0.0");

    const fieldStyle = {
      border: "0",
      color: "#0f172a",
      fontSize: "15px",
      fontFamily: "Arial, sans-serif",
      height: "46px",
      padding: "0 12px",
      width: "100%",
      boxSizing: "border-box",
      backgroundColor: "#ffffff",
    };

    window.setIfieldStyle?.("card-number", fieldStyle);
    window.setIfieldStyle?.("cvv", fieldStyle);
    window.enableAutoFormatting?.(" ");
    setScriptReady(true);
  }

  useEffect(() => {
    if (window.setAccount) {
      window.setTimeout(configureIFields, 0);
    }
  }, []);

  async function submitTokens(form: HTMLFormElement) {
    const formData = new FormData(form);
    const cardToken = cardTokenRef.current?.value || "";
    const cvvToken = cvvTokenRef.current?.value || "";

    if (!cardToken || !cvvToken) {
      setMessage("Please check the card number and security code.");
      setSubmitting(false);
      return;
    }

    const response = await fetch("/api/sola/donation", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        donorName: String(formData.get("donorName") || ""),
        email: String(formData.get("email") || ""),
        phone: String(formData.get("phone") || ""),
        amount: String(formData.get("amount") || ""),
        purpose: String(formData.get("purpose") || ""),
        note: String(formData.get("note") || ""),
        cardToken,
        cvvToken,
        expiration: String(formData.get("expiration") || ""),
        cardholderName: String(formData.get("cardholderName") || ""),
        billingZip: String(formData.get("billingZip") || ""),
      }),
    });

    const result = (await response.json()) as DonationResult;

    if (!response.ok) {
      throw new Error(result.error || "The card could not be charged.");
    }

    setSuccess(true);
    setMessage(
      result.receiptGenerated
        ? "Donation approved. A receipt has been emailed."
        : "Donation approved. The receipt was saved and email is still being prepared."
    );
    window.clearIfield?.("card-number");
    window.clearIfield?.("cvv");
    form.reset();
    setAmount("100");
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    setSuccess(false);

    const form = event.currentTarget;
    const formData = new FormData(form);
    const numericAmount = Number(formData.get("amount") || 0);
    const expiration = String(formData.get("expiration") || "").replace(
      /\D/g,
      ""
    );

    if (!Number.isFinite(numericAmount) || numericAmount < 1) {
      setMessage("Enter a donation amount of at least $1.");
      return;
    }

    if (expiration.length !== 4) {
      setMessage("Enter the expiration as MM/YY.");
      return;
    }

    if (!window.getTokens) {
      setMessage("The secure card fields are still loading. Try again in a moment.");
      return;
    }

    setSubmitting(true);

    window.getTokens(
      () => {
        submitTokens(form)
          .catch((error: unknown) => {
            setMessage(
              error instanceof Error ? error.message : "The payment failed."
            );
          })
          .finally(() => setSubmitting(false));
      },
      () => {
        setSubmitting(false);
        setMessage("Please check the card number and security code.");
      },
      30000
    );
  }

  return (
    <form ref={formRef} onSubmit={handleSubmit} className="space-y-5">
      <Script
        id="sola-donation-ifields"
        src={`${IFIELDS_BASE}/ifields.min.js`}
        strategy="afterInteractive"
        onLoad={configureIFields}
      />

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="space-y-2 text-sm font-bold text-slate-700">
          Donor Name
          <input
            name="donorName"
            required
            className="w-full rounded-xl border border-[#d8cdb7] px-4 py-3 text-slate-900"
          />
        </label>

        <label className="space-y-2 text-sm font-bold text-slate-700">
          Email Receipt
          <input
            name="email"
            type="email"
            required
            className="w-full rounded-xl border border-[#d8cdb7] px-4 py-3 text-slate-900"
          />
        </label>

        <label className="space-y-2 text-sm font-bold text-slate-700">
          Phone
          <input
            name="phone"
            type="tel"
            className="w-full rounded-xl border border-[#d8cdb7] px-4 py-3 text-slate-900"
          />
        </label>

        <label className="space-y-2 text-sm font-bold text-slate-700">
          Purpose
          <select
            name="purpose"
            defaultValue="General Donation"
            className="w-full rounded-xl border border-[#d8cdb7] bg-white px-4 py-3 text-slate-900"
          >
            <option>General Donation</option>
            <option>Ner Lamaor</option>
            <option>Mishaberach</option>
            <option>Matana</option>
            <option>Aliyah Pledge</option>
            <option>Building Fund</option>
            <option>Other</option>
          </select>
        </label>
      </div>

      <div>
        <p className="text-sm font-bold text-slate-700">Amount</p>
        <div className="mt-2 flex flex-wrap gap-2">
          {presetAmounts.map((preset) => (
            <button
              key={preset}
              type="button"
              onClick={() => setAmount(String(preset))}
              className={
                amount === String(preset)
                  ? "rounded-full bg-[#1d2940] px-4 py-2 text-sm font-bold text-white"
                  : "rounded-full border border-[#cbbd9d] bg-white px-4 py-2 text-sm font-bold"
              }
            >
              ${preset}
            </button>
          ))}
        </div>

        <label className="mt-3 block max-w-xs space-y-2 text-sm font-bold text-slate-700">
          Custom Amount
          <input
            name="amount"
            type="number"
            min="1"
            step="0.01"
            required
            value={amount}
            onChange={(event) => setAmount(event.currentTarget.value)}
            className="w-full rounded-xl border border-[#d8cdb7] px-4 py-3 text-slate-900"
          />
        </label>
      </div>

      <label className="block space-y-2 text-sm font-bold text-slate-700">
        Note
        <textarea
          name="note"
          rows={3}
          placeholder="Optional dedication, name, or payment note"
          className="w-full rounded-xl border border-[#d8cdb7] px-4 py-3 text-slate-900"
        />
      </label>

      <div className="rounded-2xl border border-[#e3d9c7] bg-[#fbf8f2] p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-black">Card Payment</h2>
            <p className="mt-1 text-sm text-slate-600">
              Card details are tokenized by Sola iFields before reaching our server.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={!applePayAvailable || !applePayConfigured}
              className="rounded-full bg-black px-5 py-2.5 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-45"
              title={
                applePayConfigured
                  ? "Apple Pay is available on supported Apple devices."
                  : "Set up Sola/Cardknox Apple Pay merchant credentials before enabling."
              }
            >
              Apple Pay
            </button>

            <button
              type="button"
              disabled={!googlePayConfigured}
              className="rounded-full bg-[#1a73e8] px-5 py-2.5 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-45"
              title="Set up Sola/Cardknox Google Pay merchant credentials before enabling."
            >
              Google Pay
            </button>
          </div>
        </div>

        <div className="mt-4 grid gap-4">
          <label className="space-y-2 text-sm font-bold text-slate-700">
            Cardholder Name
            <input
              name="cardholderName"
              required
              className="w-full rounded-xl border border-[#d8cdb7] bg-white px-4 py-3 text-slate-900"
            />
          </label>

          <label className="space-y-2 text-sm font-bold text-slate-700">
            Card Number
            <iframe
              title="Secure card number"
              data-ifields-id="card-number"
              data-ifields-placeholder="Card number"
              src={`${IFIELDS_BASE}/ifield.htm`}
              className="h-[48px] w-full rounded-xl border border-[#d8cdb7] bg-white"
            />
          </label>

          <input
            ref={cardTokenRef}
            name="xCardNum"
            data-ifields-id="card-number-token"
            type="hidden"
          />

          <div className="grid gap-3 sm:grid-cols-3">
            <label className="space-y-2 text-sm font-bold text-slate-700">
              Expiration
              <input
                name="expiration"
                inputMode="numeric"
                maxLength={5}
                placeholder="MM/YY"
                required
                onInput={(event) => {
                  const input = event.currentTarget;
                  const digits = input.value.replace(/\D/g, "").slice(0, 4);
                  input.value =
                    digits.length > 2
                      ? `${digits.slice(0, 2)}/${digits.slice(2)}`
                      : digits;
                }}
                className="w-full rounded-xl border border-[#d8cdb7] bg-white px-4 py-3 text-slate-900"
              />
            </label>

            <label className="space-y-2 text-sm font-bold text-slate-700">
              CVV
              <iframe
                title="Secure security code"
                data-ifields-id="cvv"
                data-ifields-placeholder="CVV"
                src={`${IFIELDS_BASE}/ifield.htm`}
                className="h-[48px] w-full rounded-xl border border-[#d8cdb7] bg-white"
              />
            </label>

            <label className="space-y-2 text-sm font-bold text-slate-700">
              Billing ZIP
              <input
                name="billingZip"
                inputMode="numeric"
                required
                className="w-full rounded-xl border border-[#d8cdb7] bg-white px-4 py-3 text-slate-900"
              />
            </label>
          </div>

          <input
            ref={cvvTokenRef}
            name="xCVV"
            data-ifields-id="cvv-token"
            type="hidden"
          />

          <p data-ifields-id="card-data-error" className="text-sm text-red-700" />
        </div>
      </div>

      {message && (
        <p
          className={
            success
              ? "rounded-xl bg-green-50 p-4 text-sm font-bold text-green-800"
              : "rounded-xl bg-red-50 p-4 text-sm font-bold text-red-800"
          }
        >
          {message}
        </p>
      )}

      <button
        type="submit"
        disabled={submitting || !scriptReady}
        className="w-full rounded-full bg-[#8b6b2e] px-6 py-4 text-base font-black text-white disabled:cursor-not-allowed disabled:opacity-50"
      >
        {submitting ? "Processing..." : `Donate $${Number(amount || 0).toFixed(2)}`}
      </button>
    </form>
  );
}
