import assert from 'node:assert/strict';
import { isApprovedProPrice } from '../billingPolicy';
const price = {active:true,currency:'usd',unit_amount:4999,recurring:{interval:'year',interval_count:1}};
assert.equal(isApprovedProPrice(price),true);
for (const invalid of [
 {...price, unit_amount:11988}, {...price, unit_amount:1999}, {...price,unit_amount:null},
 {...price,currency:'eur'}, {...price,active:false}, {...price,recurring:null},
 {...price,recurring:{interval:'month',interval_count:12}}, {...price,recurring:{interval:'year',interval_count:2}},
]) assert.equal(isApprovedProPrice(invalid),false);
console.log('Billing price guard: approved annual price accepted; 8 mismatched or inactive prices rejected.');
