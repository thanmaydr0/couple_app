import { useCallback, useEffect, useRef } from 'react';
import { motionTokens } from '@/motion';
import { AppState } from 'react-native';
import { useIsFocused } from 'expo-router';
/** Distinguish a photo tap from a double tap before opening a native modal. */
export function useBubbleTap(onTap: () => void, onHeart?: () => void) {
  const last = useRef(0); const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const single = useRef(onTap); const heart = useRef(onHeart); single.current=onTap;heart.current=onHeart;
  const cancel = useCallback(() => { clearTimeout(timer.current);last.current=0; }, []);
  const focused=useIsFocused();
  useEffect(()=>{if(!focused)cancel();},[focused,cancel]);
  useEffect(()=>{const subscription=AppState.addEventListener('change',state=>{if(state!=='active')cancel();});return()=>subscription.remove();},[cancel]);
  useEffect(() => cancel, [cancel]);
  const tap = useCallback(() => {
    if(!heart.current){single.current();return;}
    const now=Date.now();clearTimeout(timer.current);
    if(now-last.current<motionTokens.slow){last.current=0;heart.current();}
    else{last.current=now;timer.current=setTimeout(()=>{last.current=0;single.current();},motionTokens.slow);}
  }, []);
  return {tap,cancel};
}
