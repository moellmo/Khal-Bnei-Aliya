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
    ckApplePay?: {
      enableApplePay: (params: Record<string, unknown>) => void;
      updateAmount?: (amount: string) => void;
    };
    ckGooglePay?: {
      enableGooglePay: (params: Record<string, unknown>) => void;
      updateAmount?: (amount: string) => void;
    };
    APButtonColor?: Record<string, string>;
    APButtonType?: Record<string, string>;
    GPButtonSizeMode?: Record<string, string>;
    GPBillingAddressFormat?: Record<string, string>;
    iStatus?: Record<string, string>;
    apRequest?: Record<string, unknown>;
    gpRequest?: Record<string, unknown>;
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
  const walletsConfiguredRef = useRef(false);

  const [amount, setAmount] = useState("18");
  const [scriptReady, setScriptReady] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [walletSubmitting, setWalletSubmitting] = useState(false);
  const [message, setMessage] = useState("");
  const [success, setSuccess] = useState(false);

  const applePayAvailable =
    typeof window !== "undefined" && Boolean(window.ApplePaySession);
  const applePayConfigured =
    process.env.NEXT_PUBLIC_SOLA_APPLE_PAY_ENABLED === "true" &&
    Boolean(process.env.NEXT_PUBLIC_SOLA_APPLE_PAY_MERCHANT_ID);
  const googlePayConfigured =
    process.env.NEXT_PUBLIC_SOLA_GOOGLE_PAY_ENABLED === "true";

  function getDonationPayload() {
    const form = formRef.current;
    const formData = form ? new FormData(form) : new FormData();

    return {
      donorName: String(formData.get("donorName") || ""),
      email: String(formData.get("email") || ""),
      phone: String(formData.get("phone") || ""),
      amount: String(formData.get("amount") || amount || ""),
      purpose: String(formData.get("purpose") || ""),
      note: String(formData.get("note") || ""),
    };
  }

  function getWalletAmount() {
    const numericAmount = Number(getDonationPayload().amount || 0);
    return Number.isFinite(numericAmount) && numericAmount > 0
      ? numericAmount.toFixed(2)
      : "0.00";
  }

  async function submitWalletDonation(
    walletType: "ApplePay" | "GooglePay",
    payload: unknown
  ) {
    setWalletSubmitting(true);
    setMessage("");
    setSuccess(false);

    const response = await fetch("/api/sola/donation/wallet", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...getDonationPayload(),
        walletType,
        payload,
      }),
    });

    const text = await response.text();
    const result = text ? (JSON.parse(text) as DonationResult) : {};

    if (!response.ok) {
      throw new Error(
        result.error || "The wallet payment could not be charged."
      );
    }

    setSuccess(true);
    setMessage(
      result.receiptGenerated
        ? "Donation approved. A receipt has been emailed."
        : "Donation approved. The receipt was saved and email is still being prepared."
    );
    formRef.current?.reset();
    setAmount("18");

    return text;
  }

  function configureWallets() {
    if (walletsConfiguredRef.current) {
      return;
    }

    walletsConfiguredRef.current = true;

    if (applePayConfigured && window.ckApplePay) {
      window.apRequest = {
        buttonOptions: {
          buttonContainer: "ap-container",
          buttonColor: window.APButtonColor?.black || "black",
          buttonType: window.APButtonType?.pay || "pay",
        },
        totalAmount: null,
        onGetTransactionInfo() {
          const totalAmount = getWalletAmount();

          return {
            lineItems: [
              {
                label: "Donation",
                type: "final",
                amount: totalAmount,
              },
            ],
            total: {
              type: "final",
              label: "Khal Bnei Aliya",
              amount: totalAmount,
            },
          };
        },
        onValidateMerchant() {
          return fetch("https://api.cardknox.com/applepay/validate", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
          }).then(async (response) => {
            const text = await response.text();

            if (!response.ok) {
              throw new Error(text || "Apple Pay merchant validation failed.");
            }

            return text;
          });
        },
        onPaymentAuthorize(applePayload: unknown) {
          return submitWalletDonation("ApplePay", applePayload).finally(() =>
            setWalletSubmitting(false)
          );
        },
        onPaymentComplete(paymentComplete: Record<string, unknown>) {
          if (paymentComplete.response) {
            setSuccess(true);
          } else if (paymentComplete.error) {
            setMessage("Apple Pay could not complete this donation.");
          }
        },
        apButtonLoaded(resp: Record<string, unknown>) {
          if (!resp) return;

          if (resp.status === window.iStatus?.success) {
            setMessage("");
          } else if (resp.reason) {
            console.info("APPLE_PAY_BUTTON_NOT_LOADED", resp.reason);
          }
        },
        initAP() {
          return {
            buttonOptions: {
              buttonContainer: "ap-container",
              buttonColor: window.APButtonColor?.black || "black",
              buttonType: window.APButtonType?.pay || "pay",
            },
            merchantIdentifier:
              process.env.NEXT_PUBLIC_SOLA_APPLE_PAY_MERCHANT_ID,
            requiredBillingContactFields: ["postalAddress", "name", "phone", "email"],
            onGetTransactionInfo: "apRequest.onGetTransactionInfo",
            onValidateMerchant: "apRequest.onValidateMerchant",
            onPaymentAuthorize: "apRequest.onPaymentAuthorize",
            onPaymentComplete: "apRequest.onPaymentComplete",
            onAPButtonLoaded: "apRequest.apButtonLoaded",
            isDebug:
              process.env.NEXT_PUBLIC_SOLA_APPLE_PAY_DEBUG === "true",
          };
        },
      };

      window.ckApplePay.enableApplePay({
        initFunction: "apRequest.initAP",
        amountField: "amount",
      });
    }

    if (googlePayConfigured && window.ckGooglePay) {
      window.gpRequest = {
        merchantInfo: {
          merchantName:
            process.env.NEXT_PUBLIC_SOLA_GOOGLE_PAY_MERCHANT_NAME ||
            "Khal Bnei Aliya",
        },
        buttonOptions: {
          buttonSizeMode: window.GPButtonSizeMode?.fill || "fill",
        },
        billingParams: {
          emailRequired: true,
          billingAddressRequired: true,
          billingAddressFormat:
            window.GPBillingAddressFormat?.full || "FULL",
        },
        environment:
          process.env.NEXT_PUBLIC_SOLA_GOOGLE_PAY_ENVIRONMENT ||
          "PRODUCTION",
        onGetTransactionInfo() {
          const totalPrice = getWalletAmount();

          return {
            countryCode: "US",
            currencyCode: "USD",
            totalPriceStatus: "FINAL",
            totalPrice,
            totalPriceLabel: "Khal Bnei Aliya",
            displayItems: [
              {
                label: "Donation",
                type: "LINE_ITEM",
                price: totalPrice,
                status: "FINAL",
              },
            ],
          };
        },
        onProcessPayment(googlePayload: unknown) {
          return submitWalletDonation("GooglePay", googlePayload).finally(() =>
            setWalletSubmitting(false)
          );
        },
        gpButtonLoaded(resp: Record<string, unknown>) {
          if (resp?.reason) {
            console.info("GOOGLE_PAY_BUTTON_NOT_LOADED", resp.reason);
          }
        },
        initGP() {
          const request = window.gpRequest as Record<string, unknown>;

          return {
            merchantInfo: request.merchantInfo,
            buttonOptions: request.buttonOptions,
            onGetTransactionInfo: "gpRequest.onGetTransactionInfo",
            environment: request.environment,
            billingParameters: request.billingParams,
            onProcessPayment: "gpRequest.onProcessPayment",
            onGPButtonLoaded: "gpRequest.gpButtonLoaded",
          };
        },
      };

      window.setTimeout(() => {
        window.ckGooglePay?.enableGooglePay({
          amountField: "amount",
          iframeField: "igp",
        });
      }, 0);
    }
  }

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
    configureWallets();
  }

  useEffect(() => {
    if (window.setAccount) {
      window.setTimeout(configureIFields, 0);
    }
  }, []);

  useEffect(() => {
    window.ckApplePay?.updateAmount?.(Number(amount || 0).toFixed(2));
    window.ckGooglePay?.updateAmount?.(Number(amount || 0).toFixed(2));
  }, [amount]);

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
    setAmount("18");
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
            required
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
            id="amount"
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

          <div className="min-w-[220px] space-y-2">
            {applePayConfigured && applePayAvailable ? (
              <div id="ap-container" className="min-h-[44px]" />
            ) : (
              <button
                type="button"
                disabled
                className="w-full rounded-full bg-black px-5 py-2.5 text-sm font-bold text-white opacity-45"
                title={
                  applePayConfigured
                    ? "Apple Pay is available only on supported Apple devices."
                    : "Set NEXT_PUBLIC_SOLA_APPLE_PAY_ENABLED and NEXT_PUBLIC_SOLA_APPLE_PAY_MERCHANT_ID in Vercel."
                }
              >
                Apple Pay
              </button>
            )}

            {googlePayConfigured ? (
              <iframe
                id="igp"
                title="Google Pay"
                data-ifields-id="igp"
                data-ifields-oninit="gpRequest.initGP"
                src={`${IFIELDS_BASE}/igp.htm`}
                allow="payment *"
                sandbox="allow-popups allow-modals allow-scripts allow-same-origin allow-forms allow-popups-to-escape-sandbox allow-top-navigation"
                className="h-[44px] w-full border-0"
              />
            ) : (
              <button
                type="button"
                disabled
                className="w-full rounded-full bg-[#1a73e8] px-5 py-2.5 text-sm font-bold text-white opacity-45"
                title="Set NEXT_PUBLIC_SOLA_GOOGLE_PAY_ENABLED in Vercel."
              >
                Google Pay
              </button>
            )}
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
        disabled={submitting || walletSubmitting || !scriptReady}
        className="w-full rounded-full bg-[#8b6b2e] px-6 py-4 text-base font-black text-white disabled:cursor-not-allowed disabled:opacity-50"
      >
        {submitting || walletSubmitting
          ? "Processing..."
          : `Donate $${Number(amount || 0).toFixed(2)}`}
      </button>
    </form>
  );
}
