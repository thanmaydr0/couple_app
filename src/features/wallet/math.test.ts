import { amountText, balances, convertMinor, csv, nextMonth, parseMoney, payerShare, validDate, validateCurrency } from './math';
import type { Expense, Settlement } from './types';
let checks = 0;
function equal(actual: unknown, expected: unknown) { checks++; if (JSON.stringify(actual) !== JSON.stringify(expected)) throw new Error(`${JSON.stringify(actual)} != ${JSON.stringify(expected)}`); }
function rejects(fn: () => unknown) { checks++; let threw = false; try { fn(); } catch { threw = true; } if (!threw) throw new Error('Expected rejection'); }
const expense: Expense = { id:'e',couple_id:'c',paid_by:'me',amount_minor:451,currency:'INR',category:'food',note:'Dinner',split_type:'equal',split:{},spent_on:'2026-10-13',receipt_path:null,recurring_id:null,created_at:'',deleted_at:null };
const settlement: Settlement = { id:'s',couple_id:'c',from_user:'them',to_user:'me',amount_minor:225,currency:'INR',settled_at:'',note:null };
equal(parseMoney('450.09'),45009); equal(amountText(9),'0.09'); rejects(() => parseMoney('1.001')); rejects(() => parseMoney('-1')); rejects(() => parseMoney('99999999999'));
equal(payerShare(expense),226); equal(payerShare({...expense,split_type:'percent',split:{payer_bps:2500}}),113);
equal(payerShare({...expense,split_type:'paid_for_partner'}),0); equal(payerShare({...expense,split_type:'paid_for_me'}),451);
equal(payerShare({...expense,split_type:'custom',split:{payer_minor:100}}),100); rejects(() => payerShare({...expense,split_type:'custom',split:{payer_minor:500}}));
equal(balances([expense],[],'me'),{INR:225}); equal(balances([expense],[],'them'),{INR:-225}); equal(balances([expense],[settlement],'me'),{INR:0});
equal(balances([{...expense,deleted_at:'now'}],[],'me'),{}); equal(balances([expense,{...expense,currency:'USD'}],[],'me'),{INR:225,USD:225});
equal(convertMinor(12345,'83.125'),1026178); equal(convertMinor(-1,'0.5'),-1); rejects(() => convertMinor(100,'0'));
equal(nextMonth('2026-01-31'),'2026-02-28'); equal(nextMonth('2028-01-31'),'2028-02-29');
equal(csv([{...expense,note:'=SUM(1,2)"'}],'2026-10').includes("'=SUM"),true);
equal(validDate('2026-02-29'),false); equal(validDate('2028-02-29'),true); equal(validDate('2026-13-01'),false);
equal(balances([{...expense,paid_by:'them'}],[{...settlement,from_user:'me',to_user:'them'}],'me'),{INR:0});
equal(payerShare({...expense,amount_minor:1_000_000_000_000,split_type:'percent',split:{payer_bps:9999}}),999_900_000_000);
rejects(()=>validateCurrency('JPY')); rejects(()=>validateCurrency('KWD')); equal(validateCurrency('USD'),undefined);
console.log(`Wallet math: ${checks} assertions passed`);
