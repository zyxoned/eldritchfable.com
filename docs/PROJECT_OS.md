# Project Operating System

This document is the operating system for the project. It defines how work moves from idea to implementation to deployment, how safety is enforced, how branches are used, and how user data is protected.

This project is not just a website. It is an operational system with:
- code
- design
- AI-assisted development
- deployment
- user data
- hosting
- backups
- monitoring
- launch readiness

The goal is simple:
- move quickly without creating chaos
- keep production safe
- keep user data protected
- keep review and accountability in place
- keep clear separation between experiments, docs, recovery work, and production

---

## 1. Core principles

1. Production is protected.
   - `main` is the production-safe branch.
   - direct pushes to `main` are not allowed.
   - all production changes go through pull requests and review.

2. Staging is the release gate.
   - no merge to production without staging validation.

3. Experiments are isolated.
   - demo/prototype work must not be mixed into live production code.

4. Recovery work is archival, not live application logic.
   - old source snapshots and recovery artifacts are separate from active runtime code.

5. User data is sensitive.
   - names and emails are personal data.
   - they must be handled as PII and protected accordingly.

6. AI-assisted work must be reviewed.
   - AI-generated changes are not automatically trusted.
   - all AI work must pass the same process as human-written work.

7. We operate with evidence.
   - build passes
   - tests pass
   - smoke checks pass
   - backups are verified
   - rollback is ready
   - monitoring is active

---

## 2. Branch map

Use clear and consistent branch names.

### Production
- `main`
  - production-ready only
  - protected
  - PR required
  - required checks before merge
  - no direct pushes

### Release candidate
- `staging`
  - used for candidate releases
  - validated before production deploy
  - must be safe and representative of production

### Feature development
- `feature/*`
  - normal app or platform work
  - merge through PR
  - must pass checks before staging or main

### Experimental / prototype work
- `demo/*`
  - isolated experiments
  - proof-of-concept or gameplay prototypes
  - not for live production unless explicitly approved
  - must remain separate from production logic

### Design / docs
- `docs/*`
  - architecture documents
  - launch plans
  - AI/authoring notes
  - product design decisions
  - can be merged via PR but should not affect runtime unless intentional

### Recovery / historical source
- `archive/*`
  - historical branches
  - recovery evidence
  - old snapshots
  - old source copies
  - not considered live production code

---

## 3. Required branch protection rules

### For `main`
Require:
- pull request before merge
- at least one review
- required status checks
- no direct push
- no force push to protected branches
- protected from accidental deletion
- branch must be in a deployable state

### Recommended status checks
- install/build succeeds
- unit tests pass
- smoke tests pass
- lint/format checks pass if used
- deployment health check passes
- backup verification passes before production deployment

---

## 4. Lifecycle of work

Every item of work follows the same path:

1. Start from the correct base branch
   - feature work from `main` or `staging`
   - demo work from a demo-safe base
   - recovery work from an archive branch

2. Create a focused branch
   - the branch name must clearly describe the change

3. Make changes in small, reviewable units
   - avoid giant hidden changes
   - keep code review manageable

4. Push branch to remote

5. Open a pull request
   - explain what the change does
   - note whether it is production, demo, docs, or recovery
   - include validation steps

6. Run CI
   - build
   - tests
   - minimal smoke checks

7. Review and approve
   - code review
   - logic review
   - security considerations
   - data/privacy review if relevant

8. Merge to staging
   - test in staging
   - verify behavior

9. Production deploy
   - only after staging is validated
   - only after health checks are green

10. Monitor after deployment
   - verify uptime
   - verify logs
   - verify key workflows
   - confirm rollback path exists

---

## 5. Production safety policy

Production is never a place for experimentation.

Rules:
- no ad hoc edits in production
- no unreviewed config changes
- no direct DB writes from ad hoc scripts
- no secrets in repo files
- no deployment from a local machine without a documented process
- no "temporary fix" without an issue/task and rollback plan

All production changes must be traceable:
- which branch
- which PR
- which commit
- what was tested
- what was deployed
- what is the rollback

---

## 6. Security and privacy rules

This project handles signup data and user identity. That means names and email addresses are PII.

Mandatory rules:
- treat all signup data as sensitive
- never store secrets in GitHub repos or issue descriptions
- never commit `.env` files
- use a secret manager or secure env file outside the repo
- separate dev/staging/prod credentials
- enable MFA on GitHub and hosting accounts
- restrict production access to known users
- do not log raw personal data in shared logs
- encrypt backups
- test restore procedures
- retain only the minimum necessary data
- keep privacy policy and user deletion flow in mind
- avoid exposing account details in shared debug output

### Safe handling of email and signup data
- use secure environment variables
- store and transmit with HTTPS only
- avoid sharing live emails in screenshots or logs
- do not use real customer data in staging
- validate mail flows in isolated testing
- monitor email sending and failures

---

## 7. AI operating rules

Because AI-assisted development is part of the workflow, it must be governed.

Rules:
- AI-generated changes belong to a branch like `feature/*` or `demo/*`
- AI-generated work is not automatically approved
- every AI change must be reviewed by a human
- prototypes must remain separate from production
- AI should not write or manage secrets
- AI should not directly operate production deployment without review
- AI-generated code must pass the same build/test/staging gates

The project should treat AI as a force multiplier, not as an uncontrolled production power source.

---

## 8. Launch readiness checklist

Before a production launch or big release, all of the following must be true:

### Code and release
- `main` is green
- build passes
- tests pass
- smoke checks pass
- staging is validated
- deployment steps are documented
- rollback path is defined

### Security and privacy
- secrets are externalized
- backups are encrypted and verified
- access is restricted
- MFA is active
- no secrets are in repo
- raw personal data is minimized in logs

### Data and signup workflows
- signup flow works end-to-end
- confirmation email flow works
- reset email flow works
- validation and error handling work
- no real customer data in staging
- email queue/transport is healthy

### Operational health
- monitoring is active
- alerts are configured
- uptime checks are running
- server health can be checked
- logs are accessible
- deployment history is visible

---

## 9. Demo and prototype boundaries

Experimental features must remain clearly separate.

### Demo branch rules
- keep prototype code isolated
- do not affect production routes or live data
- do not assume it is a production feature
- use a clear demo/prototype label
- validate without touching `main`

### Demo examples
- game prototypes
- MMO concept work
- experimental mechanics
- visual exploration
- concept validation branches

The project should maintain a healthy distinction between:
- what is happening in the lab
- what is approved
- what is production

---

## 10. Recovery and archive policy

Historical or recovered source is important, but it is not current production logic.

Rules:
- recovered source must be kept in archive or recovery branches
- archive work is evidence, not runtime
- old source does not automatically become active code
- do not merge historical material into `main` unless there is explicit reason and safety validation
- if historical content is used for reference, it must be clearly labeled as archived

This protects the project from accidentally resurrecting outdated or conflicting code.

---

## 11. Monitoring and observability

You need basic operational visibility.

At minimum:
- production health checks
- uptime monitoring
- deployment history
- CI status
- error logs
- storage/disk usage
- backup status
- database health
- email sending health
- key signup flows

A single dashboard is valuable only if it reflects actual truth:
- what is live
- what is deployed
- what failed
- what is healthy
- what needs attention

---

## 12. Rollback and incident response

Every deploy must have a rollback plan.

### Required rollback items
- known good previous build or commit
- deployment notes
- rollback command or script
- access to previous environment config
- ability to restore from backup
- incident owner

### If a production issue occurs:
1. pause deployment or revert if needed
2. verify the failure
3. identify the deploy scope
4. restore previous known-safe state
5. inspect logs
6. fix in a feature branch
7. retest in staging
8. redeploy only after validation

---

## 13. Decision-making model

The project should always know which work is:
- production
- staging
- demo
- docs
- archive
- historical
- rejected

No branch should be ambiguous.

If something is not clearly classified, it should be treated as untrusted until classified.

---

## 14. Operating rhythm

Use a regular cadence.

### Daily
- review PRs
- check CI status
- check production health
- review alerts
- monitor signup/email status
- check backup health

### Weekly
- review open feature and demo branches
- decide which are ready for staging
- trim stale branches
- review security and access
- assess whether any unsupported work is still active

### Before launch
- full staging validation
- full production readiness check
- backup verification
- rollback rehearsal
- launch checklist complete

---

## 15. Default policy for this project

This project should operate by default with these rules:

- `main` is protected
- PRs are required
- staging is required before production
- demo branches stay isolated
- recovery/source-history stays archived
- no secrets in repo
- no direct prod edits
- AI work is reviewed
- user data is treated as sensitive
- backups are verified
- deployments are monitored
- rollback is always prepared

---

## 16. Summary

This project needs structure, not just momentum.

The operating system is:
- repo controls code
- PRs control changes
- staging controls release quality
- production remains protected
- PII is protected
- historical work is archived
- demos stay separate
- AI work is reviewed
- monitoring and backups keep the system honest

This is the difference between a project that wanders and a project that can actually survive, scale, and launch safely.

---

## 17. Quick start checklist

Use this immediately:

- [ ] Protect `main`
- [ ] Require PRs for all merges
- [ ] Require checks before merge
- [ ] Create `staging` environment
- [ ] Review open PRs by purpose
- [ ] Separate `demo`/prototype branches
- [ ] Move recovery/history to archive
- [ ] Ensure no secrets are in repo
- [ ] Verify backups
- [ ] Set up health monitoring
- [ ] Set up incident and rollback procedure
- [ ] Review naming and branch structure
- [ ] Document launch checklist and release gate

---

## 18. Operational note

This document is a governance and operations baseline. It should be revised as the project evolves, but the principles above should remain fixed.

The project should never confuse:
- prototype work with live product work
- historical recovery work with the active codebase
- private user data with public repo content
- experimentation with production deployment

A disciplined operating system is the difference between a website and a launchable product.
