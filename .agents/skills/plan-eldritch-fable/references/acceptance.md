# Accepting a returned slice

Use Node 24 or newer from the repository root. The validator has no package dependencies. Keep the acceptance ledger, in-game captures, designer reviews and immutable build evidence in the project's authorized evidence location. Public Git can hold the skill and player-safe handoffs. Restricted evidence belongs in private storage.

## 1. Freeze the handoff

Keep a trusted copy of the pre-implementation handoff independently of the implementer's submission. The planner records the approved design, expected outcomes, evidence methods and every shipping asset ID this change will introduce or modify. Compare this inventory with the actual implementation and build output during review. A visual changed by a gameplay slice still needs an approval.

This illustrative handoff is a format example for one hypothetical equipment change:

```json
{
  "id": "equipment-reconnect",
  "kind": "gameplay",
  "design": "equipment-ownership-decision",
  "outcome": "An eligible hero keeps one owned item equipped after reconnecting.",
  "criteria": [
    {
      "id": "slot-survives",
      "expected": "Equip once through /play, reconnect, then observe the same item and one application of its effect.",
      "method": "runtime"
    }
  ],
  "assetIds": []
}
```

Use `gameplay`, `art`, `infrastructure` or `documentation` for the kind. A counted infrastructure slice supports the game. For methods choose `runtime` (exercise the player or system behavior), `visual` (review at gameplay zoom), `automated` (a focused system or unit check), or `inspection` (source or document review). An automated browser journey through the real game can produce runtime evidence. A mocked response cannot demonstrate server persistence. Gameplay needs a runtime criterion; art needs a visual criterion and at least one asset.

## 2. Collect the candidate evidence

An empty initial ledger is `{"version":1,"slices":[],"checkpoints":[]}`. Keep a trusted snapshot of the last accepted ledger. Make a candidate from that snapshot and append one slice in order. Keep previous asset and evidence versions at their original paths. Evidence files must be nonempty, readable files inside the candidate ledger directory. Every file reference uses `{"path":"relative/path","sha256":"<64 lowercase hex digits>"}`. Hash actual bytes, for example with `sha256sum path/to/file`.

| Record | Fields and meaning |
| --- | --- |
| Slice | Copy `id`, `kind`, `design`, `outcome`, and ordered `criteria` from the frozen handoff. Add `revision` (full 40-character lowercase Git commit SHA of the implemented build), `results`, and `assets`. |
| Result, one per criterion | `id`, `method`, `revision`, `observed` (what actually happened), `passed: true`, and `evidence` (file reference). Include run/build identity, procedure, environment and outcome in that evidence. |
| Shipping asset, one per expected ID | `id`, `path` and `sha256` of the exact shipping bytes, `source` (provenance and usage rights), `preview` (file reference), and `approval`. A changed version gets a new snapshot path. |
| Asset approval | `designer`, `decision: "approved"`, `sha256` of the version reviewed and `evidence` pointing to a review record. Confirm that record covers the exact asset, intended use and preview. |
| Fifth-slice checkpoint | `after` (5, 10, …), `sliceId`, `revision` of the corresponding counted slice, `build`, `automation`, `scenario`, `designer`, `observations`, `decision: "passed"`, `blockers: []`, and `review`. Build, automation and review are file references. Use the playable artifact or a captured manifest identifying its immutable location and revision. |

Keep any outstanding blocker and failed observation in the working playtest packet. Correct and retest before submitting the closed checkpoint. If a fix changes the candidate SHA, update the pending slice's results and the checkpoint evidence to that build. Keep remediation under the same slice ID. Never manufacture approval records or copy private canon into an example.

## 3. Verify, then record acceptance

```sh
node .agents/skills/plan-eldritch-fable/scripts/validate.mjs evidence/candidate.json --previous trusted/last-accepted.json --handoff trusted/approved-handoff.json
```

Run against the **last accepted** snapshot and the **independently retained** handoff. A successful run checks a single append, expected criteria and asset IDs, claim/result agreement, evidence hashes, version-specific approval records and the fifth-slice checkpoint. Review the cited sources yourself: file integrity alone cannot establish that a person played the build, that a capture demonstrates the claim, or that an omitted asset is absent from the build. Use the real signed-in designer record and build manifest for those judgments.

Promote the reviewed candidate with the project's normal serialized acceptance operation (for example, a single Git commit reviewed against the latest ledger revision). If another slice lands first, refresh the trusted snapshot, append again and re-evaluate the count. Preserve immutable evidence and the reviewed handoff. The command is read-only and exits nonzero with the first unmet criterion.

For a read-only audit run the command with just the ledger, or add `--previous trusted/last-accepted.json` to check the accepted prefix. Audit mode does not authorize a new slice. Run the regression suite from the repository root with:

```sh
node --test standalone/tests/planning-skill.test.mjs
```
