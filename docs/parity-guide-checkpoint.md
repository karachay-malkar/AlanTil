# Guide and Learn checkpoint

Reference: Web 13.15.12 / 3249e0d3364656e1030d50791b24aaa8789ed1b8.
Input mobile: 4a91cd4a327c58cc915ab5f3b22fcec26431b33d.

## Changes
- Guide uses a same-window overlay and subtracts its measured origin from native target coordinates. No guessed status-bar adjustment.
- Minimum spotlight dimensions expand around the button center.
- Panel placement uses original Web candidate ordering, overlap penalties and card anchor, avoiding Undo/Favorite for all Learn phases.
- Closing/skipping immediately unmounts the guide, before persisting its completed flag.
- Learn header/system Back requests confirmation for an unfinished session. Stay preserves state; confirmation saves the snapshot before navigating. Uses the original localized message and Alan exit phrase.
- Card shadow moved off the two rotating faces onto their common rounded container. Inactive faces also explicitly fade out at the half-turn to prevent Android backface compositing artifacts.
- CI render script now walks all five Learn guide steps, checks the favorite spotlight center, guide removal and cancel/confirm exit.

## Evidence and limits
193 executable/source tests and eight source gates passed locally before commit. Actual build/render results must be checked for this commit; no Android device is attached. Gray-frame removal and hardware Back still need native acceptance, not just a browser image. Full Q03 remains open.

## Remaining work
| Area | Remaining acceptance |
|---|---|
| All screens | Paired visual comparison with exact Web reference, same data, locale, size |
| Guide | Native alignment at different safe-area sizes; all Path/Station help steps |
| Learn | Native flip/swipe/undo and frame cleanup; exact surface/colors |
| Test/Match | UI-level 20/40/80, directions, interrupted restoration, results |
| Account | Real Google callback, cold start, cancel, logout, restart |
| Progress | Offline, guest transfer, conflict/sync and no data loss |
| Content | Filled favorites, songs/audio, authenticated profile/statistics |
| Languages | RU/EN/TR, script/dialect and long-text S/M/L |

## Session exit and storage follow-up — 2026-09-09

- All four session modes now share the same confirmation flow and localized exit phrase. Failed final persistence leaves the screen open for retry.
- Session storage captures the user scope and namespace at invocation, serializes the snapshot immediately, and orders read/write/clear operations per key. Regression tests cover account switching during migration, pending writes followed by completion clear, and restore waiting for save.
- Station statistics and Profile tabs/metrics/settings links use the original semantic font sizes.
- Local selected suite: 199 tests pass; all eight existing source gates pass.
- Expanded CI scenarios: Test 20/40/80 in both directions, answering then exit/restore; Match 20/40/80 count and restore; cancel/confirm for both games; Stage Test cancel. These are acceptance requests until the new CI run succeeds, not completed results.
- Scope still open: exact paired visual reference comparison for all states; Android hardware Back, gray-frame acceptance and gestures; live OAuth/device lifecycle, cloud/offline sync, populated songs/favorites and authenticated UI.

## Learn surface and Stele typography — 2026-09-09

- Replaced flat Learn face fill with the exact 145-degree Web gradient, including both RGBA stops. SVG endpoints preserve the CSS angle for each measured card aspect ratio.
- Responsive front/back padding now follows learn.css, including the <=420px override.
- Translation weight/line-height and example/ordinal line-height now follow the final original CSS rules.
- Stele title/body use semantic S/M/L sizes. Overflow fitting may tighten line spacing and gaps but cannot shrink the font below the selected semantic size; scrolling remains available.
- 202 local tests and eight source gates passed. CI now checks exact default Stele body size rather than only a minimum.
- Remaining acceptance is unchanged: paired original Web visuals, native device rendering/lifecycle, real OAuth, cloud sync and filled-state coverage remain open.


## Android rendering correction after 2590d16
- Android chrome uses stationary background gradients instead of live BlurView plus MaskedView. Android faded scroll no longer masks the full scroll surface; imperative scroll ref is forwarded explicitly. iOS mask behavior retained.
- Android GlassBackdrop uses its explicit tint without live blur. This is a deliberate native rendering approximation, not a claim of pixel equality to CSS backdrop-filter.
- Transparent high-elevation chrome/guide containers have transparent shadow color; guide panel has an explicit Android background to prevent content-shaped shadow candidates.
- Guide compact buttons now match 98x35 minimum at <=390.
- Audit correction: Learn decision gap already had a responsive inline override; fixed 58 was only fallback.
- 202 local tests passed. Physical Android FPS/halo checks pending. Long route virtualization remains pending; do not claim scrolling fully fixed.

## Path station render window
- Station SVG/decorations/buttons unmount outside the viewport plus overscan after initial geometry measurement; fixed-height row placeholders retain all route coordinates, connector and restore behavior. This bounds native station content, not row placeholders or initial layout cost.
- Window store notifies only after half a viewport of movement or resize; no PathScreen state update on scroll. Guide target stays mounted.
- Learn decision borders use premultiplied sRGB mixes from Web CSS; high elevation decision wrapper has no Android shadow.
- Added behavioral coverage for long routes, pinned targets, jumps, resize and subscription cleanup. Native FPS remains unmeasured.

## Initial Path layout correction
Unknown station coordinates or an unmeasured viewport now render empty fixed-height rows. Native button/SVG content mounts only after geometry and viewport are available. Row onLayout remains outside the conditional content, so measurement does not depend on mounting the button. Initial row placeholders and full connector remain; no claim of full list virtualization.

## Cloud queue and refresh corrections after 5a88260
- Reproduced lost enqueue while an older network request was in flight. Replaced stale-array rewrites with per-key serialized mutations and exact-revision acknowledgements. Concurrent edits, including replacement of the same favorite, survive and drain.
- Queue storage key and owner captured before await; flush and synchronization are single-flight per account. Requests check expected user before sending and after refresh. This does not certify every guest-transfer/pull storage operation across account switches; those broader transactions still require work.
- Transient refresh errors retain local session; only explicit terminal Supabase codes clear it. See https://supabase.com/docs/guides/auth/debugging/error-codes . Live OAuth round-trip remains unverified.
- Failed pull/flush returns false; auth sync marker resets on false so later resume can retry.
- Behavioral tests use actual platform module bodies with injected storage/auth transport. 220 tests and 54 source checks passed before final rerun.
- Still open: guest-claim/pull atomicity across user changes, songs refresh/error UI, remaining typography/visual matrix, physical-device FPS and live OAuth.

## 2026-09-09 — account-bound local/cloud persistence

- Storage keys are captured before legacy migration awaits. Settings, favorite values and their sync metadata, progress results/activity/station attempts, and summary reads carry the initiating scope through subsequent awaits.
- Cloud pull and guest claim capture their destination once; reads, merges, writes, claim marker and queued progress use that same destination. Cloud GET requests also require the initiating user. Deferred preference/favorite queue callbacks do not enqueue old-user changes for a newly selected account.
- Seven behavioral tests run actual platform modules with controlled account changes during migration/local reads: settings, favorites, guest claim, cloud pull, and Learn/Test/Match result persistence. They assert all writes remain under account A after selecting B.
- Validation: 227 targeted tests; 54 source/state checks. This proves scoped IO behavior in those interleavings, not atomic multi-key storage or conflict-free simultaneous local edits/cloud merges. Refresh completion races and live Google OAuth remain unverified.
- Previous head 07f253a: push render artifact has 49 PASS scenarios, no console/page errors, but a cancelled Google CSV request marks that run failed; PR run succeeded. This is not evidence of native Android parity or measured scroll FPS.
