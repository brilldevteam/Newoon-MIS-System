# KYC Client Profile: Requirements Checklist

Source documents (received 2026-11-22):

- **Doc 1**: "required Changes to MIS 1" (KYC required updates)
- **Doc 2**: "Entity and Individual profile creation"

Every field and request in both documents is listed below with an ID. Use the IDs in commits and tests, and keep
the Status column current. Nothing in this list may be dropped without the business confirming it.

Status values: **Exists** = in the current code · **Partial** = present but not as required · **Missing** = not built ·
**Confirm** = needs a business decision.

Cross-cutting rules (added 2026-11-22):

- **X1 Linked records.** One person = one `ClientPerson` record per client, holding any combination of roles
  (Shareholder, UBO, Director, Manager, Secretary, SEF, Authorised Signatory, Key Communication Person, executive
  titles). Every tab is a view of the same person; an edit in one place shows everywhere. Corporate shareholders
  link to an entity record so the chain to the UBO stays connected.
- **X2 Auto-fill everywhere.** Attaching a document (enquiry, KYC form, client profile, Legal Documents register)
  reads it and proposes field values. Staff confirm before saving. The upload also creates the Legal Documents
  entry and its Expiry entry.
- **X3 Matching.** A person is matched by QID or passport number first, name only as a fallback, and staff
  confirm "same person".

X1 and X3 are done on the client profile in Phase 1 (2026-11-22): adding a person whose name is already on the client
is refused and staff add the role to that person instead. X2 (auto-fill) is done for the legal documents register in
Phase 2 (all catalogue types D01-D14; CR reading can add the listed people with their roles); the enquiry and KYC form follow
in Phase 5.

---

## A. Entity profile fields (Doc 2)

| ID | Field | Source document (auto-fill) | In KYC (Doc 2) | Current status |
|---|---|---|---|---|
| E01 | Legal name of company | Commercial Registration | Yes | Exists (KYC A, client Company tab) |
| E02 | Commercial Registration no. | Commercial Registration | Yes | Exists |
| E03 | Date of incorporation | Commercial Registration | Yes | Exists |
| E04 | Commercial Registration expiry date | Commercial Registration | NA (client only) | Done (Phase 1 field; Phase 2: a CR document sets it and is listed on the Expiry tab) |
| E05 | Country of incorporation | Commercial Registration | Yes | Exists |
| E06 | Place of incorporation | Commercial Registration | NA | Done in Phase 1 (client profile) |
| E07 | Legal form | Commercial Registration | Yes | Exists |
| E08 | Registered office address | Commercial Registration | Yes | Exists |
| E09 | Share capital | Commercial Registration | NA | Done in Phase 1 (client profile) |
| E10 | Tax card no. (TIN) | Commercial Registration (also Tax card) | NA | Exists in KYC A and client page. **Confirm** whether to keep in the KYC form, since Doc 2 says NA |
| E11 | PO Box number | Manual | NA | Done in Phase 1 (client profile) |
| E12 | Telephone | Manual | Yes | Exists |
| E13 | Email | Manual | Yes | Exists |
| E14 | Website | Manual | Yes | Exists |
| E15 | Main purpose / nature of business | Manual | Yes | Exists (`businessNature`) |
| E16 | Related industry | Manual | Yes | Exists |
| E17 | License activities | Manual | Yes | Exists |
| E18 | Financial year end | Manual | NA | Done in Phase 1 (client profile) |
| E19 | Approved auditor name | Manual | NA | Done in Phase 1 (client profile) |

## B. Individual profile fields (Doc 2)

| ID | Field | Source document (auto-fill) | In KYC (Doc 2) | Current status |
|---|---|---|---|---|
| I01 | Title (Mr, Ms, Sheikh, Sheikha) | Manual | Yes | Done: client profile (Phase 1) and KYC form + printed KYC (Phase 5) |
| I02 | Full name | QID, manually corrected to match passport | Yes | Exists. Needs "read from QID, correct to passport" flow |
| I03 | Nationality | QID | Yes | Exists |
| I04 | QID number | QID | Yes | Exists (QID/passport split) |
| I05 | QID expiry date | QID | No | Decided 2026-11-23: hidden from the KYC form (never printed); kept in the system and fed by ID copies / the person profile |
| I06 | Date of birth | QID | (blank) | Exists. **Confirm** whether it is in KYC |
| I07 | Passport number, **several passports per person** | Passport | Yes | Done in Phase 1: several passports per person, one marked main (printed on the KYC) |
| I08 | Passport expiry date, per passport | Passport | No | Decided 2026-11-23: hidden from the KYC form (never printed); each passport expiry is kept and on the Expiry tab |
| I09 | Dual citizenship (Yes/No) | Manual | Yes | Done: per person on the client profile and on every KYC person row; Section D question kept (note shown when answers differ), people listed in the printed KYC |
| I10 | Designation (multi): Shareholder, Director, Authorised Signatory, Secretary, SEF, Manager, UBO; CEO, CFO, COO, Managing Director, General Manager, Chairman | Manual | Yes | Done: any number of roles per person on the client profile; KYC position list now has Managing Director, Chairman, CEO, CFO, COO, Shareholder, UBO (older three kept) |
| I11 | Key Communication Person (Yes/No) | Manual | Yes | Done in Phase 1: Key Communication Person is a role on the person. KYC Section E unchanged |
| I12 | Entity (represented entity name) | Manual | Yes | Done: client profile for every individual (Phase 1); KYC form already has Entity name on manager rows |
| I13 | Address | Manual | Yes | Exists |
| I14 | National address certificate expiry date | Manual | No | Done (Phase 1 field; Phase 2: a National Address document sets it) |
| I15 | Authorised Signatory (Yes/No) | Manual | Yes | Done in Phase 1: Authorised Signatory is a role on any person |
| I16 | Shareholder percentage (when designation includes Shareholder) | Manual | Yes | Exists (shareholder rows) |
| I17 | UBO percentage | Manual | Yes | Exists (UBO rows) |
| I18 | Telephone | Manual | No | Done in Phase 1 (client profile) |
| I19 | Email | Manual | No | Done in Phase 1 (client profile) |
| I20 | PEP (Yes/No) | Manual | Yes | Done: per person (with details) on the client profile and on every KYC person row; Section D question kept; people listed under Section D in the printed KYC |

## C. Legal Documents register (Doc 1 §6, Doc 2)

Columns, all visible per row:

| ID | Column | Current status |
|---|---|---|
| L01 | Document type (catalogue + custom "add option") | Done in Phase 2 (catalogue, plus Other with a name) |
| L02 | Nature: Company / Individual | Done in Phase 2 |
| L03 | Number | Done in Phase 2 |
| L04 | Name (entity or person, linked to the person record) | Done in Phase 2 (defaults to the company or the person) |
| L05 | Nationality / location | Done in Phase 2 |
| L06 | Expiry date, linked to the Expiry tab ("--" when none) | Done in Phase 2 (on the Expiry tab; CR and national address expiry also update the profile) |
| L07 | File (view; passport hidden from general staff, see R04) | Done (view copy in Phase 2; passports hidden from Accounting and HR in Phase 3) |
| L08 | Add, replace and delete at any time, outside KYC; audited with reason | Done in Phase 2 (replace keeps history; remove needs a reason; Operations allowed) |
| L09 | AML team informed on every add/replace/delete (automatic notification) | Done in Phase 2 (automatic notice to AML Team, AML Supervisor, DMLRO, MLRO) |

Document type catalogue (every type named in the documents; "add option" allows more):

| ID | Document type | Nature | Has expiry |
|---|---|---|---|
| D01 | Commercial Registration Extract (English) | Company | Yes |
| D02 | Commercial Registration Extract (Arabic) | Company | Yes |
| D03 | Public CR (public portal) | Company | Yes |
| D04 | Certificate of Incorporation | Company | No |
| D05 | Commercial License | Company | Yes |
| D06 | Computer card | Company | Yes |
| D07 | Articles of Association | Company | No |
| D08 | Tax card | Company | Yes |
| D09 | Company profile | Company | No |
| D10 | Organisation chart (Doc 1 §8, if available) | Company | No |
| D11 | QID | Individual | Yes |
| D12 | Passport (several per person) | Individual | Yes |
| D13 | National Address certificate | Individual | Yes |
| D14 | Power of attorney | Individual | No (**Confirm**) |

Already in the KYC checklist, to map into the catalogue: Latest Audited Financial Statements, CR of legal entity
parties, Signed Engagement Letter.

## D. Auto-fill map (X2)

| Document | Fields it proposes |
|---|---|
| CR / Public CR / QFC extract | E01–E09, E17 where printed, plus listed shareholders, directors and signatories → people with roles (I02, I03, I10, I16) |
| Commercial License | Number, expiry; licensed activities (E17) |
| Computer card | Number, expiry |
| Tax card | E10, number, expiry |
| QID | I02, I03, I04, I05, I06 |
| Passport | I02 (correction), I03, I07, I08, I06 |
| National Address certificate | I13, I14 |

### AI document reading (decided 2026-11-22)

| ID | Requirement | Current status |
|---|---|---|
| A01 | The tenant's admin can enter their own OpenAI API key in the application (Administration settings) | Done in Phase 2 (Administration > AI Document Reading) |
| A02 | The key is stored encrypted on the server, never sent back to the browser (shown masked), never logged, and can be replaced, tested and removed; every change is audited | Done in Phase 2 (AES-256-GCM with SETTINGS_ENCRYPTION_KEY; masked; test; remove; audited) |
| A03 | When a key is set, uploads are read by the AI service (scans, Arabic and any layout) and return the auto-fill fields in section D as structured data; staff still confirm before saving | Done in Phase 2 for the legal documents register (enquiry and KYC form: Phase 5). Not yet tried with a real key |
| A04 | Without a key, or if the AI call fails, the local server reader is used (digital PDF text layer, then local OCR for passport/QID) | Done in Phase 2 (PDF text layer, English OCR, passport / QID machine-readable lines) |
| A05 | Settings state that documents are sent to OpenAI when a key is set; the tenant chooses this by adding the key | Done in Phase 2 (warning on the settings page) |
| A06 | Provider layer is swappable (OpenAI first; other providers later) | Done in Phase 2 (provider field; OpenAI only for now) |
| A07 | Later: AI chat agent inside the application, using the same key and the same tenant/role access rules | Future, not in current scope |

## E. Other requests (Doc 1)

| ID | Request | Current status |
|---|---|---|
| R01 | Client declaration wording before the signature: "By signing this document, hereby confirm that all information and documents provided are true, complete and up to date. I am authorized to represent and sign this document on behalf of the entity set out in section A:" | Decided 2026-11-23: keep "I hereby confirm" (grammatical; the business text looks like a typo). In the KYC since 2026-11-15; the server needs this build |
| R02 | Client created only at KYC final approval, not at initial approval | Current code activates only at the engagement decision after final approval. The clients found active early in the local data (Aadhil, Brill Creations, Nexora, abc-new) were created active in July 2026 by older code and added to the register by the 2026-11-09 backfill. MLRO/SEF approval relabelled in Phase 0. **Confirm** with AML whether those clients should be reviewed |
| R03 | Tab order: Overview, Company, Shareholders, Directors and Managers, Authorised Signatory, SEF, Secretary, Legal Documents, Engagements, Compliance Documents, Expiry, UBO, KYC, CRRF, Screening, EDD | Done in Phase 0 (2026-11-22), incl. new Authorised Signatory and KYC tabs |
| R03a | Rename CDD to EDD | Done in Phase 0 (tab label + default folder migration) |
| R03b | Monitoring, Reviews & Risk "not understood" | Done in Phase 3: Monitoring and Reviews & Risk are sections of the EDD tab (AML, SEF, CEO group only); old links open EDD |
| R04 | Access group "all staff subject to client allocation": Overview, Company, Shareholders, Directors and Managers, Authorised Signatory, SEF, Secretary, Engagements, Legal Documents **except passport** | Done in Phase 3: Accounting and HR see only allocated clients, with these tabs and no passports (enforced by the API) |
| R05 | Access group "Operational team": R04 tabs + Legal Documents (incl. passport), Compliance Documents, Expiry | Done in Phase 3: Operations sees every client with these tabs (passports included); no UBO, KYC, CRRF, Screening or EDD |
| R06 | Access group "AML team, SEF and CEO": all tabs incl. UBO, KYC, CRRF, Screening, EDD | Done in Phase 3: new read-only CEO role; AML roles, SEF and CEO see every tab |
| R07 | Excel export includes every detail of the current CIS file | Built in Phase 4: four sheets (register, company details, people, legal documents) covering every field of the business documents. **Match to the CIS layout still needs the CIS file**; column lists are in client-export.ts |
| R08 | Expiry tab linked to Legal Documents; shows within 60 days, within 30 days, expired | Done in Phase 2 (filters Expired / 30 / 60 days) |
| R09 | Expiry list Excel download: document name and expiry date | Done in Phase 2 (per client and all clients) |
| R10 | Overview shows Company profile and Organisation chart | Done in Phase 2 |

## F. Phase 3 decisions (2026-11-22)

- **Client allocation**: Company Admin, AML Supervisor, DMLRO or MLRO assign one or more named users to each client on
  the client page; every change is audited.
- **"All staff subject to client allocation"** = ACCOUNTING_TEAM and HR_TEAM. They see only their allocated clients:
  Overview, Company, Shareholders, Directors & Managers, Authorised Signatory, SEF, Secretary, Engagements and Legal
  Documents without passports.
- **Operations** sees every client with the R05 tabs.
- **CEO**: a new CEO role with full read-only access, grouped with the AML roles and SEF for UBO, KYC, CRRF, Screening
  and EDD.
- **Monitoring and Reviews & Risk**: merged into the EDD area as sub-sections with plain-language explanations, AML /
  SEF / CEO group only.
- Visibility is enforced by the backend (data is not sent for hidden tabs); the frontend only hides what the API
  already refuses.

## G. Phase 5 decisions (2026-11-23)

- QID and passport expiry: hidden from the KYC form (not printed on the KYC); kept in the system.
- PEP and dual citizenship: per person on every KYC person row; the Section D questions stay; a person's Yes always wins over a No on another row.
- Positions: the new designations added, the older ones kept.
- Client declaration: keep "I hereby confirm".
