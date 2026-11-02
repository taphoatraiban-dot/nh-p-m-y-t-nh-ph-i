// Isolated subscription catalog. Prices in VND; not a payment gateway.
// Never trust a price sent by the browser. Resolve plans server-side by ID.
export const SUBSCRIPTION_PLANS = Object.freeze({
  web_1m: {edition:"web",months:1,price_vnd:799000,available:true},
  web_3m: {edition:"web",months:3,price_vnd:2290000,available:true},
  web_6m: {edition:"web",months:6,price_vnd:4390000,available:true},
  web_12m:{edition:"web",months:12,price_vnd:7990000,available:true},
  print_1m: {edition:"print",months:1,price_vnd:1299000,available:false},
  print_3m: {edition:"print",months:3,price_vnd:3690000,available:false},
  print_6m: {edition:"print",months:6,price_vnd:6990000,available:false},
  print_12m:{edition:"print",months:12,price_vnd:12990000,available:false}
} as const);
export type SubscriptionPlanId = keyof typeof SUBSCRIPTION_PLANS;
export function resolveAvailablePlan(value:unknown) {
  if(typeof value!=="string"||!Object.prototype.hasOwnProperty.call(SUBSCRIPTION_PLANS,value)) throw new Error("INVALID_PLAN");
  const plan=SUBSCRIPTION_PLANS[value as SubscriptionPlanId];
  if(!plan.available) throw new Error("PLAN_NOT_AVAILABLE");
  return {id:value as SubscriptionPlanId,...plan};
}
// An invoice marked unpaid does not constitute proof of a bank transfer.
// Granting pay-later access requires a separate, auditable server-side policy.
