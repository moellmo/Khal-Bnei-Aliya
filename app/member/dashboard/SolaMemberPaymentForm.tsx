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
    ckApplePay?: {
      enableApplePay: (params: Record<string, unknown>) => unknown;
      updateAmount?: (amount: string) => void;
    };
    ckGooglePay?: {
      enableGooglePay: (params: Record<string, unknown>) => unknown;
      updateAmount?: (amount: string) => void;
    };
    APButtonColor?: Record<string, string>;
    APButtonType?: Record<string, string>;
    GPButtonSizeMode?: Record<string, string>;
    GPBillingAddressFormat?: Record<string, string>;
    iStatus?: Record<string, string>;
    memberWalletRequests?: Record<string, Record<string, unknown>>;
  }
}

type Props = {
  chargeId: string;
  amount: number;
  memberName: string;
  memberEmail: string;
  allowOpenAmount?: boolean;
};

type PaymentResult = {
  approved?: boolean;
  receiptGenerated?: boolean;
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
  const applePaySession = window.ApplePaySession;

  return Boolean(
    applePaySession &&
      (typeof applePaySession.canMakePayments !== "function" ||
        applePaySession.canMakePayments())
  );
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

function isSolaWalletRequestError(reason: unknown) {
  return String(reason).includes("defPaymentRequest");
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

function getMemberApplePayRequestObject(requestName: string) {
  return window.memberWalletRequests?.[requestName] as
    | { initAP?: () => Record<string, unknown> }
    | undefined;
}

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
  const formRef = useRef<HTMLFormElement>(null);
  const walletsConfiguredRef = useRef(false);
  const walletConfigureAttemptsRef = useRef(0);
  const walletKey = chargeId.replace(/[^a-zA-Z0-9]/g, "");
  const applePayContainerId = `ap-container-${walletKey}`;
  const googlePayIframeId = `igp-${walletKey}`;
  const requestName = `charge${walletKey}`;

  const [open, setOpen] = useState(false);
  const [scriptReady, setScriptReady] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [walletSubmitting, setWalletSubmitting] = useState(false);
  const [message, setMessage] = useState("");
  const [success, setSuccess] = useState(false);
  const [applePayAvailable, setApplePayAvailable] = useState(false);
  const [applePayButtonReady, setApplePayButtonReady] = useState(false);
  const [applePayLoadFailed, setApplePayLoadFailed] = useState(false);
  const [applePayFailureReason, setApplePayFailureReason] = useState("");
  const [, setGooglePaySupported] = useState(false);
  const [googlePayReady, setGooglePayReady] = useState(false);
  const [walletConfig, setWalletConfig] =
    useState<WalletConfig>(initialWalletConfig);
  const applePayConfigured =
    walletConfig.applePayEnabled;
  const googlePayConfigured = false;

  function getPaymentPayload() {
    const form = formRef.current;
    const formData = form ? new FormData(form) : new FormData();

    return {
      chargeId,
      amount: allowOpenAmount
        ? String(formData.get("amount") || "")
        : undefined,
      email: String(formData.get("email") || memberEmail || ""),
    };
  }

  function getWalletAmount() {
    const paymentAmount = allowOpenAmount
      ? Number(getPaymentPayload().amount || 0)
      : amount;

    return Number.isFinite(paymentAmount) && paymentAmount > 0
      ? paymentAmount.toFixed(2)
      : "0.00";
  }

  async function submitWalletPayment(
    walletType: "ApplePay" | "GooglePay",
    payload: unknown
  ) {
    setWalletSubmitting(true);
    setMessage("");
    setSuccess(false);

    const response = await fetch("/api/sola/payment", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...getPaymentPayload(),
        walletType,
        payload,
      }),
    });

    const text = await response.text();
    const result = text ? (JSON.parse(text) as PaymentResult) : {};

    if (!response.ok) {
      throw new Error(
        result.error || "The wallet payment could not be charged."
      );
    }

    setSuccess(true);
    setMessage(
      result.receiptGenerated
        ? "Payment approved. Your receipt is ready below and has been emailed."
        : "Payment approved. Your receipt is still being prepared."
    );
    router.refresh();

    return text;
  }

  function configureWallets() {
    if (!open || !walletConfig.loaded || walletsConfiguredRef.current) {
      return;
    }

    const needsApplePay = applePayConfigured && isApplePaySupported();
    const needsGooglePay = googlePayConfigured;
    const applePayMissing = needsApplePay && !window.ckApplePay;
    const googlePayMissing = needsGooglePay && !window.ckGooglePay;

    if (applePayMissing || googlePayMissing) {
      walletConfigureAttemptsRef.current += 1;

      if (walletConfigureAttemptsRef.current <= 30) {
        window.setTimeout(configureWallets, 150);
      } else if (applePayMissing) {
        setApplePayLoadFailed(true);
      }

      return;
    }

    walletsConfiguredRef.current = true;

    window.memberWalletRequests ||= {};

    if (needsApplePay && window.ckApplePay) {
      setApplePayLoadFailed(false);
      setApplePayFailureReason("");

      window.memberWalletRequests[requestName] = {
        buttonOptions: {
          buttonContainer: applePayContainerId,
          buttonColor: window.APButtonColor?.black || "black",
          buttonType: window.APButtonType?.pay || "pay",
        },
        onGetTransactionInfo() {
          const totalAmount = getWalletAmount();

          return {
            lineItems: [
              {
                label: "Member charge",
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
        onValidateMerchant(validationUrl?: string) {
          if (!validationUrl) {
            throw new Error("Apple Pay did not provide a validation URL.");
          }

          return fetch("https://api.cardknox.com/applepay/validate", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ validationUrl }),
          }).then(async (response) => {
            const text = await response.text();

            if (!response.ok) {
              throw new Error(text || "Apple Pay merchant validation failed.");
            }

            return text;
          });
        },
        onPaymentAuthorize(applePayload: unknown) {
          return submitWalletPayment("ApplePay", applePayload).finally(() =>
            setWalletSubmitting(false)
          );
        },
        onPaymentComplete(paymentComplete: Record<string, unknown>) {
          if (paymentComplete.response) {
            setSuccess(true);
          } else if (paymentComplete.error) {
            setMessage("Apple Pay could not complete this payment.");
          }
        },
        apButtonLoaded(resp: Record<string, unknown>) {
          if (!resp) return;

          if (resp.status === window.iStatus?.success) {
            setMessage("");
            setApplePayButtonReady(true);
            setApplePayLoadFailed(false);
            setApplePayFailureReason("");
          } else if (resp.reason) {
            console.info("MEMBER_APPLE_PAY_BUTTON_NOT_LOADED", resp.reason);
            setApplePayLoadFailed(true);
            setApplePayFailureReason(String(resp.reason));
          }
        },
        initAP() {
          return {
            buttonOptions: {
              buttonContainer: applePayContainerId,
              buttonColor: window.APButtonColor?.black || "black",
              buttonType: window.APButtonType?.pay || "pay",
            },
            merchantIdentifier:
              walletConfig.applePayMerchantId || "merchant.cardknox.com",
            requiredBillingContactFields: [
              "postalAddress",
              "name",
              "phone",
              "email",
            ],
            requiredShippingContactFields: [
              "postalAddress",
              "name",
              "phone",
              "email",
            ],
            onGetTransactionInfo: `memberWalletRequests.${requestName}.onGetTransactionInfo`,
            onValidateMerchant: `memberWalletRequests.${requestName}.onValidateMerchant`,
            onPaymentAuthorize: `memberWalletRequests.${requestName}.onPaymentAuthorize`,
            onPaymentComplete: `memberWalletRequests.${requestName}.onPaymentComplete`,
            onAPButtonLoaded: `memberWalletRequests.${requestName}.apButtonLoaded`,
            isDebug: walletConfig.applePayDebug,
          };
        },
      };

      try {
        const applePayResult = window.ckApplePay.enableApplePay({
          initFunction: () =>
            getMemberApplePayRequestObject(requestName)?.initAP?.(),
          amountField: `amount-${walletKey}`,
        });

        catchSolaWalletPromise(applePayResult, (error) => {
          console.info("MEMBER_APPLE_PAY_NOT_ENABLED_ASYNC", error);
          setApplePayLoadFailed(true);
          setApplePayFailureReason(String(error));
        });
      } catch (error) {
        console.info("MEMBER_APPLE_PAY_NOT_ENABLED", error);
        setApplePayLoadFailed(true);
        setApplePayFailureReason(String(error));
      }
    }

    if (googlePayConfigured && window.ckGooglePay) {
      window.memberWalletRequests[requestName] = {
        ...(window.memberWalletRequests[requestName] || {}),
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
        environment: walletConfig.googlePayEnvironment,
        onGetGoogleTransactionInfo() {
          const totalPrice = getWalletAmount();

          return {
            countryCode: "US",
            currencyCode: "USD",
            totalPriceStatus: "FINAL",
            totalPrice,
            totalPriceLabel: "Khal Bnei Aliya",
            displayItems: [
              {
                label: "Member charge",
                type: "LINE_ITEM",
                price: totalPrice,
                status: "FINAL",
              },
            ],
          };
        },
        onProcessPayment(googlePayload: unknown) {
          return submitWalletPayment("GooglePay", googlePayload).finally(() =>
            setWalletSubmitting(false)
          );
        },
        gpButtonLoaded(resp: Record<string, unknown>) {
          if (resp?.reason) {
            console.info("MEMBER_GOOGLE_PAY_BUTTON_NOT_LOADED", resp.reason);
          }
        },
        initGP() {
          const request = window.memberWalletRequests?.[requestName] || {};

          return {
            merchantInfo: request.merchantInfo,
            buttonOptions: request.buttonOptions,
            onGetTransactionInfo: `memberWalletRequests.${requestName}.onGetGoogleTransactionInfo`,
            environment: request.environment,
            billingParameters: request.billingParams,
            onProcessPayment: `memberWalletRequests.${requestName}.onProcessPayment`,
            onGPButtonLoaded: `memberWalletRequests.${requestName}.gpButtonLoaded`,
          };
        },
      };

      setGooglePayReady(true);
    }
  }

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
    configureWallets();
  };

  useEffect(() => {
    const handleWalletRejection = (event: PromiseRejectionEvent) => {
      if (!isSolaWalletRequestError(event.reason)) {
        return;
      }

      event.preventDefault();
      console.info("MEMBER_SOLA_WALLET_REQUEST_NOT_AVAILABLE", event.reason);
      setGooglePayReady(false);
      setGooglePaySupported(false);
    };

    window.addEventListener("unhandledrejection", handleWalletRejection);

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
        console.info("MEMBER_WALLET_CONFIG_NOT_LOADED", error);
        setWalletConfig({
          ...initialWalletConfig,
          loaded: true,
        });
      });

    window.setTimeout(() => {
      setApplePayAvailable(isApplePaySupported());
      setGooglePaySupported(isGooglePaySupportedBrowser());
    }, 0);

    return () => {
      window.removeEventListener("unhandledrejection", handleWalletRejection);
    };
  }, []);

  useEffect(() => {
    if (open && window.setAccount) {
      window.setTimeout(configureIFields, 0);
    }
  }, [open]);

  useEffect(() => {
    if (open && scriptReady && walletConfig.loaded) {
      window.setTimeout(configureWallets, 0);
    }
  }, [open, scriptReady, walletConfig]);

  useEffect(() => {
    if (!googlePayReady || !window.ckGooglePay) {
      return;
    }

    window.setTimeout(() => {
      try {
        const googlePayResult = window.ckGooglePay?.enableGooglePay({
          amountField: `amount-${walletKey}`,
          iframeField: googlePayIframeId,
        });

        catchSolaWalletPromise(googlePayResult, (error) => {
          console.info("MEMBER_GOOGLE_PAY_NOT_ENABLED_ASYNC", error);
          setGooglePayReady(false);
          setGooglePaySupported(false);
        });
      } catch (error) {
        console.info("MEMBER_GOOGLE_PAY_NOT_ENABLED", error);
        setGooglePayReady(false);
        setGooglePaySupported(false);
      }
    }, 0);
  }, [googlePayReady, googlePayIframeId, walletKey]);

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
        id={`sola-ifields-script-${walletKey}`}
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
        <form ref={formRef} onSubmit={handleSubmit} className="space-y-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-bold text-slate-900">Charge card</p>
              <p className="mt-1 text-xs text-slate-500">
                {allowOpenAmount
                  ? "Amount: choose below"
                  : `Amount: $${amount.toFixed(2)}`}
              </p>
            </div>

            <div className="flex min-w-[220px] flex-wrap items-center gap-2">
              {applePayConfigured ? (
                <>
                  <div
                    id={applePayContainerId}
                    className={
                      applePayAvailable
                        ? "min-h-[40px] min-w-[130px] flex-1"
                        : "hidden"
                    }
                  />
                  {!applePayAvailable && (
                    <button
                      type="button"
                      disabled
                      className="rounded-full bg-black px-4 py-2 text-xs font-bold text-white opacity-45"
                      title="Apple Pay is available only on supported Apple devices."
                    >
                      Apple Pay
                    </button>
                  )}
                  {applePayAvailable &&
                    !applePayButtonReady &&
                    !applePayLoadFailed && (
                      <p className="text-xs font-semibold text-slate-500">
                        Loading Apple Pay...
                      </p>
                    )}
                  {applePayLoadFailed && (
                    <p className="basis-full rounded-lg bg-amber-50 p-2 text-xs font-semibold text-amber-900">
                      Apple Pay unavailable:{" "}
                      {applePayFailureReason ||
                        "Sola did not load the button."}
                    </p>
                  )}
                </>
              ) : (
                <button
                  type="button"
                  disabled
                  className="rounded-full bg-black px-4 py-2 text-xs font-bold text-white opacity-45"
                  title="Set up Sola/Cardknox Apple Pay merchant credentials before enabling."
                >
                  Apple Pay
                </button>
              )}

              {googlePayConfigured && googlePayReady ? (
                <iframe
                  id={googlePayIframeId}
                  title="Google Pay"
                  data-ifields-id={googlePayIframeId}
                  data-ifields-oninit={`memberWalletRequests.${requestName}.initGP`}
                  src={`${IFIELDS_BASE}/igp.htm`}
                  allow="payment *"
                  sandbox="allow-popups allow-modals allow-scripts allow-same-origin allow-forms allow-popups-to-escape-sandbox allow-top-navigation"
                  className="h-[40px] min-w-[130px] flex-1 border-0"
                />
              ) : null}

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
                id={`amount-${walletKey}`}
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

          {!allowOpenAmount && (
            <input
              id={`amount-${walletKey}`}
              name="amount"
              type="hidden"
              value={amount.toFixed(2)}
              readOnly
            />
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
            disabled={submitting || walletSubmitting || !scriptReady}
            className="rounded-full bg-[#1d2940] px-5 py-2.5 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-50"
          >
            {submitting || walletSubmitting
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
