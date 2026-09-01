# AlanTil mobile E2E

The flows use stable React Native `testID` values and do not depend on RU, EN or
TR copy. They cover fresh guest onboarding, selected station learning, the full
station test, process restoration for Test and Match, and persisted settings.

## Local run

Install the 14.2.0 application on an Android emulator or iOS simulator, install
the Maestro CLI, then run from `mobile/`:

```sh
npm run e2e
```

Screenshots are written by Maestro under `artifacts/screenshots`. Each main flow
clears application data first and can be run independently. Files under
`subflows/` are setup helpers, not standalone tests.

## Required device and width matrix

Run all smoke flows on each native device. Capture the four exact logical-width
references with the closest listed target.

| Contract | Native target | Logical size / note |
| --- | --- | --- |
| 320 px | Compact reference | Web/native layout contract at 320 px |
| iPhone SE | iPhone SE (3rd generation) | 375 × 667 pt, home button safe area |
| 360 px | Small Android | 360 px wide, gesture navigation |
| 390 px | Modern iPhone | iPhone 15 / 16, Dynamic Island |
| 430 px | Large modern iPhone | 430 px wide, Dynamic Island |
| Tall Android | Pixel-class tall emulator | 20:9+, gesture navigation |

For every target, keep screenshots from `00`, `10`, `11`, `20`, `30` and `40`.
The native runs also validate status-bar, cutout and home-indicator safe areas;
the exact 320/360/390/430 references validate wrapping and touch layout.

## Acceptance mapping

| Flow | Contract checked |
| --- | --- |
| `00_guest_onboarding_flow.yaml` | RU setup, guest choice, guide, three root tabs |
| `10_station_learning_flow.yaml` | Hidden selection affects learning, reverse direction, card and result |
| `11_station_test_flow.yaml` | Test starts with all station words even after Hide all, result and return |
| `20_general_test_resume_flow.yaml` | Test snapshot survives process death |
| `30_match_resume_flow.yaml` | Match snapshot survives process death |
| `40_settings_flow.yaml` | EN and Large persist after process death |
