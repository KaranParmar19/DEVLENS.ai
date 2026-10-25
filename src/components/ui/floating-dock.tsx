import React, { useState, useEffect } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import { motion, AnimatePresence, LayoutGroup } from "motion/react";
import {
  House,
  Layers,
  Grid2x2,
  LayoutDashboard,
  UserRound,
  LogOut,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { api } from "@/lib/api";
import { ActivityBadge } from "@/components/ui/activity-badge";

export interface FloatingDockItem {
  id: string;
  label: string;
  to?: string;
  href?: string;
  isExternal?: boolean;
  icon: React.ReactNode;
  onClick?: () => void;
  title?: string;
  badge?: "live" | "dot";
}

export function FloatingDock() {
  const path = useRouterState({ select: (s) => s.location.pathname });
  const { user, isAuthenticated, loginWithGitHub, logout } = useAuth();
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [dbStatus, setDbStatus] = useState<"ok" | "down">("down");

  // Check backend & database health
  useEffect(() => {
    let mounted = true;
    const checkHealth = async () => {
      try {
        const res = await api.health();
        if (!mounted) return;
        if (res && (res.status === "ok" || res.services?.postgres === "ok")) {
          setDbStatus("ok");
        } else {
          setDbStatus("down");
        }
      } catch {
        if (mounted) setDbStatus("down");
      }
    };

    checkHealth();
    const interval = setInterval(checkHealth, 20000);
    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, []);

  // Determine active id based on current route
  const getActiveId = (): string => {
    if (path === "/") return "home";
    if (path === "/features") return "features";
    if (path === "/how-it-works") return "how-it-works";
    if (path.startsWith("/dashboard")) return "dashboard";
    return "";
  };

  const activeId = getActiveId();
  // Highlight strictly follows actively hovered item; no default hover state when cursor is away
  const highlightedId = hoveredId;

  // Primary navigation links
  const navItems: FloatingDockItem[] = [
    {
      id: "home",
      label: "Home",
      to: "/",
      icon: <House size={18} strokeWidth={1.9} />,
      title: "DevLens AI Home",
    },
    {
      id: "features",
      label: "Features",
      to: "/features",
      icon: <Layers size={18} strokeWidth={1.9} />,
      title: "DevLens Features & Deep Ingestion",
    },
    {
      id: "how-it-works",
      label: "How it works",
      to: "/how-it-works",
      icon: <Grid2x2 size={18} strokeWidth={1.9} />,
      title: "How DevLens Maps Codebases",
    },
  ];

  // Action & Auth items
  const actionItems: FloatingDockItem[] = [
    ...(isAuthenticated && user
      ? [
          {
            id: "dashboard",
            label: `@${user.username || "user"}`,
            to: "/dashboard",
            icon: user.avatarUrl ? (
              <img
                src={user.avatarUrl}
                alt={user.username || "Account"}
                style={{ width: 22, height: 22, borderRadius: "50%", objectFit: "cover" }}
              />
            ) : (
              <UserRound size={18} strokeWidth={1.9} />
            ),
            title: "Go to DevLens Workspace",
            badge: "live" as const,
          },
          {
            id: "signout",
            label: "Sign out",
            icon: <LogOut size={17} strokeWidth={1.9} />,
            onClick: logout,
            title: "Sign out",
          },
        ]
      : [
          {
            id: "connect",
            label: "Connect",
            icon: (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12" />
              </svg>
            ),
            onClick: loginWithGitHub,
            title: "Connect GitHub Account",
          },
          {
            id: "dashboard",
            label: "Dashboard ↗",
            to: "/dashboard",
            icon: <LayoutDashboard size={18} strokeWidth={1.9} />,
            title: "Launch DevLens Workspace",
          },
        ]),
  ];

  return (
    <div className="mf-floating-dock-wrap">
      <LayoutGroup id="floating-dock-nav">
        <motion.nav
          className="mf-floating-dock"
          aria-label="DevLens navigation dock"
          onMouseLeave={() => setHoveredId(null)}
          initial={{ y: -24, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
        >
          {/* DevLens Brand Logo */}
          <Link
            to="/"
            className="mf-dock-item mf-dock-brand"
            onMouseEnter={() => setHoveredId("brand")}
            title={`DevLens AI · Database ${dbStatus === "ok" ? "Online" : "Offline"}`}
            aria-label={`DevLens AI Home (Database ${dbStatus === "ok" ? "Online" : "Offline"})`}
          >
            {highlightedId === "brand" && (
              <motion.div
                layoutId="dock-highlight"
                className="mf-dock-highlight"
                transition={{ type: "spring", stiffness: 550, damping: 38 }}
              />
            )}
            <span className="mf-dock-logo-mark" aria-hidden="true">
              <ActivityBadge
                preset={dbStatus === "ok" ? "green" : "red"}
                animation="circle"
                scaleAmount={2.3}
                rings={2}
                minOpacity={0.75}
                glowSize={8}
                glowOpacity={0.5}
                transition={{ duration: 1.1, ease: "easeOut", delay: 0.3 }}
                size={8}
                label={dbStatus === "ok" ? "Database: Online" : "Database: Offline"}
              />
            </span>
            <AnimatePresence initial={false}>
              {highlightedId === "brand" && (
                <motion.span
                  className="mf-dock-label"
                  initial={{ opacity: 0, width: 0, x: -4, filter: "blur(2px)" }}
                  animate={{ opacity: 1, width: "auto", x: 0, filter: "blur(0px)" }}
                  exit={{ opacity: 0, width: 0, x: -4, filter: "blur(2px)" }}
                  transition={{ type: "spring", stiffness: 600, damping: 40 }}
                >
                  DevLens<span style={{ opacity: 0.65 }}>.ai</span>
                </motion.span>
              )}
            </AnimatePresence>
          </Link>

          <span className="mf-dock-sep" aria-hidden="true" />

          {/* Primary Navigation Items */}
          {navItems.map((item) => {
            const isHighlighted = highlightedId === item.id;
            const isItemActive = activeId === item.id;

            return (
              <Link
                key={item.id}
                to={item.to!}
                className="mf-dock-item"
                data-active={isItemActive}
                onMouseEnter={() => setHoveredId(item.id)}
                title={item.title}
                aria-label={item.label}
              >
                {isHighlighted && (
                  <motion.div
                    layoutId="dock-highlight"
                    className="mf-dock-highlight"
                    transition={{ type: "spring", stiffness: 550, damping: 38 }}
                  />
                )}
                <span className="mf-dock-icon">{item.icon}</span>
                <AnimatePresence initial={false}>
                  {isHighlighted && (
                    <motion.span
                      className="mf-dock-label"
                      initial={{ opacity: 0, width: 0, x: -4, filter: "blur(2px)" }}
                      animate={{ opacity: 1, width: "auto", x: 0, filter: "blur(0px)" }}
                      exit={{ opacity: 0, width: 0, x: -4, filter: "blur(2px)" }}
                      transition={{ type: "spring", stiffness: 600, damping: 40 }}
                    >
                      {item.label}
                    </motion.span>
                  )}
                </AnimatePresence>
              </Link>
            );
          })}

          <span className="mf-dock-sep" aria-hidden="true" />

          {/* Action & Auth Items */}
          {actionItems.map((item) => {
            const isHighlighted = highlightedId === item.id;
            const isItemActive = activeId === item.id;

            if (item.href) {
              return (
                <a
                  key={item.id}
                  href={item.href}
                  target={item.isExternal ? "_blank" : undefined}
                  rel={item.isExternal ? "noreferrer" : undefined}
                  className="mf-dock-item"
                  data-active={isItemActive}
                  onMouseEnter={() => setHoveredId(item.id)}
                  title={item.title}
                  aria-label={item.label}
                >
                  {isHighlighted && (
                    <motion.div
                      layoutId="dock-highlight"
                      className="mf-dock-highlight"
                      transition={{ type: "spring", stiffness: 550, damping: 38 }}
                    />
                  )}
                  <span className="mf-dock-icon">{item.icon}</span>
                  <AnimatePresence initial={false}>
                    {isHighlighted && (
                      <motion.span
                        className="mf-dock-label"
                        initial={{ opacity: 0, width: 0, x: -4, filter: "blur(2px)" }}
                        animate={{ opacity: 1, width: "auto", x: 0, filter: "blur(0px)" }}
                        exit={{ opacity: 0, width: 0, x: -4, filter: "blur(2px)" }}
                        transition={{ type: "spring", stiffness: 600, damping: 40 }}
                      >
                        {item.label}
                      </motion.span>
                    )}
                  </AnimatePresence>
                </a>
              );
            }

            if (item.onClick) {
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={item.onClick}
                  className="mf-dock-item mf-dock-btn"
                  data-active={isItemActive}
                  onMouseEnter={() => setHoveredId(item.id)}
                  title={item.title}
                  aria-label={item.label}
                >
                  {isHighlighted && (
                    <motion.div
                      layoutId="dock-highlight"
                      className="mf-dock-highlight"
                      transition={{ type: "spring", stiffness: 550, damping: 38 }}
                    />
                  )}
                  <span className="mf-dock-icon">{item.icon}</span>
                  <AnimatePresence initial={false}>
                    {isHighlighted && (
                      <motion.span
                        className="mf-dock-label"
                        initial={{ opacity: 0, width: 0, x: -4, filter: "blur(2px)" }}
                        animate={{ opacity: 1, width: "auto", x: 0, filter: "blur(0px)" }}
                        exit={{ opacity: 0, width: 0, x: -4, filter: "blur(2px)" }}
                        transition={{ type: "spring", stiffness: 600, damping: 40 }}
                      >
                        {item.label}
                      </motion.span>
                    )}
                  </AnimatePresence>
                </button>
              );
            }

            return (
              <Link
                key={item.id}
                to={item.to!}
                className="mf-dock-item"
                data-active={isItemActive}
                onMouseEnter={() => setHoveredId(item.id)}
                title={item.title}
                aria-label={item.label}
              >
                {isHighlighted && (
                  <motion.div
                    layoutId="dock-highlight"
                    className="mf-dock-highlight"
                    transition={{ type: "spring", stiffness: 550, damping: 38 }}
                  />
                )}
                <span className="mf-dock-icon">{item.icon}</span>
                <AnimatePresence initial={false}>
                  {isHighlighted && (
                    <motion.span
                      className="mf-dock-label"
                      initial={{ opacity: 0, width: 0, x: -4, filter: "blur(2px)" }}
                      animate={{ opacity: 1, width: "auto", x: 0, filter: "blur(0px)" }}
                      exit={{ opacity: 0, width: 0, x: -4, filter: "blur(2px)" }}
                      transition={{ type: "spring", stiffness: 600, damping: 40 }}
                    >
                      {item.label}
                    </motion.span>
                  )}
                </AnimatePresence>
              </Link>
            );
          })}
        </motion.nav>
      </LayoutGroup>
    </div>
  );
}
