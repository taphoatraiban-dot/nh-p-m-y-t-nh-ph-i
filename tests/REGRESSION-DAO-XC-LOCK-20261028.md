# DAO XC — LOCKED REGRESSION SPEC (2026-10-28)

User verified production works at main commit c5e2cbc2b3a04f7dc7022a8ce858f9224f615d5e.

## Exact input (full sample)
```
2dmn
3300 bdao1.,300.033 bdao1.xdao10.,3333,0000b1.
333,000b1.xc10.
33,00da2.dd20.
```

Expected:
- 3300 DAO BL 1n = 192k
- 300 DAO BL 1n = 102k
- 033 DAO BL 1n = 102k
- 300 DAO XC 10n = 120k, EXACTLY ONCE
- 033 DAO XC 10n = 120k, EXACTLY ONCE
- 3333 Bao 4 1n = 32k
- 0000 Bao 4 1n = 32k
- 333 Bao 3 1n = 34k
- 000 Bao 3 1n = 34k
- 333 XC 10n = 40k
- 000 XC 10n = 40k
- 33-00 DA 2n = 144k
- 33 DD 20n = 80k
- 00 DD 20n = 80k

Expected gross = 1152k. The shorter sample WITHOUT DA/DD = 848k.
Do not double-add 033 DAO XC and do not drop 300 DAO XC.
Check manual paste, Telegram import, mixed station blocks and long 13-message sample.

## Full 13-message regression
Expected gross by region: MN 2044k; MT 3252k; HN 2603k; total 7899k.
Also preserve the earlier locked shared XC/XDUOI fixture:
148.348.848xc3.xduoi10 => 3 XC and 3 XC-DUOI, each once.

This is a documented acceptance fixture, NOT an executable automated test. Future edits to parser or normalization require automated tests and live verification before deployment.
