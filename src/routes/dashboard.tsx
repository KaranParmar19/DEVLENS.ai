import { useState } from "react";
import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { PortalTransform } from "@/components/portal-transform";
import { NeuralMesh } from "@/components/neural-mesh";

type DashboardSearch = {
  repo?: string;
};

export const Route = createFileRoute("/dashboard")({
  validateSearch: (search: Record<string, unknown>): DashboardSearch => {
    return {
      repo: search.repo as string | undefined,
    };
  },
  component: DashboardPage,
  head: () => ({
    meta: [
      { title: "Dashboard — DevLens AI" },
      { name: "description", content: "Interactive architecture mapping, smart Q&A, and onboarding documentation." }
    ],
  }),
});

function DashboardPage() {
  const { repo } = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });
  const [inputRepo, setInputRepo] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (inputRepo.trim()) {
      navigate({
        search: { repo: inputRepo.trim() },
      });
    }
  };

  // If a repository URL is provided, display the dashboard shell/portal transform
  if (repo) {
    return (
      <PortalTransform
        open={true}
        repoUrl={repo}
        onClose={() => {
          navigate({ search: { repo: undefined } });
        }}
      />
    );
  }

  // If no repository URL is provided, render a premium connect screen
  return (
    <div className="relative min-h-screen bg-[#09090b] font-sans text-brand-text flex flex-col justify-between overflow-hidden">
      {/* Background Effects */}
      <div className="fixed inset-0 z-0 pointer-events-none">
        <NeuralMesh opacity={0.08} />
      </div>
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[500px] h-[500px] bg-emerald-500/5 blur-[120px] rounded-full pointer-events-none" />

      {/* Nav */}
      <nav className="relative z-10 border-b border-white/5 px-6 py-4 flex items-center justify-between bg-brand-bg/60 backdrop-blur-md">
        <Link to="/" className="font-mono text-[13px] font-semibold text-white tracking-tight flex items-center gap-2">
          <span className="size-2 rounded-full bg-[#00E5A0] shadow-[0_0_8px_rgba(0,229,160,0.5)]" />
          DEVLENS_V2
        </Link>
        <div className="flex items-center gap-6">
          <Link to="/pricing" className="font-mono text-[11px] uppercase tracking-widest text-zinc-500 hover:text-white transition-colors">
            Pricing
          </Link>
          <Link to="/onboarding" className="font-mono text-[11px] uppercase tracking-widest text-zinc-500 hover:text-white transition-colors">
            Get Started
          </Link>
          <Link to="/" className="font-mono text-[11px] uppercase tracking-widest text-zinc-400 hover:text-white transition-colors">
            ← Home
          </Link>
        </div>
      </nav>

      {/* Content */}
      <main className="relative z-10 flex-1 flex flex-col items-center justify-center px-6 text-center max-w-xl mx-auto py-16">
        <div className="font-mono text-[10px] uppercase tracking-widest text-zinc-500 mb-6">
          System_Ready // Interactive_Session
        </div>
        
        <h1 className="text-4xl sm:text-5xl font-semibold text-white tracking-tight mb-4">
          Enter repository.
        </h1>
        <p className="text-sm text-zinc-500 leading-relaxed mb-10 max-w-sm">
          Provide any GitHub repository URL below to load its interactive architecture map and start Q&A.
        </p>

        {/* Command bar */}
        <form onSubmit={handleSubmit} className="w-full">
          <div className="flex items-center gap-4 bg-[#111] p-2 pl-4 rounded-lg border border-zinc-800 focus-within:border-[#00E5A0] transition-colors shadow-[0_0_24px_rgba(0,0,0,0.4)]">
            <span className="font-mono text-zinc-600 text-sm select-none">/connect</span>
            <input
              type="text"
              value={inputRepo}
              onChange={(e) => setInputRepo(e.target.value)}
              placeholder="github.com/org/repo"
              className="flex-1 bg-transparent font-mono text-sm text-white outline-none placeholder:text-zinc-700 min-w-0"
              autoFocus
            />
            <button
              type="submit"
              className="bg-zinc-100 text-zinc-950 font-medium text-xs py-2 pl-2 pr-3 rounded flex items-center gap-2 hover:bg-white transition-colors shrink-0"
            >
              Connect
            </button>
          </div>
        </form>

        <div className="mt-8 flex items-center gap-6">
          <span className="font-mono text-[10px] uppercase tracking-widest text-zinc-700">AES-256 encrypted</span>
          <span className="h-px w-4 bg-zinc-800" />
          <span className="font-mono text-[10px] uppercase tracking-widest text-zinc-700">zero logs retained</span>
        </div>
      </main>

      {/* Footer */}
      <footer className="relative z-10 py-6 text-center border-t border-white/5 font-mono text-[10px] text-zinc-700">
        // DevLens AI v2 · Full codebase indexing & semantic RAG
      </footer>
    </div>
  );
}
