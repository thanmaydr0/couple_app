import type { SupabaseClient } from '@supabase/supabase-js';
import { randomUUID } from 'expo-crypto';
import * as ImagePicker from 'expo-image-picker';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import * as FileSystem from 'expo-file-system/legacy';
import { decode } from 'base64-arraybuffer';
import { supabase } from '@/lib/supabase';
import { featureSupabase as db } from '@/lib/data/feature-client';
import { decodeWallet, draftSchema } from './schema';
import { integer, money, nextMonth, payerShare, validDate, validateCurrency } from './math';
import type { Expense, ExpenseDraft, Goal } from './types';
type RpcDatabase = { public: { Tables: Record<never, never>; Views: Record<never, never>; Functions: { wallet_settle: { Args:{p_currency:string;p_expected:number;p_note:string|null}; Returns:string } } } };
const rpc = supabase as unknown as SupabaseClient<RpcDatabase>;
const tables = ['wallet_expenses','wallet_settlements','wallet_goals','wallet_contributions','wallet_recurring'] as const;
export const walletTiming = { notificationCooldown:60_000, invalidate:300 };
export async function loadWallet(couple: string) {
  // Page through the full ledger: truncating at PostgREST's row cap corrupts balances.
  const rows = await Promise.all(tables.map(async table => {
    const all: unknown[] = []; let start = 0;
    for (;;) {
      const {data,error} = await db.from(table).select('*').eq('couple_id',couple).order('id').range(start,start+499);
      if (error) throw new Error('Wallet could not refresh. Your saved view is still here.');
      const page = data ?? []; all.push(...page); if (page.length<500) break; start+=500;
    }
    return all;
  }));
  return decodeWallet(rows);
}
export async function pickReceipt(): Promise<string | null> {
  const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permission.granted) throw new Error('Allow photos in Android settings to attach a receipt.');
  const result = await ImagePicker.launchImageLibraryAsync({mediaTypes:['images'],allowsMultipleSelection:false,exif:false});
  if (result.canceled) return null;
  const asset = result.assets[0]; if (!asset) return null;
  const context = ImageManipulator.manipulate(asset.uri);
  context.resize(asset.width>=asset.height ? {width:Math.min(asset.width,1600)} : {height:Math.min(asset.height,1600)});
  const rendered = await context.renderAsync();
  try { return (await rendered.saveAsync({format:SaveFormat.JPEG,compress:0.7})).uri; }
  finally { rendered.release(); context.release(); }
}
let lastNotification = 0;
export async function saveExpense(couple: string, draft: ExpenseDraft, id: string, receipt: string | null, existing?: Expense): Promise<{notificationFailed:boolean}> {
  draftSchema.parse(draft); payerShare(draft); validateCurrency(draft.currency);
  if (!validDate(draft.spent_on)) throw new Error('Use a real date in YYYY-MM-DD format.');
  let uploaded: string | null = null;
  let inserted = true;
  let writeStarted = false;
  try {
    if (receipt) {
      uploaded = `${couple}/receipts/${id}/${randomUUID()}.jpg`;
      const bytes = decode(await FileSystem.readAsStringAsync(receipt,{encoding:FileSystem.EncodingType.Base64}));
      const result = await supabase.storage.from('wallet-receipts').upload(uploaded,bytes,{contentType:'image/jpeg',cacheControl:'0'});
      if (result.error) throw new Error('Receipt could not upload. Try again.');
    }
    const values = {...draft,receipt_path:uploaded ?? draft.receipt_path};
    writeStarted = true;
    const result = existing ? await db.from('wallet_expenses').update(values).eq('couple_id',couple).eq('id',id).select('id').single() : await db.from('wallet_expenses').upsert({id,couple_id:couple,...values},{onConflict:'id',ignoreDuplicates:true}).select('id');
    if (result.error) throw new Error('Could not save. Your draft is still here; reconnect and retry.');
    if (!existing && Array.isArray(result.data) && !result.data.length) {
      // A retry after a lost response must not add another expense or photo.
      inserted = false;
      if (uploaded) await supabase.storage.from('wallet-receipts').remove([uploaded]);
    }
  } catch(error) {
    // A lost response can follow a committed write. Reconcile before deleting a
    // photo that the ledger may already reference, or reporting a failed save.
    if (writeStarted) {
      const persisted = await db.from('wallet_expenses').select('*').eq('id',id).eq('couple_id',couple).maybeSingle();
      const expected = {...draft,receipt_path:uploaded ?? draft.receipt_path};
      if (!persisted.error && persisted.data && Object.entries(expected).every(([key,value])=>JSON.stringify(persisted.data?.[key])===JSON.stringify(value))) {
        if (existing?.receipt_path && existing.receipt_path!==expected.receipt_path) await supabase.storage.from('wallet-receipts').remove([existing.receipt_path]);
        return {notificationFailed:!existing};
      }
      // If reconciliation itself is offline, preserve the potentially attached
      // photo. A stable expense ID makes the next save retry safe.
      if (uploaded && !persisted.error && persisted.data?.receipt_path!==uploaded) await supabase.storage.from('wallet-receipts').remove([uploaded]);
    } else if (uploaded) await supabase.storage.from('wallet-receipts').remove([uploaded]);
    throw error;
  }
  if (existing?.receipt_path && existing.receipt_path !== (uploaded ?? draft.receipt_path)) await supabase.storage.from('wallet-receipts').remove([existing.receipt_path]);
  const now = Date.now();
  if (!existing && inserted && now-lastNotification>=walletTiming.notificationCooldown) {
    lastNotification=now;
    const {data:auth} = await supabase.auth.getSession(); const viewer = auth.session?.user.id;
    const share = draft.amount_minor-payerShare(draft);
    const detail = draft.paid_by===viewer ? `you owe ${money(share,draft.currency)}` : `you paid, they owe ${money(share,draft.currency)}`;
    const result = await supabase.functions.invoke('notify-partner',{body:{channel:'plans',title:'A little wallet update',body:`They added ${money(draft.amount_minor,draft.currency)} ${draft.note || draft.category} — ${detail}`,data:{route:'/us/wallet',expense_id:id}}});
    return {notificationFailed:!!result.error};
  }
  return {notificationFailed:false};
}
export async function deleteExpense(expense: Expense) {
  // Leave the pointer available for retry when Storage is offline.
  if (expense.receipt_path) { const cleanup=await supabase.storage.from('wallet-receipts').remove([expense.receipt_path]); if(cleanup.error) throw new Error('Receipt could not be removed. Reconnect and retry deleting.'); }
  const result = await db.from('wallet_expenses').update({deleted_at:new Date().toISOString(),receipt_path:null}).eq('id',expense.id).eq('couple_id',expense.couple_id).select('id').single();
  if (result.error) throw new Error('Could not delete. Reconnect and try again.');
}
export async function settle(currency: string, expected: number, note: string) {
  const result = await rpc.rpc('wallet_settle',{p_currency:currency,p_expected:expected,p_note:note.trim() || null});
  if (result.error) throw new Error('Balance changed or the connection failed. Refresh before settling again.');
}
export async function createGoal(couple: string,user: string,title: string,emoji: string,target: number,deadline: string,id:string) {
  integer(target,1_000_000_000_000);
  if (!title.trim() || title.trim().length>80 || target===0 || (deadline && !validDate(deadline))) throw new Error('Add a title, positive target and a real deadline (or leave it blank).');
  const result=await db.from('wallet_goals').upsert({id,couple_id:couple,created_by:user,title:title.trim(),emoji:emoji || '🫙',target_minor:target,deadline:deadline || null},{onConflict:'id',ignoreDuplicates:true});
  if(result.error) throw new Error('Could not save your jar. Reconnect and retry.');
}
export async function contribute(goal:Goal,user:string,amount:number,id:string) {
  integer(amount,1_000_000_000_000); if(!amount) throw new Error('Enter a positive contribution.');
  const result=await db.from('wallet_contributions').upsert({id,goal_id:goal.id,couple_id:goal.couple_id,user_id:user,amount_minor:amount},{onConflict:'id',ignoreDuplicates:true});
  if(result.error) throw new Error('Could not add your contribution. Reconnect and retry.');
}
export async function makeRecurring(couple:string,user:string,draft:ExpenseDraft,id:string) {
  draftSchema.parse(draft); payerShare(draft); validateCurrency(draft.currency);
  const result=await db.from('wallet_recurring').upsert({id,couple_id:couple,template:{...draft,paid_by:user,receipt_path:null},cadence:'monthly',next_run:nextMonth(draft.spent_on)},{onConflict:'id',ignoreDuplicates:true});
  if(result.error) throw new Error('Expense saved; monthly repeat could not be saved. Retry repeating from the expense.');
}
export async function stopRecurring(id:string,couple:string) {
  const result=await db.from('wallet_recurring').delete().eq('id',id).eq('couple_id',couple);
  if(result.error) throw new Error('Could not stop the repeat. Try again when connected.');
}
export async function receiptUrl(path:string):Promise<string> { const result=await supabase.storage.from('wallet-receipts').createSignedUrl(path,60); if(result.error) throw new Error('Receipt unavailable. Try again.'); return result.data.signedUrl; }
