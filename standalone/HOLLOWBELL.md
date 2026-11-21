# Play the Hollowbell expedition

Two ordinary heroes can take this optional road from the authenticated `/play` realm. Begin in Hollowbell’s quarry market. Meet the repairer, investigate Resonant Gate together and find a way back from the far landing. Each traveler chooses when to leave and what to investigate.

## Local two-player session

On Node 24 or newer, run from `standalone/`:

```sh
npm ci
npm run play:quarry
```

The launcher builds the game, creates a temporary database and two verified playtest accounts, and starts the app on loopback. Open the printed login URL in two independent browser profiles and sign in with the different credentials printed in the terminal. In each window open `/play`. Choose two callings, enter the same open party and select **Travel to Hollowbell**. The first player can copy a party invitation. Keep both windows open for the multiplayer test. Ctrl+C ends this disposable session; refresh during play tests persistent saves. For an existing development build with verified test accounts, use the ordinary `/play` entry and party invitation.

Click or tap an interaction to walk into range. Click the ground to walk, or use WASD, arrow keys or the on-screen movement controls. The actions, visual score and field journal work with audio muted. Each player can wait behind, continue separately or return to the main realm.

## What to playtest

- Observe the repairer's work and service. Give the second player a chance to discover the route without receiving the first player's notes.
- Enter the fight together. Check the crawler's anticipation, both heroes' contributions, level gain, the named skill and the Rare bracer. Equip the drop and exercise its mechanical benefit.
- Test partial puzzle feedback, independent travel, the far-side return mechanism and the trip back. Refresh a client and check its personal equipment, skill and journal.
- Review all three environments with actual characters at game zoom. Walk and strike with an armored and a robed hero, observe the repairer and crawler in motion, and check readability on desktop, touch and reduced motion.

The [frozen handoff](../docs/superpowers/plans/hollowbell-expedition-handoff.json) identifies the eight visual review items and measurable outcomes. The three illustrated background plates are original generated artwork for this expedition. Actor forms and animation are original Canvas illustrations, using the game's existing appearance palette. The art modules and interface styling together supply the final in-game views. Review the actual version, in-game preview and provenance for each asset before recording designer acceptance. The playtest leaves the setting-wide atlas and naming decision with the designer.

The repository CI runs the authenticated two-client journey on desktop and mobile. The `hollowbell-art-review` artifact retains spoiler-free market and gate screenshots; the local test output also contains a far-side capture. To reproduce the browser test from `standalone/` after installing dependencies:

```sh
npm run build
npx playwright install chromium
npx playwright test tests/browser/quarry.spec.mjs
```
