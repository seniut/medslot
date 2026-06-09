# Prompt — Start a New Codex/Copilot Session

Copy this into Codex or GitHub Copilot Chat:

```text
You are working on the MedSlot project.

MedSlot is a Next.js + TypeScript + PostgreSQL + Prisma appointment calendar for healthcare professionals.

Read first:
- README.md
- AGENTS.md
- .github/copilot-instructions.md
- PLANS.md
- DECISIONS.md
- docs/01-product-spec.md
- docs/02-architecture.md
- docs/03-data-model.md
- docs/04-gdpr-rodo.md
- docs/05-i18n.md
- docs/07-runbook-dev-deploy.md

Main MVP:
- patient booking calendar;
- admin calendar;
- cancellation link;
- manual appointment creation;
- configurable working days/hours;
- patient history;
- internal notes;
- CSV export;
- Polish and English UI;
- GDPR/RODO-aware handling.

Rules:
- Do not expose patient data publicly.
- Do not create full medical documentation features unless explicitly requested.
- Use server-side validation.
- Use DB-level double-booking protection.
- Update docs/changelog/decisions when behavior changes.

First summarize the current repository state, then propose the next 3 concrete implementation steps.
```

