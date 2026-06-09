import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

const nextConfig: NextConfig = {
  // nodemailer is a Node-only package with dynamic requires; keep it external
  // so the server bundler does not try to inline it.
  serverExternalPackages: ["nodemailer"],
};

export default withNextIntl(nextConfig);
