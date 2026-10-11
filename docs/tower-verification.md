# Tower verification — 2026-10-11
Published source base: 13710ec, agent/16.8.0, build16.8.0.15. New web build16.8.0.16.

- Actual Chromium WebGL: guest application route after onboarding/login guest choice. Local meshes/textures load; canvas ready; no page errors. Desktop1280×900, mobile390×844.
- Actual editor + isolated wallet fixture: purchase, lost-response retry (one receipt/one charge), mesh selection, deletion/exact silver refund, maximum resizing with fixed price, payment3gold, no horizontal mobile overflow. `scripts/qa/browser-tower.cjs` reproduces this using Playwright. This is not an authenticated live browser-to-Supabase end-to-end test.
- Live PostgreSQL rollback fixture: auth/permissions, atomic placement/refund, receipt replay and misuse, revision conflict, support/dependent removal, vertical beam and bounds. Migration applied; no persisted fixture account/funds/receipts. See tower-server.md.
- Entire Web test suite:439 tests,400pass,37fail,2skip. Same37 failures reproduced at published base13710ec; zero new failures. Some tests assert obsolete historical source patterns. Generated visual manifest updated with existing repository script.
- Four new pure tower tests pass. JavaScript syntax and git diff whitespace checked.

Limitations: door price32silver and dictionary-to-difficulty mapping remain provisional. Height limit80cells. One tower; ranking entry button deferred. The source models are CC0 third-party scans, not Upper Balkaria scans. Window/door/roof/log-stair meshes adapted from timber textures/geometry. This first playable implementation needs artistic review against real tower photographs before calling its appearance historically final. Native game screen not included.
