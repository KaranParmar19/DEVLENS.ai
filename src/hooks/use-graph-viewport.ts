import { useCallback, useEffect, useRef, useState } from "react";

export type Transform = { x: number; y: number; zoom: number };

const MIN_ZOOM = 0.3;
const MAX_ZOOM = 3.2;
const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));

export type Point = { x: number; y: number };

export function useGraphViewport(points: Point[]) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [transform, setTransform] = useState<Transform>({ x: 0, y: 0, zoom: 1 });
  const transformRef = useRef(transform);
  transformRef.current = transform;

  const fitAll = useCallback(() => {
    const el = containerRef.current;
    if (!el || points.length === 0) return;
    const rect = el.getBoundingClientRect();
    const xs = points.map((p) => p.x);
    const ys = points.map((p) => p.y);
    const minX = Math.min(...xs) - 90;
    const maxX = Math.max(...xs) + 90;
    const minY = Math.min(...ys) - 70;
    const maxY = Math.max(...ys) + 70;
    const zoom = clamp(
      Math.min(rect.width / (maxX - minX), rect.height / (maxY - minY)),
      MIN_ZOOM,
      1.4,
    );
    setTransform({
      zoom,
      x: rect.width / 2 - ((minX + maxX) / 2) * zoom,
      y: rect.height / 2 - ((minY + maxY) / 2) * zoom,
    });
  }, [points]);

  const focusPoint = useCallback((point: Point, zoom = 1.75) => {
    const el = containerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const next = clamp(zoom, MIN_ZOOM, MAX_ZOOM);
    setTransform({
      zoom: next,
      x: rect.width / 2 - point.x * next,
      y: rect.height / 2 - point.y * next,
    });
  }, []);

  const zoomAtCenter = useCallback((factor: number) => {
    const el = containerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    setTransform((t) => {
      const next = clamp(t.zoom * factor, MIN_ZOOM, MAX_ZOOM);
      const k = next / t.zoom;
      const px = rect.width / 2;
      const py = rect.height / 2;
      return { zoom: next, x: px - (px - t.x) * k, y: py - (py - t.y) * k };
    });
  }, []);

  // Cursor-anchored wheel zoom on a non-passive native listener.
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      const dy =
        event.deltaY * (event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? 100 : 1);
      const rect = el.getBoundingClientRect();
      const px = event.clientX - rect.left;
      const py = event.clientY - rect.top;
      setTransform((t) => {
        const next = clamp(t.zoom * Math.exp(-dy * 0.0016), MIN_ZOOM, MAX_ZOOM);
        const k = next / t.zoom;
        return { zoom: next, x: px - (px - t.x) * k, y: py - (py - t.y) * k };
      });
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, []);

  // Drag to pan.
  const dragRef = useRef<{ id: number; x: number; y: number } | null>(null);
  const [panning, setPanning] = useState(false);

  const onPointerDown = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return;
    dragRef.current = { id: event.pointerId, x: event.clientX, y: event.clientY };
    event.currentTarget.setPointerCapture(event.pointerId);
    setPanning(true);
  }, []);

  const onPointerMove = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.id !== event.pointerId) return;
    const dx = event.clientX - drag.x;
    const dy = event.clientY - drag.y;
    dragRef.current = { id: drag.id, x: event.clientX, y: event.clientY };
    setTransform((t) => ({ ...t, x: t.x + dx, y: t.y + dy }));
  }, []);

  const onPointerUp = useCallback(() => {
    dragRef.current = null;
    setPanning(false);
  }, []);

  return {
    containerRef,
    transform,
    panning,
    fitAll,
    focusPoint,
    zoomAtCenter,
    panHandlers: { onPointerDown, onPointerMove, onPointerUp, onPointerCancel: onPointerUp },
  };
}
