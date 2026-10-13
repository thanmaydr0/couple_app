import type { PropsWithChildren } from 'react';
import { useEffect } from 'react';
import { View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import Svg, { Circle, Path, Rect } from 'react-native-svg';
import Animated, { cancelAnimation, useAnimatedStyle, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';
import { useTheme } from '@/theme';
import { PressableScale, useMotion } from '@/motion';
import { Card, Text } from '@/ui';
import { categories, type Category, type Expense, type Goal } from './types';
import { money } from './math';
export const categoryIcons: Record<Category, keyof typeof Ionicons.glyphMap> = {food:'restaurant-outline',groceries:'basket-outline',rent:'home-outline',travel:'airplane-outline',fun:'sparkles-outline',gifts:'gift-outline',bills:'receipt-outline',health:'heart-outline',other:'ellipsis-horizontal'};
export function Choice({label,selected,onPress,icon,disabled=false}: {label:string;selected?:boolean;onPress:()=>void;icon?:keyof typeof Ionicons.glyphMap;disabled?:boolean}) {
 const {colors,spacing,radius,geometry}=useTheme();
 return <PressableScale disabled={disabled} accessibilityRole="button" accessibilityState={{selected}} onPress={onPress} style={{minHeight:geometry.touch,paddingHorizontal:spacing.md,paddingVertical:spacing.sm,borderRadius:radius.pill,backgroundColor:selected?colors.primary:colors.surfaceAlt,borderWidth:geometry.hairline,borderColor:colors.border,flexDirection:'row',alignItems:'center',gap:spacing.sm}}>{icon && <Ionicons name={icon} size={geometry.icon} color={selected?colors.primaryContrast:colors.textPrimary}/>}<Text variant="label" color={selected?'primaryContrast':'textPrimary'}>{label}</Text></PressableScale>;
}
export function Row({children}:PropsWithChildren) { const {spacing}=useTheme(); return <View style={{flexDirection:'row',flexWrap:'wrap',alignItems:'center',gap:spacing.sm}}>{children}</View>; }
export function LiquidJar({goal}: {goal:Goal}) {
 const {colors,spacing,radius,geometry}=useTheme(); const motion=useMotion(); const level=useSharedValue(0); const wave=useSharedValue(0);
 const fill=Math.min(1,goal.saved_minor/goal.target_minor); const size=geometry.touch*2;
 useEffect(()=>{level.value=motion.level==='full'?withTiming(fill,{duration:motion.duration('hero')}):fill;},[fill,motion.level,level]);
 useEffect(()=>{wave.value=0;if(motion.level==='full') wave.value=withRepeat(withTiming(1,{duration:motion.duration('drift')}),-1,true);return()=>cancelAnimation(wave);},[wave,motion.level]);
 const animated=useAnimatedStyle(()=>({height:size*level.value,transform:[{translateX:motion.level==='full'?wave.value*spacing.xs:0}]}));
 const days=goal.deadline?Math.ceil((new Date(`${goal.deadline}T23:59:59`).getTime()-Date.now())/86400000):null;
 return <Row><View accessible accessibilityRole="progressbar" accessibilityLabel={`${goal.title}, ${Math.round(fill*100)} percent saved`} accessibilityValue={{min:0,max:100,now:Math.round(fill*100)}} style={{width:size,height:size,borderWidth:geometry.stroke,borderColor:colors.primary,borderRadius:radius.sheet,overflow:'hidden',backgroundColor:colors.surfaceAlt,justifyContent:'flex-end'}}><Animated.View style={[{backgroundColor:colors.primary,width:'110%',borderTopLeftRadius:radius.lg,borderTopRightRadius:radius.lg},animated]}>{fill>0 && <Svg width="100%" height={spacing.md} viewBox={`0 0 ${size} ${spacing.md}`} style={{position:'absolute',top:-spacing.sm}}><Path d={`M0 ${spacing.sm} Q${size/4} 0 ${size/2} ${spacing.sm} T${size} ${spacing.sm} V${spacing.md} H0 Z`} fill={colors.primary}/></Svg>}</Animated.View><View style={{position:'absolute',inset:0,alignItems:'center',justifyContent:'center'}}><Text variant="display/M">{goal.emoji}</Text></View></View><View style={{flex:1,gap:spacing.sm}}><Text variant="title/M">{goal.title}</Text><Text>{money(goal.saved_minor)} / {money(goal.target_minor)}</Text><Text variant="caption" color="textSecondary">{fill>=1?'You made it, together ✨':days===null?'One little contribution at a time':days<0?'Deadline passed — keep going':`${days} days to ${goal.deadline}`}</Text></View></Row>;
}
export function SpendingCharts({expenses,all,currency,month,uid}: {expenses:Expense[];all:Expense[];currency:string;month:string;uid:string}) {
 const {colors,spacing,geometry}=useTheme(); const motion=useMotion(); const progress=useSharedValue(1);
 const signature=expenses.map(e=>`${e.id}:${e.amount_minor}:${e.category}:${e.paid_by}`).join('|');
 useEffect(()=>{progress.value=motion.level==='off'?1:0;progress.value=withTiming(1,{duration:motion.duration('base')});},[signature,month,currency,motion.level,progress]);
 const animated=useAnimatedStyle(()=>({opacity:progress.value,transform:[{scaleY:motion.level==='full'?0.9+progress.value*0.1:1}]}));
 const width=geometry.touch*6; const height=geometry.touch*2;
 const palette=[colors.primary,colors.accent,colors.success,colors.warning,colors.textSecondary];
 const total=expenses.reduce((sum,e)=>sum+e.amount_minor,0);
 const groups=categories.map(category=>({category,value:expenses.filter(e=>e.category===category).reduce((sum,e)=>sum+e.amount_minor,0)})).filter(g=>g.value>0);
 const anchor=new Date(`${month}-01T12:00:00`);
 const months=Array.from({length:6},(_,i)=>{const d=new Date(anchor);d.setMonth(d.getMonth()-5+i);const key=`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;return {key,label:d.toLocaleDateString('en-IN',{month:'short'}),value:all.filter(e=>!e.deleted_at && e.currency===currency && e.spent_on.startsWith(key)).reduce((sum,e)=>sum+e.amount_minor,0)};});
 const maximum=Math.max(1,...months.map(m=>m.value)); let offset=0; const r=height/3; const circumference=2*Math.PI*r;
 const mine=expenses.filter(e=>e.paid_by===uid).reduce((sum,e)=>sum+e.amount_minor,0);
 return <Card style={{gap:spacing.md}}><Text variant="title/M">Our spending · {currency}</Text><Text color="textSecondary">{money(total,currency)} this month</Text><Animated.View style={animated}><View accessible accessibilityLabel={months.map(m=>`${m.label}: ${money(m.value,currency)}`).join('. ')}><Svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`}>{months.map((m,i)=><Rect key={m.key} x={i*width/6+spacing.sm} y={height-height*m.value/maximum} width={width/6-spacing.md} height={height*m.value/maximum} rx={spacing.xs} fill={m.key===month?colors.primary:colors.accent}/>)}</Svg><View style={{flexDirection:'row'}}>{months.map(m=><Text key={m.key} variant="caption" style={{flex:1,textAlign:'center'}}>{m.label}</Text>)}</View></View><Row><View accessible accessibilityLabel={`Category spending: ${groups.map(g=>`${g.category} ${money(g.value,currency)}`).join(', ') || 'No spending'}`}><Svg width={height} height={height} viewBox={`0 0 ${height} ${height}`}><Circle cx={height/2} cy={height/2} r={r} stroke={colors.border} strokeWidth={spacing.md} fill="none"/>{groups.map((g,i)=>{const dash=total?circumference*g.value/total:0;const start=offset;offset+=dash;return <Circle key={g.category} cx={height/2} cy={height/2} r={r} stroke={palette[i%palette.length]} strokeWidth={spacing.md} fill="none" strokeDasharray={`${dash} ${circumference-dash}`} strokeDashoffset={-start} rotation={-90} origin={`${height/2},${height/2}`}/>;})}</Svg></View><View style={{flex:1}}>{groups.map((g,i)=><Text key={g.category} variant="caption">{i+1}. {g.category} · {money(g.value,currency)}</Text>)}</View></Row></Animated.View><Text variant="label">Who paid what</Text><Text>You · {money(mine,currency)}</Text><Text>Them · {money(total-mine,currency)}</Text><View accessibilityLabel={`You paid ${money(mine,currency)}; they paid ${money(total-mine,currency)}`} style={{height:geometry.track,backgroundColor:colors.accent}}><View style={{height:'100%',width:`${total?mine/total*100:0}%`,backgroundColor:colors.primary}}/></View></Card>;
}


