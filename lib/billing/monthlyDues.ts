import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { sendPaymentRequestEmail } from "@/lib/payments/sendPaymentRequestEmail";

type BillingMember = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  custom_dues_amount: number | null;
  recurring_amount: number | null;
  autopay_active: boolean | null;
};

type GenerateMonthlyDuesOptions = {
  billingMonth: number;
  billingYear: number;
  defaultAmount: number;
  dueDate: string;
  memberId?: string;
  sendEmails?: boolean;
};

function monthName(billingMonth: number, billingYear: number) {
  return new Intl.DateTimeFormat("en-US", {
    month: "long",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(billingYear, billingMonth - 1, 1)));
}

export function memberDuesAmount(
  member: Pick<BillingMember, "recurring_amount" | "custom_dues_amount">,
  defaultAmount: number
) {
  const recurringAmount = Number(member.recurring_amount || 0);
  const customAmount = Number(member.custom_dues_amount || 0);

  if (recurringAmount > 0) return recurringAmount;
  if (customAmount > 0) return customAmount;
  return defaultAmount;
}

export async function generateMonthlyDuesCharges({
  billingMonth,
  billingYear,
  defaultAmount,
  dueDate,
  memberId,
  sendEmails = true,
}: GenerateMonthlyDuesOptions) {
  let membersQuery = supabaseAdmin
    .from("members")
    .select(
      "id, first_name, last_name, email, custom_dues_amount, recurring_amount, autopay_active"
    )
    .eq("status", "active");

  if (memberId) {
    membersQuery = membersQuery.eq("id", memberId);
  }

  const { data: members, error: membersError } = await membersQuery;

  if (membersError) {
    throw new Error(membersError.message);
  }

  if (!members || members.length === 0) {
    throw new Error(
      memberId
        ? "The selected active member was not found."
        : "No active members were found."
    );
  }

  let createdCount = 0;
  let skippedCount = 0;
  let emailSentCount = 0;
  let emailSkippedCount = 0;
  const errors: string[] = [];

  for (const member of members as BillingMember[]) {
    try {
      const amount = memberDuesAmount(member, defaultAmount);

      if (!Number.isFinite(amount) || amount <= 0) {
        skippedCount += 1;
        continue;
      }

      const { data: existingCharge, error: existingError } =
        await supabaseAdmin
          .from("member_charges")
          .select("id")
          .eq("member_id", member.id)
          .eq("charge_type", "Membership Dues")
          .eq("billing_month", billingMonth)
          .eq("billing_year", billingYear)
          .maybeSingle();

      if (existingError) {
        throw new Error(existingError.message);
      }

      if (existingCharge) {
        skippedCount += 1;
        continue;
      }

      const month = monthName(billingMonth, billingYear);
      const description = member.autopay_active
        ? `${month} ${billingYear} membership dues - awaiting automatic payment`
        : `${month} ${billingYear} membership dues`;

      const { data: charge, error: insertError } = await supabaseAdmin
        .from("member_charges")
        .insert({
          member_id: member.id,
          charge_type: "Membership Dues",
          description,
          amount,
          status: "unpaid",
          due_date: dueDate,
          billing_month: billingMonth,
          billing_year: billingYear,
        })
        .select("id")
        .single();

      if (insertError || !charge) {
        throw new Error(
          insertError?.message || "Unable to create monthly dues charge."
        );
      }

      createdCount += 1;

      if (sendEmails) {
        const emailResult = await sendPaymentRequestEmail({
          recipient: member.email,
          memberFirstName: member.first_name || "Member",
          amount,
          chargeType: "Membership Dues",
          description,
          chargeId: charge.id,
          isOpenAmount: false,
        });

        if (emailResult.sent) {
          emailSentCount += 1;
        } else {
          emailSkippedCount += 1;
        }
      }
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unknown error";
      errors.push(
        `${member.first_name || ""} ${member.last_name || ""}`.trim() +
          `: ${message}`
      );
    }
  }

  return {
    createdCount,
    skippedCount,
    emailSentCount,
    emailSkippedCount,
    errors,
  };
}
