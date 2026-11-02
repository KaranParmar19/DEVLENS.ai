import { useEffect, useRef, useState, type ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { FloatingDock } from "@/components/ui/floating-dock";
import { FooterField } from "@/components/ui/footer-field";

/* ── Reveal on scroll ─────────────────────────────────────────────── */
export function Reveal({ children, delay = 0, className = "", as: Tag = "div" }: {
  children: ReactNode; delay?: number; className?: string; as?: "div" | "section" | "li";
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [seen, setSeen] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([e]) => { if (e.isIntersecting) { setSeen(true); io.disconnect(); } },
      { threshold: 0.12 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);
  const Comp = Tag as "div";
  return (
    <Comp ref={ref} className={`mf-reveal ${seen ? "in" : ""} ${className}`} style={{ transitionDelay: `${delay}ms` }}>
      {children}
    </Comp>
  );
}

export function Pill({ children, live = false, dot = true }: { children: ReactNode; live?: boolean; dot?: boolean }) {
  return (
    <span className="mf-pill">
      {dot && <span className={`mf-dot ${live ? "live" : ""}`} />}
      {children}
    </span>
  );
}

export const NAV = [
  { to: "/", label: "Home" },
  { to: "/features", label: "Features" },
  { to: "/how-it-works", label: "How it works" },
  { to: "/dashboard", label: "Dashboard" },
] as const;

/* ── Navbar ───────────────────────────────────────────────────────── */
export function SiteNav() {
  return <FloatingDock />;
}

/* ── Site Footer ─────────────────────────────────────────────────── */
export function SiteFooter() {
  return <FooterField />;
}

export function SiteLayout({ children }: { children: ReactNode }) {
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;

    const sections = [...root.querySelectorAll<HTMLElement>("section[data-theme], footer[data-theme]")];
    if (sections.length === 0) return;

    let rafId = 0;
    const onScroll = () => {
      cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(() => {
        // 1. Top of page safeguard: within 80px of top, ALWAYS force light theme (Hero is active)
        if (window.scrollY <= 80) {
          if (root.dataset.theme !== "light") {
            root.dataset.theme = "light";
            document.documentElement.dataset.theme = "light";
          }
          return;
        }

        // 2. Bottom of page safeguard: within 80px of document bottom, activate footer/last theme
        const atBottom = window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 80;
        if (atBottom && sections.length > 0) {
          const last = sections[sections.length - 1];
          const lastTheme = last.dataset.theme || "dark";
          if (root.dataset.theme !== lastTheme) {
            root.dataset.theme = lastTheme;
            document.documentElement.dataset.theme = lastTheme;
          }
          return;
        }

        // 3. Focal line detection: the section that intersects the upper-middle focal point (42% down viewport)
        const focalY = window.innerHeight * 0.42;
        let activeTheme = "light";
        let found = false;

        for (const s of sections) {
          const rect = s.getBoundingClientRect();
          if (rect.top <= focalY && rect.bottom >= focalY) {
            activeTheme = s.dataset.theme || "light";
            found = true;
            break;
          }
        }

        if (!found) {
          for (const s of sections) {
            const rect = s.getBoundingClientRect();
            if (rect.top <= focalY) {
              activeTheme = s.dataset.theme || "light";
            }
          }
        }

        if (root.dataset.theme !== activeTheme) {
          root.dataset.theme = activeTheme;
          document.documentElement.dataset.theme = activeTheme;
        }
      });
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    onScroll();

    return () => {
      cancelAnimationFrame(rafId);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      document.documentElement.removeAttribute("data-theme");
    };
  }, []);

  return (
    <div className="mf-root" ref={rootRef} data-theme="light">
      <SiteNav />
      <main>{children}</main>
      <SiteFooter />
    </div>
  );
}

/* ── Page header used by sub pages ────────────────────────────────── */
export function PageHero({ eyebrow, title, lead }: { eyebrow: string; title: ReactNode; lead: string }) {
  return (
    <section className="mf-hero" style={{ paddingBottom: 72 }}>
      <div className="mf-wrap">
        <div className="mf-hero-top"><Pill live>{eyebrow}</Pill></div>
        <h1 className="mf-h1" style={{ maxWidth: "12em" }}>{title}</h1>
        <p className="mf-lead" style={{ marginTop: 28 }}>{lead}</p>
      </div>
    </section>
  );
}
