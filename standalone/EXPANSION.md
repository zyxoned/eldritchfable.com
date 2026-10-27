# The Hollow King expansion

The existing same-origin game gains five callings: Bard, Cleric, Wizard,
Sorcerer, and Monk. Ranger, Knight, and Mage remain available. Every calling has
two included starter skills, three named pieces of equipped in-game gear, and
original lore in `shared/class-catalog.mjs`. Equipment is part of the character,
not merchandise or a shop order. Existing characters and private wallets survive
the upgrade.

## Callings and combat

The shared catalog supplies both client presentation and server combat values.
Bards combine discord and nearby party healing; Clerics bring dawnfire and
sanctuary; Wizards use frost and a runic ward; Sorcerers channel embers and
lightning; Monks combine a close-range flurry with restorative meditation.
The original three callings also receive matching skills and equipment.

The server chooses targets by distance, applies its own damage/healing/armor
values, checks class ownership, and persists per-skill cooldowns. Replayed
requests cannot apply an effect or credit a reward twice. Healing does not mint
XP. Starter skills cost no XP; the existing 1,250 XP per gold exchange remains
unchanged. Future XP-priced ability unlocks and physical shop redemption remain
separate and unavailable.

## Universal prologue and graphics

Every account sees the same opening: six mysterious heroes stand against the
Hollow King at the last gate. It can be skipped, advanced manually, and replayed.
Completion is remembered in versioned browser storage for that account.
Reduced-motion settings are respected and no sound autoplays.

The game renderer adds detailed terrain, lighting, water, foliage, class-specific
figures, spell effects, and the Draconian seventh character. Map coordinates,
walkability, keyboard/touch controls, and account gates retain their existing
meaning.

## The seventh

Verified, enabled site administrators get an account link to enter as the
seventh. No customer-facing class selector includes Death Knight. Authorization
comes from the current server-side account role, never a browser parameter.

The reserved avatar is **The Unnamed**, a **Draconian Death Knight**, with level
**???** and three **SSS** pieces: **Grave of Stars**, **Night Sovereign Plate**,
and **Black Sun Signet**. Its powers are **Undying Oath** (invulnerability) and
**Soul Reap** (instant defeat of a nearby hostile creature). It does not attack
other players or create shop XP through executions.

There can be six ordinary active characters and one reserved administrator
avatar. The administrator's ordinary character is preserved separately; only
one avatar from that account is active at a time. Administrator entry does not
take a customer seat. Losing account access or administrator status removes
privileged access.

## Upgrade and recovery

Schema 4 retains existing account, character, quest, XP, coin, and request data,
and adds skill state, visual effects, and a separate administrator character.
Production deploys package the shared catalog with the API and built frontend.
Before migration, the deploy helper makes a private SQLite backup and compares
all original table columns after the upgrade.

If activation fails after schema 4 commits, the prepared recovery release keeps
the accounts and storefront available and pauses adventure endpoints rather than
serving unknown new classes to the older frontend. It retains the upgraded
database and later customer writes; it never restores the stale pre-upgrade
snapshot automatically.

Run the production build, server tests, and the full desktop/mobile Playwright
suite against an isolated database before release. Public deployment checks must
not create customer accounts or send verification emails.
