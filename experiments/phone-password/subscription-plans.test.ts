import {SUBSCRIPTION_PLANS,resolveAvailablePlan} from "./subscription-plans.ts";
function assert(ok:boolean,message:string){if(!ok)throw new Error(message)}
const expected={
 web_1m:799000,web_3m:2290000,web_6m:4390000,web_12m:7990000,
 print_1m:1299000,print_3m:3690000,print_6m:6990000,print_12m:12990000
} as const;
assert(Object.keys(SUBSCRIPTION_PLANS).length===8,"Must have exactly 8 plans");
for(const [id,price] of Object.entries(expected)){
 const p=SUBSCRIPTION_PLANS[id as keyof typeof SUBSCRIPTION_PLANS];
 assert(p.price_vnd===price,"Incorrect price: "+id);
 assert(p.available===id.startsWith("web_"),"Incorrect availability: "+id);
 if(p.available)assert(resolveAvailablePlan(id).id===id,"WEB plan rejected: "+id);
 else {
  let blocked=false;
  try{resolveAvailablePlan(id)}catch(e){blocked=(e as Error).message==="PLAN_NOT_AVAILABLE"}
  assert(blocked,"Unreleased print plan was accepted: "+id);
 }
}
for(const bad of ["permanent","trial","web_0m","web_24m","__proto__",null,799000]){
 let blocked=false;
 try{resolveAvailablePlan(bad)}catch{blocked=true}
 assert(blocked,"Invalid plan accepted: "+String(bad));
}
console.log("PASS: 8 prices, 4 unavailable print plans, invalid plan rejection");
