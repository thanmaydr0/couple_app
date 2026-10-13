import { useRef } from 'react';
import { Animated, PanResponder, StyleSheet } from 'react-native';
import { RTCView, type MediaStream } from 'react-native-webrtc';

export function ScreenShareView({ stream }: { stream: MediaStream }) {
  const scale = useRef(new Animated.Value(1)).current;
  const distance = useRef(0);
  const zoom = useRef(1);
  const base = useRef(1);
  const responder = useRef(PanResponder.create({
    onStartShouldSetPanResponder: event => event.nativeEvent.touches.length === 2,
    onMoveShouldSetPanResponder: event => event.nativeEvent.touches.length === 2,
    onPanResponderGrant: event => {
      const [a, b] = event.nativeEvent.touches;
      if (a && b) distance.current = Math.hypot(a.pageX - b.pageX, a.pageY - b.pageY);
      base.current = zoom.current;
    },
    onPanResponderMove: event => {
      const [a, b] = event.nativeEvent.touches;
      if (a && b && distance.current > 0) {
        zoom.current = Math.max(1, Math.min(4, base.current * Math.hypot(a.pageX - b.pageX, a.pageY - b.pageY) / distance.current));
        scale.setValue(zoom.current);
      }
    },
  })).current;
  return <Animated.View accessibilityLabel="Partner’s shared screen. Pinch with two fingers to zoom." {...responder.panHandlers}
    style={[StyleSheet.absoluteFill, { transform: [{ scale }] }]}>
    <RTCView streamURL={stream.toURL()} objectFit="contain" style={StyleSheet.absoluteFill} />
  </Animated.View>;
}
