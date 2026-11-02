# Returned Enquiry Editing and Saved Access

The return-to-BD action writes RETURNED_TO_BD on both enquiry and KYC case. That KYC status was missing from the edit allowlist, causing the editor to redirect to details and backend saves to be rejected even with Enquiries Edit permission.

Enquiry list, details and editor now share one frontend policy: use the saved enquiries.edit grant when the matrix is configured, otherwise existing role defaults. A linked RETURNED_TO_BD case is a preparation state. Non-AML, non-admin users may edit only draft/returned enquiries; review-stage cases remain locked. Backend applies the same state restriction after RolesGuard checks the saved matrix, retaining tenant isolation and existing administrator behavior. Granting Edit does not override workflow locks or confer reviewer authority.

Authentication permissions refresh on window focus/visibility and same-browser access-update events. An editor waits for initial authentication before checking access. Saving access also notifies other same-origin browser tabs; other browsers refresh when focused. No polling or JWT role manipulation is used. Backend permission checks remain authoritative on every action.

No database migration or data rewrite. Synthetic tests cover Edit/View/None, returned vs active-review cases, frontend/backend parity and tenant-filtered queries. Separate pending access-hardening work is not required for this correction and must not be bundled without review.
