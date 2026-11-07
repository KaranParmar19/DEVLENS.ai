"""
DevLens AI - Onboarding Dossier Evaluation Script
Runs automated verification checks on the output of DevLensAgent.generate_onboarding_doc():
1. No em-dashes (strictly no \u2014 or —)
2. No banned AI buzzwords (delve, elevate, robust, testament, comprehensive, seamless, etc.)
3. All cited [[paths]] exist in the repository AST index or recognized manifest/readme
4. Commands match manifest facts (or 'no tests found' when test modules == 0)
5. Section numbering is strictly sequential with no gaps or empty headers
"""

import sys
import re
import asyncio
from pathlib import PurePosixPath
from typing import Any

from sqlalchemy import select
from app.database import AsyncSessionLocal
from app.models.repository import Repository
from app.agent.devlens_agent import DevLensAgent, _is_valid_source_file
from app.core.facts_extractor import FactsExtractor

BANNED_WORDS = [
    "delve",
    "elevate",
    "robust",
    "testament",
    "comprehensive",
    "seamless",
    "cutting-edge",
    "game-changer",
    "moreover",
    "beacon",
    "pinnacle",
    "tapestry",
]

TARGET_REPOS = [
    "KaranParmar19/Portfolio",
    "patelhashilkumar/flo-studios",
    "KaranParmar19/DEVLENS.ai",
    "bottlepy/bottle",
    "KaranParmar19/Luminary",       # Held-out: no-README
    "pallets/markupsafe",          # Held-out: Python-only
]


async def evaluate_repo(db, repo_full_name: str) -> dict[str, Any]:
    stmt = select(Repository).where(Repository.full_name == repo_full_name)
    res = await db.execute(stmt)
    repo = res.scalar_one_or_none()
    if not repo:
        return {
            "repo": repo_full_name,
            "status": "NOT_FOUND",
            "checks": {},
            "passed": False,
        }

    agent = DevLensAgent(
        db=db,
        repo_id=repo.id,
        repo_full_name=repo.full_name,
        graph_cache=repo.graph_cache or {},
    )

    extractor = FactsExtractor(
        db=db,
        repo_id=repo.id,
        repo_full_name=repo.full_name,
        graph_cache=repo.graph_cache or {},
    )
    facts = await extractor.assemble_verified_facts()

    # Generate document via real LLM path (falls back gracefully if LLM is unavailable)
    doc_md = await agent.generate_onboarding_doc()

    all_nodes = (repo.graph_cache or {}).get("nodes", [])
    known_paths = {n.get("path") or n.get("id", "") for n in all_nodes}

    # 1. No em-dashes
    has_em_dash = ("\u2014" in doc_md) or ("—" in doc_md)
    check_em_dash = not has_em_dash

    # 2. No banned words
    doc_lower = doc_md.lower()
    found_banned = [w for w in BANNED_WORDS if re.search(rf"\b{w}\b", doc_lower)]
    check_banned_words = (len(found_banned) == 0)

    # 3. Path citations grounded
    citations = re.findall(r"\[\[(.*?)\]\]", doc_md)
    invalid_citations = [
        c for c in citations if not _is_valid_source_file(c, known_paths)
    ]
    check_paths_exist = (len(invalid_citations) == 0)

    # 4. Commands match manifest facts
    manifest = facts.get("manifest", {})
    manifest_install = manifest.get("install_command")
    manifest_test = manifest.get("test_command")

    check_commands = True
    if manifest_install and manifest_install not in doc_md:
        check_commands = False
    if manifest_test and manifest_test != "no tests found" and manifest_test not in doc_md:
        check_commands = False
    if facts.get("test_modules_count", 0) == 0 and "no tests found" not in doc_md:
        check_commands = False

    # 5. Strictly sequential section numbering
    headers = re.findall(r"^## (\d+)\. (.*)$", doc_md, re.MULTILINE)
    section_nums = [int(h[0]) for h in headers]
    expected_nums = list(range(1, len(section_nums) + 1))
    check_numbering = (section_nums == expected_nums)

    # 6. Narrative guard: first_task title and rationale must not leak the filename when purpose is not verified
    check_narrative = True
    narrative_error = None
    structured_doc = getattr(agent, "last_structured_doc", {}) or {}
    first_task = structured_doc.get("first_task", {})
    starters = first_task.get("suggested_files", [])
    if starters:
        top_st = starters[0]
        if top_st.get("verified_purpose") == "purpose not verified":
            title = first_task.get("title", "")
            rationale = first_task.get("rationale", "")
            file_name = PurePosixPath(top_st["path"]).name
            stem = PurePosixPath(top_st["path"]).stem

            # Title must be generic
            if not (title == f"Add a test for {file_name}" or title.startswith("Add a test for") or title == "Explore Low-Risk Modules"):
                check_narrative = False
                narrative_error = f"Title '{title}' is not generic when purpose is unverified"

            # Check that unverified rationale does not hallucinate purpose based on file stem
            clean_rationale = re.sub(r"\[\[.*?\]\]", "", rationale)
            stem_tokens = [t.lower() for t in re.split(r"[-_.]", stem) if len(t) >= 4 and t.lower() not in ("test", "main", "utils", "index")]
            leaked_tokens = [t for t in stem_tokens if t in clean_rationale.lower()]
            if leaked_tokens:
                check_narrative = False
                narrative_error = f"Rationale leaked unverified filename tokens: {leaked_tokens}"

    all_passed = (
        check_em_dash
        and check_banned_words
        and check_paths_exist
        and check_commands
        and check_numbering
        and check_narrative
    )

    drops_by_section = getattr(agent, "last_drops_by_section", {}) or {
        "paths": [],
        "gotchas": [],
        "glossary": [],
        "starters": [],
    }

    return {
        "repo": repo_full_name,
        "status": repo.status.value,
        "facts": facts,
        "doc_md": doc_md,
        "drops": getattr(agent, "last_drops", []),
        "drops_by_section": drops_by_section,
        "checks": {
            "no_em_dash": check_em_dash,
            "no_banned_words": check_banned_words,
            "banned_found": found_banned,
            "paths_exist": check_paths_exist,
            "invalid_citations": invalid_citations,
            "commands_verified": check_commands,
            "sequential_numbering": check_numbering,
            "section_nums": section_nums,
            "narrative_guard": check_narrative,
            "narrative_error": narrative_error,
        },
        "passed": all_passed,
    }


async def main():
    print("=" * 80)
    print("DEVLENS ONBOARDING EVALUATION RUNNER")
    print("=" * 80)

    results = []
    async with AsyncSessionLocal() as db:
        for repo_name in TARGET_REPOS:
            print(f"\n[Evaluating] {repo_name}...")
            res = await evaluate_repo(db, repo_name)
            results.append(res)
            print(f"  -> Result: {'PASS' if res['passed'] else 'FAIL'}")

    print("\n" + "=" * 80)
    print("AUTOMATED EVALUATION SCORECARD")
    print("=" * 80)
    header = (
        f"| {'Repository':<30} | {'No Em-Dash':<10} | {'No Banned':<10} | "
        f"{'Paths Grounded':<14} | {'Commands Valid':<14} | {'Numbering':<10} | {'Narrative Guard':<16} | {'Verdict':<8} |"
    )
    print(header)
    print("|" + "-" * 32 + "|" + "-" * 12 + "|" + "-" * 12 + "|" + "-" * 16 + "|" + "-" * 16 + "|" + "-" * 12 + "|" + "-" * 18 + "|" + "-" * 10 + "|")

    for r in results:
        c = r.get("checks", {})
        em_str = "PASS" if c.get("no_em_dash") else "FAIL"
        ban_str = "PASS" if c.get("no_banned_words") else f"FAIL ({','.join(c.get('banned_found', []))})"
        path_str = "PASS" if c.get("paths_exist") else f"FAIL ({len(c.get('invalid_citations', []))})"
        cmd_str = "PASS" if c.get("commands_verified") else "FAIL"
        num_str = "PASS" if c.get("sequential_numbering") else f"FAIL ({c.get('section_nums')})"
        narr_str = "PASS" if c.get("narrative_guard") else "FAIL"
        verd_str = "PASS" if r.get("passed") else "FAIL"

        row = (
            f"| {r['repo']:<30} | {em_str:<10} | {ban_str:<10} | "
            f"{path_str:<14} | {cmd_str:<14} | {num_str:<10} | {narr_str:<16} | {verd_str:<8} |"
        )
        print(row)

    print("\n" + "=" * 80)
    print("DROPS LOGGED PER SECTION")
    print("=" * 80)
    for r in results:
        print(f"\n### Repository: {r['repo']}")
        dbs = r.get("drops_by_section", {})
        for sec in ("paths", "gotchas", "glossary", "starters"):
            items = dbs.get(sec, [])
            print(f"- **{sec}** ({len(items)} dropped):")
            for it in items:
                print(f"  - {it}")

    print("\n" + "=" * 80)
    print("FULL GENERATED ONBOARDING DOCUMENTS")
    print("=" * 80)
    for r in results:
        print(f"\n{'#' * 80}\n# REPOSITORY: {r['repo']}\n{'#' * 80}\n")
        print(r.get("doc_md", ""))


if __name__ == "__main__":
    asyncio.run(main())
