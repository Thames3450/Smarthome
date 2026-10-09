# Home Thames v2.4 Verification

- `npm run check`: JavaScript syntax validated.
- `npm test`: 27 passing tests, including timezone, leap year, range shifts, monthly totals, SQL function protections, font references, and retained device flows.
- UI smoke: Desktop 1440px, Mobile 390px using an inlined-script DOM harness in headless Chromium (same production app/css code).
- Tested 7/24/31/12 bins for week/day/month/year and Feb 2026 (28 days), month bill selector, power detail chart.
- Verified no horizontal document overflow, no JavaScript page errors, and Sarabun CSS font family in Chromium.
- The complete deployed website with a real Supabase project and physical ESP32 was NOT tested.
