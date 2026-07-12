"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { sendPortalInvitationEmail } from "@/lib/members/sendPortalInvitationEmail";

type FamilyMemberInput = {
  first_name?: string;
  last_name?: string;
  hebrew_name?: string;
  relationship?: string;
  tribe_status?: string;
  include_on_mishaberach_card?: boolean;
};

async function getApplication(applicationId: string) {
  const { data, error } = await supabaseAdmin
    .from("membership_applications")
    .select("*")
    .eq("id", applicationId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  if (!data) {
    throw new Error("Membership application not found.");
  }

  return data;
}

export async function approveMembershipApplication(
  applicationId: string
) {
  const application = await getApplication(applicationId);

  if (application.status === "approved") {
    redirect(
      `/admin/membership-applications/${applicationId}?alreadyApproved=1`
    );
  }

  const { data: existingMember, error: existingMemberError } =
    await supabaseAdmin
      .from("members")
      .select("id, auth_user_id")
      .eq("email", application.email)
      .maybeSingle();

  if (existingMemberError) {
    throw new Error(existingMemberError.message);
  }

  let memberId = existingMember?.id || "";

  if (!existingMember) {
    const { data: newMember, error: memberError } =
      await supabaseAdmin
        .from("members")
        .insert({
          first_name: application.first_name,
          last_name: application.last_name,
          email: application.email,
          phone: application.phone,
          address: application.address,
          hebrew_name: application.hebrew_name,
          tribe_status:
            application.tribe_status || "Yisroel",
          membership_type: application.membership_type,
          custom_dues_amount:
            application.requested_dues_amount || 0,
          notes: application.notes,
          status: "active",
          portal_status: "not_invited",
          portal_role: "member",
        })
        .select("id")
        .single();

    if (memberError || !newMember) {
      throw new Error(
        memberError?.message || "Unable to create member."
      );
    }

    memberId = newMember.id;
  }

  const familyMembers =
    Array.isArray(application.family_members)
      ? (application.family_members as FamilyMemberInput[])
      : [];

  if (familyMembers.length > 0) {
    const rows = familyMembers
      .filter((person) => person.first_name)
      .map((person) => ({
        member_id: memberId,
        first_name: person.first_name,
        last_name: person.last_name || null,
        hebrew_name: person.hebrew_name || null,
        relationship: person.relationship || "Other",
        tribe_status: person.tribe_status || "Yisroel",
        include_on_mishaberach_card:
          person.include_on_mishaberach_card !== false,
      }));

    if (rows.length > 0) {
      const { error: familyError } = await supabaseAdmin
        .from("member_family_members")
        .insert(rows);

      if (familyError) {
        throw new Error(familyError.message);
      }
    }
  }

  const headerStore = await headers();

  const inviteResult = await sendPortalInvitationEmail({
    memberId,
    email: application.email,
    firstName: application.first_name,
    lastName: application.last_name,
    requestOrigin: headerStore.get("origin"),
  });

  if (!inviteResult.sent || !inviteResult.userId) {
    throw new Error(inviteResult.error || "Unable to send portal invitation.");
  }

  const now = new Date().toISOString();

  const { error: memberLinkError } = await supabaseAdmin
    .from("members")
    .update({
      auth_user_id: inviteResult.userId,
      portal_status: "invited",
      portal_invited_at: now,
      updated_at: now,
    })
    .eq("id", memberId);

  if (memberLinkError) {
    throw new Error(memberLinkError.message);
  }

  const { error: applicationUpdateError } =
    await supabaseAdmin
      .from("membership_applications")
      .update({
        status: "approved",
        reviewed_at: now,
        created_member_id: memberId,
        updated_at: now,
      })
      .eq("id", applicationId);

  if (applicationUpdateError) {
    throw new Error(applicationUpdateError.message);
  }

  revalidatePath("/admin/membership-applications");
  revalidatePath(`/admin/membership-applications/${applicationId}`);
  revalidatePath("/admin/members");

  redirect(
    `/admin/membership-applications/${applicationId}?approved=1`
  );
}

export async function rejectMembershipApplication(
  applicationId: string
) {
  const now = new Date().toISOString();

  const { error } = await supabaseAdmin
    .from("membership_applications")
    .update({
      status: "rejected",
      reviewed_at: now,
      updated_at: now,
    })
    .eq("id", applicationId)
    .eq("status", "pending");

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/admin/membership-applications");
  revalidatePath(`/admin/membership-applications/${applicationId}`);

  redirect(
    `/admin/membership-applications/${applicationId}?rejected=1`
  );
}
