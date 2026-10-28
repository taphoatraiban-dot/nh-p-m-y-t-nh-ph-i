# LOCKED REGRESSION: shared XC + XDUOI (verified by user 2026-10-28)

Do not regress this behavior when modifying normalization, Telegram import or parseBets.

## Input A (single station)
btre
148.348.848xc3.xduoi10

Expected Bến Tre rows:
148 XC 3
348 XC 3
848 XC 3
148 XC-ĐUÔI 10
348 XC-ĐUÔI 10
848 XC-ĐUÔI 10

## Input B (HN)
hn
111.911.191xc3.xduoi10

Expected HN rows:
111 XC 3
911 XC 3
191 XC 3
111 XC-ĐUÔI 10
911 XC-ĐUÔI 10
191 XC-ĐUÔI 10

## Input C (combined)
btre
148.348.848xc3.xduoi10
hn
111.911.191xc3.xduoi10

Expected: 12 wager rows, six in each station. The same result must occur when entered manually or copied from Telegram.

## Input D (long production sample)
2dmn
32.92da1.
57.75da1.
3272da1
233272da2.
973.592.652xc6.
7186da2.
3333b1.
333xc10.
3dmn
639b3.xc5.
030xc60.
2dmn
2332da1.
3dmn
1123b2.
3dmn
1991b1.
991.b1.
Btre
48dau10.duoi20
148.348.848xc3.xduoi10
Vtau
951.111b0,5.xc3
732b0,5.xc5
Blieu
58dau50.
59dau10.

Expected Bến Tre includes all six shared XC/XDUOI rows, not just 848 XC-DUOI.
Do not assert an overall total without reconciling the entire wager and pricing table.

## Protected implementation
Keep the original-input preservation and post-normalization shared XC/XDUOI reconciliation in index.html. Do not remove either without automated and iPhone regression tests. The user confirmed the production behavior after commit c0df5cf05793d97457cf6fd12b61cb2157328c44.

This is a regression fixture/specification, not an executable automated test.
