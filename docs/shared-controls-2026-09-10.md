# Shared controls, 2026-09-10

Reference: Web 13.15.12. This patch extends packages/alantil-ui; Web consumes generated CSS variables and React Native consumes the same control values.

Implemented:
- Progress: ten 8×2 square cells, 4px cell gap, brackets and shared colors.
- Station: responsive 44–76px tab inset, 12px footer sides, 6px footer gap and 28px toolbar with 18px sides.
- Guide: registered shared primary/text button roles, terminal metrics and compact sizing.
- Header Back, modal Close and navigation icons: foreground wrapper above the web backdrop; inactive navigation icons retain full text2 color.
- Settings small buttons: one border with the correct radius.
- Learn undo: horizontal icon/label arrangement.
- Profile avatar choices: 9px gap and 150/180px responsive minimum height.
- Action footer buttons use the common action radius.

Validation before CI: 242 executable tests passed; 54 source/state checks passed; shared contract and structural gates passed. CI additionally captures Path and Station at 1920×920 and checks progress geometry, navigation foreground and desktop tab insets.

Limitations: native Android performance, real device screenshots, real Google login, authenticated profile branches and complete per-state/per-language visual equivalence still require runtime evidence. A passing source gate is not proof of complete visual parity.
