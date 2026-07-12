"use client";

import Script from "next/script";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";

const IFIELDS_VERSION = "2.9.2109.2701";
const IFIELDS_BASE = `https://cdn.cardknox.com/ifields/${IFIELDS_VERSION}`;

declare global {
  interface Window {
    setAccount?: (key: string, softwareName: string, softwareVersion: string) => void;
    getTokens?: (
      onSuccess: () => void,
      onError: () => void,
      timeout: number
    ) => void;
    setIfieldStyle?: (field: string, style: Record<string, string>) => void;
    enableAutoFormatting?: (separator?: string) => void;
    clearIfield?: (field: string) => void;
    ApplePaySession?: {
      canMakePayments?: () => boolean;
    };
  }
}

type Props = {
  chargeId: string;
  amount: number;
  memberName: string;
  memberEmail: string;
  allowOpenAmount?: boolean;
};

export default function SolaCardPaymentForm({
  chargeId,
  amount,
  memberName,
  memberEmail,
  allowOpenAmount = false,
}: Props) {
  const router = useRouter();
  const cardTokenRef = useRef<HTMLInputElement>(null);
  const cvvTokenRef = useRef<HTMLInputElement>(null);

  const [open, setOpen] = useState(false);
  const [scriptReady, setScriptReady] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState("");
  const [success, setSuccess] = useState(false);
  const [applePayAvailable, setApplePayAvailable] = useState(false);
  const applePayConfigured =
    process.env.NEXT_PUBLIC_SOLA_APPLE_PAY_ENABLED === "true" &&
    Boolean(process.env.NEXT_PUBLIC_SOLA_APPLE_PAY_MERCHANT_ID?.trim());
  const googlePayConfigured =
    process.env.NEXT_PUBLIC_SOLA_GOOGLE_PAY_ENABLED === "true";

  const configureIFields = () => {
    const key = process.env.NEXT_PUBLIC_SOLA_IFIELDS_KEY;

    if (!key || !window.setAccount) {
      setMessage("Card payment is not configured yet.");
      return;
    }

    window.setAccount(key, "Khal Bnei Aliya Portal", "1.0.0");

    const fieldStyle = {
      border: "0",
      color: "#0f172a",
      fontSize: "15px",
      fontFamily: "Arial, sans-serif",
      height: "44px",
      padding: "0 12px",
      width: "100%",
      boxSizing: "border-box",
      backgroundColor: "#ffffff",
    };

    window.setIfieldStyle?.("card-number", fieldStyle);
    window.setIfieldStyle?.("cvv", fieldStyle);
    window.enableAutoFormatting?.(" ");
    setScriptReady(true);
  };

  useEffect(() => {
    window.setTimeout(() => {
      const applePaySession = window.ApplePaySession;

      setApplePayAvailable(
        Boolean(
          applePaySession &&
            (typeof applePaySession.canMakePayments !== "function" ||
              applePaySession.canMakePayments())
        )
      );
    }, 0);
  }, []);

  useEffect(() => {
    if (open && window.setAccount) {
      window.setTimeout(configureIFields, 0);
    }
  }, [open]);

  async function submitTokens(form: HTMLFormElement) {
    const formData = new FormData(form);
    const cardToken = cardTokenRef.current?.value || "";
    const cvvToken = cvvTokenRef.current?.value || "";

    if (!cardToken || !cvvToken) {
      setSubmitting(false);
      setMessage("Please check the card number and security code.");
      return;
    }

    const response = await fetch("/api/sola/payment", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chargeId,
        cardToken,
        cvvToken,
        expiration: String(formData.get("expiration") || ""),
        cardholderName: String(formData.get("cardholderName") || ""),
        billingZip: String(formData.get("billingZip") || ""),
        email: String(formData.get("email") || ""),
        amount: allowOpenAmount
          ? String(formData.get("amount") || "")
          : undefined,
      }),
    });

    const result = await response.json();

    if (!response.ok) {
      throw new Error(result.error || "The card could not be charged.");
    }

    setSuccess(true);
    setMessage(
  result.receiptGenerated
    ? "Payment approved. Your receipt is ready below and has been emailed."
    : "Payment approved. Your receipt is still being prepared."
);
    window.clearIfield?.("card-number");
    window.clearIfield?.("cvv");
    router.refresh();
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    setSuccess(false);

    const form = event.currentTarget;
    const expiration = String(new FormData(form).get("expiration") || "")
      .replace(/\D/g, "");

    if (expiration.length !== 4) {
      setMessage("Enter the expiration as MMYY, for example 0828.");
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
    <div className="mt-4 rounded-xl border border-blue-100 bg-white p-4">
      <Script
        id="sola-ifields-script"
        src={`${IFIELDS_BASE}/ifields.min.js`}
        strategy="afterInteractive"
        onLoad={configureIFields}
      />

      {!open ? (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm font-bold text-slate-900">Card payment</p>
            <p className="mt-1 text-xs text-slate-500">
              {allowOpenAmount
                ? "Choose the Matana amount and pay securely online."
                : `Securely pay this charge online for $${amount.toFixed(2)}.`}
            </p>
          </div>

          <button
            type="button"
            onClick={() => setOpen(true)}
            className="rounded-full bg-[#1d2940] px-5 py-2.5 text-sm font-bold text-white"
          >
            Pay by Card
          </button>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-bold text-slate-900">Charge card</p>
              <p className="mt-1 text-xs text-slate-500">
                {allowOpenAmount
                  ? "Amount: choose below"
                  : `Amount: $${amount.toFixed(2)}`}
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={!applePayAvailable || !applePayConfigured}
                className="rounded-full bg-black px-4 py-2 text-xs font-bold text-white disabled:cursor-not-allowed disabled:opacity-45"
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
                className="rounded-full bg-[#1a73e8] px-4 py-2 text-xs font-bold text-white disabled:cursor-not-allowed disabled:opacity-45"
                title="Set up Sola/Cardknox Google Pay merchant credentials before enabling."
              >
                Google Pay
              </button>

              <button
                type="button"
                onClick={() => setOpen(false)}
                className="text-xs font-bold text-slate-500"
              >
                Close
              </button>
            </div>
          </div>

          {allowOpenAmount && (
            <label className="block space-y-1 text-xs font-bold text-slate-600">
              Matana Amount
              <input
                name="amount"
                type="number"
                min="1"
                step="0.01"
                required
                className="w-full rounded-lg border border-[#d8cdb7] px-3 py-3 text-sm text-slate-900"
                placeholder="Enter amount"
              />
            </label>
          )}

          <label className="block space-y-1 text-xs font-bold text-slate-600">
            Cardholder Name
            <input
              name="cardholderName"
              defaultValue={memberName}
              required
              className="w-full rounded-lg border border-[#d8cdb7] px-3 py-3 text-sm text-slate-900"
            />
          </label>

          <label className="block space-y-1 text-xs font-bold text-slate-600">
            Card Number
            <iframe
              title="Secure card number"
              data-ifields-id="card-number"
              data-ifields-placeholder="Card number"
              src={`${IFIELDS_BASE}/ifield.htm`}
              className="h-[46px] w-full rounded-lg border border-[#d8cdb7] bg-white"
            ></iframe>
          </label>

          <input
            ref={cardTokenRef}
            name="xCardNum"
            data-ifields-id="card-number-token"
            type="hidden"
          />

          <div
            className="grid gap-3"
            style={{ gridTemplateColumns: "1fr 1fr 1fr" }}
          >
            <label className="space-y-1 text-xs font-bold text-slate-600">
              Expiration (MMYY)
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
              />
            </label>

            <label className="space-y-1 text-xs font-bold text-slate-600">
              Security Code
              <iframe
                title="Secure security code"
                data-ifields-id="cvv"
                data-ifields-placeholder="CVV"
                src={`${IFIELDS_BASE}/ifield.htm`}
                className="h-[46px] w-full rounded-lg border border-[#d8cdb7] bg-white"
              ></iframe>
            </label>

            <label className="space-y-1 text-xs font-bold text-slate-600">
              Billing ZIP
              <input
                name="billingZip"
                inputMode="numeric"
                required
                className="w-full rounded-lg border border-[#d8cdb7] px-3 py-3 text-sm text-slate-900"
              />
            </label>
          </div>

          <input
            ref={cvvTokenRef}
            name="xCVV"
            data-ifields-id="cvv-token"
            type="hidden"
          />

          <label className="block space-y-1 text-xs font-bold text-slate-600">
            Email Receipt
            <input
              name="email"
              type="email"
              defaultValue={memberEmail}
              className="w-full rounded-lg border border-[#d8cdb7] px-3 py-3 text-sm text-slate-900"
            />
          </label>

          <p data-ifields-id="card-data-error" className="text-sm text-red-700" />

          {message && (
            <p
              className={
                success
                  ? "rounded-lg bg-green-50 p-3 text-sm font-semibold text-green-800"
                  : "rounded-lg bg-red-50 p-3 text-sm font-semibold text-red-800"
              }
            >
              {message}
            </p>
          )}

          <button
            type="submit"
            disabled={submitting || !scriptReady}
            className="rounded-full bg-[#1d2940] px-5 py-2.5 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-50"
          >
            {submitting
              ? "Processing…"
              : allowOpenAmount
                ? "Pay Matana"
                : `Pay $${amount.toFixed(2)}`}
          </button>
        </form>
      )}
    </div>
  );
}
