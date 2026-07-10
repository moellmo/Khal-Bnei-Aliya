"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type Props = {
  paymentId: string;
};

export default function GenerateReceiptButton({
  paymentId,
}: Props) {
  const router = useRouter();

  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState("");

  async function generateReceipt() {
    setSubmitting(true);
    setMessage("");

    try {
      const response = await fetch(
        `/api/member/receipts/${paymentId}/generate`,
        {
          method: "POST",
        }
      );

      const result = await response.json();

      if (!response.ok) {
        throw new Error(
          result.error || "Unable to generate the receipt."
        );
      }

      setMessage("Receipt generated.");
      router.refresh();
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Unable to generate the receipt."
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex flex-col items-end gap-2">
      <button
        type="button"
        onClick={generateReceipt}
        disabled={submitting}
        className="rounded-full border border-[#8b6b2e] px-4 py-2 text-sm font-bold text-[#8b6b2e] hover:bg-[#f7f3ea] disabled:cursor-not-allowed disabled:opacity-50"
      >
        {submitting ? "Generating…" : "Generate Receipt"}
      </button>

      {message ? (
        <p className="max-w-[240px] text-right text-xs text-slate-500">
          {message}
        </p>
      ) : null}
    </div>
  );
}