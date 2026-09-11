# Mobile 16.6.3 — Web 13.15.12 screen/state matrix

Reference: Web 13.15.12. Mobile branch: `agent/16.6.3-full-screen-parity`.

Status meanings:
- `CODE_PASS` — composition/state contract implemented and covered by source/executable gates.
- `RENDER_PENDING` — final Expo Web render comparison still required before Q03 may become PASS.
- `DEVICE_REQUIRED` — native-only lifecycle/physical-device behavior belongs to 16.7 and is not counted as a 16.6.3 visual PASS.

| Screen | Shell/Header | Geometry/Typography | Controls/selected/pressed | Overlay/modal | Loading/empty/error | Guest/account/result | Render |
|---|---|---|---|---|---|---|---|
| Path | CODE_PASS | CODE_PASS | CODE_PASS | Story Stele + Guide CODE_PASS | CODE_PASS | progress/status CODE_PASS | RENDER_PENDING |
| Station / words | CODE_PASS | CODE_PASS | CODE_PASS | Guide CODE_PASS | CODE_PASS | selection CODE_PASS | RENDER_PENDING |
| Station / statistics | CODE_PASS | CODE_PASS | CODE_PASS | n/a | empty CODE_PASS | passed/failed/mastery CODE_PASS | RENDER_PENDING |
| Learn | CODE_PASS | CODE_PASS | swipe/flip/undo/favorite CODE_PASS | Guide CODE_PASS | empty/restore CODE_PASS | result/problems CODE_PASS | RENDER_PENDING |
| Stage Test | CODE_PASS | CODE_PASS | options/selected/action CODE_PASS | n/a | restore CODE_PASS | pass/fail/retry/favorite CODE_PASS | RENDER_PENDING |
| Practice | CODE_PASS | CODE_PASS | rows/pressed CODE_PASS | n/a | n/a | n/a | RENDER_PENDING |
| General Test menu | CODE_PASS | CODE_PASS | scope/indeterminate/limit/direction CODE_PASS | n/a | CODE_PASS | selected count CODE_PASS | RENDER_PENDING |
| General Test session | CODE_PASS | CODE_PASS | options/selected/action CODE_PASS | n/a | restore CODE_PASS | n/a | RENDER_PENDING |
| General Test results | CODE_PASS | CODE_PASS | favorite/retry/marquee CODE_PASS | n/a | CODE_PASS | mastery/correct/wrong CODE_PASS | RENDER_PENDING |
| Match menu/session/results | CODE_PASS | CODE_PASS | selected/matched/wrong/shake CODE_PASS | n/a | restore CODE_PASS | errors-only/favorite CODE_PASS | RENDER_PENDING |
| Favorites set preparation | CODE_PASS | CODE_PASS | checkbox/show-hide/direction CODE_PASS | n/a | empty CODE_PASS | favoritesOnly CODE_PASS | RENDER_PENDING |
| Story Word List | CODE_PASS | CODE_PASS | animated search/favorite/marquee CODE_PASS | n/a | empty CODE_PASS | saved Path position CODE_PASS | RENDER_PENDING |
| Songs catalog/playlists | CODE_PASS | CODE_PASS | search/player states CODE_PASS | n/a | loading/empty/error CODE_PASS | n/a | RENDER_PENDING |
| Song detail | CODE_PASS | CODE_PASS | media/seek/clickable words CODE_PASS | Info modal CODE_PASS | audio error CODE_PASS | favorite CODE_PASS | RENDER_PENDING |
| Profile guest | Web exception CODE_PASS | CODE_PASS | login action CODE_PASS | n/a | CODE_PASS | locked avatar CODE_PASS | RENDER_PENDING |
| Profile incomplete account | Web exception CODE_PASS | CODE_PASS | setup action CODE_PASS | n/a | loading CODE_PASS | nickname/gender state CODE_PASS | RENDER_PENDING |
| Profile normal | Web exception CODE_PASS | CODE_PASS | story/account CODE_PASS | n/a | empty CODE_PASS | authenticated CODE_PASS | RENDER_PENDING |
| Statistics | CODE_PASS | CODE_PASS | rows/chips CODE_PASS | n/a | empty CODE_PASS | metrics/problems CODE_PASS | RENDER_PENDING |
| Settings | CODE_PASS | CODE_PASS | S/M/L/language/script/dialect/update CODE_PASS | n/a | checking/updating/error CODE_PASS | dirty/save CODE_PASS | RENDER_PENDING |
| Thanks / Version / Privacy | CODE_PASS | CODE_PASS | analytics checkbox CODE_PASS | n/a | CODE_PASS | n/a | RENDER_PENDING |
| Account | CODE_PASS | CODE_PASS | OAuth/setup/logout CODE_PASS | n/a | loading/error CODE_PASS | guest/auth CODE_PASS | RENDER_PENDING |
| Onboarding | CODE_PASS | CODE_PASS | language/script/dialect/account-guest CODE_PASS | n/a | save error CODE_PASS | final transition CODE_PASS | RENDER_PENDING |
| Guided Help | n/a | target geometry CODE_PASS | Next/Skip/input block CODE_PASS | spotlight/halo CODE_PASS | target fallback CODE_PASS | replay/state CODE_PASS | RENDER_PENDING |
| Header / BottomNav | CODE_PASS | CODE_PASS | active/inactive/pressed CODE_PASS | masks/blur CODE_PASS | n/a | Profile exception CODE_PASS | RENDER_PENDING |

## Mobile extensions retained

- Learn progress bar — retained through shared session progress styling.
- “Нажмите, чтобы перевернуть” — retained through shared helper typography.
- Path scroll position — retained.
- Per-story Path scroll restoration — retained.

## Admin

Web Admin is an operational/privileged feature, not part of the native end-user navigation contract. It remains a separate follow-up block and does not share or delay the user-facing visual parity gate.

## Q03 rule

Source/token/regex checks cannot grant Q03. Q03 changes to PASS only after the preview from the exact final branch HEAD is rendered and compared screen/state-by-screen/state against Web 13.15.12. Until then this matrix deliberately remains `RENDER_PENDING` in the final column.
