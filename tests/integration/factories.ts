// Fixture factories for integration tests. They build the dependency chain
// Clinic -> Doctor -> (AdminUser, Patient, WorkingHour, Appointment) using the
// real Prisma client against the test database.

import { AppointmentSource, AppointmentStatus } from "@prisma/client";

import { prisma } from "@/db/prisma";
import type { AdminSession } from "@/server/auth/getAdminSession";
import { getAvailability, type Slot } from "@/server/appointments/getAvailability";
import { hashPassword } from "@/lib/security/password";

let sequence = 0;
function uniqueSuffix(): string {
  sequence += 1;
  return `${Date.now().toString(36)}-${sequence}`;
}

export async function createClinic(
  overrides: Partial<{
    name: string;
    slug: string;
    defaultLocale: string;
    timezone: string;
    phone: string | null;
    email: string | null;
    address: string | null;
  }> = {},
) {
  const suffix = uniqueSuffix();
  return prisma.clinic.create({
    data: {
      name: overrides.name ?? `Test Clinic ${suffix}`,
      slug: overrides.slug ?? `test-clinic-${suffix}`,
      defaultLocale: overrides.defaultLocale ?? "pl",
      timezone: overrides.timezone ?? "Europe/Warsaw",
      phone: overrides.phone ?? null,
      email: overrides.email ?? null,
      address: overrides.address ?? null,
    },
  });
}

export async function createDoctor(
  clinicId: string,
  overrides: Partial<{ displayName: string; email: string; timezone: string }> = {},
) {
  const suffix = uniqueSuffix();
  return prisma.doctor.create({
    data: {
      clinicId,
      displayName: overrides.displayName ?? `Dr. Test ${suffix}`,
      email: overrides.email ?? `doctor-${suffix}@example.com`,
      timezone: overrides.timezone ?? "Europe/Warsaw",
    },
  });
}

/** Create a clinic and its single doctor in one step (the MVP shape). */
export async function createClinicWithDoctor(
  overrides: {
    clinic?: Parameters<typeof createClinic>[0];
    doctor?: Parameters<typeof createDoctor>[1];
  } = {},
) {
  const clinic = await createClinic(overrides.clinic);
  const doctor = await createDoctor(clinic.id, overrides.doctor);
  return { clinic, doctor };
}

export async function createAdminUser(
  clinicId: string,
  doctorId: string | null,
  overrides: Partial<{ email: string; password: string; role: string }> = {},
) {
  const suffix = uniqueSuffix();
  const passwordHash = await hashPassword(overrides.password ?? "correct horse");
  return prisma.adminUser.create({
    data: {
      clinicId,
      doctorId,
      email: overrides.email ?? `admin-${suffix}@example.com`,
      passwordHash,
      role: overrides.role ?? "owner",
    },
  });
}

/** Build an AdminSession object the way getAdminSession would return it. */
export function makeAdminSession(params: {
  adminUserId: string;
  clinicId: string;
  doctorId: string | null;
  role?: string;
  email?: string;
}): AdminSession {
  return {
    adminUserId: params.adminUserId,
    clinicId: params.clinicId,
    doctorId: params.doctorId,
    role: params.role ?? "owner",
    email: params.email ?? "admin@example.com",
  };
}

export type WorkingDayRow = {
  dayOfWeek: number;
  isActive: boolean;
  startTime: string;
  endTime: string;
};

/** Monday–Friday 09:00–17:00, weekend inactive (mirrors the seed default). */
export function weekdayHours(
  startTime = "09:00",
  endTime = "17:00",
): WorkingDayRow[] {
  return [1, 2, 3, 4, 5, 6, 7].map((dayOfWeek) => ({
    dayOfWeek,
    isActive: dayOfWeek <= 5,
    startTime,
    endTime,
  }));
}

/** All seven days active with the same window (guarantees availability). */
export function allWeekHours(
  startTime = "08:00",
  endTime = "18:00",
): WorkingDayRow[] {
  return [1, 2, 3, 4, 5, 6, 7].map((dayOfWeek) => ({
    dayOfWeek,
    isActive: true,
    startTime,
    endTime,
  }));
}

export async function setWorkingHours(
  clinicId: string,
  doctorId: string,
  days: WorkingDayRow[] = weekdayHours(),
) {
  await prisma.workingHour.deleteMany({ where: { clinicId, doctorId } });
  await prisma.workingHour.createMany({
    data: days.map((day) => ({ clinicId, doctorId, ...day })),
  });
}

export async function createPatient(
  clinicId: string,
  overrides: Partial<{
    firstName: string;
    lastName: string;
    phone: string;
    email: string;
  }> = {},
) {
  const suffix = uniqueSuffix();
  return prisma.patient.create({
    data: {
      clinicId,
      firstName: overrides.firstName ?? "Jan",
      lastName: overrides.lastName ?? "Kowalski",
      phone: overrides.phone ?? `+4860000${(sequence % 10000).toString().padStart(4, "0")}`,
      email: overrides.email ?? `patient-${suffix}@example.com`,
    },
  });
}

export async function createAppointment(params: {
  clinicId: string;
  doctorId: string;
  patientId: string;
  startsAt: Date;
  endsAt: Date;
  status?: AppointmentStatus;
  source?: AppointmentSource;
  cancelTokenHash?: string | null;
}) {
  return prisma.appointment.create({
    data: {
      clinicId: params.clinicId,
      doctorId: params.doctorId,
      patientId: params.patientId,
      startsAt: params.startsAt,
      endsAt: params.endsAt,
      status: params.status ?? AppointmentStatus.booked,
      source: params.source ?? AppointmentSource.public_booking,
      cancelTokenHash: params.cancelTokenHash ?? null,
    },
  });
}

export { AppointmentSource, AppointmentStatus };

/**
 * Return the earliest bookable slot for a doctor, scanning every day in the
 * booking window. Throws when no slot exists so tests fail loudly instead of
 * silently booking nothing.
 */
export async function firstAvailableSlot(params: {
  clinicId: string;
  doctorId: string;
  timeZone: string;
  now?: Date;
}): Promise<Slot> {
  const days = await getAvailability(params);
  for (const day of days) {
    if (day.slots.length > 0) {
      return day.slots[0];
    }
  }
  throw new Error("No available slot found for fixture");
}
