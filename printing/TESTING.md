# Print-core smoke test
Run in a browser after loading printing/print-core.js.

```js
const p = window.CuncunPrintCore;
console.assert(p.lock('receipt-1') === true);
console.assert(p.lock('receipt-1') === false, 'duplicate should be blocked');
p.unlock('receipt-1');
console.assert(p.lock('receipt-1') === true);
p.unlock('receipt-1');
console.assert(p.normalizeState('pending') === 'queued');
console.assert(p.normalizeState('processing') === 'printing');
console.assert(p.displayState('shared').includes('chưa xác nhận'));
console.assert(typeof p.createJobId() === 'string');
```

This is not a hardware integration test. Do not report physical printing success from these checks.
