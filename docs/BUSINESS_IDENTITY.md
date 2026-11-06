# Eldritch Fable business evidence

Owner-supplied documents were read as text and visually reviewed on November 6,
2026 (America/New_York). This is a record of what the supplied files say; no
government registry, filing acceptance or current tax-account status was checked.

The source-safe data is [business-profile.json](../standalone/src/config/business-profile.json).
It is reference data only: it is not imported into the current application and
does not configure Stripe, enable checkout or change legal page content.

| Field | Evidence from the supplied files |
| --- | --- |
| Business name | ELDRITCH FABLE LLC appears in both documents. |
| Brand name | Eldritch Fable. |
| Entity description and jurisdiction | The supplied Articles describe a Kentucky limited liability company. |
| Formation evidence | The file called LLC Certification.pdf is Articles of Organization with a large DRAFT watermark, not an accepted-filing certificate. |
| Stated effective date | The draft says September 30, 2026; filing acceptance and effective formation remain unverified. |
| Management | The draft says member-managed. The EIN notice addressee includes SOLE MBR; neither establishes the current ownership roster. |
| EIN evidence | A supplied IRS CP575G notice dated September 24, 2026 contains an EIN and name control; the values remain private. |
| Address evidence | Both files contain the same principal/mailing address; the draft also uses it for the registered office. The full address remains private, and its current head-office use has not been confirmed. |
| Corporate tax election | Neither supplied file establishes an S-corporation or C-corporation election. |
| Sales tax | No sales-tax permit, registration number, jurisdiction list or filing enrollment was supplied. |

## Private packet

The owner has a private packet containing the original, unmodified PDFs, a
structured `business-profile.private.json`, source SHA-256 digests and a README
for Codex/Copilot. The packet identifies the supplied draft accurately and keeps
unverified account/registration statuses explicit. It is retained separately
from this public repository and application web roots.

Agents requiring private values must use an authorized private copy mounted
outside the repository, `standalone/src/`, `standalone/public/` and build output.
The connected project host has a protected copy; the owner-held packet contains
its exact location. A different Codex or Copilot session does not automatically
inherit this chat's attachments or server access. Read these source notes after
fetching the shared branch, then use the private packet only if the task needs it.

Do not commit the PDFs, EIN, full address, personal names or private profile. Do
not paste them into issues, PRs, build logs, screenshots for delivery or browser
code. Git ignore rules help prevent accidental additions; they are not an access
control or protection against files that are already tracked.

## Applying these records to payment work

Use the documented business name consistently. Treat the private address as
documented input pending confirmation of its current operational role. Preserve
the original files when an authorized provider requests documentary evidence.
Do not treat draft Articles as approved formation evidence, infer sales-tax
registrations from an EIN or LLC document, or infer a corporate election from
general explanatory text in the IRS notice.

These inputs do not by themselves complete payment onboarding. Accepted formation
evidence when required, current business details, any applicable confirmed sales-
tax registrations, product classifications, shipping inputs, protected API keys
and an actual sandbox exercise remain separate work. No provider configuration,
live payment activation, database migration or deployment was performed here.
