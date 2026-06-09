import { createNavigation } from "next-intl/navigation";
import { routing } from "./routing";

// Locale-aware navigation helpers. Always use these instead of next/link and
// next/navigation so locale prefixes are handled consistently.
export const { Link, redirect, usePathname, useRouter, getPathname } =
  createNavigation(routing);
