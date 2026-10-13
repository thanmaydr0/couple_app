import { useState } from 'react';
import { View } from 'react-native';
import { Button, PressableScale, Text, TextField } from '@/ui';
import { useTheme } from '@/theme';
import { validDate } from './geo';

export function DatePicker({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const { spacing, colors, radius, geometry } = useTheme(); const [open,setOpen] = useState(false);
  const initial = validDate(value) ? new Date(`${value}T12:00:00`) : new Date();
  const [month,setMonth] = useState(new Date(initial.getFullYear(),initial.getMonth(),1));
  const count = new Date(month.getFullYear(),month.getMonth()+1,0).getDate();
  // Six columns preserve a 48dp target on narrow Android displays.
  return <View style={{gap:spacing.sm}}><TextField label="Visit date (optional, YYYY-MM-DD)" value={value} onChangeText={onChange} keyboardType="numbers-and-punctuation" maxLength={10} error={value && !validDate(value) ? 'Use a real date: YYYY-MM-DD.' : undefined} />
    <Button title={open ? 'Close calendar' : 'Choose date'} variant="secondary" onPress={()=>setOpen(!open)} />
    {open && <View style={{gap:spacing.sm}}><View style={{flexDirection:'row',alignItems:'center'}}><PressableScale accessibilityRole="button" accessibilityLabel="Previous month" onPress={()=>setMonth(new Date(month.getFullYear(),month.getMonth()-1,1))} style={{alignItems:'center',justifyContent:'center'}}><Text>‹</Text></PressableScale><Text variant="label" style={{flex:1,textAlign:'center'}}>{month.toLocaleDateString(undefined,{month:'short',year:'numeric'})}</Text><PressableScale accessibilityRole="button" accessibilityLabel="Next month" onPress={()=>setMonth(new Date(month.getFullYear(),month.getMonth()+1,1))} style={{alignItems:'center',justifyContent:'center'}}><Text>›</Text></PressableScale></View>
      <View style={{flexDirection:'row',flexWrap:'wrap'}}>{Array.from({length:count},(_,i)=>{ const day=i+1; const date=`${month.getFullYear()}-${String(month.getMonth()+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
        return <PressableScale key={day} accessibilityRole="button" accessibilityLabel={new Date(`${date}T12:00:00`).toLocaleDateString(undefined,{dateStyle:'full'})} accessibilityState={{selected:value===date}} onPress={()=>{onChange(date);setOpen(false);}} style={{width:'16.666%',minHeight:geometry.touch,borderRadius:radius.sm,alignItems:'center',justifyContent:'center',backgroundColor:value===date ? colors.primary : colors.surface}}><Text color={value===date ? 'primaryContrast' : 'textPrimary'}>{day}</Text></PressableScale>;
      })}</View></View>}
  </View>;
}
