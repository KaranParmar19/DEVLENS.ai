import React, { useRef, useState, useCallback, useEffect } from "react";

interface PanelResizerProps {
  side: "left" | "right";
  onResize: (deltaX: number) => void;
  onReset?: () => void;
  theme?: "dark" | "light";
  minWidth?: number;
  maxWidth?: number;
  currentWidth?: number;
  title?: string;
}

export function PanelResizer({
  side,
  onResize,
  onReset,
  theme = "dark",
  currentWidth,
  title = "Drag to resize panel, double-click to reset",
}: PanelResizerProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const startXRef = useRef<number>(0);
  const rafIdRef = useRef<number | null>(null);

  // Clean up rAF and global styles on unmount
  useEffect(() => {
    return () => {
      if (rafIdRef.current) cancelAnimationFrame(rafIdRef.current);
      document.body.style.removeProperty("cursor");
      document.body.style.removeProperty("user-select");
    };
  }, []);

  const handlePointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (e.button !== 0) return; // Only primary mouse button
      e.preventDefault();
      e.stopPropagation();

      const el = e.currentTarget;
      try {
        el.setPointerCapture(e.pointerId);
      } catch {
        // Fallback if pointer capture unsupported
      }

      startXRef.current = e.clientX;
      setIsDragging(true);

      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";
    },
    [],
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (!isDragging) return;
      e.preventDefault();

      const clientX = e.clientX;

      if (rafIdRef.current) {
        cancelAnimationFrame(rafIdRef.current);
      }

      rafIdRef.current = requestAnimationFrame(() => {
        const deltaX = clientX - startXRef.current;
        if (deltaX !== 0) {
          // If side is "left" (resizing left rail), moving right increases width
          // If side is "right" (resizing right rail), moving left increases width
          const directionalDelta = side === "left" ? deltaX : -deltaX;
          onResize(directionalDelta);
          startXRef.current = clientX;
        }
      });
    },
    [isDragging, onResize, side],
  );

  const handlePointerUp = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (!isDragging) return;
      e.preventDefault();

      if (rafIdRef.current) {
        cancelAnimationFrame(rafIdRef.current);
        rafIdRef.current = null;
      }

      try {
        e.currentTarget.releasePointerCapture(e.pointerId);
      } catch {
        // No-op
      }

      setIsDragging(false);
      document.body.style.removeProperty("cursor");
      document.body.style.removeProperty("user-select");
    },
    [isDragging],
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      const step = e.shiftKey ? 24 : 8;
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        onResize(side === "left" ? -step : step);
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        onResize(side === "left" ? step : -step);
      } else if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        onReset?.();
      }
    },
    [onResize, onReset, side],
  );

  const isLight = theme === "light";
  const defaultLineColor = isLight ? "rgba(0, 0, 0, 0.08)" : "rgba(255, 255, 255, 0.1)";
  const activeLineColor = isLight ? "#09090b" : "#ffffff";
  const hoverLineColor = isLight ? "rgba(0, 0, 0, 0.35)" : "rgba(255, 255, 255, 0.5)";

  return (
    <div
      role="separator"
      tabIndex={0}
      aria-orientation="vertical"
      aria-valuenow={currentWidth}
      title={title}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      onDoubleClick={onReset}
      onKeyDown={handleKeyDown}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      style={{
        width: 10,
        marginLeft: -5,
        marginRight: -5,
        position: "relative",
        zIndex: 35,
        cursor: "col-resize",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        flexShrink: 0,
        touchAction: "none",
        outline: "none",
        userSelect: "none",
      }}
    >
      {/* 1px Center Hairline Divider */}
      <div
        style={{
          width: isDragging ? 2 : 1,
          height: "100%",
          backgroundColor: isDragging
            ? activeLineColor
            : isHovered
            ? hoverLineColor
            : defaultLineColor,
          transition: isDragging ? "none" : "background-color 0.15s ease, width 0.15s ease",
          boxShadow: isDragging
            ? isLight
              ? "0 0 6px rgba(0,0,0,0.2)"
              : "0 0 6px rgba(255,255,255,0.4)"
            : "none",
        }}
      />

      {/* Tactile Grip Pill for Visual Affordance */}
      {(isHovered || isDragging) && (
        <div
          style={{
            position: "absolute",
            top: "50%",
            transform: "translateY(-50%)",
            width: 4,
            height: 28,
            borderRadius: 999,
            backgroundColor: isDragging ? activeLineColor : hoverLineColor,
            transition: "background-color 0.15s ease",
            pointerEvents: "none",
          }}
        />
      )}
    </div>
  );
}
