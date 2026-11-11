# Mobile lab numbers for the RES performance change

Method: Lighthouse 12.6.1, mobile form factor, Moto G Power emulation (412×823, DPR 1.75), simulated throttling, `--only-categories=performance`, headless Chrome. Each reported median is the middle of three runs. TBT is the lab stand-in for INP. `max-potential-fid` is the longest main-thread task and is a better single-interaction proxy than summed TBT. Lab TBT is not field INP.

Before is production `https://hashpop.io` (main, including `#113` `79136fe` and `#114` `aecf656`). After is the Vercel preview of this branch. Preview HTML is behind Vercel Authentication; runs that landed on the Vercel login page were discarded. JSON in this folder has the bypass cookie redacted and the full-page screenshot bytes replaced with `[extracted]`. PNGs are the end-of-load viewport, after the splash has dismissed.

`/support` is a real route (HTTP 200, title “Support · Hashpop”). It is not a redirect or a 404.

## Priority routes

| Route          |                              | Perf |   FCP |    LCP |   TBT |   CLS | First Load JS | Runtime JS |
| -------------- | ---------------------------- | ---: | ----: | -----: | ----: | ----: | ------------: | ---------: |
| `/marketplace` | before                       |   47 | 1.53s | 23.72s | 1.74s |     0 |        193 kB |   ~1600 kB |
| `/marketplace` | after, 3 runs, grid hydrated |   96 | 1.07s |  2.73s |   8ms | 0.001 |        145 kB |    ~423 kB |
| `/support`     | before                       |   49 | 1.53s | 23.57s | 1.49s |     0 |       90.4 kB |   ~1589 kB |
| `/support`     | after, median of 3           |   93 | 1.22s |  3.17s |  12ms |     0 |       90.2 kB |    ~423 kB |

First Load JS is gzip from `next build` and does not include dynamic chunks. Runtime JS is transfer size of `Script` requests in the Lighthouse network log. Production downloaded HashConnect chunks of about 530 kB, 327 kB, and 171 kB on both routes. Those requests are absent after this change. The splash file `/hashpop-cart-3d.PNG` went from 3,879,975 bytes to 111,328 bytes.

LCP element on production, on `/support` after, and on the hydrated marketplace runs: `div.hp-splash-overlay > div.flex > img.hp-splash-logo`.

`/support` runs (score, FCP ms, LCP ms, TBT ms): (93, 1223, 3174, 0), (92, 1229, 3329, 17), (93, 1224, 3174, 12). Median max-potential-FID 60ms.

Hydrated `/marketplace` runs: (96, 1084, 2734, 36), (92, 1075, 3326, 8), (96, 928, 2730, 0). Median max-potential-FID 58ms. JSON: `after/marketplace-client-grid-*.json`.

A follow-up commit put the card grid in the static HTML (`useSearchParams` had been bailing that route out to “Loading listings…”). Two authenticated runs on that preview: (82, 1333, 4850, 33, CLS 0) and (94, 1228, 3028, 16, CLS 0.001). A third run could not be collected; later sessions were sent to the Vercel login page. Those two runs are `after/marketplace-final-1.json` and `after/marketplace-final-2.json`. The LCP element audit was `notApplicable` on both, so the 4.85s sample is not tied to a node.

## RES-weighted estimate

Vercel mobile curves, p10 ≈ 90 and median ≈ 50: FCP 1.8s–3s, LCP 2.5s–4s, INP 200ms–500ms, CLS 0.1–0.25. Weights: FCP 15%, LCP 30%, INP 30%, CLS 25%. Scored with the Lighthouse log-normal (`QUANTILE_AT_VALUE`).

| Route                                             | INP input               | RES |
| ------------------------------------------------- | ----------------------- | --: |
| `/marketplace` before                             | TBT 1.74s               |  41 |
| `/marketplace` before                             | max-potential-FID 591ms |  52 |
| `/support` before                                 | TBT 1.49s               |  41 |
| `/support` before                                 | max-potential-FID 582ms |  52 |
| `/support` after (median of 3)                    | TBT 12ms                |  92 |
| `/support` after                                  | max-potential-FID 60ms  |  92 |
| `/marketplace` after (median of 3, hydrated grid) | TBT 8ms                 |  95 |
| `/marketplace` final run, LCP 3.03s               | TBT 16ms                |  93 |
| `/marketplace` final run, LCP 4.85s               | TBT 33ms                |  79 |

CLS stays at the top of the curve. The lab estimate clears 90 when LCP is about 3.2s or better and main-thread tasks stay under 200ms. It does not clear 90 on the 4.85s marketplace sample. Field INP is not in this table.

## Secondary

Galaxy Gas, `/listing/lst-1789509247906-l5i6xsq`, median of 3: perf 77, FCP 1.23s, LCP 6.34s, TBT 66ms, CLS 0.023, max-potential-FID 104ms. RES about 73 with TBT as the INP input. LCP element is the hero `img.object-contain` (next/image, `fetchpriority=high`). First Load JS is still 318 kB (was 320 kB).

`/` on production is a 307 to `/marketplace`. This branch does not change `app/page.tsx`. One preview run whose final URL stayed `/` measured perf 93, FCP 1.08s, LCP 3.20s, TBT 29ms, CLS 0.001, LCP element the splash logo. That is one run, not a median of 3.
