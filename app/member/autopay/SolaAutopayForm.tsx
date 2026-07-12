"use client";

import Script from "next/script";
import { useRouter } from "next/navigation";
import {
  useEffect,
  useRef,
  useState,
} from "react";
import type { FormEvent } from "react";

const IFIELDS_VERSION = "2.9.2109.2701";
const IFIELDS_BASE =
  `https://cdn.cardknox.com/ifields/${IFIELDS_VERSION}`;

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

    enableAutoFormatting?: (
      separator?: string
    ) => void;

    clearIfield?: (field: string) => void;
  }
}

type Props = {
  memberName: string;
  defaultAmount: number;
};

export default function SolaAutopayForm({
  memberName,
  defaultAmount,
}: Props) {
  const router = useRouter();

  const cardTokenRef =
    useRef<HTMLInputElement>(null);

  const [scriptReady, setScriptReady] =
    useState(false);

  const [submitting, setSubmitting] =
    useState(false);

  const [message, setMessage] = useState("");
  const [success, setSuccess] = useState(false);

  function configureIFields() {
    const key =
      process.env.NEXT_PUBLIC_SOLA_IFIELDS_KEY;

    if (!key || !window.setAccount) {
      setMessage(
        "Secure card enrollment is not configured."
      );
      return;
    }

    window.setAccount(
      key,
      "Khal Bnei Aliya Portal",
      "1.0.0"
    );

    window.setIfieldStyle?.("card-number", {
      border: "0",
      color: "#0f172a",
      fontSize: "16px",
      fontFamily: "Arial, sans-serif",
      height: "48px",
      padding: "0 14px",
      width: "100%",
      boxSizing: "border-box",
      backgroundColor: "#ffffff",
    });

    window.enableAutoFormatting?.(" ");
    setScriptReady(true);
  }

  useEffect(() => {
    if (window.setAccount) {
      window.setTimeout(configureIFields, 0);
    }
  }, []);

  async function submitToken(
    form: HTMLFormElement
  ) {
    const formData = new FormData(form);

    const cardToken =
      cardTokenRef.current?.value || "";

    if (!cardToken) {
      throw new Error(
        "Please check the card number."
      );
    }

    const response = await fetch(
      "/api/member/sola/autopay",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          cardToken,
          expiration: String(
            formData.get("expiration") || ""
          ),
          cardholderName: String(
            formData.get("cardholderName") || ""
          ),
          billingZip: String(
            formData.get("billingZip") || ""
          ),
          amount: Number(
            formData.get("amount") || 0
          ),
          billingDay: Number(
            formData.get("billingDay") || 0
          ),
          consent:
            formData.get("consent") === "on",
        }),
      }
    );

    const result = await response.json();

    if (!response.ok) {
      throw new Error(
        result.error ||
          "Unable to enroll in automatic payments."
      );
    }

    setSuccess(true);
    setMessage(
      `Automatic payments are active. Your first payment is scheduled for ${result.nextBillingDate}.`
    );

    window.clearIfield?.("card-number");

    router.refresh();
    router.push("/member/dashboard?autopay=active");
  }

  function handleSubmit(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    setMessage("");
    setSuccess(false);

    const form = event.currentTarget;
    const formData = new FormData(form);

    const expiration = String(
      formData.get("expiration") || ""
    ).replace(/\D/g, "");

    if (expiration.length !== 4) {
      setMessage(
        "Enter the expiration as MM/YY."
      );
      return;
    }

    if (!window.getTokens) {
      setMessage(
        "The secure card field is still loading."
      );
      return;
    }

    setSubmitting(true);

    window.getTokens(
      () => {
        submitToken(form)
          .catch((error: unknown) => {
            setMessage(
              error instanceof Error
                ? error.message
                : "Enrollment failed."
            );
          })
          .finally(() =>
            setSubmitting(false)
          );
      },
      () => {
        setSubmitting(false);
        setMessage(
          "Please check the card number."
        );
      },
      30000
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-5"
    >
      <Script
        id="sola-autopay-ifields"
        src={`${IFIELDS_BASE}/ifields.min.js`}
        strategy="afterInteractive"
        onLoad={configureIFields}
      />

      <label className="block space-y-2">
        <span className="font-semibold">
          Cardholder Name
        </span>

        <input
          name="cardholderName"
          defaultValue={memberName}
          required
          className="w-full rounded-xl border border-[#d8cdb7] px-4 py-3"
        />
      </label>

      <label className="block space-y-2">
        <span className="font-semibold">
          Card Number
        </span>

        <iframe
          title="Secure card number"
          data-ifields-id="card-number"
          data-ifields-placeholder="Card number"
          src={`${IFIELDS_BASE}/ifield.htm`}
          className="h-[50px] w-full rounded-xl border border-[#d8cdb7] bg-white"
        />
      </label>

      <input
        ref={cardTokenRef}
        name="xCardNum"
        data-ifields-id="card-number-token"
        type="hidden"
      />

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="space-y-2">
          <span className="font-semibold">
            Expiration
          </span>

          <input
            name="expiration"
            inputMode="numeric"
            maxLength={5}
            placeholder="MM/YY"
            required
            onInput={(event) => {
              const input = event.currentTarget;

              const digits = input.value
                .replace(/\D/g, "")
                .slice(0, 4);

              input.value =
                digits.length > 2
                  ? `${digits.slice(
                      0,
                      2
                    )}/${digits.slice(2)}`
                  : digits;
            }}
            className="w-full rounded-xl border border-[#d8cdb7] px-4 py-3"
          />
        </label>

        <label className="space-y-2">
          <span className="font-semibold">
            Billing ZIP
          </span>

          <input
            name="billingZip"
            required
            autoComplete="postal-code"
            className="w-full rounded-xl border border-[#d8cdb7] px-4 py-3"
          />
        </label>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="space-y-2">
          <span className="font-semibold">
            Monthly Amount
          </span>

          <input
            name="amount"
            type="number"
            min="1"
            step="0.01"
            defaultValue={defaultAmount}
            required
            className="w-full rounded-xl border border-[#d8cdb7] px-4 py-3"
          />
        </label>

        <label className="space-y-2">
          <span className="font-semibold">
            Billing Day
          </span>

          <select
            name="billingDay"
            defaultValue="2"
            required
            className="w-full rounded-xl border border-[#d8cdb7] bg-white px-4 py-3"
          >
            {Array.from(
              { length: 28 },
              (_, index) => index + 1
            ).map((day) => (
              <option
                key={day}
                value={day}
              >
                Day {day} of each month
              </option>
            ))}
          </select>
        </label>
      </div>

      <label className="flex items-start gap-3 rounded-2xl bg-[#fbf8f2] p-5">
        <input
          name="consent"
          type="checkbox"
          required
          className="mt-1 h-5 w-5"
        />

        <span className="text-sm leading-6 text-slate-700">
          I authorize Khal Bnei Aliya to
          automatically charge the card provided
          for the monthly amount shown above on
          the selected billing day. I understand
          that I may request cancellation of
          future automatic payments.
        </span>
      </label>

      <p
        data-ifields-id="card-data-error"
        className="text-sm text-red-700"
      />

      {message ? (
        <div
          className={
            success
              ? "rounded-xl bg-green-50 p-4 font-semibold text-green-800"
              : "rounded-xl bg-red-50 p-4 font-semibold text-red-800"
          }
        >
          {message}
        </div>
      ) : null}

      <button
        type="submit"
        disabled={submitting || !scriptReady}
        className="w-full rounded-2xl bg-[#1d2940] px-6 py-4 text-lg font-bold text-white disabled:cursor-not-allowed disabled:opacity-50"
      >
        {submitting
          ? "Creating Automatic Payments…"
          : "Enroll in Automatic Payments"}
      </button>
    </form>
  );
}
