// MedSlot data-retention sweep (GDPR/RODO storage limitation).
//
// Anonymizes patients whose most recent appointment is older than the
// configured retention window (RETENTION_MONTHS, default 24) and who have no
// future appointments. Intended to be run on a schedule (e.g. a cron job).
//
// Run with: pnpm retention:sweep
//
// Privacy: prints only aggregate counts — never patient names, emails, phone
// numbers, or note content.

import { prisma } from "../src/db/prisma";
import { retentionSweep } from "../src/server/retention/retentionSweep";

async function main(): Promise<void> {
  const summary = await retentionSweep();

  console.log("MedSlot retention sweep complete:");
  console.log(`  Retention window: ${summary.retentionMonths} month(s)`);
  console.log(`  Cutoff:           ${summary.cutoff}`);
  console.log(`  Scanned:          ${summary.scanned}`);
  console.log(`  Anonymized:       ${summary.anonymized}`);
  console.log(`  Skipped:          ${summary.skipped}`);
}

main()
  .catch((error) => {
    console.error("Retention sweep failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
