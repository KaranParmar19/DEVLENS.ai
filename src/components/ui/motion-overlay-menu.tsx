import React, { useState, useEffect, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence, useReducedMotion, type Transition } from "motion/react";
import { Link, useNavigate } from "@tanstack/react-router";

export interface MotionMenuLink {
  label: string;
  to?: string;
  href?: string;
  newTab?: boolean;
  onClick?: () => void;
  badge?: string;
}

export interface MotionSecondaryLink {
  label: string;
  to?: string;
  href?: string;
  newTab?: boolean;
  onClick?: () => void;
}

export interface MotionOverlayMenuProps {
  brand?: React.ReactNode;
  brandLink?: string;
  brandNewTab?: boolean;
  logo?: "mark" | "none" | "custom";
  customLogo?: React.ReactNode;
  logoSize?: number;
  links?: MotionMenuLink[];
  secondary?: MotionSecondaryLink[];
  note?: React.ReactNode;
  noteLink?: string;
  noteNewTab?: boolean;
  actions?: React.ReactNode;
  overlayFooterExtra?: React.ReactNode;
  menuLabel?: string;
  closeLabel?: string;
  showLabel?: boolean;
  showNumbers?: boolean;
  align?: "left" | "center";
  reveal?: "circle" | "wipe" | "fade";
  duration?: number;
  stagger?: number;
  hoverShift?: number;
  dimOthers?: boolean;
  headerColor?: string;
  barBackground?: string;
  barBorder?: string;
  overlayBackground?: string;
  overlayZIndex?: number;
  overlayText?: string;
  overlayBar?: string;
  accent?: string;
  glow?: string;
  barRadius?: string;
  barShadow?: boolean;
  barBlur?: number;
  blur?: number;
  headerPadding?: string;
  overlayPadding?: string;
  className?: string;
  style?: React.CSSProperties;
  isOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
}

const EASE_OUT = [0.22, 1, 0.36, 1] as const;
const EASE_IN = [0.4, 0, 1, 1] as const;
const EASE_SMOOTH = [0.65, 0, 0.35, 1] as const;
const ICON_MS = 520;
const DEFAULT_OVERLAY_Z_INDEX = 10000;

const DEFAULT_LINKS: MotionMenuLink[] = [
  { label: "Overview", to: "/dashboard" },
  { label: "Features", to: "/features" },
  { label: "How it works", to: "/how-it-works" },
  { label: "Home", to: "/" },
];

const DEFAULT_SECONDARY: MotionSecondaryLink[] = [
  { label: "GitHub", href: "https://github.com", newTab: true },
];

const CSS = `
[data-smo-static], [data-smo-static] * { animation: none !important; transition: none !important; }
[data-smo-static] { pointer-events: none; }
.smo-link, .smo-btn, .smo-brand, .smo-sec { -webkit-tap-highlight-color: transparent; }
.smo-link:focus, .smo-btn:focus, .smo-brand:focus, .smo-sec:focus { outline: none; }
.smo-link:focus-visible, .smo-brand:focus-visible, .smo-sec:focus-visible {
  outline: 2px solid currentColor; outline-offset: 6px; border-radius: 6px;
}
.smo-btn:focus-visible .smo-icon { box-shadow: 0 0 0 2px currentColor; }
.smo-sec .smo-ul { transform: scaleX(0); transform-origin: left; transition: transform .4s cubic-bezier(.22,1,.36,1); }
.smo-sec:hover .smo-ul, .smo-sec:focus-visible .smo-ul { transform: scaleX(1); }
.smo-brand:hover .smo-mark { transform: rotate(180deg); }
.smo-mark { transition: transform .6s cubic-bezier(.65,0,.35,1); }
.smo-nav { scrollbar-width: none; }
.smo-nav::-webkit-scrollbar { display: none; }
@media (prefers-reduced-motion: reduce) {
  .smo-sec .smo-ul, .smo-mark { transition: none; }
}
`;

function pad(n: number) {
  return String(n).padStart(2, "0");
}

function mix(color: string, pct: number) {
  return `color-mix(in srgb, ${color} ${pct}%, transparent)`;
}

function DevLensMark({ size = 20 }: { size?: number }) {
  return (
    <svg
      className="smo-mark"
      width={size}
      height={size}
      viewBox="0 0 20 20"
      aria-hidden="true"
      style={{ display: "block", flex: "none" }}
    >
      <circle cx="10" cy="10" r="8.25" fill="none" stroke="currentColor" strokeWidth="1.5" />
      <path d="M10 1.75 A8.25 8.25 0 0 1 10 18.25 Z" fill="currentColor" />
    </svg>
  );
}

interface TopBarProps {
  logo?: "mark" | "none" | "custom";
  customLogo?: React.ReactNode;
  logoSize?: number;
  brand?: React.ReactNode;
  brandHref?: string;
  brandNewTab?: boolean;
  color?: string;
  background?: string;
  border?: string;
  radius?: string;
  shadow?: boolean;
  blur?: number;
  padding?: string;
  open: boolean;
  menuLabel?: string;
  closeLabel?: string;
  showLabel?: boolean;
  ariaLabel?: string;
  onToggle: () => void;
  buttonRef?: React.Ref<HTMLButtonElement>;
  barRef?: React.Ref<HTMLDivElement>;
  fromClosed?: boolean;
  reduce?: boolean;
  actions?: React.ReactNode;
}

function TopBar({
  logo = "mark",
  customLogo,
  logoSize = 20,
  brand = "DevLens",
  brandHref = "/",
  brandNewTab = false,
  color = "#111111",
  background = "rgba(255, 255, 255, 0.72)",
  border = "rgba(0, 0, 0, 0.08)",
  radius = "999px",
  shadow = true,
  blur = 16,
  padding = "10px 14px 10px 20px",
  open,
  menuLabel = "Menu",
  closeLabel = "Close",
  showLabel = true,
  ariaLabel = "Toggle navigation",
  onToggle,
  buttonRef,
  barRef,
  fromClosed,
  reduce,
  actions,
}: TopBarProps) {
  const [hover, setHover] = useState(false);
  const line: React.CSSProperties = {
    display: "block",
    height: 2,
    borderRadius: 2,
    background: "currentColor",
    transformOrigin: "center",
  };
  const active = hover || open;
  const dur = reduce ? 0 : ICON_MS / 1000;
  const phase: Transition = {
    duration: dur,
    times: [0, 0.5, 1],
    ease: EASE_SMOOTH,
  };

  const topVariants = {
    open: { y: [0, 3.5, 3.5], rotate: [0, 0, 45], transition: phase },
    closed: { y: [3.5, 3.5, 0], rotate: [45, 0, 0], transition: phase },
  };

  const bottomVariants = {
    open: { y: [0, -3.5, -3.5], rotate: [0, 0, -45], transition: phase },
    closed: { y: [-3.5, -3.5, 0], rotate: [-45, 0, 0], transition: phase },
  };

  const state = open ? "open" : "closed";
  const widthTransition = reduce ? undefined : "width 0.35s cubic-bezier(0.22, 1, 0.36, 1)";
  const labelTransition: Transition = { duration: dur, ease: EASE_SMOOTH };
  const labelBase: React.CSSProperties = {
    gridArea: "1 / 1",
    whiteSpace: "nowrap",
    display: "block",
  };

  const BrandContent = (
    <span
      className="smo-brand-inner"
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 10,
        fontWeight: 600,
        fontSize: "0.9375rem",
        letterSpacing: "-0.01em",
      }}
    >
      {logo === "mark" && <DevLensMark size={logoSize} />}
      {logo === "custom" && customLogo}
      {brand && <span className="smo-brand-text">{brand}</span>}
    </span>
  );

  return (
    <div
      ref={barRef}
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        width: "100%",
        boxSizing: "border-box",
        padding,
        color,
        background,
        border: `1px solid ${border}`,
        borderRadius: radius,
        boxShadow: shadow
          ? "0 12px 32px -14px rgba(0,0,0,0.2), inset 0 1px 0 rgba(255,255,255,0.4)"
          : undefined,
        backdropFilter: blur ? `blur(${blur}px) saturate(160%)` : undefined,
        WebkitBackdropFilter: blur ? `blur(${blur}px) saturate(160%)` : undefined,
        flex: "none",
        gap: 12,
      }}
    >
      {/* Brand logo & text */}
      <div style={{ display: "flex", alignItems: "center", flex: "none" }}>
        {brandHref.startsWith("http") ? (
          <a
            className="smo-brand"
            href={brandHref}
            target={brandNewTab ? "_blank" : undefined}
            rel={brandNewTab ? "noopener noreferrer" : undefined}
            style={{
              color: "inherit",
              textDecoration: "none",
              whiteSpace: "nowrap",
              display: "inline-flex",
              alignItems: "center",
            }}
          >
            {BrandContent}
          </a>
        ) : (
          <Link
            to={brandHref}
            className="smo-brand"
            style={{
              color: "inherit",
              textDecoration: "none",
              whiteSpace: "nowrap",
              display: "inline-flex",
              alignItems: "center",
            }}
          >
            {BrandContent}
          </Link>
        )}
      </div>

      {/* Right Controls: Optional Actions (Backend Status, User Auth) + Menu Toggle */}
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        {actions && (
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>{actions}</div>
        )}

        <button
          ref={buttonRef}
          type="button"
          className="smo-btn"
          aria-label={ariaLabel}
          aria-expanded={open}
          onClick={onToggle}
          onPointerEnter={(e) => {
            if (e.pointerType === "mouse") setHover(true);
          }}
          onPointerLeave={() => setHover(false)}
          style={{
            appearance: "none",
            WebkitAppearance: "none",
            background: "none",
            border: 0,
            padding: 0,
            margin: 0,
            display: "flex",
            alignItems: "center",
            gap: 10,
            cursor: "pointer",
            color: "inherit",
            userSelect: "none",
            WebkitUserSelect: "none",
            touchAction: "manipulation",
          }}
        >
          {showLabel && (
            <span
              aria-hidden="true"
              style={{
                fontSize: "0.8125rem",
                fontWeight: 500,
                letterSpacing: "0.02em",
                lineHeight: 1,
                display: "grid",
                justifyItems: "end",
                overflow: "hidden",
                padding: "3px 0",
                margin: "-3px 0",
                opacity: active ? 1 : 0.75,
                transition: reduce ? undefined : "opacity 0.3s",
              }}
            >
              <motion.span
                style={labelBase}
                initial={fromClosed ? { y: 0, opacity: 1 } : false}
                animate={{ y: open ? -12 : 0, opacity: open ? 0 : 1 }}
                transition={labelTransition}
              >
                {menuLabel}
              </motion.span>
              <motion.span
                style={labelBase}
                initial={fromClosed ? { y: 12, opacity: 0 } : false}
                animate={{ y: open ? 0 : 12, opacity: open ? 1 : 0 }}
                transition={labelTransition}
              >
                {closeLabel}
              </motion.span>
            </span>
          )}

          <span
            className="smo-icon"
            style={{
              width: 38,
              height: 38,
              borderRadius: 999,
              background: active ? mix(color, 14) : mix(color, 7),
              transition: reduce ? undefined : "background-color 0.35s ease",
              border: `1px solid ${mix(color, 12)}`,
              display: "flex",
              flexDirection: "column",
              alignItems: "flex-end",
              justifyContent: "center",
              gap: 5,
              boxSizing: "border-box",
              padding: "0 10px",
              flex: "none",
            }}
          >
            <motion.span
              style={{ ...line, width: 18 }}
              variants={topVariants}
              initial={fromClosed ? "closed" : false}
              animate={state}
            />
            <motion.span
              style={{
                ...line,
                width: open || hover ? 18 : 11,
                transition: widthTransition,
              }}
              variants={bottomVariants}
              initial={fromClosed ? "closed" : false}
              animate={state}
            />
          </span>
        </button>
      </div>
    </div>
  );
}

export function MotionOverlayMenu({
  brand = (
    <>
      DevLens<span style={{ fontWeight: 400, opacity: 0.65 }}>.ai</span>
    </>
  ),
  brandLink = "/",
  brandNewTab = false,
  logo = "mark",
  customLogo,
  logoSize = 20,
  links = DEFAULT_LINKS,
  secondary = DEFAULT_SECONDARY,
  note = "DevLens AI // Intelligent Cognitive Architecture Engine",
  noteLink,
  noteNewTab = false,
  actions,
  overlayFooterExtra,
  menuLabel = "Menu",
  closeLabel = "Close",
  showLabel = true,
  showNumbers = true,
  align = "left",
  reveal = "circle",
  duration = 0.8,
  stagger = 70,
  hoverShift = 16,
  dimOthers = true,
  headerColor = "var(--mf-ink, #0a0a0a)",
  barBackground = "rgba(255, 255, 255, 0.72)",
  barBorder = "rgba(0, 0, 0, 0.08)",
  overlayBackground = "rgba(10, 10, 11, 0.95)",
  overlayZIndex = DEFAULT_OVERLAY_Z_INDEX,
  overlayText = "#FAFAFA",
  overlayBar = "rgba(255, 255, 255, 0.07)",
  accent = "#8A8A8E",
  glow = "rgba(255, 255, 255, 0.08)",
  barRadius = "999px",
  barShadow = true,
  barBlur = 16,
  blur = 24,
  headerPadding = "10px 14px 10px 20px",
  overlayPadding = "40px 32px 40px 32px",
  className,
  style,
  isOpen,
  onOpenChange,
}: MotionOverlayMenuProps) {
  const navigate = useNavigate();
  const reduceMotion = useReducedMotion();
  const reduce = !!reduceMotion;

  const [internalOpen, setInternalOpen] = useState(false);
  const [closing, setClosing] = useState(false);
  const isControlled = typeof isOpen === "boolean";
  const open = isControlled ? isOpen : internalOpen;

  const [hovered, setHovered] = useState<number | null>(null);
  const [mounted, setMounted] = useState(false);
  const [narrow, setNarrow] = useState(false);
  const [barRect, setBarRect] = useState<{
    top: number;
    left: number;
    width: number;
    height: number;
    layoutWidth: number;
    insetLeft: number;
    insetRight: number;
  } | null>(null);

  const rootRef = useRef<HTMLDivElement>(null);
  const barRef = useRef<HTMLDivElement>(null);
  const toggleRef = useRef<HTMLButtonElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const wasOpen = useRef(false);
  const closeTimer = useRef<number | null>(null);
  const origin = useRef("calc(100% - 44px) 36px");

  useEffect(() => {
    setMounted(true);
  }, []);

  const measure = useCallback(() => {
    const root = rootRef.current;
    const bar = barRef.current;
    if (!root || !bar || typeof window === "undefined") return;
    const r = root.getBoundingClientRect();

    const button = toggleRef.current;
    if (button) {
      const buttonRect = button.getBoundingClientRect();
      origin.current = `${Math.round(buttonRect.right - 20)}px ${Math.round(
        buttonRect.top + buttonRect.height / 2,
      )}px`;
    }

    const computed = window.getComputedStyle(bar);
    const next = {
      top: r.top,
      left: r.left,
      width: r.width,
      height: r.height,
      layoutWidth: root.offsetWidth,
      insetLeft:
        (parseFloat(computed.paddingLeft) || 0) + (parseFloat(computed.borderLeftWidth) || 0),
      insetRight:
        (parseFloat(computed.paddingRight) || 0) + (parseFloat(computed.borderRightWidth) || 0),
    };

    setNarrow(next.layoutWidth < 640);
    setBarRect((prev) =>
      prev && Object.keys(next).every((key) => (prev as any)[key] === (next as any)[key])
        ? prev
        : next,
    );
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    measure();
    const ro = "ResizeObserver" in window ? new ResizeObserver(measure) : null;
    if (rootRef.current) ro?.observe(rootRef.current);
    if (barRef.current) ro?.observe(barRef.current);
    window.addEventListener("resize", measure);
    return () => {
      ro?.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, [measure, headerPadding]);

  const setOpen = useCallback(
    (nextOpen: boolean) => {
      if (!isControlled) {
        setInternalOpen(nextOpen);
      }
      onOpenChange?.(nextOpen);
    },
    [isControlled, onOpenChange],
  );

  const openMenu = useCallback(() => {
    if (closeTimer.current) {
      window.clearTimeout(closeTimer.current);
      closeTimer.current = null;
    }
    const el = toggleRef.current;
    if (el && typeof window !== "undefined") {
      const r = el.getBoundingClientRect();
      origin.current = `${Math.round(r.left + r.width - 20)}px ${Math.round(
        r.top + r.height / 2,
      )}px`;
    }
    measure();
    setHovered(null);
    setClosing(false);
    setOpen(true);
  }, [measure, setOpen]);

  const closeMenu = useCallback(() => {
    if (closeTimer.current) return;
    setClosing(true);
    const wait = reduce ? 0 : ICON_MS * 0.35;
    closeTimer.current = window.setTimeout(() => {
      closeTimer.current = null;
      setClosing(false);
      setOpen(false);
    }, wait);
  }, [reduce, setOpen]);

  useEffect(
    () => () => {
      if (closeTimer.current) window.clearTimeout(closeTimer.current);
    },
    [],
  );

  // Escape key & scroll lock while open
  useEffect(() => {
    if (!open || typeof document === "undefined") return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeMenu();
    };
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    measure();
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, closeMenu, measure]);

  // Focus management
  useEffect(() => {
    if (open) {
      wasOpen.current = true;
      const t = window.setTimeout(() => {
        overlayRef.current?.focus({ preventScroll: true });
      }, 80);
      return () => window.clearTimeout(t);
    }
    if (wasOpen.current) {
      wasOpen.current = false;
      toggleRef.current?.focus({ preventScroll: true });
    }
  }, [open]);

  const onOverlayKeyDown = (e: React.KeyboardEvent) => {
    if (e.key !== "Tab" || !overlayRef.current) return;
    const nodes = overlayRef.current.querySelectorAll<HTMLElement>(
      'a[href], button, [tabindex]:not([tabindex="-1"])',
    );
    if (!nodes.length) return;
    const first = nodes[0];
    const last = nodes[nodes.length - 1];
    const active = document.activeElement;
    if (active === overlayRef.current) {
      e.preventDefault();
      const initialLink = overlayRef.current.querySelector<HTMLElement>(".smo-link");
      (e.shiftKey ? last : initialLink || first).focus();
    } else if (e.shiftKey && active === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && active === last) {
      e.preventDefault();
      first.focus();
    }
  };

  const handleLinkClick = (item: MotionMenuLink) => {
    closeMenu();
    if (item.onClick) {
      item.onClick();
    } else if (item.to) {
      navigate({ to: item.to });
    }
  };

  const handleSecondaryClick = (item: MotionSecondaryLink) => {
    closeMenu();
    if (item.onClick) {
      item.onClick();
    } else if (item.to) {
      navigate({ to: item.to });
    }
  };

  const d = reduce ? 0.2 : Math.max(0.1, duration || 0.8);
  const staggerS = reduce ? 0 : Math.max(0, stagger || 0) / 1000;
  const iconOpen = open && !closing;
  const circleAt = origin.current;

  const bgVariants =
    reveal === "wipe"
      ? {
          hidden: { clipPath: "inset(0 0 100% 0)" },
          visible: { clipPath: "inset(0 0 0% 0)", transition: { duration: d, ease: EASE_OUT } },
          exit: { clipPath: "inset(0 0 100% 0)", transition: { duration: d, ease: EASE_IN } },
        }
      : reveal === "circle"
        ? {
            hidden: { clipPath: `circle(0% at ${circleAt})` },
            visible: {
              clipPath: `circle(150% at ${circleAt})`,
              transition: { duration: d * 1.1, ease: EASE_OUT },
            },
            exit: {
              clipPath: `circle(0% at ${circleAt})`,
              transition: { duration: d * 1.1, ease: EASE_IN },
            },
          }
        : {
            hidden: { opacity: 0 },
            visible: { opacity: 1, transition: { duration: d * 0.6, ease: EASE_OUT } },
            exit: { opacity: 0, transition: { duration: d * 0.6, ease: EASE_IN } },
          };

  const itemVariants = {
    hidden: { opacity: 0, y: reduce ? 0 : 28, filter: reduce ? "blur(0px)" : "blur(12px)" },
    visible: (i: number) => ({
      opacity: 1,
      y: 0,
      filter: "blur(0px)",
      transition: { duration: d, ease: EASE_OUT, delay: d * 0.3 + i * staggerS },
    }),
    exit: {
      opacity: 0,
      y: reduce ? 0 : -10,
      filter: reduce ? "blur(0px)" : "blur(8px)",
      transition: { duration: d * 0.35, ease: EASE_IN },
    },
  };

  const footerDelay = d * 0.3 + links.length * staggerS + 0.05;
  const dividerVariants = {
    hidden: { scaleX: 0, opacity: 0 },
    visible: {
      scaleX: 1,
      opacity: 1,
      transition: { duration: d, ease: EASE_OUT, delay: footerDelay },
    },
    exit: { opacity: 0, transition: { duration: d * 0.3, ease: EASE_IN } },
  };

  const footerVariants = {
    hidden: { opacity: 0, y: reduce ? 0 : 12 },
    visible: (j: number) => ({
      opacity: 1,
      y: 0,
      transition: { duration: d * 0.8, ease: EASE_OUT, delay: footerDelay + 0.1 + j * 0.06 },
    }),
    exit: { opacity: 0, transition: { duration: d * 0.3, ease: EASE_IN } },
  };

  const overlayBarBorder = mix(overlayText, 14);
  const hasFooter = !!note || secondary.length > 0 || !!overlayFooterExtra;
  const contentLeft = barRect?.insetLeft ?? 24;
  const contentRight = barRect?.insetRight ?? 14;
  const brandOffset = logo === "mark" ? logoSize + 10 : 0;
  const leftAligned = align !== "center" || narrow;
  const numberWidth = brandOffset || 36;
  const fixedBar = barRect;

  const overlay = (
    <motion.div
      ref={overlayRef}
      role="dialog"
      aria-modal="true"
      aria-label="Navigation Menu"
      tabIndex={-1}
      onKeyDown={onOverlayKeyDown}
      variants={bgVariants}
      initial="hidden"
      animate="visible"
      exit="exit"
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        width: "100%",
        height: "100%",
        zIndex: overlayZIndex,
        outline: "none",
        boxSizing: "border-box",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
        background: overlayBackground,
        backdropFilter: blur ? `blur(${blur}px)` : undefined,
        WebkitBackdropFilter: blur ? `blur(${blur}px)` : undefined,
        color: overlayText,
        willChange: "clip-path, opacity",
      }}
    >
      {/* Background Radial Glow */}
      <div
        aria-hidden="true"
        style={{
          position: "absolute",
          inset: 0,
          pointerEvents: "none",
          background: `radial-gradient(720px 520px at 88% 12%, ${glow}, transparent 70%)`,
        }}
      />

      {/* Top Bar inside Overlay */}
      <div
        style={
          fixedBar
            ? {
                position: "absolute",
                top: Math.max(12, fixedBar.top),
                left: fixedBar.left,
                width: fixedBar.width,
                zIndex: 2,
              }
            : { position: "relative", width: "100%", zIndex: 2 }
        }
      >
        <TopBar
          logo={logo}
          customLogo={customLogo}
          logoSize={logoSize}
          brand={brand}
          brandHref={brandLink}
          brandNewTab={brandNewTab}
          color={overlayText}
          background={overlayBar}
          border={overlayBarBorder}
          radius={barRadius}
          shadow={false}
          blur={0}
          padding={headerPadding}
          open={iconOpen}
          menuLabel={menuLabel}
          closeLabel={closeLabel}
          showLabel={showLabel}
          ariaLabel="Close menu"
          onToggle={closeMenu}
          fromClosed={true}
          reduce={reduce}
          actions={actions}
        />
      </div>

      {fixedBar && (
        <div style={{ flex: "none", height: Math.max(12, fixedBar.top) + fixedBar.height + 16 }} />
      )}

      {/* Main Nav Items Container */}
      <div
        className="smo-nav"
        style={{
          position: "relative",
          zIndex: 1,
          flex: 1,
          minHeight: 0,
          display: "flex",
          flexDirection: "column",
          padding: overlayPadding,
          paddingLeft: contentLeft,
          paddingRight: contentRight,
          width: fixedBar ? fixedBar.width : "100%",
          marginLeft: fixedBar ? fixedBar.left : 0,
          boxSizing: "border-box",
          overflowY: "auto",
          overflowX: "hidden",
        }}
      >
        <nav
          aria-label="Main Navigation"
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            justifyContent: narrow ? "flex-start" : "center",
            paddingTop: narrow ? "4vh" : 0,
            paddingBottom: hasFooter ? 28 : 0,
          }}
        >
          <ul
            style={{
              listStyle: "none",
              margin: 0,
              padding: 0,
              display: "flex",
              flexDirection: "column",
              alignItems: align === "center" && !narrow ? "center" : "flex-start",
              gap: narrow ? "0.22em" : "0.12em",
              fontFamily: "var(--mf-font, 'Geist', sans-serif)",
              fontSize: "clamp(2.5rem, 6.5vw, 4.75rem)",
              fontWeight: 500,
              letterSpacing: "-0.03em",
              lineHeight: 1.05,
            }}
          >
            {links.map((item, i) => {
              const isHovered = hovered === i;
              const dimmed = dimOthers && hovered !== null && !isHovered;

              return (
                <motion.li
                  key={item.label}
                  custom={i}
                  variants={itemVariants}
                  style={{ margin: 0, padding: 0, willChange: "transform, opacity, filter" }}
                >
                  <motion.div
                    className="smo-link"
                    role="button"
                    tabIndex={0}
                    data-smo-first={i === 0 ? "" : undefined}
                    onPointerEnter={(e) => {
                      if (e.pointerType === "mouse") setHovered(i);
                    }}
                    onPointerLeave={() => setHovered((h) => (h === i ? null : h))}
                    onClick={() => handleLinkClick(item)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        handleLinkClick(item);
                      }
                    }}
                    animate={{
                      x: isHovered && !reduce ? hoverShift : 0,
                      opacity: dimmed ? 0.32 : 1,
                    }}
                    transition={
                      reduce
                        ? { duration: 0 }
                        : { type: "spring", stiffness: 320, damping: 28, mass: 0.7 }
                    }
                    style={{
                      display: "inline-flex",
                      alignItems: "baseline",
                      gap: leftAligned ? "0.15em" : "0.28em",
                      color: "inherit",
                      textDecoration: "none",
                      cursor: "pointer",
                      userSelect: "none",
                      WebkitUserSelect: "none",
                      touchAction: "manipulation",
                      padding: "0.04em 0",
                      paddingLeft: leftAligned && !showNumbers ? brandOffset : undefined,
                    }}
                  >
                    {showNumbers && (
                      <span
                        aria-hidden="true"
                        style={{
                          fontSize: "max(12px, 0.22em)",
                          fontWeight: 500,
                          letterSpacing: "0.08em",
                          lineHeight: 1,
                          color: accent,
                          fontFamily: "var(--mf-mono, monospace)",
                          fontVariantNumeric: "tabular-nums",
                          transform: "translateY(-0.85em)",
                          display: "inline-block",
                          flex: "none",
                          width: leftAligned ? numberWidth : undefined,
                        }}
                      >
                        {pad(i + 1)}
                      </span>
                    )}

                    <span>{item.label}</span>

                    {item.badge && (
                      <span
                        style={{
                          marginLeft: 12,
                          fontSize: "0.75rem",
                          letterSpacing: "0.04em",
                          fontFamily: "var(--mf-mono, monospace)",
                          padding: "2px 8px",
                          borderRadius: 999,
                          background: "rgba(255, 255, 255, 0.1)",
                          color: "#10b981",
                          border: "1px solid rgba(16, 185, 129, 0.2)",
                          verticalAlign: "middle",
                        }}
                      >
                        {item.badge}
                      </span>
                    )}
                  </motion.div>
                </motion.li>
              );
            })}
          </ul>
        </nav>

        {/* Footer Area with animated divider */}
        {hasFooter && (
          <div style={{ flex: "none", marginTop: "auto" }}>
            <motion.div
              variants={dividerVariants}
              style={{
                height: 1,
                background: mix(overlayText, 14),
                transformOrigin: "left",
                marginBottom: 20,
              }}
            />

            <div
              style={{
                display: "flex",
                flexDirection: narrow ? "column" : "row",
                justifyContent: "space-between",
                alignItems: narrow ? "flex-start" : "center",
                gap: narrow ? 16 : 24,
                fontSize: "0.8125rem",
                lineHeight: 1.5,
              }}
            >
              {/* Note / status / info */}
              {note ? (
                <motion.div custom={0} variants={footerVariants} style={{ maxWidth: 520 }}>
                  {noteLink ? (
                    <a
                      className="smo-sec"
                      href={noteLink}
                      target={noteNewTab ? "_blank" : undefined}
                      rel={noteNewTab ? "noopener noreferrer" : undefined}
                      onClick={() => closeMenu()}
                      style={{
                        color: accent,
                        textDecoration: "none",
                        display: "inline-block",
                        paddingBottom: 2,
                        position: "relative",
                        cursor: "pointer",
                      }}
                    >
                      {note}
                      <span
                        className="smo-ul"
                        aria-hidden="true"
                        style={{
                          position: "absolute",
                          left: 0,
                          right: 0,
                          bottom: 0,
                          height: 1,
                          background: "currentColor",
                        }}
                      />
                    </a>
                  ) : (
                    <div style={{ color: accent }}>{note}</div>
                  )}
                </motion.div>
              ) : (
                <span />
              )}

              {/* Secondary links & extra footer controls */}
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  flexWrap: "wrap",
                  gap: "10px 24px",
                }}
              >
                {overlayFooterExtra && (
                  <motion.div custom={1} variants={footerVariants}>
                    {overlayFooterExtra}
                  </motion.div>
                )}

                {secondary.length > 0 && (
                  <ul
                    aria-label="Secondary links"
                    style={{
                      listStyle: "none",
                      margin: 0,
                      padding: 0,
                      display: "flex",
                      flexWrap: "wrap",
                      gap: "8px 20px",
                    }}
                  >
                    {secondary.map((item, j) => (
                      <motion.li
                        key={item.label}
                        custom={j + 2}
                        variants={footerVariants}
                        style={{ margin: 0, padding: 0 }}
                      >
                        {item.href ? (
                          <a
                            className="smo-sec"
                            href={item.href}
                            target={item.newTab ? "_blank" : undefined}
                            rel={item.newTab ? "noopener noreferrer" : undefined}
                            onClick={() => closeMenu()}
                            style={{
                              color: "inherit",
                              textDecoration: "none",
                              display: "inline-block",
                              paddingBottom: 2,
                              position: "relative",
                              cursor: "pointer",
                            }}
                          >
                            {item.label}
                            <span
                              className="smo-ul"
                              aria-hidden="true"
                              style={{
                                position: "absolute",
                                left: 0,
                                right: 0,
                                bottom: 0,
                                height: 1,
                                background: "currentColor",
                              }}
                            />
                          </a>
                        ) : (
                          <button
                            type="button"
                            className="smo-sec"
                            onClick={() => handleSecondaryClick(item)}
                            style={{
                              background: "none",
                              border: 0,
                              padding: "0 0 2px 0",
                              margin: 0,
                              color: "inherit",
                              textDecoration: "none",
                              display: "inline-block",
                              position: "relative",
                              cursor: "pointer",
                              font: "inherit",
                            }}
                          >
                            {item.label}
                            <span
                              className="smo-ul"
                              aria-hidden="true"
                              style={{
                                position: "absolute",
                                left: 0,
                                right: 0,
                                bottom: 0,
                                height: 1,
                                background: "currentColor",
                              }}
                            />
                          </button>
                        )}
                      </motion.li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </motion.div>
  );

  return (
    <div
      ref={rootRef}
      className={className}
      style={{
        position: "relative",
        display: "flex",
        alignItems: "center",
        boxSizing: "border-box",
        width: "100%",
        ...style,
      }}
    >
      <style>{CSS}</style>
      <TopBar
        logo={logo}
        customLogo={customLogo}
        logoSize={logoSize}
        brand={brand}
        brandHref={brandLink}
        brandNewTab={brandNewTab}
        color={headerColor}
        background={barBackground}
        border={barBorder}
        radius={barRadius}
        shadow={barShadow}
        blur={barBlur}
        padding={headerPadding}
        open={iconOpen}
        menuLabel={menuLabel}
        closeLabel={closeLabel}
        showLabel={showLabel}
        ariaLabel="Open menu"
        onToggle={open ? closeMenu : openMenu}
        buttonRef={toggleRef}
        barRef={barRef}
        reduce={reduce}
        actions={actions}
      />

      {mounted && typeof document !== "undefined"
        ? createPortal(<AnimatePresence>{open && overlay}</AnimatePresence>, document.body)
        : null}
    </div>
  );
}
