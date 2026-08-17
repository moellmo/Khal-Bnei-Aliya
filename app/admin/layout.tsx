import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { requirePortalAccess } from "@/lib/adminAccess";

export default async function AdminLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const requestHeaders = await headers();
  const pathname = requestHeaders.get("x-kba-pathname") || "";
  const isKiddushRoute =
    pathname === "/admin/kiddush" || pathname.startsWith("/admin/kiddush/");

  const { member } = await requirePortalAccess(
    isKiddushRoute ? ["admin", "kiddush_admin"] : ["admin"]
  );

  if (member.portal_role === "kiddush_admin" && !isKiddushRoute) {
    redirect("/admin/kiddush");
  }

  return children;
}
