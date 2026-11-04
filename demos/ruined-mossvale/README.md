# Ruined Mossvale playable prototype

A small, standalone single-player exploration demo of the approved Eldritch Fable direction.

[Play the demo](https://eldritch-fable-mossvale-demo-yizzwe.v2.appdeploy.ai/).

- Walk freely through ruined Mossvale; optional conversations and landmarks.
- Discover either of two short sample areas through physical travel.
- Try eight class silhouettes with their own equipment, combat/telegraphs, rest and recovery.
- Customize skin, hair, clothing palette, metal trim and build; preview walking, attacks and rotation.
- Move with acceleration/braking, planted steps, body lean and trailing cloth.
- Use keyboard, click-to-walk or touch controls; journal and browser-local save.

This is an isolated prototype, not the finished MMO. It does not implement all
100 cave floors, the full sky temple, multiplayer, accounts, the economy or any
concealed finale. Demo saves never connect to production.

## Run locally

From this directory with Python 3:

```sh
python3 -m http.server 8080 --bind 127.0.0.1
```

Open http://127.0.0.1:8080. With Node 24+, run the focused rules checks:

```sh
npm test
```

No package installation or build step is needed for this static source.
The separate AppDeploy preview uses its standard HTML/Vite scaffold. Its source
contains the same demo modules; tests/tests.json describes the preview QA flows.

## Controls

WASD/arrows or ground clicks move; E interacts, Space attacks, Q uses the class
ability, C customizes your character, J opens the journal, Esc pauses. Touch controls are on screen. You can
decline conversations or travel and return through the pause menu in this demo.
Starting a fresh demo requires confirmation and clears only the demo's browser save.

## Art and privacy

The Canvas world is procedural: layered terrain, masonry, foliage, shadows,
fog and lighting. The DOM UI follows the supplied dark/gold fantasy direction.
Character appearance is cosmetic and saved in this browser. Existing version-1 saves
receive safe default appearances. Reduced motion removes extra bob, lean and cloth movement.
No outside asset service or private story content is loaded.
