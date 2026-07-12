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
    ApplePaySession?: {
      new (version: number, request: Record<string, unknown>): {
        onvalidatemerchant:
          | ((event: { validationURL: string }) => void)
          | null;
        onpaymentauthorized:
          | ((event: { payment: unknown }) => void)
          | null;
        oncancel: (() => void) | null;
        begin: () => void;
        completeMerchantValidation: (merchantSession: unknown) => void;
        completePayment: (status: number) => void;
      };
      canMakePayments?: () => boolean;
      STATUS_SUCCESS: number;
      STATUS_FAILURE: number;
    };
    ckGooglePay?: {
      enableGooglePay: (params: Record<string, unknown>) => unknown;
      updateAmount?: (amount: string) => void;
    };
    GPButtonSizeMode?: Record<string, string>;
    GPBillingAddressFormat?: Record<string, string>;
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

type WalletConfig = {
  loaded: boolean;
  applePayEnabled: boolean;
  applePayMerchantId: string;
  applePayDebug: boolean;
  googlePayEnabled: boolean;
  googlePayMerchantName: string;
  googlePayEnvironment: string;
};

const initialWalletConfig: WalletConfig = {
  loaded: false,
  applePayEnabled: false,
  applePayMerchantId: "",
  applePayDebug: false,
  googlePayEnabled: false,
  googlePayMerchantName: "Khal Bnei Aliya",
  googlePayEnvironment: "PRODUCTION",
};

function isApplePaySupported() {
  return Boolean(window.ApplePaySession);
}

function isGooglePaySupportedBrowser() {
  if (window.ApplePaySession) {
    return false;
  }

  const userAgent = window.navigator.userAgent;
  const vendor = window.navigator.vendor;
  const isSafari =
    /Safari/i.test(userAgent) &&
    /Apple Computer/i.test(vendor) &&
    !/Chrome|CriOS|FxiOS|Edg/i.test(userAgent);

  return !isSafari;
}

function catchSolaWalletPromise(
  result: unknown,
  onError: (error: unknown) => void
) {
  if (
    result &&
    typeof result === "object" &&
    "then" in result &&
    typeof (result as Promise<unknown>).then === "function"
  ) {
    void (result as Promise<unknown>).catch(onError);
  }
}

export default function DonationForm() {
  const cardTokenRef = useRef<HTMLInputElement>(null);
  const cvvTokenRef = useRef<HTMLInputElement>(null);
  const formRef = useRef<HTMLFormElement>(null);

  const [amount, setAmount] = useState("18");
  const [scriptReady, setScriptReady] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [walletSubmitting, setWalletSubmitting] = useState(false);
  const [message, setMessage] = useState("");
  const [success, setSuccess] = useState(false);

  const [applePayAvailable, setApplePayAvailable] = useState(false);
  const [applePayLoadFailed, setApplePayLoadFailed] = useState(false);
  const [applePayFailureReason, setApplePayFailureReason] = useState("");
  const [googlePayReady, setGooglePayReady] = useState(false);
  const [, setGooglePaySupported] = useState(false);
  const [walletConfig, setWalletConfig] =
    useState<WalletConfig>(initialWalletConfig);
  const applePayConfigured =
    walletConfig.applePayEnabled;
  const googlePayConfigured = false;

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

  async function validateApplePayMerchant(validationUrl: string) {
    const response = await fetch("https://api.cardknox.com/applepay/validate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ validationUrl }),
    });

    const text = await response.text();

    if (!response.ok) {
      throw new Error(text || "Apple Pay merchant validation failed.");
    }

    try {
      return JSON.parse(text) as unknown;
    } catch {
      return text;
    }
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

  function startApplePay() {
    const ApplePaySession = window.ApplePaySession;
    const form = formRef.current;

    setMessage("");
    setSuccess(false);
    setApplePayLoadFailed(false);
    setApplePayFailureReason("");

    if (!ApplePaySession || !applePayAvailable || !applePayConfigured) {
      setApplePayLoadFailed(true);
      setApplePayFailureReason("Apple Pay is not available on this device.");
      return;
    }

    if (form && !form.reportValidity()) {
      return;
    }

    const totalAmount = getWalletAmount();

    if (Number(totalAmount) <= 0) {
      setApplePayLoadFailed(true);
      setApplePayFailureReason("Enter a donation amount greater than $0.");
      return;
    }

    const session = new ApplePaySession(3, {
      countryCode: "US",
      currencyCode: "USD",
      merchantCapabilities: ["supports3DS"],
      supportedNetworks: ["amex", "discover", "masterCard", "visa"],
      requiredBillingContactFields: ["postalAddress", "name", "phone", "email"],
      total: {
        label: "Khal Bnei Aliya",
        amount: totalAmount,
        type: "final",
      },
      lineItems: [
        {
          label: "Donation",
          amount: totalAmount,
          type: "final",
        },
      ],
    });

    session.onvalidatemerchant = (event) => {
      validateApplePayMerchant(event.validationURL)
        .then((merchantSession) => {
          session.completeMerchantValidation(merchantSession);
        })
        .catch((error: unknown) => {
          console.info("APPLE_PAY_MERCHANT_VALIDATION_FAILED", error);
          setApplePayLoadFailed(true);
          setApplePayFailureReason(
            error instanceof Error
              ? error.message
              : "Apple Pay merchant validation failed."
          );
          session.completePayment(ApplePaySession.STATUS_FAILURE);
        });
    };

    session.onpaymentauthorized = (event) => {
      submitWalletDonation("ApplePay", { payment: event.payment })
        .then(() => {
          session.completePayment(ApplePaySession.STATUS_SUCCESS);
        })
        .catch((error: unknown) => {
          console.info("APPLE_PAY_PAYMENT_FAILED", error);
          setApplePayLoadFailed(true);
          setApplePayFailureReason(
            error instanceof Error
              ? error.message
              : "Apple Pay payment failed."
          );
          session.completePayment(ApplePaySession.STATUS_FAILURE);
        })
        .finally(() => setWalletSubmitting(false));
    };

    session.oncancel = () => {
      setWalletSubmitting(false);
    };

    try {
      session.begin();
    } catch (error) {
      setApplePayLoadFailed(true);
      setApplePayFailureReason(
        error instanceof Error ? error.message : "Apple Pay could not start."
      );
    }
  }

  function configureWallets() {
    if (googlePayConfigured && window.ckGooglePay) {
      window.gpRequest = {
        merchantInfo: {
          merchantName: walletConfig.googlePayMerchantName,
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
          walletConfig.googlePayEnvironment,
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

      setGooglePayReady(true);
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
  }

  useEffect(() => {
    fetch("/api/sola/wallet-config", {
      cache: "no-store",
    })
      .then(async (response) => {
        if (!response.ok) {
          throw new Error("Unable to load wallet configuration.");
        }

        return (await response.json()) as Omit<WalletConfig, "loaded">;
      })
      .then((config) => {
        setWalletConfig({
          ...initialWalletConfig,
          ...config,
          loaded: true,
        });
      })
      .catch((error: unknown) => {
        console.info("WALLET_CONFIG_NOT_LOADED", error);
        setWalletConfig({
          ...initialWalletConfig,
          loaded: true,
        });
      });

    window.setTimeout(() => {
      setApplePayAvailable(isApplePaySupported());
      setGooglePaySupported(isGooglePaySupportedBrowser());
    }, 0);

    if (window.setAccount) {
      window.setTimeout(configureIFields, 0);
    }
  }, []);

  useEffect(() => {
    if (scriptReady && walletConfig.loaded) {
      window.setTimeout(configureWallets, 0);
    }
  }, [scriptReady, walletConfig]);

  useEffect(() => {
    if (!googlePayReady || !window.ckGooglePay) {
      return;
    }

    window.setTimeout(() => {
      try {
        const googlePayResult = window.ckGooglePay?.enableGooglePay({
          amountField: "amount",
          iframeField: "igp",
        });

        catchSolaWalletPromise(googlePayResult, (error) => {
          console.info("GOOGLE_PAY_NOT_ENABLED_ASYNC", error);
          setGooglePayReady(false);
          setGooglePaySupported(false);
        });
      } catch (error) {
        console.info("GOOGLE_PAY_NOT_ENABLED", error);
        setGooglePayReady(false);
        setGooglePaySupported(false);
      }
    }, 0);
  }, [googlePayReady]);

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
            {applePayConfigured ? (
              <>
                <button
                  type="button"
                  disabled={!applePayAvailable || walletSubmitting}
                  onClick={startApplePay}
                  className="w-full rounded-full bg-black px-5 py-2.5 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-45"
                  title={
                    applePayAvailable
                      ? "Pay securely with Apple Pay."
                      : "Apple Pay is available only on supported Apple devices."
                  }
                >
                  {walletSubmitting ? "Processing..." : "Apple Pay"}
                </button>
                {applePayLoadFailed && (
                  <p className="rounded-lg bg-amber-50 p-2 text-xs font-semibold text-amber-900">
                    Apple Pay unavailable:{" "}
                    {applePayFailureReason || "Sola did not load the button."}
                  </p>
                )}
              </>
            ) : (
              <button
                type="button"
                disabled
                className="w-full rounded-full bg-black px-5 py-2.5 text-sm font-bold text-white opacity-45"
                title="Apple Pay is not enabled by the payment configuration."
              >
                Apple Pay
              </button>
            )}

            {googlePayConfigured && googlePayReady ? (
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
            ) : null}
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
