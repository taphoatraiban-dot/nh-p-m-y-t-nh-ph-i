/** Prices only; no writes to auth, licenses or devices. */
export const PRICES = Object.freeze({
 WEB: Object.freeze({1:799000,3:2290000,6:4390000,12:7990000}),
 WEB_PRINT: Object.freeze({1:1299000,3:3690000,6:6990000,12:12990000})
});
export const WEB_PRINT_ON_SALE = false;
export function quote(plan,months) {
 if(!Object.hasOwn(PRICES,plan)||!Object.hasOwn(PRICES[plan],months)) throw new RangeError('Invalid plan or months');
 return Object.freeze({plan,months:Number(months),amountVnd:PRICES[plan][months],canSell:plan==='WEB'||WEB_PRINT_ON_SALE});
}
export function addMonthsClamped(iso,months) {
 if(![1,3,6,12].includes(months)) throw new RangeError('Invalid months');
 const d=new Date(iso);
 if(!Number.isFinite(d.getTime())) throw new RangeError('Invalid date');
 const target=new Date(Date.UTC(d.getUTCFullYear(),d.getUTCMonth()+months,1,d.getUTCHours(),d.getUTCMinutes(),d.getUTCSeconds(),d.getUTCMilliseconds()));
 const last=new Date(Date.UTC(target.getUTCFullYear(),target.getUTCMonth()+1,0)).getUTCDate();
 target.setUTCDate(Math.min(d.getUTCDate(),last));
 return target.toISOString();
}
export function renewalQuote({now,expiresAt,plan,months}) {
 const price=quote(plan,months);
 if(!price.canSell) throw new RangeError('Plan not on sale');
 const nowMs=Date.parse(now),expiryMs=expiresAt?Date.parse(expiresAt):NaN;
 if(!Number.isFinite(nowMs)) throw new RangeError('Invalid now');
 const base=Number.isFinite(expiryMs)&&expiryMs>nowMs?expiresAt:now;
 return Object.freeze({...price,proposedExpiresAt:addMonthsClamped(base,price.months),status:'awaiting_admin_confirmation'});
}
