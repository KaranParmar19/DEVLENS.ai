"""
DevLens AI - Onboarding Dossier Evaluation Script
Runs automated verification checks on the output of DevLensAgent.generate_onboarding_doc():
1. No em-dashes (strictly no em-dash character)
2. No banned AI buzzwords (delve, elevate, robust, testament, comprehensive, seamless, etc.)
3. No placeholders ("application run command", "entry module")
4. All cited [[paths]] exist in the repository graph index (known_paths)
5. Commands match manifest facts and Quick Start vs first_task commands are identical
6. Banned first-task titles ("Explore Repository Architecture", or "Add a test" when no tests exist)
7. Verified purpose is prose (either "purpose not verified" or valid prose with no trailing '{', ',', '(', ';')
8. Tech stack size rendered in Markdown is at most 12 groups
9. Section numbering is strictly sequential with no gaps or empty headers
10. Count invariants and hand-written expected.json ground truth verification
"""

import sys
import re
import json
import asyncio
from pathlib import Path, PurePosixPath
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

PLACEHOLDER_STRINGS = [
    "application run command",
    "entry module",
]

BANNED_FIRST_TASK_TITLES = [
    "Explore Repository Architecture",
    "Explore Low-Risk Modules",
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
    has_em_dash = ("\u2014" in doc_md) or (chr(8212) in doc_md)
    check_em_dash = not has_em_dash

    # 2. No banned words
    doc_lower = doc_md.lower()
    found_banned = [w for w in BANNED_WORDS if re.search(rf"\b{w}\b", doc_lower)]
    check_banned_words = (len(found_banned) == 0)

    # 3. No placeholders
    found_placeholders = [p for p in PLACEHOLDER_STRINGS if p.lower() in doc_lower]
    check_no_placeholders = (len(found_placeholders) == 0)

    # 4. Path citations strictly in known_paths
    citations = re.findall(r"\[\[(.*?)\]\]", doc_md)
    invalid_citations = [
        c for c in citations if c not in known_paths
    ]
    check_paths_exist = (len(invalid_citations) == 0)

    # 5. Commands match manifest facts & Quick Start vs first_task equality
    manifest = facts.get("manifest", {})
    manifest_install = manifest.get("install_command")
    manifest_test = manifest.get("test_command")
    manifest_run = manifest.get("run_command")

    structured_doc = getattr(agent, "last_structured_doc", {}) or {}
    qs_doc = structured_doc.get("quick_start", {})
    first_task = structured_doc.get("first_task", {})

    check_commands = True
    command_errors = []
    if manifest_install and manifest_install not in doc_md:
        check_commands = False
        command_errors.append(f"install_command '{manifest_install}' missing from doc")
    if manifest_test and manifest_test != "no tests found" and manifest_test not in doc_md:
        check_commands = False
        command_errors.append(f"test_command '{manifest_test}' missing from doc")
    if facts.get("test_modules_count", 0) == 0 and "no tests found" not in doc_md:
        check_commands = False
        command_errors.append("0 test modules but 'no tests found' missing from doc")

    # Quick Start vs first_task command equality
    qs_test = qs_doc.get("test_command") or ""
    qs_run = qs_doc.get("run_command") or ""
    ft_title = first_task.get("title") or ""
    ft_verif = first_task.get("verification_steps") or ""

    for cmd_val in (qs_doc.get("install_command", ""), qs_run, qs_test):
        if "(runs:" in str(cmd_val) or "(testpaths:" in str(cmd_val):
            check_commands = False
            command_errors.append(f"command string contains provenance annotation: '{cmd_val}'")

    has_tests_bool = bool(facts.get("test_modules_count", 0) > 0 and qs_test and qs_test != "no tests found")
    if has_tests_bool:
        if f"`{qs_test}`" not in ft_verif:
            check_commands = False
            command_errors.append(f"Quick Start test_command '{qs_test}' != first_task verification '{ft_verif}'")
    else:
        if qs_run not in ft_title:
            check_commands = False
            command_errors.append(f"Quick Start run_command '{qs_run}' not in first_task title '{ft_title}'")

    # 6. Strictly sequential section numbering
    headers = re.findall(r"^## (\d+)\. (.*)$", doc_md, re.MULTILINE)
    section_nums = [int(h[0]) for h in headers]
    expected_nums = list(range(1, len(section_nums) + 1))
    check_numbering = (section_nums == expected_nums)

    # 7. Narrative guard, banned first-task titles, and prose purpose check
    check_narrative = True
    narrative_errors = []

    if ft_title in BANNED_FIRST_TASK_TITLES:
        check_narrative = False
        narrative_errors.append(f"Banned first_task title: '{ft_title}'")

    if not has_tests_bool:
        if "add a test" in ft_title.lower():
            check_narrative = False
            narrative_errors.append(f"first_task title '{ft_title}' says 'Add a test' when test_command is '{qs_test}'")
        if not ft_title.startswith("Read ") or ", then run " not in ft_title:
            check_narrative = False
            narrative_errors.append(f"first_task title '{ft_title}' does not match 'Read <entry>, then run <cmd>'")

    starters = first_task.get("suggested_files", [])
    for st in starters:
        vp = str(st.get("verified_purpose", "")).strip()
        if vp != "purpose not verified":
            if vp.endswith(("{", ",", "(", ";", "[", "=", ":")):
                check_narrative = False
                narrative_errors.append(f"Starter '{st.get('path')}' purpose ends with code punctuation: '{vp}'")
            if re.match(r"^(import|from|export|const|let|var|function|return|class|def)\b", vp):
                check_narrative = False
                narrative_errors.append(f"Starter '{st.get('path')}' purpose starts with code token: '{vp}'")

    if starters:
        top_st = starters[0]
        if top_st.get("verified_purpose") == "purpose not verified":
            title = first_task.get("title", "")
            rationale = first_task.get("rationale", "")
            file_name = PurePosixPath(top_st["path"]).name
            stem = PurePosixPath(top_st["path"]).stem

            if has_tests_bool and title != f"Add a test for {file_name}":
                check_narrative = False
                narrative_errors.append(f"Title '{title}' is not generic 'Add a test for {file_name}' when purpose is unverified")

            clean_rationale = re.sub(r"\[\[.*?\]\]", "", rationale)
            stem_tokens = [t.lower() for t in re.split(r"[-_.]", stem) if len(t) >= 4 and t.lower() not in ("test", "main", "utils", "index")]
            leaked_tokens = [t for t in stem_tokens if t in clean_rationale.lower()]
            if leaked_tokens:
                check_narrative = False
                narrative_errors.append(f"Rationale leaked unverified filename tokens: {leaked_tokens}")

    # 8. Tech stack size check (at most 12 groups rendered)
    check_tech_stack_size = True
    tech_stack_groups_count = 0
    ts_match = re.search(r"^-\s+\*\*Tech Stack\*\*:\s+(.+)$", doc_md, re.MULTILINE)
    if ts_match:
        groups = [g.strip() for g in ts_match.group(1).split(",") if g.strip()]
        tech_stack_groups_count = len(groups)
        if tech_stack_groups_count > 12:
            check_tech_stack_size = False

    # 9. Pre-clean model citations inspection
    raw_citations = getattr(agent, "last_raw_citations_before_clean", [])
    raw_invalid_citations = [
        c for c in raw_citations if not _is_valid_source_file(c, known_paths)
    ]

    # 10. Count Invariant check & Hand-written expected.json verification
    invariant_errors = []

    careful_files_facts = {cf["path"]: cf for cf in facts.get("high_risk_files", [])}
    careful_matches = re.findall(
        r"-\s+\*\*\[\[(.*?)\]\]\*\*\s+\(Risk:\s+(?:High|Medium|Low|Core file, imported by tests only),\s+Total Dependents:\s+(\d+)\s+\(Source:\s+(\d+),\s+Tests:\s+(\d+)\)",
        doc_md,
    )
    for path, tot_s, src_s, tst_s in careful_matches:
        if path in careful_files_facts:
            cf = careful_files_facts[path]
            if int(tot_s) != int(cf.get("dependents_count", 0)):
                invariant_errors.append(
                    f"Careful file {path} total dependents {tot_s} != fact {cf.get('dependents_count')}"
                )
            if int(src_s) != int(cf.get("source_dependents_count", 0)):
                invariant_errors.append(
                    f"Careful file {path} source dependents {src_s} != fact {cf.get('source_dependents_count')}"
                )
            if int(tst_s) != int(cf.get("test_dependents_count", 0)):
                invariant_errors.append(
                    f"Careful file {path} test dependents {tst_s} != fact {cf.get('test_dependents_count')}"
                )

    starter_facts = {sf["path"]: sf for sf in facts.get("candidate_starters", [])}
    starter_matches = re.findall(
        r"-\s+\*\*\[\[(.*?)\]\]\*\*\s+\((\d+)\s+lines?,\s+(\d+)\s+source dependents?",
        doc_md,
    )
    for path, lines_s, src_s in starter_matches:
        if path in starter_facts:
            sf = starter_facts[path]
            if int(src_s) != int(sf.get("source_dependents_count", 0)):
                invariant_errors.append(
                    f"Starter file {path} source dependents {src_s} != fact {sf.get('source_dependents_count')}"
                )

    folder_facts = {fb["path"].strip().rstrip("/"): fb for fb in facts.get("folder_breakdown", [])}
    folder_matches = re.findall(r"-\s+\*\*`([^`]+)/`\*\*\s+\((\d+)\s+files?", doc_md)
    for f_path, cnt_s in folder_matches:
        clean_fp = f_path.strip().rstrip("/")
        if clean_fp in folder_facts:
            fb = folder_facts[clean_fp]
            if int(cnt_s) != int(fb.get("file_count", 0)):
                invariant_errors.append(
                    f"Folder {clean_fp} count {cnt_s} != fact {fb.get('file_count')}"
                )

    total_files_fact = facts.get("total_modules", 0)
    source_files_fact = facts.get("source_modules_count", 0)
    test_files_fact = facts.get("test_modules_count", 0)

    for m in re.finditer(r"\b(\d+)\s+(?:total\s+files|files\s+in\s+total)\b", doc_md, re.IGNORECASE):
        num = int(m.group(1))
        if num != total_files_fact and num != source_files_fact:
            invariant_errors.append(f"Prose claimed {num} total files, expected {total_files_fact}")

    valid_source_counts = {
        source_files_fact,
        total_files_fact,
        *{int(hr.get("source_dependents_count", 0)) for hr in facts.get("high_risk_files", [])},
        *{int(hr.get("dependents_count", 0)) for hr in facts.get("high_risk_files", [])},
    }
    for m in re.finditer(r"\b(\d+)\s+source\s+(?:modules|files)\b", doc_md, re.IGNORECASE):
        num = int(m.group(1))
        if num not in valid_source_counts:
            invariant_errors.append(f"Prose claimed {num} source files, expected {source_files_fact}")

    valid_test_counts = {
        test_files_fact,
        *{int(hr.get("test_dependents_count", 0)) for hr in facts.get("high_risk_files", [])},
    }
    for m in re.finditer(r"\b(\d+)\s+test\s+(?:modules|files)\b", doc_md, re.IGNORECASE):
        num = int(m.group(1))
        if num not in valid_test_counts:
            invariant_errors.append(f"Prose claimed {num} test files, expected {test_files_fact}")

    # Hand-written expected.json verification
    golden_dir = Path(__file__).resolve().parent.parent / "tests" / "golden"
    golden_dir.mkdir(parents=True, exist_ok=True)
    slug = repo_full_name.split("/")[-1]
    expected_path = golden_dir / f"{slug}.expected.json"
    expected_errors = []
    if expected_path.exists():
        with open(expected_path, "r", encoding="utf-8") as ef:
            exp = json.load(ef)
        if "repo_full_name" in exp and facts.get("repo_full_name") != exp["repo_full_name"]:
            expected_errors.append(f"repo_full_name {facts.get('repo_full_name')} != {exp['repo_full_name']}")
        if "manifest_type" in exp and manifest.get("manifest_type") != exp["manifest_type"]:
            expected_errors.append(f"manifest_type {manifest.get('manifest_type')} != {exp['manifest_type']}")
        if "is_monorepo" in exp and bool(manifest.get("monorepo_packages")) != bool(exp["is_monorepo"]):
            expected_errors.append(f"is_monorepo {bool(manifest.get('monorepo_packages'))} != {exp['is_monorepo']}")
        if "install_command" in exp and qs_doc.get("install_command") != exp["install_command"]:
            expected_errors.append(f"install_command '{qs_doc.get('install_command')}' != '{exp['install_command']}'")
        if "run_command" in exp and qs_doc.get("run_command") != exp["run_command"]:
            expected_errors.append(f"run_command '{qs_doc.get('run_command')}' != '{exp['run_command']}'")
        if "test_command" in exp and qs_doc.get("test_command") != exp["test_command"]:
            expected_errors.append(f"test_command '{qs_doc.get('test_command')}' != '{exp['test_command']}'")
        if "has_tests" in exp and has_tests_bool != bool(exp["has_tests"]):
            expected_errors.append(f"has_tests {has_tests_bool} != {exp['has_tests']}")
        if "required_tech_stack_subset" in exp:
            actual_ts_lower = {str(x).lower() for x in (structured_doc.get("tech_stack") or [])}
            for req_dep in exp["required_tech_stack_subset"]:
                if req_dep.lower() not in actual_ts_lower:
                    expected_errors.append(f"required tech_stack item '{req_dep}' missing from {actual_ts_lower}")
        if "core_or_high_risk_file" in exp:
            hr_paths = {hr["path"] for hr in facts.get("high_risk_files", [])}
            if exp["core_or_high_risk_file"] not in hr_paths:
                expected_errors.append(f"expected high-risk/core file '{exp['core_or_high_risk_file']}' not in {hr_paths}")
        if "source_modules_count" in exp and facts.get("source_modules_count") != exp["source_modules_count"]:
            expected_errors.append(f"source_modules_count {facts.get('source_modules_count')} != {exp['source_modules_count']}")
        if "test_modules_count" in exp and facts.get("test_modules_count") != exp["test_modules_count"]:
            expected_errors.append(f"test_modules_count {facts.get('test_modules_count')} != {exp['test_modules_count']}")
        if "entry_point" in exp:
            ep_paths = {ep["path"] for ep in facts.get("entry_points", [])}
            if exp["entry_point"] not in ep_paths:
                expected_errors.append(f"expected entry_point '{exp['entry_point']}' not in {ep_paths}")
    else:
        expected_errors.append(f"Missing {expected_path}")

    invariant_errors.extend(expected_errors)
    check_invariants = (len(invariant_errors) == 0)

    golden_path = golden_dir / f"{slug}.facts.json"
    with open(golden_path, "w", encoding="utf-8") as f:
        json.dump(facts, f, indent=2, sort_keys=True)

    all_passed = (
        check_em_dash
        and check_banned_words
        and check_no_placeholders
        and check_paths_exist
        and check_commands
        and check_numbering
        and check_narrative
        and check_tech_stack_size
        and check_invariants
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
        "glossary_stats": getattr(agent, "last_glossary_stats", {"returned": 0, "kept": 0}),
        "checks": {
            "no_em_dash": check_em_dash,
            "no_banned_words": check_banned_words,
            "banned_found": found_banned,
            "no_placeholders": check_no_placeholders,
            "placeholders_found": found_placeholders,
            "paths_exist": check_paths_exist,
            "invalid_citations": invalid_citations,
            "raw_citations_count": len(raw_citations),
            "raw_invalid_citations": raw_invalid_citations,
            "commands_verified": check_commands,
            "command_errors": command_errors,
            "sequential_numbering": check_numbering,
            "section_nums": section_nums,
            "narrative_guard": check_narrative,
            "narrative_errors": narrative_errors,
            "tech_stack_size": check_tech_stack_size,
            "tech_stack_groups_count": tech_stack_groups_count,
            "count_invariants": check_invariants,
            "invariant_errors": invariant_errors,
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
        f"| {'Repository':<28} | {'No EmDash':<9} | {'No Banned':<9} | {'No Placeh':<9} | "
        f"{'Paths OK':<8} | {'Cmds Equal':<10} | {'Numbering':<9} | "
        f"{'Task/Purpose':<12} | {'Stack<=12':<9} | {'Expected/Inv':<12} | {'Verdict':<7} |"
    )
    print(header)
    print(
        "|" + "-" * 30 + "|" + "-" * 11 + "|" + "-" * 11 + "|" + "-" * 11 + "|"
        + "-" * 10 + "|" + "-" * 12 + "|" + "-" * 11 + "|"
        + "-" * 14 + "|" + "-" * 11 + "|" + "-" * 14 + "|" + "-" * 9 + "|"
    )

    for r in results:
        c = r.get("checks", {})
        em_str = "PASS" if c.get("no_em_dash") else "FAIL"
        ban_str = "PASS" if c.get("no_banned_words") else "FAIL"
        pl_str = "PASS" if c.get("no_placeholders") else "FAIL"
        path_str = "PASS" if c.get("paths_exist") else f"FAIL({len(c.get('invalid_citations', []))})"
        cmd_str = "PASS" if c.get("commands_verified") else "FAIL"
        num_str = "PASS" if c.get("sequential_numbering") else "FAIL"
        narr_str = "PASS" if c.get("narrative_guard") else "FAIL"
        ts_str = f"PASS ({c.get('tech_stack_groups_count', 0)})" if c.get("tech_stack_size") else f"FAIL ({c.get('tech_stack_groups_count', 0)})"
        inv_str = "PASS" if c.get("count_invariants") else f"FAIL({len(c.get('invariant_errors', []))})"
        verd_str = "PASS" if r.get("passed") else "FAIL"

        row = (
            f"| {r['repo']:<28} | {em_str:<9} | {ban_str:<9} | {pl_str:<9} | "
            f"{path_str:<8} | {cmd_str:<10} | {num_str:<9} | "
            f"{narr_str:<12} | {ts_str:<9} | {inv_str:<12} | {verd_str:<7} |"
        )
        print(row)

    print("\n" + "=" * 80)
    print("PRE-CLEAN CITATIONS VERIFICATION (RAW MODEL OUTPUT)")
    print("=" * 80)
    for r in results:
        c = r.get("checks", {})
        raw_cnt = c.get("raw_citations_count", 0)
        raw_inv = c.get("raw_invalid_citations", [])
        status_txt = "ALL GROUNDED" if len(raw_inv) == 0 else f"{len(raw_inv)} UNGROUNDED DROPPED"
        print(f"- {r['repo']}: {raw_cnt} raw citations in model prose -> {status_txt}")
        if raw_inv:
            print(f"  Ungrounded raw citations caught & cleaned: {raw_inv}")

    print("\n" + "=" * 80)
    print("CHECK DETAILS (COMMANDS, NARRATIVE, INVARIANTS & EXPECTED.JSON)")
    print("=" * 80)
    for r in results:
        c = r.get("checks", {})
        errs = (
            c.get("command_errors", [])
            + c.get("narrative_errors", [])
            + c.get("invariant_errors", [])
        )
        if errs:
            print(f"- {r['repo']}: FAIL ({len(errs)} errors)")
            for e in errs:
                print(f"  * {e}")
        else:
            print(f"- {r['repo']}: PASS (all commands, starter purposes, counts, and expected.json checks verified)")

    print("\n" + "=" * 80)
    print("GLOSSARY TERMS RETURNED VS KEPT")
    print("=" * 80)
    for r in results:
        g = r.get("glossary_stats", {})
        print(f"- {r['repo']}: returned {g.get('returned', 0)}, kept {g.get('kept', 0)}")

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
