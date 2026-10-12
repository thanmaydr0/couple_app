import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Canvas, Picture, Skia, PaintStyle, StrokeCap, StrokeJoin, type SkPicture, type SkPath } from '@shopify/react-native-skia';
import { useSharedValue } from 'react-native-reanimated';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import type { Point, Stroke } from './model';

// Mutable drawing model: points never enter React state. The picture shared value
// updates at most once per frame; completed paths are cached between frames.
export class Drawing {
  strokes: Stroke[] = [];
  private cache = new Map<string, { count: number; path: SkPath }>();
  private listeners = new Set<() => void>();
  subscribe(listener: () => void) { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; }
  notify() { this.listeners.forEach(listener => listener()); }
  replace(strokes: Stroke[]) { this.strokes = strokes; this.cache.clear(); this.notify(); }
  append(stroke: Stroke, complete = false, offset?: number) {
    const index = this.strokes.findIndex(item => item.id === stroke.id);
    if (index < 0) { if (this.strokes.length >= 200) return; this.strokes.push({ ...stroke, points: [...stroke.points] }); }
    else if (complete) this.strokes[index] = stroke;
    else {
      const points = this.strokes[index]!.points;
      // A snapshot may already contain part of an in-flight point batch.
      const skip = offset === undefined ? 0 : Math.max(0, points.length - offset);
      const remaining = Math.max(0, 8000 - this.count());
      points.push(...stroke.points.slice(skip, skip + remaining));
    }
    this.cache.delete(stroke.id); this.notify();
  }
  undo() { const stroke = this.strokes.pop(); if (stroke) this.cache.delete(stroke.id); this.notify(); }
  count() { return this.strokes.reduce((sum, stroke) => sum + stroke.points.length, 0); }
  picture(): SkPicture {
    const recorder = Skia.PictureRecorder();
    const canvas = recorder.beginRecording(Skia.XYWHRect(0, 0, 1000, 1000));
    canvas.drawColor(Skia.Color('#ffffff'));
    for (const stroke of this.strokes) {
      if (!stroke.points.length) continue;
      let path = this.cache.get(stroke.id)?.path;
      if (!path) {
        path = Skia.Path.Make();
        const first = stroke.points[0]!;
        path.moveTo(first.x, first.y);
        for (let i = 1; i < stroke.points.length; i++) {
          const previous = stroke.points[i - 1]!; const point = stroke.points[i]!;
          path.quadTo(previous.x, previous.y, (previous.x + point.x) / 2, (previous.y + point.y) / 2);
        }
        const last = stroke.points[stroke.points.length - 1]!;
        path.lineTo(last.x + 0.01, last.y + 0.01);
        this.cache.set(stroke.id, { count: stroke.points.length, path });
      }
      const paint = Skia.Paint(); paint.setColor(Skia.Color(stroke.color)); paint.setStyle(PaintStyle.Stroke);
      paint.setStrokeWidth(stroke.size); paint.setStrokeCap(StrokeCap.Round); paint.setStrokeJoin(StrokeJoin.Round); paint.setAntiAlias(true);
      canvas.drawPath(path, paint);
    }
    return recorder.finishRecordingAsPicture();
  }
}
export function DrawingCanvas({ drawing, enabled, onBegin, onPoint, onEnd }: { drawing: Drawing; enabled: boolean; onBegin: (point: Point) => void; onPoint: (point: Point) => void; onEnd: () => void }) {
  const [width, setWidth] = useState(300);
  const picture = useSharedValue(drawing.picture());
  useEffect(() => {
    let frame: number | undefined;
    picture.value = drawing.picture();
    const unsubscribe = drawing.subscribe(() => {
      if (frame !== undefined) return;
      frame = requestAnimationFrame(() => { frame = undefined; picture.value = drawing.picture(); });
    });
    return () => { unsubscribe(); if (frame !== undefined) cancelAnimationFrame(frame); };
  }, [drawing, picture]);
  const point = (x: number, y: number): Point => ({ x: Math.round(Math.max(0, Math.min(1000, x / width * 1000))), y: Math.round(Math.max(0, Math.min(1000, y / width * 1000))) });
  const gesture = Gesture.Pan().enabled(enabled).minDistance(0).runOnJS(true)
    .onBegin(event => onBegin(point(event.x, event.y)))
    .onUpdate(event => onPoint(point(event.x, event.y))).onFinalize(onEnd);
  return <View style={styles.frame} onLayout={event => setWidth(event.nativeEvent.layout.width)}>
    <GestureDetector gesture={gesture}><Canvas style={{ width, height: width }}><Picture picture={picture} transform={[{ scale: width / 1000 }]} /></Canvas></GestureDetector>
  </View>;
}
const styles = StyleSheet.create({ frame: { width: '100%', aspectRatio: 1, backgroundColor: '#fff', borderRadius: 18, overflow: 'hidden' } });
