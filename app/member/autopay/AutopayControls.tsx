"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type Props = {
  active: boolean;
  amount: number;
};

type Action =
  | "pause"
  | "resume"
  | "update_amount"
  | "cancel";

export default function AutopayControls({
  active,
  amount,
}: Props) {
  const router = useRouter();

  const [monthlyAmount, setMonthlyAmount] =
    useState(String(amount || ""));

  const [submitting, setSubmitting] =
    useState<Action | null>(null);

  const [message, setMessage] = useState("");
  const [success, setSuccess] = useState(false);

  async function runAction(
    action: Action,
    extra?: Record<string, unknown>
  ) {
    if (
      action === "cancel" &&
      !window.confirm(
        "Cancel automatic payments permanently? Future scheduled charges will stop."
      )
    ) {
      return;
    }

    if (
      action === "pause" &&
      !window.confirm(
        "Pause automatic payments? No future scheduled charges will run until you resume."
      )
    ) {
      return;
    }

    setSubmitting(action);
    setMessage("");
    setSuccess(false);

    try {
      const response = await fetch(
        "/api/member/sola/autopay/manage",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            action,
            ...extra,
          }),
        }
      );

      const result = await response.json();

      if (!response.ok) {
        throw new Error(
          result.error ||
            "Unable to update automatic payments."
        );
      }

      setSuccess(true);

      if (action === "pause") {
        setMessage("Automatic payments were paused.");
      } else if (action === "resume") {
        setMessage("Automatic payments were resumed.");
      } else if (action === "cancel") {
        setMessage("Automatic payments were cancelled.");
      } else {
        setMessage("The monthly amount was updated.");
      }

      router.refresh();

      if (action === "cancel") {
        router.push("/member/dashboard");
      }
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Unable to update automatic payments."
      );
    } finally {
      setSubmitting(null);
    }
  }

  return (
    <div className="mt-6 space-y-6">
      <section className="rounded-2xl border border-[#e3d9c7] bg-white p-5">
        <h3 className="text-lg font-bold">
          Monthly Amount
        </h3>

        <p className="mt-2 text-sm text-slate-500">
          Update the amount Sola charges each month.
        </p>

        <div className="mt-4 flex flex-col gap-3 sm:flex-row">
          <input
            type="number"
            min="1"
            step="0.01"
            value={monthlyAmount}
            onChange={(event) =>
              setMonthlyAmount(event.target.value)
            }
            className="w-full rounded-xl border border-[#d8cdb7] px-4 py-3 sm:max-w-[220px]"
          />

          <button
            type="button"
            disabled={Boolean(submitting)}
            onClick={() =>
              runAction("update_amount", {
                amount: Number(monthlyAmount),
              })
            }
            className="rounded-xl bg-[#1d2940] px-5 py-3 font-bold text-white disabled:opacity-50"
          >
            {submitting === "update_amount"
              ? "Updating…"
              : "Update Amount"}
          </button>
        </div>
      </section>

      <section className="rounded-2xl border border-[#e3d9c7] bg-white p-5">
        <h3 className="text-lg font-bold">
          Schedule Status
        </h3>

        <p className="mt-2 text-sm text-slate-500">
          {active
            ? "Automatic payments are currently active."
            : "Automatic payments are currently paused."}
        </p>

        <div className="mt-4 flex flex-wrap gap-3">
          {active ? (
            <button
              type="button"
              disabled={Boolean(submitting)}
              onClick={() => runAction("pause")}
              className="rounded-full border border-amber-300 bg-amber-50 px-5 py-2.5 text-sm font-bold text-amber-800 disabled:opacity-50"
            >
              {submitting === "pause"
                ? "Pausing…"
                : "Pause Automatic Payments"}
            </button>
          ) : (
            <button
              type="button"
              disabled={Boolean(submitting)}
              onClick={() => runAction("resume")}
              className="rounded-full bg-green-700 px-5 py-2.5 text-sm font-bold text-white disabled:opacity-50"
            >
              {submitting === "resume"
                ? "Resuming…"
                : "Resume Automatic Payments"}
            </button>
          )}

          <button
            type="button"
            disabled={Boolean(submitting)}
            onClick={() => runAction("cancel")}
            className="rounded-full border border-red-200 bg-white px-5 py-2.5 text-sm font-bold text-red-700 hover:bg-red-50 disabled:opacity-50"
          >
            {submitting === "cancel"
              ? "Cancelling…"
              : "Cancel Automatic Payments"}
          </button>
        </div>
      </section>

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
    </div>
  );
}