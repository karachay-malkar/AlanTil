# Web 13.15.12 parity — 2026-09-08 correction

## Fixed inputs

- Reference: `13.15.12`, commit `3249e0d3364656e1030d50791b24aaa8789ed1b8`, tree `c530a74d0509003ff12ba033dfa2a44eba4bd5a8`.
- Mobile input: `agent/16.6.3-full-screen-parity`, commit `113670182ccd964e2a8e0a6ca7d5e30bae0e407e` (16.6.6).
- The reference was reconstructed locally and every blob hash verified. Do not use the modified Web styles from the Mobile branch as the reference.
- Existing render evidence: workflow run `34021750755`; screenshots belong to the input commit, NOT this correction.

## Implemented correction

| Finding | Change | Evidence / remaining check |
|---|---|---|
| Mobile uses desktop display/result maxima on every width | Pure shared CSS-clamp resolver; runtime provider subscribes to viewport width; Learn uses the same provider as tests | Executable comparison with pinned original theme fixture, S/M/L at 9 widths |
| Header, buttons, navigation and common rows ignore semantic size settings | Components now resolve semantic sizes without replacing their existing weight/family; button roles follow final Web typography tier | Existing source gates plus role tests; updated render required |
| Onboarding language labels retain 8.5/10px feature overrides despite final caption cascade | Caption tier applied after compact styling | Updated render required |
| Path labels/counts remain fixed, large text does not reserve additional space | Caption/micro tiers and original small/medium/large station gaps/reserves | Updated render required |
| Match cards use 11/13px rather than caption tier; scope sections use caption rather than body | Final semantic tiers applied | Existing functional tests remain green; render required |
| Plain ListRow passes a function as View style | Resolve style array for View, retain pressed callback only for Pressable | Native/Web render required |
| Learn decisions are nested below a sibling chrome mask stacking context | Decisions moved to Screen root; layout spacer preserves card space; safe bottom inset and Web responsive gap applied | Must verify mask layering and Guide targets on native device |

## Validation boundary

Local current CI selection: 190 tests pass (Mobile suite, shared core, progress sync policy and boundary tests). The full historical root test glob has pre-existing failures against old release literals/implementation shapes; those failures existed before this correction and were not rewritten to manufacture a green result.

Local browser access was denied by Cloud Browser URL policy. No alternate browser mechanism was used. Mobile dependencies are not installed locally; the attempted offline dependency installation was rejected by execution approval. Updated JSX compilation, Expo export and Android build must therefore be verified by CI before release acceptance.

This is an implementation checkpoint, NOT full visual parity completion. Keep Q03 open. Native OAuth, session lifecycle, offline/sync, all 20/40/80 combinations, authenticated screens, audio, remaining visual states and paired screenshots against the reference still require verification. No physical Android device is attached here.

## Next verification

1. Compile/export this exact source commit and inspect new screenshots.
2. Compare Web 13.15.12 and Mobile using identical viewport, S/M/L, RU/EN/TR, writing mode, dictionary and progress.
3. On APK: Google login → native callback → Path; cancellation, logout, restart, expired session.
4. On APK: Guide spotlight/halos, bottom controls above masks, long text, restore, selected scopes and offline sync.
5. Update each screen/state verdict with evidence; do not convert screenshot capture or source regex success into pixel parity.
