import { useState } from 'react';
import { Image, View } from 'react-native';
import { randomUUID } from 'expo-crypto';
import { BottomSheet, Button, Slider, Text, TextField } from '@/ui';
import { useTheme } from '@/theme';
import { PressableScale } from '@/motion';
import { amountText, localDate, money, parseMoney, payerShare } from './math';
import { categoryIcons, Choice, Row } from './Presentation';
import { makeRecurring, pickReceipt, saveExpense } from './service';
import { categories, type Category, type Expense, type ExpenseDraft, type SplitType } from './types';
export function ExpenseEditor({couple,uid,partner,expense,offline,onClose,onSaved}: {couple:string;uid:string;partner:{id:string;display_name:string|null}|null;expense?:Expense;offline:boolean;onClose:()=>void;onSaved:(message:string)=>void}) {
 const {spacing,colors,geometry,radius}=useTheme();
 const [id]=useState(()=>expense?.id ?? randomUUID()); const [repeatId]=useState(randomUUID);
 const [amount,setAmount]=useState(expense?amountText(expense.amount_minor):''); const [category,setCategory]=useState<Category>(expense?.category ?? 'food');
 const [paidBy,setPaidBy]=useState(expense?.paid_by ?? uid); const [currency,setCurrency]=useState(expense?.currency ?? 'INR');
 const [splitType,setSplitType]=useState<SplitType>(expense?.split_type ?? 'equal'); const [percent,setPercent]=useState((expense?.split.payer_bps ?? 5000)/100);
 const [custom,setCustom]=useState(expense?.split.payer_minor!==undefined?amountText(expense.split.payer_minor):'');
 const [note,setNote]=useState(expense?.note ?? ''); const [date,setDate]=useState(expense?.spent_on ?? localDate());
 const [receipt,setReceipt]=useState<string|null>(null); const [keepReceipt,setKeepReceipt]=useState(!!expense?.receipt_path); const [repeat,setRepeat]=useState(false);
 const [busy,setBusy]=useState(false); const [error,setError]=useState(''); const [expenseSaved,setExpenseSaved]=useState(false);
 const draft=():ExpenseDraft=>({paid_by:paidBy,amount_minor:parseMoney(amount),currency:currency.toUpperCase(),category,note:note.trim() || null,split_type:splitType,split:splitType==='percent'?{payer_bps:Math.round(percent*100)}:splitType==='custom'?{payer_minor:parseMoney(custom)}:{},spent_on:date,receipt_path:keepReceipt?expense?.receipt_path ?? null:null});
 let splitPreview='Equal, with the odd paise kept by the payer';try { const d=draft();splitPreview=`Payer’s share ${money(payerShare(d),currency)} · other share ${money(d.amount_minor-payerShare(d),currency)}`; } catch { /* incomplete input */ }
 const save=async()=>{
  if(busy || offline) return; setBusy(true);setError('');
  try {
   const d=draft();if(!d.amount_minor) throw new Error('Enter an amount greater than zero.');
   let notificationFailed=false;
   if(!expenseSaved) {const saved=await saveExpense(couple,d,id,receipt,expense);notificationFailed=saved.notificationFailed;setExpenseSaved(true);}
   if(repeat && !expense) await makeRecurring(couple,uid,d,repeatId);
   onSaved(notificationFailed?'Expense saved. Partner notification could not be delivered.':'Saved, together.');
  } catch(e) {setError(e instanceof Error?e.message:'Could not save. Try again.');} finally {setBusy(false);}
 };
 const key=(value:string)=>{if(expenseSaved) return;if(value==='⌫')setAmount(v=>v.slice(0,-1));else setAmount(v=>{const next=(value==='.' && !v?'0':v)+value;return /^\d{0,11}(\.\d{0,2})?$/.test(next)?next:v;});};
 return <BottomSheet visible title={expense?'Edit our expense':'A little expense'} initialSnapIndex={1} onClose={()=>{if(!busy)onClose();}}>
  <Text variant="display/L" accessibilityLiveRegion="polite">{currency} {amount || '0'}</Text>
  <View style={{gap:spacing.sm}}>{[['1','2','3'],['4','5','6'],['7','8','9'],['.','0','⌫']].map((row,i)=><View key={i} style={{flexDirection:'row',gap:spacing.sm}}>{row.map(value=><PressableScale key={value} accessibilityRole="button" accessibilityLabel={value==='⌫'?'Delete last digit':value==='.'?'Decimal point':value} disabled={busy || expenseSaved} onPress={()=>key(value)} style={{flex:1,minHeight:geometry.touch+spacing.sm,alignItems:'center',justifyContent:'center',borderRadius:radius.md,backgroundColor:colors.surfaceAlt}}><Text variant="title/L">{value}</Text></PressableScale>)}</View>)}</View>
  {error && <Text color="danger" accessibilityLiveRegion="polite">{error}</Text>}
  <Button title={expenseSaved?'Retry monthly repeat':expense?'Save changes':'Save expense'} loading={busy} disabled={offline} onPress={()=>void save()}/>
  <Text variant="caption" color="textSecondary">{offline?'Reconnect to save. Your draft stays here.':'Equal split is ready. Add a detail only if you want to.'}</Text>
  <Text variant="label">Category</Text><Row>{categories.map(c=><Choice key={c} label={c} icon={categoryIcons[c]} selected={category===c} disabled={busy || expenseSaved} onPress={()=>setCategory(c)}/>)}</Row>
  <Text variant="label">Who paid?</Text><Row><Choice label="I paid" selected={paidBy===uid} disabled={busy || expenseSaved} onPress={()=>setPaidBy(uid)}/>{partner && <Choice label={`${partner.display_name || 'They'} paid`} selected={paidBy===partner.id} disabled={busy || expenseSaved} onPress={()=>{setPaidBy(partner.id);setRepeat(false);}}/>}</Row>
  <Text variant="label">Split, from the payer’s point of view</Text><Row>{([['equal','Equal'],['percent','Percentage'],['paid_for_partner','Paid for them'],['paid_for_me','Just for payer'],['custom','Custom']] as const).map(([value,label])=><Choice key={value} label={label} selected={splitType===value} disabled={busy || expenseSaved} onPress={()=>setSplitType(value)}/>)}</Row>
  {splitType==='percent' && <><Text>Payer {percent}% · other person {100-percent}%</Text><Slider disabled={busy || expenseSaved} value={percent} minimumValue={0} maximumValue={100} step={1} onValueChange={setPercent} accessibilityLabel="Payer percentage"/></>}
  {splitType==='custom' && <TextField label="Payer share (major units)" keyboardType="decimal-pad" value={custom} onChangeText={setCustom} editable={!busy && !expenseSaved}/>}
  <Text variant="caption" color="textSecondary">{splitPreview}</Text>
  <TextField label="A note, if you like" value={note} maxLength={500} onChangeText={setNote} editable={!busy && !expenseSaved}/>
  <TextField label="Spent on · YYYY-MM-DD" value={date} onChangeText={setDate} editable={!busy && !expenseSaved}/>
  <TextField label="Currency · INR, USD, EUR, GBP… (2 decimals)" value={currency} maxLength={3} autoCapitalize="characters" onChangeText={value=>setCurrency(value.toUpperCase())} editable={!busy && !expenseSaved}/>
  <Text variant="caption" color="textSecondary">Receipts are private to your couple. No photo is attached unless you choose one.</Text>
  {receipt && <Image source={{uri:receipt}} accessibilityLabel="Selected receipt" style={{width:geometry.touch*2,height:geometry.touch*2,borderRadius:radius.md}}/>}
  <Button variant="secondary" title={receipt || keepReceipt?'Receipt attached · replace':'Attach receipt photo'} disabled={busy || expenseSaved} onPress={()=>{setBusy(true);void pickReceipt().then(uri=>{if(uri){setReceipt(uri);setKeepReceipt(false);}}).catch(e=>setError(e instanceof Error?e.message:'Photo unavailable')).finally(()=>setBusy(false));}}/>
  {(receipt || keepReceipt) && <Button variant="ghost" title="Remove receipt" disabled={busy || expenseSaved} onPress={()=>{setReceipt(null);setKeepReceipt(false);}}/>}
  {!expense && <><Choice label={repeat?'Monthly repeat on · tap to turn off':'Repeat monthly · off'} selected={repeat} disabled={busy || expenseSaved || paidBy!==uid} onPress={()=>setRepeat(v=>!v)}/><Text variant="caption" color="textSecondary">Repeats begin next month, paid by you. Stop any repeat from the Wallet screen.</Text></>}
 </BottomSheet>;
}

