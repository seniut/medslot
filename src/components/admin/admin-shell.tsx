import type { ReactNode } from "react";

import { AdminNav } from "@/components/admin/admin-nav";

type AdminShellProps = {
  locale: string;
  email: string;
  children: ReactNode;
};

/**
 * Shared chrome for authenticated admin pages.
 *
 * Each protected page enforces the session itself (via `requireAdmin`) and then
 * wraps its content in this shell. Using a plain component instead of a Next
 * route-group layout keeps the route param types simple and predictable.
 */
export async function AdminShell({ locale, email, children }: AdminShellProps) {
  return (
    <div className="flex min-h-full flex-1 flex-col">
      <AdminNav locale={locale} email={email} />
      <div className="mx-auto w-full max-w-5xl flex-1 px-6 py-8">{children}</div>
    </div>
  );
}
