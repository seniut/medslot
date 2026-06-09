import { expect, it } from "vitest";

import { describeDb } from "./db";

import { getActiveClinic } from "@/server/clinic/getActiveClinic";
import { getClinicProfile } from "@/server/clinic/getClinicProfile";

import { createClinic, createClinicWithDoctor, createDoctor } from "./factories";

describeDb("active clinic resolution", () => {
  it("returns null when no clinic is configured", async () => {
    expect(await getActiveClinic()).toBeNull();
    expect(await getClinicProfile()).toBeNull();
  });

  it("exposes the clinic identity, contact details, and its doctor", async () => {
    const clinic = await createClinic({
      name: "FizjoAkademia",
      phone: "+48 600 123 456",
      email: "kontakt@example.com",
      address: "ul. Testowa 1, 00-000 Warszawa",
    });
    await createDoctor(clinic.id, { displayName: "mgr Test Doctor" });

    const active = await getActiveClinic();
    expect(active).not.toBeNull();
    expect(active?.name).toBe("FizjoAkademia");
    expect(active?.doctor?.displayName).toBe("mgr Test Doctor");

    const profile = await getClinicProfile();
    expect(profile).toEqual({
      name: "FizjoAkademia",
      doctorName: "mgr Test Doctor",
      phone: "+48 600 123 456",
      email: "kontakt@example.com",
      address: "ul. Testowa 1, 00-000 Warszawa",
    });
  });

  it("returns null contact fields and doctorName when unset", async () => {
    await createClinic({ name: "Bare Clinic" });

    const profile = await getClinicProfile();
    expect(profile).toEqual({
      name: "Bare Clinic",
      doctorName: null,
      phone: null,
      email: null,
      address: null,
    });
  });

  it("never exposes patient-bearing fields on the profile", async () => {
    const { clinic } = await createClinicWithDoctor({
      clinic: { name: "Scoped Clinic" },
    });
    expect(clinic.name).toBe("Scoped Clinic");

    const profile = await getClinicProfile();
    expect(Object.keys(profile ?? {})).toEqual([
      "name",
      "doctorName",
      "phone",
      "email",
      "address",
    ]);
  });
});
