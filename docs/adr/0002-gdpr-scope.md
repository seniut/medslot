# ADR 0002 — GDPR/RODO Scope and Medical Documentation Boundary

Status: Accepted

## Context

The system handles patient contact data and appointment history. Doctor notes may accidentally include health-related information.

In Poland, physiotherapists have obligations around medical documentation. A full medical records system has higher legal and technical requirements.

## Decision

MVP will be positioned as:

- appointment calendar;
- basic visit history;
- internal administrative notes.

MVP will not be positioned as:

- full medical documentation system;
- diagnostic/treatment record system.

The notes UI must show a warning that the field is not full medical documentation unless legally/technically reviewed.

## Consequences

Positive:

- lower initial complexity;
- simpler product validation;
- clearer MVP scope.

Negative:

- some doctors may want full documentation support;
- this must be treated as a future module.

## Future work

If medical documentation module is added:

- legal review required;
- stronger audit trail;
- immutable/corrected record model;
- formal retention rules;
- patient access/export;
- encryption and access logging;
- documentation templates.

