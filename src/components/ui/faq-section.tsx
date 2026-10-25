import React, { useState } from "react";
import { motion, AnimatePresence } from "motion/react";

export interface FAQItemData {
  id: string;
  question: string;
  answer: string;
}

export interface FAQSectionProps {
  title?: string;
  subtitle?: string;
  items?: FAQItemData[];
  defaultOpenIndex?: number | null;
  className?: string;
}

export const DEFAULT_DEVLENS_FAQS: FAQItemData[] = [
  {
    id: "01",
    question: "Does DevLens store my code?",
    answer:
      "No. Repositories are cloned to an ephemeral worker, parsed in memory, indexed to session graphs, and immediately discarded. Zero code is retained after your session.",
  },
  {
    id: "02",
    question: "Which languages are supported?",
    answer:
      "TypeScript, JavaScript, Python, Go, Java, Rust, Ruby, and PHP resolve imports natively via Tree-sitter. All other languages receive full file tree mapping and keyword/symbol exploration.",
  },
  {
    id: "03",
    question: "Can I analyze private repositories?",
    answer:
      "Yes. Connect your GitHub account or Personal Access Token (PAT) directly from the dashboard to analyze private repositories securely.",
  },
  {
    id: "04",
    question: "How fast is the analysis?",
    answer:
      "Most repositories finish full AST parsing and graph generation in under eight seconds. Progress streams live over real-time WebSockets.",
  },
];

export function FAQSection({
  title = "Questions & Answers",
  subtitle = "Have more questions? Don't hesitate to email us:",
  items = DEFAULT_DEVLENS_FAQS,
  defaultOpenIndex = 0,
  className = "",
}: FAQSectionProps) {
  const [openIndex, setOpenIndex] = useState<number | null>(defaultOpenIndex);
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  const toggle = (idx: number) => {
    setOpenIndex((prev) => (prev === idx ? null : idx));
  };

  return (
    <div className={`ffaq-root ${className}`}>
      <div className="ffaq-grid">
        {/* Left Column: Heading, Subtitle & Large Crisp FAQ Watermark */}
        <div className="ffaq-left">
          <div className="ffaq-left-content">
            <h2 className="ffaq-title">{title}</h2>
            <p className="ffaq-subtitle">{subtitle}</p>
          </div>

          {/* Fully Visible FAQ Watermark Typography */}
          <div className="ffaq-wm" aria-hidden="true">
            FAQ
          </div>
        </div>

        {/* Right Column: Interactive Card Accordions */}
        <div className="ffaq-right">
          <div className="ffaq-items">
            {items.map((item, idx) => {
              const isOpen = openIndex === idx;
              const isHovered = hoveredIndex === idx;

              return (
                <motion.div
                  key={item.id}
                  className={`ffaq-card ${isOpen ? "is-open" : ""}`}
                  onMouseEnter={() => setHoveredIndex(idx)}
                  onMouseLeave={() => setHoveredIndex(null)}
                  whileHover={{ y: -2 }}
                  transition={{ type: "spring", stiffness: 400, damping: 28 }}
                >
                  <button
                    type="button"
                    className="ffaq-card-header"
                    onClick={() => toggle(idx)}
                    aria-expanded={isOpen}
                  >
                    <span className="ffaq-card-num">{item.id}</span>
                    <span
                      className="ffaq-card-question"
                      style={{
                        transform: isHovered ? "translateX(6px)" : "translateX(0px)",
                        transition: "transform 0.22s cubic-bezier(0.16, 1, 0.3, 1)",
                      }}
                    >
                      {item.question}
                    </span>
                    <span className={`ffaq-chevron ${isOpen ? "is-open" : ""}`}>
                      <svg
                        width="18"
                        height="18"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <path d="m6 9 6 6 6-6" />
                      </svg>
                    </span>
                  </button>

                  <AnimatePresence initial={false}>
                    {isOpen && (
                      <motion.div
                        className="ffaq-answer-wrapper"
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
                      >
                        <div className="ffaq-answer-inner">
                          <p className="ffaq-answer-text">{item.answer}</p>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
