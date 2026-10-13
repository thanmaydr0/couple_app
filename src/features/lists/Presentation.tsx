import { useEffect, useRef, useState, type PropsWithChildren } from 'react';
import { AppState, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { cancelAnimation, useAnimatedStyle, useDerivedValue, useSharedValue, withTiming } from 'react-native-reanimated';
import { Canvas, Circle, Group, Path, RoundedRect, Skia } from '@shopify/react-native-skia';
import { useTheme } from '@/theme';
import { Burst, motionTokens, useMotion } from '@/motion';
import { Button, Text } from '@/ui';
import { candidates, type ListItem, type Mood } from './types';
export function Progress({done,total}:{done:number;total:number}) {
 const {colors,geometry,spacing}=useTheme(); const size=geometry.touch; const r=(size-geometry.stroke*2)/2; const ring=Skia.Path.Make(); ring.addCircle(size/2,size/2,r);
 return <View style={{flexDirection:'row',gap:spacing.sm,alignItems:'center'}}><Canvas style={{width:size,height:size}}><Circle cx={size/2} cy={size/2} r={r} style="stroke" strokeWidth={geometry.stroke} color={colors.border}/><Path path={ring} style="stroke" strokeWidth={geometry.stroke} color={colors.primary} start={0} end={total?done/total:0}/></Canvas><Text variant="caption">{done} / {total} done</Text></View>;
}
export function ItemGesture({children,onComplete,onDelete,onMove,disabled}:{onComplete:()=>void;onDelete:()=>void;onMove:(offset:number)=>void;disabled:boolean}&PropsWithChildren) {
 const {geometry,spacing}=useTheme(); const motion=useMotion(); const x=useSharedValue(0); const y=useSharedValue(0); const height=useRef(geometry.touch*3);
 const vertical=Gesture.Pan().enabled(!disabled).activateAfterLongPress(motionTokens.slow).runOnJS(true).onUpdate(e=>{y.value=e.translationY;}).onEnd(e=>{onMove(Math.round(e.translationY/height.current));}).onFinalize(()=>{y.value=withTiming(0,{duration:motion.duration('fast')});});
 const horizontal=Gesture.Pan().enabled(!disabled).activeOffsetX([-spacing.lg,spacing.lg]).failOffsetY([-spacing.md,spacing.md]).runOnJS(true).onUpdate(e=>{x.value=e.translationX;}).onEnd(e=>{if(e.translationX>geometry.touch*2)onComplete();if(e.translationX< -geometry.touch*2)onDelete();}).onFinalize(()=>{x.value=withTiming(0,{duration:motion.duration('fast')});});
 const style=useAnimatedStyle(()=>({transform:[{translateX:x.value},{translateY:y.value}],zIndex:y.value?1:0}));
 return <GestureDetector gesture={Gesture.Race(vertical,horizontal)}><Animated.View onLayout={e=>{height.current=e.nativeEvent.layout.height+spacing.md;}} style={style}>{children}</Animated.View></GestureDetector>;
}
export function Ceremony({title,trigger}:{title:string;trigger:number}) {
 const {geometry,spacing,colors}=useTheme(); const motion=useMotion(); const progress=useSharedValue(0);
 useEffect(()=>{progress.value=0;progress.value=withTiming(1,{duration:motion.duration('base')});},[trigger,motion.level,progress]);
 const style=useAnimatedStyle(()=>({opacity:motion.level==='off'?1:progress.value,transform:[{scale:motion.level==='full'?0.8+0.2*progress.value:1}]}));
 return <View style={{alignItems:'center',gap:spacing.md}}><Animated.View style={[{minHeight:geometry.touch,justifyContent:'center',backgroundColor:colors.surfaceAlt,padding:spacing.md,borderRadius:geometry.touch},style]}><Text variant="display/M">✓</Text></Animated.View><Text variant="title/M" accessibilityLiveRegion="polite">{title}</Text><View style={{position:'absolute',top:0}}><Burst trigger={trigger}/></View></View>;
}
export function Picker({items,mood,disabled}:{items:ListItem[];mood:Mood;disabled:boolean}) {
 const {spacing,colors,geometry,radius}=useTheme(); const motion=useMotion(); const pool=candidates(items,mood); const [picked,setPicked]=useState('Let fate choose a little joy.');const [spinning,setSpinning]=useState(false);const angle=useSharedValue(0); const timer=useRef<ReturnType<typeof setTimeout>|null>(null);
 const rotation=useDerivedValue(()=>[{rotate:angle.value}]); const stop=()=>{if(timer.current)clearTimeout(timer.current);timer.current=null;cancelAnimation(angle);setSpinning(false);};
 useEffect(()=>{const sub=AppState.addEventListener('change',state=>{if(state!=='active')stop();});return()=>{if(timer.current)clearTimeout(timer.current);cancelAnimation(angle);sub.remove();};},[]);
 useEffect(()=>{stop();setPicked('Let fate choose a little joy.');},[mood,items[0]?.list_id,motion.level]);
 const choose=(coin:boolean)=>{if(spinning)return; const value=coin?(Math.random()<0.5?'Heads — your choice!':'Tails — their choice!'):pool[Math.floor(Math.random()*pool.length)]?.title; if(!value)return;setSpinning(true);setPicked('Choosing…');angle.value=0;angle.value=withTiming(Math.PI*8,{duration:motion.level==='full'?motion.duration('particles'):0}); timer.current=setTimeout(()=>{setPicked(value);setSpinning(false);},motion.level==='full'?motion.duration('particles'):0);};
 return <View style={{gap:spacing.md}}><Canvas style={{height:geometry.touch*2,width:geometry.touch*2,alignSelf:'center'}}><Group transform={rotation} origin={{x:geometry.touch,y:geometry.touch}}>{Array.from({length:8},(_,i)=><Group key={i} transform={[{rotate:i*Math.PI/4}]} origin={{x:geometry.touch,y:geometry.touch}}><RoundedRect x={geometry.touch-geometry.track} y={geometry.stroke} width={geometry.track*2} height={geometry.icon} r={radius.sm} color={i%2?colors.primary:colors.accent}/></Group>)}</Group><Circle cx={geometry.touch} cy={geometry.touch} r={geometry.dot} color={colors.primary}/></Canvas><Text accessibilityLiveRegion="polite" variant="title/S">{picked}</Text><Button title="Pick for us" disabled={disabled||spinning||!pool.length} onPress={()=>choose(false)}/><Button title="Flip a coin" variant="secondary" disabled={disabled||spinning} onPress={()=>choose(true)}/>{!pool.length&&<Text color="textSecondary">No unfinished ideas for this mood. Add one below.</Text>}</View>;
}
