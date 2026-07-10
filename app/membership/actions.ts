"use server";

import { redirect } from "next/navigation";
import { Resend } from "resend";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

type FamilyMemberInput = {
  first_name: string;
  last_name: string;
  hebrew_name: string;
  relationship: string;
  tribe_status: string;
  include_on_mishaberach_card: boolean;
};

function getString(formData: FormData, key: string) {
  return String(formData.get(key) || "").trim();
}

function getOptionalNumber(formData: FormData, key: string) {
  const rawValue = getString(formData, key);

  if (!rawValue) {
    return null;
  }

  const value = Number(rawValue);

  return Number.isFinite(value) ? value : null;
}

function parseFamilyMembers(value: string): FamilyMemberInput[] {
  return value
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [firstName, lastName, hebrewName, relationship] = line
        .split("|")
        .map((part) => part.trim());

      return {
        first_name: firstName || "",
        last_name: lastName || "",
        hebrew_name: hebrewName || "",
        relationship: relationship || "Child",
        tribe_status: "Yisroel",
        include_on_mishaberach_card: true,
      };
    })
    .filter((person) => Boolean(person.first_name));
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

export async function submitMembershipApplication(
  formData: FormData
) {
  const firstName = getString(formData, "first_name");
  const lastName = getString(formData, "last_name");
  const email = getString(formData, "email").toLowerCase();
  const phone = getString(formData, "phone");
  const address = getString(formData, "address");

  const hebrewName = getString(formData, "hebrew_name");
  const tribeStatus =
    getString(formData, "tribe_status") || "Yisroel";

  const spouseFirstName = getString(
    formData,
    "spouse_first_name"
  );

  const spouseLastName = getString(
    formData,
    "spouse_last_name"
  );

  const spouseHebrewName = getString(
    formData,
    "spouse_hebrew_name"
  );

  const spouseEmail = getString(
    formData,
    "spouse_email"
  ).toLowerCase();

  const spousePhone = getString(
    formData,
    "spouse_phone"
  );

  const spouseTribeStatus =
    getString(formData, "spouse_tribe_status") ||
    "Yisroel";

  const membershipType =
    getString(formData, "membership_type") || "Family";

  const requestedDuesAmount = getOptionalNumber(
    formData,
    "requested_dues_amount"
  );

  const notes = getString(formData, "notes");

  if (!firstName || !lastName || !email) {
    redirect(
      "/membership?error=First%20name%2C%20last%20name%2C%20and%20email%20are%20required."
    );
  }

  const agreedToTerms =
    formData.get("agreed_to_terms") === "on";

  if (!agreedToTerms) {
    redirect(
      "/membership?error=Please%20confirm%20the%20application%20agreement."
    );
  }

  const { data: existingApplication, error: existingError } =
    await supabaseAdmin
      .from("membership_applications")
      .select("id, status")
      .ilike("email", email)
      .eq("status", "pending")
      .maybeSingle();

  if (existingError) {
    console.error(
      "MEMBERSHIP_APPLICATION_LOOKUP_ERROR",
      existingError
    );

    throw new Error(existingError.message);
  }

  if (existingApplication) {
    redirect(
      "/membership?error=A%20pending%20application%20already%20exists%20for%20this%20email."
    );
  }

  const familyMembers = parseFamilyMembers(
    getString(formData, "family_members")
  );

  if (spouseFirstName) {
    familyMembers.unshift({
      first_name: spouseFirstName,
      last_name: spouseLastName || lastName,
      hebrew_name: spouseHebrewName,
      relationship: "Spouse",
      tribe_status: spouseTribeStatus,
      include_on_mishaberach_card: true,
    });
  }

  const now = new Date().toISOString();

  const { data: application, error: insertError } =
    await supabaseAdmin
      .from("membership_applications")
      .insert({
        first_name: firstName,
        last_name: lastName,
        email,
        phone: phone || null,
        address: address || null,

        hebrew_name: hebrewName || null,
        tribe_status: tribeStatus,

        spouse_first_name: spouseFirstName || null,
        spouse_last_name: spouseLastName || null,
        spouse_hebrew_name: spouseHebrewName || null,
        spouse_email: spouseEmail || null,
        spouse_phone: spousePhone || null,

        membership_type: membershipType,
        requested_dues_amount: requestedDuesAmount,

        notes: notes || null,
        family_members: familyMembers,
        agreed_to_terms: agreedToTerms,

        status: "pending",
        updated_at: now,
      })
      .select("id")
      .single();

  if (insertError || !application) {
    console.error(
      "MEMBERSHIP_APPLICATION_ERROR",
      insertError
    );

    throw new Error(
      insertError?.message ||
        "Unable to save the membership application."
    );
  }

  const resendApiKey = process.env.RESEND_API_KEY;
  const adminEmail = process.env.MEMBERSHIP_ADMIN_EMAIL;

  const fromEmail =
    process.env.MEMBERSHIP_FROM_EMAIL ||
    "Khal Bnei Aliya <onboarding@resend.dev>";

  const siteUrl =
    process.env.NEXT_PUBLIC_SITE_URL ||
    "http://localhost:3000";

  if (resendApiKey && adminEmail) {
    try {
      const resend = new Resend(resendApiKey);

      const reviewUrl =
        `${siteUrl}/admin/membership-applications/${application.id}`;

      const safeFirstName = escapeHtml(firstName);
      const safeLastName = escapeHtml(lastName);
      const safeEmail = escapeHtml(email);
      const safePhone = escapeHtml(phone || "Not provided");
      const safeMembershipType =
        escapeHtml(membershipType);

      const { error: emailError } =
        await resend.emails.send({
          from: fromEmail,
          to: [adminEmail],
          subject:
            `New membership application: ${firstName} ${lastName}`,
          html: `
            <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #172033;">
              <h2 style="margin-bottom: 16px;">
                New Membership Application
              </h2>

              <p>
                A new membership application was submitted for
                <strong>${safeFirstName} ${safeLastName}</strong>.
              </p>

              <p>
                <strong>Email:</strong> ${safeEmail}<br />
                <strong>Phone:</strong> ${safePhone}<br />
                <strong>Membership type:</strong> ${safeMembershipType}
              </p>

              <p style="margin-top: 24px;">
                <a
                  href="${reviewUrl}"
                  style="
                    display: inline-block;
                    background: #1d2940;
                    color: #ffffff;
                    text-decoration: none;
                    padding: 12px 20px;
                    border-radius: 999px;
                    font-weight: bold;
                  "
                >
                  Review Application
                </a>
              </p>

              <p style="margin-top: 20px; font-size: 13px; color: #64748b;">
                Application ID: ${application.id}
              </p>
            </div>
          `,
        });

      if (emailError) {
        console.error(
          "MEMBERSHIP_ADMIN_NOTIFICATION_ERROR",
          emailError
        );
      }
    } catch (emailError) {
      /*
       * The application has already been saved.
       * An email problem must not erase or fail the application.
       */
      console.error(
        "MEMBERSHIP_ADMIN_NOTIFICATION_ERROR",
        emailError
      );
    }
  } else {
    console.warn(
      "Membership application saved, but admin notification email is not configured."
    );
  }

  redirect("/membership?submitted=1");
}