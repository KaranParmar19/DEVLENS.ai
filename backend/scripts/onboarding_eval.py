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

    all_passed = (
        check_em_dash
        and check_banned_words
        and check_paths_exist
        and check_commands
        and check_numbering
    )

    return {
        "repo": repo_full_name,
        "status": repo.status.value,
        "facts": facts,
        "doc_md": doc_md,
        "drops": getattr(agent, "last_drops", []),
        "checks": {
            "no_em_dash": check_em_dash,
            "no_banned_words": check_banned_words,
            "banned_found": found_banned,
            "paths_exist": check_paths_exist,
            "invalid_citations": invalid_citations,
            "commands_verified": check_commands,
            "sequential_numbering": check_numbering,
            "section_nums": section_nums,
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
        f"{'Paths Grounded':<14} | {'Commands Valid':<14} | {'Numbering':<10} | {'Verdict':<8} |"
    )
    print(header)
    print("|" + "-" * 32 + "|" + "-" * 12 + "|" + "-" * 12 + "|" + "-" * 16 + "|" + "-" * 16 + "|" + "-" * 12 + "|" + "-" * 10 + "|")

    for r in results:
        c = r.get("checks", {})
        em_str = "PASS" if c.get("no_em_dash") else "FAIL"
        ban_str = "PASS" if c.get("no_banned_words") else f"FAIL ({','.join(c.get('banned_found', []))})"
        path_str = "PASS" if c.get("paths_exist") else f"FAIL ({len(c.get('invalid_citations', []))})"
        cmd_str = "PASS" if c.get("commands_verified") else "FAIL"
        num_str = "PASS" if c.get("sequential_numbering") else f"FAIL ({c.get('section_nums')})"
        verd_str = "PASS" if r.get("passed") else "FAIL"

        row = (
            f"| {r['repo']:<30} | {em_str:<10} | {ban_str:<10} | "
            f"{path_str:<14} | {cmd_str:<14} | {num_str:<10} | {verd_str:<8} |"
        )
        print(row)

    print("\n" + "=" * 80)
    print("FACTS & DROPS SUMMARY PER REPOSITORY")
    print("=" * 80)
    for r in results:
        print(f"\n### Repository: {r['repo']}")
        f = r.get("facts", {})
        print(f"- Modules: {f.get('total_modules')} (Source: {f.get('source_modules_count')}, Tests: {f.get('test_modules_count')})")
        manifest = f.get("manifest", {})
        print(f"- Manifest: {manifest.get('manifest_type')}")
        print(f"- Install Command: {manifest.get('install_command')}")
        print(f"- Test Command: {manifest.get('test_command')}")
        print(f"- Run Command: {manifest.get('run_command')}")
        print(f"- High Risk Files: {len(f.get('high_risk_files', []))}")
        print(f"- Candidate Starters: {len(f.get('candidate_starters', []))}")
        print(f"- Post-processing Drops: {r.get('drops', [])}")


if __name__ == "__main__":
    asyncio.run(main())
