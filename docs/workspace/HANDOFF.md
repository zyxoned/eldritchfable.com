# Eldritch Fable shared workspace handoff

Observed at 2026-10-29T12:31:15-04:00 (America/New_York, EDT). Executor: connected SentinelX
host `eldritch-server`, Ubuntu, Python 3.12.3. This file is the latest task handoff;
[PROJECT_STATE](../../PROJECT_STATE.md) records detailed source/production evidence.

## Project and current task

Repository: https://github.com/zyxoned/eldritchfable.com.git; accepted base: `main`.
Preserve one authoritative, recoverable Eldritch Fable repository, finish PR #8,
and enable continuous Workspace Relay checks for the actual development checkout. The approved
Tavern remains inside the existing React/Vite application in `standalone/`.
No separate Next.js application, production rollout or live database change is
part of this work.

## Source baseline and local state

| Field | Verified value before this handoff |
| --- | --- |
| Accepted main | `2d708248a9e812195d4e4e9177da85aaa33d7589` |
| Main tree | `40647f991fbbcbfcc75cd104106d1a8a26b133ad` |
| Application/code commit before handoff | `648bd81c04bd8e5c1c2e0e7c62b16b202be8e730` |
| Task branch | `reconcile/candy-recovery-20261029` |
| Task upstream | `origin/reconcile/candy-recovery-20261029` at `648bd81c04bd8e5c1c2e0e7c62b16b202be8e730` |
| Actual development root | `/srv/eldritch-staging/reconcile-20261028T031715Z/repo-final` |
| Sanitized remote identity | `github.com/zyxoned/eldritchfable.com` |
| Initial local state | Clean; no staged, unstaged or untracked files; no unpublished commits; no active Git operation; full history |
| Worktrees in this clone | One, the development root above |
| Comparison after fresh fetch | Upstream ahead/behind 0/0; task branch 2 commits ahead of main, 0 behind |
| Integration | [PR #8](https://github.com/zyxoned/eldritchfable.com/pull/8), open, non-draft, mergeable before this handoff |

The handoff commit itself is identified by Git history/PR head; the SHA above is
explicitly the commit before these documentation changes. Re-fetch the PR branch
to obtain the actual current head rather than treating this dated table as a
future synchronization guarantee.

All nine original CANDY checkouts and other historical source remain preserved
and are listed in PROJECT_STATE.md. They are not enrolled for automatic repair.
The first audit draft checkout at `/srv/eldritch-staging/reconcile-20261028T031715Z/repo`
and the fresh archive-verification clone are separate evidence copies, not the
active development worktree. Do not reset or replace them as incidental cleanup.

## Change and Workspace Relay activation

The source reconciliation already exists on main through PR #7. PR #8 adds 14
recoverable historical snapshots, source comparisons, verified production state
and a reproducible deployment/recovery procedure. This handoff records continuous Relay activation and the latest session
context; no application code changes are needed.
Intended files in this follow-up: `docs/workspace/HANDOFF.md`, `PROJECT_STATE.md`
and `SOURCE_RECONCILIATION.md` (to retain an exact PR file list).

Only the exact development root/branch above is enrolled, role `development`,
remote `origin`, accepted base `main`. Helper version 0.1.0 is a verbatim private
copy of Workspace Relay's skill-bundled helper, SHA256
`9071aac8285cd7184e09944c793451c9b6d30c2f8b7dcaff65812cd6f5be3d04`.
On CANDY its path is:

```text
/srv/eldritch-staging/workspace-relay/helpers/9071aac8285cd7184e09944c793451c9b6d30c2f8b7dcaff65812cd6f5be3d04/workspace_sync.py
```

The helper is not vendored into the application. Enrollment, latest result,
editing lease and common repository lock live under Git metadata, outside source
control. The editing session obtained a lease before these edits. A held-session
sync check returned `session_active` as intended and did not move HEAD. The lease
must be released only by its owner after publication; check the actual metadata
before starting another editing session. Lease tokens are never shared here.

Initialization ran `inspect --fetch`, `enroll`, `sync`, `hold` and another
fresh `inspect --fetch`. Sync returned `ahead`, not lag: no repair worktree,
fast-forward, merge, reset, stash or cleanup was needed. The earlier initialization did not start a continuous watcher.
The subsequently authorized service activation is recorded below; enrollment
does not imply synchronization of every machine.

For another accessible development checkout, invoke the Workspace Relay skill
there and inspect/enroll that exact worktree/branch. Do not copy private lease
metadata or enroll production/release directories. A new branch requires fresh
inspection and enrollment. Before editing this worktree, use its helper to inspect
with fetch, sync when no lease is active, and acquire your own editing lease.

## Continuous watcher enabled, October 29

The owner explicitly requested activation after initialization. A dedicated
system-managed service now runs as the existing development user; it is not a
systemd user service and no lingering/user-session configuration was changed.

| Setting | Verified value |
| --- | --- |
| Service | `eldritch-workspace-relay.service` |
| Effective unit | `/etc/systemd/system/eldritch-workspace-relay.service`, regular root-owned mode 0644 file |
| Reviewed private artifact | `/srv/eldritch-staging/workspace-relay/services/eldritch-workspace-relay.service` |
| Unit SHA256 | `83901cdbd5d4816f23b6d26aef650b9237236693f3907cb2a818bd59ce3b45ce` |
| Process identity | `sentinelx:sentinelx`, UID 996 / GID 987 |
| Target | The exact enrolled development root/branch above |
| Command | Python helper `watch --repo <that root> --interval 300` |
| Interval | Every 300 seconds, with each cycle's runtime added |
| Persistence | Enabled for `multi-user.target`; `Restart=on-failure`, 30-second restart delay; staging mount dependencies |
| Isolation | `NoNewPrivileges=yes`, private umask 0077; no production checkout enrolled |

The first daemon cycle at 12:29 EDT returned `remote_fresh: true`, clean HEAD
`648bd81c04bd8e5c1c2e0e7c62b16b202be8e730`, upstream 0/0 and two commits ahead of
main. The actual running PID/arguments, enabled state and unit ownership were
checked. A controlled restart under this session's editing lease produced a fresh
`session_active` journal record and left the previous successful result unchanged.
A held lease does not refresh `last-result.json`; use the journal to distinguish
a paused cycle from a new successful fetch. After publication, release only this
session's lease and verify a fresh daemon cycle again.

This service persists independently of the chat and is configured to start after
reboot; no server reboot was performed as a test. It fast-forwards only clean
enrolled development lag, preserves a recovery ref, and prepares one isolated
repair when histories diverge. It does not push, auto-merge main, deploy, modify
production data, send notifications, resolve semantic conflicts or run tests.
Other editors must honor the editing lease. Conflicts and failed access require
an active agent. If the upstream branch is later deleted, fresh fetching reports
a failure until an agent selects/enrolls the intended new branch; a running PID
alone does not prove a successful sync.

Inspect or stop only this development service on CANDY:

```sh
sudo systemctl status --no-pager eldritch-workspace-relay.service
sudo journalctl --unit eldritch-workspace-relay.service --lines 10 --no-pager
sudo systemctl stop eldritch-workspace-relay.service
# To stop it and also prevent automatic startup:
sudo systemctl disable --now eldritch-workspace-relay.service
```

Its bounded latest successful/returned result is at
`.git/workspace-relay/last-result.json`; blocked lease/branch states may appear
only in the journal. Check observation time, state and `remote_fresh`, not just
service liveness. Restore/start controls are `sudo systemctl enable --now
eldritch-workspace-relay.service`; no production service command is involved.

## Verification and evidence

Checks run during Relay initialization and this activation session (dated where relevant):

- Actual root, branch, full HEAD, upstream, status, worktrees and unpublished
  commits inspected before any edit. Fresh helper fetch compared both upstream
  and main, with `remote_fresh: true` and no missing commits.
- Helper source parsed successfully with Python; exact packaged bytes preserved. The new unit passed `systemd-analyze verify`.
- Enrollment and sync succeeded; held-session protection refused sync as expected.
- Public HTTPS `/frontend-release.json` and `/api/health` rechecked at
  2026-10-29 12:15 EDT; manifest identities below match and health is online.
- Documentation relative links and staged diff reviewed before publication.

Prior exact-head application evidence, not newly run local application tests:
[CI 40841655451](https://github.com/zyxoned/eldritchfable.com/actions/runs/40841655451)
on `10802d3481d6a687bbe02c6b677f2a06ef57f9c6` passed locked dependency installation,
Vite build, server syntax, **69 backend tests and 30 desktop/mobile browser tests**.
Pre-activation [CI 40910338605](https://github.com/zyxoned/eldritchfable.com/actions/runs/40910338605)
on `648bd81c04bd8e5c1c2e0e7c62b16b202be8e730` also passed build/syntax, 69 backend
and 30 browser tests. No local application tests were rerun for service/docs setup.
The fresh public GitHub clone recovery check restored all 14 snapshots / 1,069
source aliases with exact hashes/modes and left the clone clean. The archive
validation file records the independent earlier restoration checks.

This follow-up changes documentation only. The existing PR includes standalone
Markdown, so normal PR CI runs again; its final result belongs in the PR Checks.
There is no configured lint or standalone typecheck script. Do not claim that
Relay's `handoff --check` text executed those checks. The actual workflow contains
no deployment actions; no active local Git hooks were present.

## Production: separately observed

| Component | Evidence |
| --- | --- |
| Public frontend commit | `2011d09558baa37d90820aeae4aab3eab473e6b6` |
| Public frontend release | `welcome-2011d09558ba-20261027T064119Z` |
| Public backend release | `f05b81a0ff9d-20261027013515284` |
| Backend source from earlier full file audit | `f05b81a0ff9d60fa39aff635d7164623f2256eb9` |
| Live schema from earlier read-only server audit | 3; main source requires 4 |

The public manifest/health check above is fresh to this session. The 29-frontend/
27-backend file comparison, service PIDs, timers and live schema metadata were
verified in the earlier October 29 audit, not repeated by Relay enrollment.
Enrollment is confined to development; production services, bindings, database,
email, DNS and release symlinks were not modified. Read [deployment/recovery](../../DEPLOYMENT_RECOVERY.md)
for a separately authorized future operation.

## Blockers and next action

No drift or merge conflict blocks this documentation handoff. The managed cloud
`/workspace` environment still reports pending/offline; its checkout and unpublished
contents remain UNKNOWN. Existing accessible CANDY source was independently
preserved; a fresh clone does not prove anything about that inaccessible workspace.

Production remains schema 3 and lacks main's schema-4 expansion/phone fix. A future
rollout needs private schema-3-to-4 rehearsal, schema-compatible fallback and old
hashed-asset retention. Real catalog/inventory, checkout/payment/fulfillment,
physical redemption and other commerce work remain incomplete. See the exact
[remaining differences](../../SOURCE_RECONCILIATION.md).

**Next action:** review PR #8's exact file list and final green Checks for integration
into `main` through the normal reviewed workflow. Do not deploy or auto-merge as
part of Relay initialization. GitHub is the shared handoff channel; no messages
were sent to other people or other GPT/Codex conversations.
