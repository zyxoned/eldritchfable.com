# The Hollow King expansion

> Updated 2026-11-04 for eight-player parties, two support visitors and saved appearance. This is source behavior; production rollout remains separate.

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
figures, spell effects, and the separate Draconian support visitors. Map coordinates,
walkability, keyboard/touch controls, and account gates retain their existing
meaning.

## Party visitors and appearance

A party has eight ordinary seats and two independent administrator visitor slots.
Open matchmaking creates another persistent party when needed; solo sessions
are eligible for random support visits but cannot be joined through ordinary
matching. Roster, enemies, chat and effects are isolated per party.

Verified, enabled site administrators enter a uniformly selected eligible active
party, including a solo or full party. Authorization comes from the current
server role and authenticated account session. No customer-facing class selector
includes Death Knight. The separate visitor is The Unnamed, a Draconian Death
Knight with hidden level and its existing distinctive equipment. Its ordinary
hero, appearance, objectives and wallet remain preserved; only one avatar from
that account is active at a time.

Undying Oath makes visitors invulnerable. Veiled Strike and basic attacks share
the ordinary 700 ms attack budget; damage follows the lower median of active
regular members' effective basic damage and uses that member's ordinary range.
Guardian Boon restores 15 HP to nearby living regular party members within four
tiles, with a six-second cooldown. Browser-supplied damage, healing and radius
cannot change these values. Visitors do not count toward customer capacity,
difficulty or wipes and cannot claim their own customer rewards. Normal eligible
contributors retain rewards and progression even when a visitor lands the final
hit. Idle members receive no kill rewards.

Visitor control belongs to the authenticated administrator account. Another live
session for that same account can control its active visitor; the recorded entry
session must also remain valid. Explicit entry rebinds that lease to the current
session. Expiry, logout/revocation, disabling or demotion removes privileged access.
Confirmed receipts reauthorize the current account before returning only its
current party projection, even after it has left or switched parties.

Regular heroes can save skin tone, hair style/color, outfit palette, trim and
build independently of their immutable class, combat stats, progress and wallet.
The server validates a strict cosmetic catalog and persists changes with the
same receipt and party safeguards. Class silhouettes, equipment and articulated
walking/attack poses remain distinct; reduced-motion preferences limit decorative
animation.

## Upgrade and recovery

Schema 5 preserves existing account, character, quest, XP, coin and request data,
and adds persistent party worlds, party bindings and cosmetic appearance. The
legacy singleton world remains as a recovery record.
Production deploys package the shared catalog with the API and built frontend.
Before migration, the deploy helper makes a private SQLite backup and compares
all original table columns after the upgrade.

If activation fails after the schema upgrade commits, the prepared recovery release keeps
the accounts and storefront available and pauses adventure endpoints rather than
serving unknown new classes to the older frontend. It retains the upgraded
database and later customer writes; it never restores the stale pre-upgrade
snapshot automatically.

Run the production build, server tests, and the full desktop/mobile Playwright
suite against an isolated database before release. Public deployment checks must
not create customer accounts or send verification emails.
