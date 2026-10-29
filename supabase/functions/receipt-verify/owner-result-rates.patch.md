# Owner-only payout rates patch

Production Edge Function receipt-verify v28 remains unchanged pending integration validation.

Inside the authenticated `owner-result` response, add these fields to the `source` object only:

```diff
- source: { rawText: source.rawText, totalGross: source.totalGross, finalTotal: source.finalTotal, pricedRows: source.pricedRows, drawDate: date },
+ source: { rawText: source.rawText, totalGross: source.totalGross, finalTotal: source.finalTotal, pricedRows: source.pricedRows, drawDate: date, payoutRatesSnapshot: source.payoutRatesSnapshot, payoutRatesSnapshotVersion: source.payoutRatesSnapshotVersion },
```

Never add `payoutRatesSnapshot` to public `check`, `owner-access`, or `issue` responses. The existing owner JWT and `owner_user_id` authorization must remain in place. Do not compute a finalized payout until all supported types and results are verified.
