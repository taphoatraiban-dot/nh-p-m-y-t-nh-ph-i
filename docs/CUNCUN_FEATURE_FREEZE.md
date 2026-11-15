# CUNCUN feature freeze — 2026-11-15

Baseline backup branch: `backup/cuncun-2026-11-15-feature-freeze`.

## Preserve existing behavior
- Bet parsing and station selection for MN/MT/HN, including aliases, decimal stakes, DA, B, DD, XC, XDAO and chained functions.
- Pricing, customer accounts, statistics, debt tracking, bet archives, customer messages and history.
- Telegram chat and sync, printing and CuncunPrint, device administration, regular/Pro permissions and login.
- Stored customer data, price tables, and settings. Never delete or reset these as a side effect of a parser fix.

## Change protocol
1. Make changes on a feature branch, not directly on main.
2. Keep the diff narrowly scoped; do not refactor unrelated code.
3. Run `node --test tests/*.test.cjs` and add a regression case for every repaired bug.
4. Verify affected UI, printing, and Telegram workflows where relevant; parser tests alone cannot prove those features.
5. Review the diff and test results before merging or deploying.
6. Keep backup branch intact. Revert the specific bad commit if a regression is detected.

## Enforcement limits
The GitHub Actions workflow reports test failures; it does NOT prevent direct pushes by itself. Enable GitHub branch protection or a ruleset for `main` requiring pull requests and a successful `parser-regression` check to make the guard mandatory. This repository document is a policy, not a technical lock.
