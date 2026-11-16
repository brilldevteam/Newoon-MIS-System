# Newoon MIS Architecture and QA Review Pack

Prepared for management, engineering and independent QA on 27 October 2026.

**Review status: draft for business and technical approval. Not a production-readiness certificate.**

Assessed application commit: `7da1a27a874e72d2f0b28f4910e48b12e1b0d24b`, local branch `bugfix-2026-10-27`. The owner reports a merge to main; that report is not verification of main or the server checkout. No server, client records, secrets or shared database were accessed. Pre-existing deleted/modified export fixtures and unrelated untracked documentation were excluded from this review's changes.

## Reading order

1. [Management review](MANAGEMENT_REVIEW.md): architecture, journeys, decision points and readiness recommendation.
2. [Workflow specification](WORKFLOWS.md): entry/exit rules and handoffs for all implemented business areas.
3. [Technical appendix](TECHNICAL_APPENDIX.md): complete source-derived route/API inventory, DTO fields, schema and enum vocabulary.
4. [Findings register](FINDINGS.md): observed implementation gaps, release risks and policy questions.
5. [QA handover](QA_HANDOVER.md): fixtures, role matrix, executable scenarios, evidence requirements and release gates.
6. [Endpoint coverage matrix](ENDPOINT_QA_MATRIX.md): one pending acceptance row for every registered API operation.
7. [Verification record](VERIFICATION.md): actual local checks, limitations and pending approvals.

The editable sources are Markdown. Management Word/PDF publication follows management's content review; it is deliberately not labelled approved or generated as a final report in this draft. Diagrams are editable Mermaid source. A renderer supporting Mermaid is required to display them graphically; the accompanying prose and tables remain readable without it.

## Coverage and traceability

The baseline contains 21 registered controllers, 118 HTTP operations, 30 frontend paths, 47 Prisma models and 26 enums. The generator follows local AppModule imports, then Module controller registrations; a controller on disk is not counted unless registered. No API was invoked to obtain the inventory. Nest/Express middleware, the static SPA fallback, CORS preflight and network infrastructure are discussed separately rather than counted as business controller endpoints.

Stable IDs: `WF-*` workflow, `R-*` business rule, `API-*` operation, `UI-*` frontend route, `F-*` finding, `B-*` policy question, `Q-*` QA scenario. API/UI IDs are hashes of method/path and path, respectively, so adding another endpoint does not renumber existing entries. `inventory.json` is the machine-readable companion. The endpoint matrix is an assignment checklist, not evidence of successful tests.

Regenerate only documentation with `node docs/architecture-review/generate-inventory.cjs` from the repository root. Regeneration records HEAD; repeat the human review when application source changes. The static analyzer follows same-service helper calls, not arbitrary dependency injection/runtime dispatch. It does not prove tenant isolation or complete response schemas. Inferred output contracts are explicitly labelled; staging contract capture remains required.

## Approval sequence

Business owner confirms B-01 through B-06 and expected process rules. Engineering triages F-01 through F-09 and proposes separately approved fixes. QA executes the full matrix against the agreed staging commit. Operations demonstrates backup/restore, migration and rollback. The release owner records go/no-go with links to evidence. No reviewer name, approval or test result is pre-filled.
