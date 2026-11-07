"""
Unit tests for FactsExtractor
Verifies deterministic fact computation, risk scoring, starter selection,
manifest parsing, environment variable parsing, and fallback document generation.
"""

import asyncio
import pytest
import json
from unittest.mock import AsyncMock, patch

from app.core.facts_extractor import (
    is_test_file,
    is_config_file,
    is_generated_file,
    classify_risk_level,
    join_chunks_without_overlap,
    build_deterministic_fallback_doc,
    FactsExtractor,
    RiskThresholds,
)


def test_file_type_classifiers():
    # Test file classifier
    assert is_test_file("src/components/button.test.tsx") is True
    assert is_test_file("tests/unit/test_auth.py") is True
    assert is_test_file("src/__tests__/utils.ts") is True
    assert is_test_file("test/test_app.py") is True
    assert is_test_file("src/components/button.tsx") is False

    # Config file classifier
    assert is_config_file("vite.config.ts") is True
    assert is_config_file("tsconfig.json") is True
    assert is_config_file("package.json") is True
    assert is_config_file("pyproject.toml") is True
    assert is_config_file(".env.example") is True
    assert is_config_file("src/services/api.ts") is False

    # Generated file classifier
    assert is_generated_file("dist/bundle.js") is True
    assert is_generated_file("build/main.js") is True
    assert is_generated_file("src/types/schema.d.ts") is True
    assert is_generated_file("src/types/models.ts") is False


def test_chunk_reassembly_deduplication():
    # Simulate sliding-window overlap of exact length used by chunker (256 chars = 64 tokens * 4)
    prefix = "A" * 1800
    overlap = "X" * 256
    suffix = "B" * 1800
    part1 = prefix + overlap
    part2 = overlap + suffix

    # Joining raw parts has duplicated overlap text
    raw_joined = part1 + part2
    assert raw_joined.count(overlap) == 2

    # join_chunks_without_overlap detects the exact chunker overlap length and removes it
    deduped = join_chunks_without_overlap([part1, part2])
    assert deduped.count(overlap) == 1
    assert deduped == prefix + overlap + suffix


def test_risk_classification():
    custom_thresholds = RiskThresholds(
        HIGH_DEPENDENTS_MIN=5,
        HIGH_COUPLING_MIN=0.5,
        HIGH_COMBINED_DEPS_MIN=3,
        MEDIUM_DEPENDENTS_MIN=2,
        MEDIUM_DEPENDENCIES_MIN=8,
        MEDIUM_COUPLING_MIN=0.3,
    )

    # Entry point with 0 dependents must NOT read "High"
    assert classify_risk_level(0, 0, 0.0, is_entry=True, source_dependents_count=0, thresholds=custom_thresholds) == "Low"
    assert classify_risk_level(0, 2, 0.0, is_entry=True, source_dependents_count=0, thresholds=custom_thresholds) == "Low"

    # Core file imported by tests only (bottle.py pattern: 0 source importers, 28 test importers)
    assert classify_risk_level(28, 0, 0.0, is_entry=False, source_dependents_count=0, test_dependents_count=28) == "Core file, imported by tests only"

    # Entry point with active callers is High
    assert classify_risk_level(2, 2, 0.1, is_entry=True, source_dependents_count=2, thresholds=custom_thresholds) == "High"

    # High dependents
    assert classify_risk_level(5, 2, 0.1, is_entry=False, source_dependents_count=5, thresholds=custom_thresholds) == "High"

    # High combined dependents and coupling
    assert classify_risk_level(3, 2, 0.6, is_entry=False, source_dependents_count=3, thresholds=custom_thresholds) == "High"

    # Medium risk
    assert classify_risk_level(2, 2, 0.1, is_entry=False, source_dependents_count=2, thresholds=custom_thresholds) == "Medium"
    assert classify_risk_level(0, 10, 0.1, is_entry=False, source_dependents_count=0, thresholds=custom_thresholds) == "Medium"
    assert classify_risk_level(0, 2, 0.4, is_entry=False, source_dependents_count=0, thresholds=custom_thresholds) == "Medium"

    # Low risk (isolated leaf)
    assert classify_risk_level(1, 2, 0.1, is_entry=False, source_dependents_count=1, thresholds=custom_thresholds) == "Low"
    assert classify_risk_level(0, 2, 0.1, is_entry=False, source_dependents_count=0, thresholds=custom_thresholds) == "Low"


def test_graph_metrics_and_starter_selection():
    mock_graph = {
        "nodes": [
            {"id": "src/server.ts", "path": "src/server.ts", "is_entry": True, "line_count": 50, "complexity": 5},
            {"id": "src/router.ts", "path": "src/router.ts", "coupling": 0.8, "line_count": 120, "complexity": 15},
            {"id": "src/utils/math.ts", "path": "src/utils/math.ts", "coupling": 0.1, "line_count": 30, "complexity": 2},
            {"id": "src/utils/math.test.ts", "path": "src/utils/math.test.ts", "line_count": 40, "complexity": 2},
            {"id": "vite.config.ts", "path": "vite.config.ts", "line_count": 25, "complexity": 1},
            {"id": "src/dead_file.ts", "path": "src/dead_file.ts", "line_count": 10, "complexity": 1},
        ],
        "edges": [
            ["src/server.ts", "src/router.ts"],
            ["src/router.ts", "src/utils/math.ts"],
        ],
        "meta": {"cycles": []},
    }

    extractor = FactsExtractor(
        db=None,  # type: ignore
        repo_id=None,  # type: ignore
        repo_full_name="test-org/test-repo",
        graph_cache=mock_graph,
    )

    metrics = extractor.compute_graph_metrics()
    assert metrics["total_modules"] == 6
    assert metrics["total_edges"] == 2
    assert metrics["cycles_count"] == 0

    # Entry points
    entry_ids = [e["id"] for e in metrics["entry_points"]]
    assert "src/server.ts" in entry_ids

    # Candidate starters should:
    # 1. Include src/utils/math.ts (has low dependents, has a nearby test src/utils/math.test.ts)
    # 2. Exclude src/utils/math.test.ts (is a test)
    # 3. Exclude vite.config.ts (is config)
    # 4. Exclude src/dead_file.ts (dead code: 0 dependents, 0 dependencies)
    # 5. Exclude src/server.ts (is entry point)
    starters = metrics["candidate_starters"]
    starter_paths = [s["path"] for s in starters]

    assert "src/utils/math.ts" in starter_paths
    assert "src/utils/math.test.ts" not in starter_paths
    assert "vite.config.ts" not in starter_paths
    assert "src/dead_file.ts" not in starter_paths
    assert "src/server.ts" not in starter_paths

    math_starter = next(s for s in starters if s["path"] == "src/utils/math.ts")
    assert math_starter["nearby_test"] == "src/utils/math.test.ts"


def test_starter_selection_with_no_tests_in_repo():
    mock_graph = {
        "nodes": [
            {"id": "src/main.py", "path": "src/main.py", "is_entry": True, "line_count": 100, "complexity": 8},
            {"id": "src/core.py", "path": "src/core.py", "coupling": 0.5, "line_count": 80, "complexity": 10},
            {"id": "src/format.py", "path": "src/format.py", "coupling": 0.0, "line_count": 25, "complexity": 1},
        ],
        "edges": [
            ["src/main.py", "src/core.py"],
            ["src/core.py", "src/format.py"],
        ],
        "meta": {"cycles": []},
    }

    extractor = FactsExtractor(
        db=None,  # type: ignore
        repo_id=None,  # type: ignore
        repo_full_name="test-org/no-tests",
        graph_cache=mock_graph,
    )

    metrics = extractor.compute_graph_metrics()
    starters = metrics["candidate_starters"]
    assert len(starters) == 1
    assert starters[0]["path"] == "src/format.py"
    assert starters[0]["nearby_test"] is None


def test_readme_summary_extraction():
    extractor = FactsExtractor(
        db=None,  # type: ignore
        repo_id=None,  # type: ignore
        repo_full_name="test-org/readme-test",
    )

    # 1. Valid README with badges and title
    readme_sample = """# Project Foo
[![Build Status](https://ci.org/badge.svg)](https://ci.org)
<img src="logo.png" />

Project Foo is a lightweight async task queue built for high throughput microservices.

It provides automatic retry policies, dead-letter queues, and real-time dashboard telemetry.

## Installation
Run pip install foo
"""
    with patch.object(extractor, "extract_file_content", AsyncMock(return_value=readme_sample)):
        summary = asyncio.run(extractor.extract_readme_summary())
        assert summary is not None
        assert "Project Foo is a lightweight async task queue" in summary
        assert "It provides automatic retry policies" in summary
        assert "[![Build Status]" not in summary
        assert "# Project Foo" not in summary

    # 2. Missing README
    with patch.object(extractor, "extract_file_content", AsyncMock(return_value=None)):
        missing_summary = asyncio.run(extractor.extract_readme_summary())
        assert missing_summary is None

    # 3. Empty README
    with patch.object(extractor, "extract_file_content", AsyncMock(return_value="   ")):
        empty_summary = asyncio.run(extractor.extract_readme_summary())
        assert empty_summary is None

    # 4. Valid README.rst with image directives, header underlines, and rst links
    rst_sample = """.. image:: logo.png
   :target: https://example.org
   :alt: Logo

====================
Awesome Microservice
====================

Awesome Microservice is a lightweight WSGI_ micro web-framework for Python_. It has no dependencies other than the `Python Standard Library <https://docs.python.org>`_.

* **Fast:** High performance.
"""
    with patch.object(extractor, "extract_file_content", AsyncMock(return_value=rst_sample)):
        rst_summary = asyncio.run(extractor.extract_readme_summary())
        assert rst_summary is not None
        assert "Awesome Microservice is a lightweight WSGI micro web-framework for Python." in rst_summary
        assert "Python Standard Library" in rst_summary
        assert ".. image::" not in rst_summary
        assert "====================" not in rst_summary


def test_package_json_and_pyproject_parsing():
    extractor = FactsExtractor(
        db=None,  # type: ignore
        repo_id=None,  # type: ignore
        repo_full_name="test-org/manifest-test",
    )

    # 1. Standard package.json
    pkg_json = json.dumps({
        "name": "sample-app",
        "scripts": {
            "dev": "vite",
            "build": "vite build",
            "test": "vitest run",
        },
        "dependencies": {
            "react": "^18.2.0",
            "zustand": "^4.5.0",
        },
        "devDependencies": {
            "typescript": "^5.0.0",
            "vitest": "^1.0.0",
        },
    })
    with patch.object(extractor, "extract_file_content", AsyncMock(return_value=pkg_json)):
        facts = asyncio.run(extractor.extract_manifest_facts())
        assert facts["manifest_type"] == "package.json"
        assert facts["project_name"] == "sample-app"
        assert "npm test" in facts["test_command"]
        assert "declared" in facts["test_command_type"]
        assert "npm run dev" in facts["dev_command"]
        assert "react" in facts["runtime_dependencies"]
        assert "typescript" in facts["dev_dependencies"]

    # 2. Empty package.json
    with patch.object(extractor, "extract_file_content", AsyncMock(return_value="{}")):
        empty_facts = asyncio.run(extractor.extract_manifest_facts())
        assert empty_facts["manifest_type"] == "package.json"
        assert empty_facts["project_name"] is None
        assert empty_facts["test_command"] is None
        assert empty_facts["runtime_dependencies"] == []
        assert empty_facts["dev_dependencies"] == []

    # 3. Standard pyproject.toml parsed with tomllib
    pyproject_toml = """[project]
name = "sample-service"
dependencies = [
    "fastapi>=0.100.0",
    "sqlalchemy>=2.0.0",
]

[project.optional-dependencies]
dev = [
    "pytest>=8.0.0",
    "pytest-cov>=4.0.0",
]

[tool.pytest.ini_options]
testpaths = ["tests"]
"""
    async def mock_extract(name: str):
        if name == "package.json":
            return None
        if name == "pyproject.toml":
            return pyproject_toml
        return None

    with patch.object(extractor, "extract_file_content", side_effect=mock_extract):
        py_facts = asyncio.run(extractor.extract_manifest_facts())
        assert py_facts["manifest_type"] == "pyproject.toml"
        assert py_facts["project_name"] == "sample-service"
        assert "pytest" in py_facts["test_command"]
        assert "declared" in py_facts["test_command_type"]
        assert "fastapi" in py_facts["runtime_dependencies"]
        assert "sqlalchemy" in py_facts["runtime_dependencies"]
        assert "pytest" in py_facts["dev_dependencies"]
        assert "AUTHORS" not in py_facts["runtime_dependencies"]
        assert "AUTHORS" not in py_facts["dev_dependencies"]


def test_real_readme_chunker_and_reassembly():
    from app.core.chunker import chunk_file

    sections = [
        f"## Section {i}\n\nThis is paragraph {i} of the comprehensive repository documentation. "
        f"It contains architectural guidelines, dependency notes, and setup instructions for new contributors.\n\n"
        f"```bash\nmake target-{i}\n```\n"
        for i in range(35)
    ]
    original = "# Complete Repository Guide\n\n" + "\n".join(sections)
    assert len(original) > 5000

    chunks = chunk_file("README.md", original, "Markdown")
    assert len(chunks) > 3

    raw_contents = [c.content.replace("# File: README.md\n\n", "") for c in chunks]
    reconstructed = join_chunks_without_overlap(raw_contents)

    assert reconstructed == original


def test_env_example_parsing():
    extractor = FactsExtractor(
        db=None,  # type: ignore
        repo_id=None,  # type: ignore
        repo_full_name="test-org/env-test",
    )

    env_content = """# App Configuration
PORT=8080
DATABASE_URL=postgresql://localhost:5432/app
JWT_SECRET=supersecret123

# Optional Redis
REDIS_URL=redis://localhost:6379/0
"""
    # 1. Valid .env.example
    with patch.object(extractor, "extract_file_content", AsyncMock(return_value=env_content)):
        keys = asyncio.run(extractor.extract_env_variables())
        assert "PORT" in keys
        assert "DATABASE_URL" in keys
        assert "JWT_SECRET" in keys
        assert "REDIS_URL" in keys
        # Never extracts comments or values
        assert "# App Configuration" not in keys
        assert "supersecret123" not in keys

    # 2. Missing .env.example
    with patch.object(extractor, "extract_file_content", AsyncMock(return_value=None)):
        missing_keys = asyncio.run(extractor.extract_env_variables())
        assert missing_keys == []


def test_folder_grouping():
    mock_graph = {
        "nodes": [
            {"id": "src/components/button.tsx", "path": "src/components/button.tsx"},
            {"id": "src/components/card.tsx", "path": "src/components/card.tsx"},
            {"id": "src/lib/api.ts", "path": "src/lib/api.ts"},
            {"id": "backend/app/main.py", "path": "backend/app/main.py"},
            {"id": "README.md", "path": "README.md"},
        ],
        "edges": [],
    }

    extractor = FactsExtractor(
        db=None,  # type: ignore
        repo_id=None,  # type: ignore
        repo_full_name="test-org/folder-test",
        graph_cache=mock_graph,
    )

    breakdown = extractor.compute_folder_breakdown()
    paths = [b["path"] for b in breakdown]
    assert "src/components" in paths
    assert "src/lib" in paths
    assert "backend" in paths
    assert "root" in paths

    # Verify no trailing slashes and singular vs plural formatting
    for b in breakdown:
        assert not b["path"].endswith("/")
    
    fallback_doc = build_deterministic_fallback_doc({
        "repo_full_name": "test-org/folder-test",
        "total_modules": 5,
        "total_edges": 0,
        "folder_breakdown": breakdown,
    })
    assert "- `src/components/` (2 files" in fallback_doc
    assert "- `src/lib/` (1 file" in fallback_doc
    assert "src/components//" not in fallback_doc
    assert "1 files" not in fallback_doc


def test_deterministic_fallback_document():
    facts = {
        "repo_full_name": "acme/quantum-engine",
        "total_modules": 42,
        "total_edges": 88,
        "cycles_count": 0,
        "readme_summary": "Quantum simulation engine for statevector calculation.",
        "entry_points": [
            {"path": "src/main.py", "dependents_count": 0, "dependencies_count": 5}
        ],
        "high_risk_files": [
            {"path": "src/circuit.py", "dependents_count": 12, "dependencies_count": 3, "coupling": 0.85}
        ],
        "candidate_starters": [
            {"path": "src/gates/hadamard.py", "line_count": 45, "dependents_count": 0, "nearby_test": "tests/test_hadamard.py"}
        ],
        "manifest": {
            "test_command": "pytest",
            "dev_command": None,
            "build_command": "python -m build",
            "tech_stack": ["numpy", "scipy"],
        },
    }

    doc = build_deterministic_fallback_doc(facts)

    # Must contain real verified facts
    assert "# acme/quantum-engine: Onboarding Guide" in doc
    assert "—" not in doc
    assert "unidirectional hierarchy" not in doc
    assert "42" in doc
    assert "88" in doc
    assert "src/circuit.py" in doc
    assert "src/gates/hadamard.py" in doc
    assert "pytest" in doc
    assert "tests/test_hadamard.py" in doc

    # Must NOT contain fake data
    assert "src/router.ts" not in doc
    assert "src/db.ts" not in doc
    assert "0.75" not in doc
    assert "HAZARD ALERT" not in doc
    assert "Non-Negotiable Architectural Invariants" not in doc


def test_chunk_boundary_no_overlap_shared_suffix_prefix():
    # Chunk 1 ends with a pattern and Chunk 2 starts with the exact same 9-char pattern
    # when there was NO intentional sliding window overlap (e.g. separate AST symbol chunks).
    chunk1 = "First function ends here:\nreturn 0;\n"
    chunk2 = "return 0;\nSecond function begins here."
    merged = join_chunks_without_overlap([chunk1, chunk2])
    # Both lines must survive because arbitrary short matches are NOT sliding window overlaps
    assert merged == "First function ends here:\nreturn 0;\nreturn 0;\nSecond function begins here."


def test_real_readme_round_trip_chunking_and_reassembly():
    from app.core.chunker import chunk_file
    import re

    real_readme = (
        "# Sample Project\n\n"
        "A comprehensive demonstration of DevLens facts extraction and chunking pipeline.\n\n"
        "## Installation\n\n"
        "```bash\npip install -e .\n```\n\n"
        "## Architecture Overview\n\n"
        "DevLens uses a multi-layered static analysis pipeline to inspect repositories.\n"
        "It traces imports, builds graph models, and extracts grounded facts without hallucinations.\n\n"
    ) + ("\n## Section Details\n\nThis section describes feature components in detail with exhaustive context.\n" * 40)

    chunks = chunk_file("README.md", real_readme, "Markdown")
    assert len(chunks) > 1, "Expected multi-chunk split for test coverage"

    # Strip the file header added by _chunk_generic
    clean_chunks = [re.sub(r"^# File: [^\n]+\n\n", "", c.content) for c in chunks]

    # Reconstruct the original document
    reconstructed = join_chunks_without_overlap(clean_chunks)
    assert reconstructed == real_readme


def test_makefile_test_target_precedence_over_pyproject():
    extractor = FactsExtractor(
        db=None,  # type: ignore
        repo_id=None,  # type: ignore
        repo_full_name="test-org/makefile-precedence",
    )
    pyproject_toml = """[project]
name = "bottle"
dependencies = []

[tool.pytest.ini_options]
testpaths = ["test"]
"""
    makefile = """
.PHONY: test build
test:
\tpytest test/
build:
\tpython -m build
"""
    async def mock_extract(name: str):
        if name == "package.json":
            return None
        if name == "Makefile":
            return makefile
        if name == "pyproject.toml":
            return pyproject_toml
        return None

    with patch.object(extractor, "extract_file_content", side_effect=mock_extract):
        facts = asyncio.run(extractor.extract_manifest_facts())
        assert facts["test_command"] == "make test"
        assert "Makefile target" in facts["test_command_type"]
        assert facts["build_command"] == "make build"


def test_candidate_starter_first_30_lines_and_purpose():
    mock_graph = {
        "nodes": [
            {"id": "src/main.py", "path": "src/main.py", "is_entry": True, "line_count": 80, "complexity": 5},
            {"id": "src/helper.py", "path": "src/helper.py", "line_count": 20, "complexity": 1},
        ],
        "edges": [
            ["src/main.py", "src/helper.py"],
        ],
        "meta": {"cycles": []},
    }
    extractor = FactsExtractor(
        db=None,  # type: ignore
        repo_id=None,  # type: ignore
        repo_full_name="test-org/starter-snippet",
        graph_cache=mock_graph,
    )
    snippet = "def helper():\n    # verified logic\n    return 42"
    async def mock_extract(name: str):
        if "helper.py" in name:
            return snippet
        return None

    with patch.object(extractor, "extract_file_content", side_effect=mock_extract):
        facts = asyncio.run(extractor.assemble_verified_facts())
        starters = facts["candidate_starters"]
        assert len(starters) == 1
        assert starters[0]["first_30_lines"] == snippet.strip()

        facts_text = extractor.format_facts_text(facts)
        assert "Verified first 30 lines snippet" in facts_text
        assert "def helper():" in facts_text


def test_onboarding_doc_schema_validation():
    from app.schemas.onboarding import (
        OnboardingDocSchema,
        QuickStartInfo,
        FolderMapItem,
        CarefulFileItem,
        GotchaItem,
        FirstTaskSection,
        StarterTaskItem,
        GlossaryItem,
    )

    doc_data = {
        "repo_name": "acme/quantum",
        "summary": "Quantum computing library.",
        "tech_stack": ["python", "numpy"],
        "quick_start": {
            "install_command": "pip install -e .",
            "run_command": "python -m quantum",
            "test_command": "make test",
            "test_command_type": "declared",
            "env_variables": ["QUANTUM_SEED"],
        },
        "folder_map": [
            {"path": "quantum", "role": "Core engine", "file_count": 10, "sample_files": "engine.py"}
        ],
        "how_it_works": "Requests enter quantum.py and invoke simulation steps.",
        "careful_files": [
            {
                "path": "quantum/core.py",
                "risk_level": "High",
                "dependents_count": 8,
                "source_dependents_count": 8,
                "test_dependents_count": 2,
                "coupling": 0.9,
                "reason": "Core statevector dispatch.",
            }
        ],
        "gotchas": [
            {"title": "DAG invariant", "description": "No cyclic imports", "evidence_path": "quantum/core.py"}
        ],
        "first_task": {
            "title": "Add gate unit test",
            "suggested_files": [
                {
                    "path": "quantum/gates.py",
                    "line_count": 30,
                    "source_dependents_count": 1,
                    "nearby_test": "tests/test_gates.py",
                    "verified_purpose": "Calculates unitary matrix.",
                }
            ],
            "rationale": "Isolated leaf.",
            "verification_steps": "Run make test.",
        },
        "glossary": [
            {"term": "Statevector", "definition": "Array of complex amplitudes.", "defined_in": "quantum/core.py"}
        ],
    }

    schema = OnboardingDocSchema.model_validate(doc_data)
    assert schema.repo_name == "acme/quantum"
    assert schema.quick_start.install_command == "pip install -e ."
    assert schema.careful_files[0].risk_level == "High"
    assert schema.first_task.suggested_files[0].line_count == 30


def test_first_task_guarding_when_purpose_unverified():
    from app.schemas.onboarding import StarterTaskItem, FirstTaskSection
    from pathlib import PurePosixPath

    # Scenario: unverified purpose must force generic title and rationale
    candidate_starter = {
        "path": "src/utils/payment_processor.ts",
        "line_count": 45,
        "source_dependents_count": 0,
        "nearby_test": None,
        "first_30_lines": None,
    }
    
    file_name = PurePosixPath(candidate_starter["path"]).name
    has_snippet = bool(candidate_starter.get("first_30_lines"))
    verified_purpose = "purpose not verified" if not has_snippet else "Grounded explanation"
    
    # Model hallucinated a title based on filename
    model_title = "Implement Stripe Payment Webhook"
    if verified_purpose == "purpose not verified":
        task_title = f"Add a test for {file_name}"
        task_rationale = f"Module [[{candidate_starter['path']}]] has low complexity ({candidate_starter['line_count']} lines)."
    else:
        task_title = model_title
        task_rationale = "Custom rationale."

    assert task_title == "Add a test for payment_processor.ts"
    assert "Stripe" not in task_title
    assert "Add a test for" in task_title


def test_zero_test_modules_guard():
    # If 0 test modules exist, never recommend test command, say 'no tests found'
    mock_graph = {
        "nodes": [
            {"id": "src/app.ts", "path": "src/app.ts"},
            {"id": "package.json", "path": "package.json"},
        ],
        "edges": [],
    }
    extractor = FactsExtractor(
        db=None,  # type: ignore
        repo_id=None,  # type: ignore
        repo_full_name="test-org/zero-tests",
        graph_cache=mock_graph,
    )

    pkg_json = json.dumps({
        "name": "zero-tests",
        "scripts": {"test": "jest", "dev": "vite"},
        "devDependencies": {"jest": "^29.0.0"}
    })

    with patch.object(extractor, "extract_file_content", AsyncMock(side_effect=lambda p: pkg_json if p == "package.json" else None)):
        manifest = asyncio.run(extractor.extract_manifest_facts(test_modules_count=0))
        assert manifest["test_command"] == "no tests found"
        assert "no test files found in indexed files" in manifest["test_command_type"]


def test_monorepo_multi_manifest_support():
    mock_graph = {
        "nodes": [
            {"id": "frontend/package.json", "path": "frontend/package.json"},
            {"id": "frontend/src/App.tsx", "path": "frontend/src/App.tsx"},
            {"id": "frontend/src/App.test.tsx", "path": "frontend/src/App.test.tsx"},
            {"id": "backend/requirements.txt", "path": "backend/requirements.txt"},
            {"id": "backend/Dockerfile", "path": "backend/Dockerfile"},
            {"id": "backend/app/main.py", "path": "backend/app/main.py"},
            {"id": "backend/tests/test_main.py", "path": "backend/tests/test_main.py"},
        ],
        "edges": [],
    }
    extractor = FactsExtractor(
        db=None,  # type: ignore
        repo_id=None,  # type: ignore
        repo_full_name="test-org/monorepo",
        graph_cache=mock_graph,
    )

    frontend_pkg = json.dumps({
        "name": "client",
        "scripts": {"dev": "vite", "test": "vitest run"}
    }, indent=2)
    backend_req = "fastapi>=0.100.0\nuvicorn>=0.23.0\npytest>=7.0.0\n"
    backend_dockerfile = (
        "FROM python:3.11-slim\n"
        "RUN pip install -r requirements.txt\n"
        'CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]\n'
    )
    readme_md = (
        "# Monorepo\n"
        "```bash\n"
        "pytest backend/tests\n"
        "```\n"
    )

    def mock_fetch(p: str):
        if p == "frontend/package.json":
            return frontend_pkg
        elif p == "backend/requirements.txt":
            return backend_req
        elif p == "backend/Dockerfile":
            return backend_dockerfile
        elif p == "README.md":
            return readme_md
        return None

    with patch.object(extractor, "extract_file_content", AsyncMock(side_effect=mock_fetch)):
        manifest = asyncio.run(extractor.extract_manifest_facts(test_modules_count=1))
        pkgs = manifest.get("monorepo_packages", [])
        assert len(pkgs) == 2
        folders = [p["folder"] for p in pkgs]
        assert "frontend" in folders
        assert "backend" in folders

        front = next(p for p in pkgs if p["folder"] == "frontend")
        assert front["install_command"] == "not declared in repo"
        assert front["install_provenance"] is None
        assert front["run_command"] == "cd frontend && npm run dev"
        assert "frontend/package.json:4 (scripts.dev: vite)" in front["run_provenance"]
        assert front["test_command"] == "cd frontend && npm test"
        assert "frontend/package.json:5 (scripts.test: vitest run)" in front["test_provenance"]

        back = next(p for p in pkgs if p["folder"] == "backend")
        assert back["install_command"] == "pip install -r requirements.txt"
        assert back["install_provenance"] == "backend/Dockerfile:2"
        assert back["run_command"] == "uvicorn app.main:app --host 0.0.0.0 --port 8000"
        assert back["run_provenance"] == "backend/Dockerfile:3 (CMD)"
        assert back["test_command"] == "pytest backend/tests"
        assert back["test_provenance"] == "README.md:3"


def test_grouped_env_variables_and_code_usage():
    from app.core.facts_extractor import categorize_env_key

    assert categorize_env_key("DATABASE_URL") == "Database & Cache"
    assert categorize_env_key("AUTH_JWT_SECRET") == "Authentication & Security"
    assert categorize_env_key("STRIPE_API_KEY") == "Authentication & Security"
    assert categorize_env_key("NEXT_PUBLIC_APP_URL") == "API & External Services"
    assert categorize_env_key("APP_ENV") == "Application & Runtime"

    mock_graph = {
        "nodes": [
            {"id": "src/config.ts", "path": "src/config.ts"},
            {"id": ".env.example", "path": ".env.example"},
        ],
        "edges": [],
    }
    extractor = FactsExtractor(
        db=None,  # type: ignore
        repo_id=None,  # type: ignore
        repo_full_name="test-org/env-test",
        graph_cache=mock_graph,
    )

    env_content = (
        "DATABASE_URL=postgres://localhost/db\n"
        "AUTH_SECRET=secret123\n"
        "MISC_SETTING=foo\n"
        "REDIS_URL=redis://localhost:6379\n"
        "API_KEY=xyz123\n"
        "PORT=8000\n"
        "DEBUG=true\n"
    )
    code_content = "const db = process.env.DATABASE_URL;\nconst secret = process.env['AUTH_SECRET'];\n"

    def mock_fetch(p: str):
        if p == ".env.example":
            return env_content
        elif p == "src/config.ts":
            return code_content
        return None

    with patch.object(extractor, "extract_file_content", AsyncMock(side_effect=mock_fetch)):
        facts = asyncio.run(extractor.assemble_verified_facts())
        grouped = facts.get("grouped_env_variables", {})
        assert "Database & Cache" in grouped
        assert "Authentication & Security" in grouped

        db_item = next(i for i in grouped["Database & Cache"] if i["key"] == "DATABASE_URL")
        assert db_item["read_in_code"] is True
        assert db_item["accessor"] == "process.env"

        unused_item = next(i for i in grouped.get("Configuration", []) if i["key"] == "MISC_SETTING")
        assert unused_item["read_in_code"] is False

        fallback_doc = build_deterministic_fallback_doc(facts)
        assert "- **Database & Cache**:" in fallback_doc
        assert "`DATABASE_URL` (read in code via process.env)" in fallback_doc
        assert "`MISC_SETTING` (declared in .env.example)" in fallback_doc
        assert "DATABASE_URL, AUTH_SECRET, MISC_SETTING" not in fallback_doc


def test_glossary_and_gotcha_evidence_chunk_validation():
    from app.agent.devlens_agent import _is_valid_source_file, _resolve_graph_path, _clean_markdown_citations
    from app.schemas.onboarding import GlossaryItem

    known_paths = {"src/app.ts", "src/auth.ts", "README.rst", "package.json"}
    assert _is_valid_source_file("src/app.ts", known_paths) is True
    assert _resolve_graph_path("README", known_paths) == "README.rst"
    assert _resolve_graph_path("README.md", known_paths) == "README.rst"
    assert _is_valid_source_file("package.json", known_paths) is True
    assert _is_valid_source_file("pyproject.toml", known_paths) is False
    assert _is_valid_source_file("fictional_unindexed_file.py", known_paths) is False

    cleaned = _clean_markdown_citations("See [[README]] and [[src/app.ts]] and [[not_in_graph.py]].", known_paths)
    assert cleaned == "See [[README.rst]] and [[src/app.ts]] and not_in_graph.py."

    gl = GlossaryItem(term="Topological", definition="Graph analysis", seen_in="README.rst")
    assert gl.seen_in == "README.rst"

    # Chunk term validation logic
    readme_chunk = "# DevLens AI\nDevLens provides topological repository intelligence."
    term_present = "Topological"
    term_absent = "QuantumSupremacy"

    assert term_present.lower() in readme_chunk.lower()
    assert term_absent.lower() not in readme_chunk.lower()


def test_dynamic_section_renumbering_when_sections_omitted():
    from app.agent.devlens_agent import DevLensAgent
    from app.schemas.onboarding import (
        OnboardingDocSchema,
        QuickStartInfo,
        CarefulFileItem,
        FirstTaskSection,
        FolderMapItem,
    )

    doc = OnboardingDocSchema(
        repo_name="acme/renumber-test",
        summary="Architecture summary.",
        quick_start=QuickStartInfo(
            install_command="npm install",
            run_command="npm run dev",
            test_command="npm test",
            env_variables=[],
        ),
        folder_map=[
            FolderMapItem(path="src", role="Source code", file_count=5, sample_files="app.ts")
        ],
        how_it_works="Data flows from main to handlers.",
        careful_files=[
            CarefulFileItem(
                path="src/main.ts",
                risk_level="High",
                dependents_count=10,
                source_dependents_count=8,
                test_dependents_count=2,
                coupling=0.7,
                reason="Main coordinator.",
            )
        ],
        gotchas=[],  # EMPTY
        first_task=FirstTaskSection(
            title="Add a test for helpers.ts",
            rationale="Safe starter task.",
            suggested_files=[],
            verification_steps="npm test",
        ),
        glossary=[],  # EMPTY
    )

    agent = DevLensAgent(db=None, repo_id=None, repo_full_name="acme/renumber-test")  # type: ignore
    rendered = agent._render_schema_to_markdown(doc, facts={})

    assert "## 1. Project Overview & Architecture" in rendered
    assert "## 2. Quick Start" in rendered
    assert "## 3. Folder Map" in rendered
    assert "## 4. How It Works" in rendered
    assert "## 5. Files to Handle Carefully" in rendered
    # Since gotchas is empty, Recommended First Task must be ## 6, not ## 7!
    assert "## 6. Recommended First Task" in rendered
    assert "## 7." not in rendered
    assert "## 8." not in rendered
    assert "Repository Invariants & Gotchas" not in rendered


def test_manifest_parse_failure_handling():
    mock_graph = {
        "nodes": [{"id": "package.json", "path": "package.json"}],
        "edges": [],
    }
    extractor = FactsExtractor(
        db=None,  # type: ignore
        repo_id=None,  # type: ignore
        repo_full_name="test-org/corrupt-manifest",
        graph_cache=mock_graph,
    )

    with patch.object(extractor, "extract_file_content", AsyncMock(side_effect=lambda p: "{invalid json content" if p == "package.json" else None)):
        manifest = asyncio.run(extractor.extract_manifest_facts())
        assert manifest["parse_error"] == "could not read package.json"
        assert manifest["manifest_type"] == "package.json"

        facts = {"manifest": manifest, "total_modules": 1, "total_edges": 0}
        fallback = build_deterministic_fallback_doc(facts)
        assert "- could not read package.json" in fallback

        from app.schemas.onboarding import OnboardingDocSchema, QuickStartInfo, FirstTaskSection
        from app.agent.devlens_agent import DevLensAgent
        doc = OnboardingDocSchema(
            repo_name="test-org/corrupt-manifest",
            summary="Overview",
            architecture="Arch",
            quick_start=QuickStartInfo(),
            folder_map=[],
            how_it_works="Data flows through modules.",
            careful_files=[],
            gotchas=[],
            first_task=FirstTaskSection(title="Generic task"),
            glossary=[],
        )
        agent = DevLensAgent(db=None, repo_id=None, repo_full_name="test-org/corrupt-manifest")  # type: ignore
        rendered = agent._render_schema_to_markdown(doc, facts=facts)
        assert "- could not read package.json" in rendered

    with patch.object(extractor, "extract_file_content", AsyncMock(side_effect=lambda p: "corrupt = [toml" if p == "pyproject.toml" else None)):
        manifest_py = asyncio.run(extractor.extract_manifest_facts())
        assert manifest_py["parse_error"] == "could not read pyproject.toml"
        assert manifest_py["manifest_type"] == "pyproject.toml"


def test_verified_purpose_rules_and_evidence_quote():
    from app.agent.devlens_agent import _extract_purpose_from_snippet

    # 1. Snippet starting with code line (e.g. "return <Scene />;") without docstring/comment or quote
    code_snippet = "function Hero3D() {\n  return <Scene />;\n}"
    assert _extract_purpose_from_snippet(code_snippet) == "purpose not verified"

    # 2. Snippet with trailing code punctuation in object property
    obj_snippet = "export const getRouter = () => {\n  const router = createRouter({\n    context: { queryClient },\n  });\n};"
    assert _extract_purpose_from_snippet(obj_snippet) == "purpose not verified"

    # 3. Snippet starting with a module docstring -> extracts first sentence
    doc_snippet = '"""FastAPI application entry point for DevLens AI. Initializes routes and middleware."""\nfrom fastapi import FastAPI\n'
    assert _extract_purpose_from_snippet(doc_snippet) == "FastAPI application entry point for DevLens AI."

    # 4. Snippet starting with a leading comment -> extracts first sentence
    comment_snippet = "// Utility helpers for formatting timestamps across UI views.\nexport function formatTime(ms: number) { return ms; }"
    assert _extract_purpose_from_snippet(comment_snippet) == "Utility helpers for formatting timestamps across UI views."

    # 5. Model provides an exact substring evidence_quote and valid prose purpose
    assert (
        _extract_purpose_from_snippet(
            obj_snippet,
            model_purpose="Creates and configures the application router instance.",
            evidence_quote="const router = createRouter({",
        )
        == "Creates and configures the application router instance."
    )

    # 6. Model provides an evidence_quote NOT in the snippet -> rejected
    assert (
        _extract_purpose_from_snippet(
            obj_snippet,
            model_purpose="Creates and configures the application router instance.",
            evidence_quote="nonexistent quote not in snippet",
        )
        == "purpose not verified"
    )


def test_core_file_imported_by_tests_only_in_high_risk():
    nodes = [
        {"id": "bottle.py", "path": "bottle.py", "line_count": 4000},
        {"id": "docs/conf.py", "path": "docs/conf.py", "line_count": 100},
    ]
    edges = [["docs/conf.py", "bottle.py"]]
    for i in range(6):
        t_path = f"test/test_suite_{i}.py"
        nodes.append({"id": t_path, "path": t_path, "line_count": 50})
        edges.append([t_path, "bottle.py"])

    extractor = FactsExtractor(
        db=None,  # type: ignore
        repo_id=None,  # type: ignore
        repo_full_name="bottlepy/bottle",
        graph_cache={"nodes": nodes, "edges": edges, "meta": {"cycles": []}},
    )
    with patch.object(extractor, "extract_file_content", AsyncMock(return_value='"""Bottle micro-framework."""\n')):
        facts = asyncio.run(extractor.assemble_verified_facts())
        assert len(facts["high_risk_files"]) == 1
        hr = facts["high_risk_files"][0]
        assert hr["path"] == "bottle.py"
        assert hr["risk_level"] == "Core file, imported by tests only"
        assert hr["dependents_count"] == 6
        assert hr["test_dependents_count"] == 6
        assert hr["source_dependents_count"] == 0


def test_group_tech_stack_and_monorepo_merging():
    from app.core.facts_extractor import group_tech_stack

    raw_deps = (
        [f"@radix-ui/react-pkg-{i}" for i in range(28)]
        + ["@tanstack/react-query", "@tanstack/react-router", "@tanstack/react-start", "@tanstack/router-plugin"]
        + ["react", "react-dom", "tailwindcss", "three", "zod", "clsx", "cmdk", "sonner", "vaul", "lenis"]
        + ["fastapi", "uvicorn", "celery", "pgvector", "sqlalchemy", "redis", "langchain", "langchain-openai", "langchain-core"]
    )
    grouped = group_tech_stack(raw_deps, max_groups=12)
    assert len(grouped) <= 12
    assert "@radix-ui/* (28 packages)" in grouped
    assert "@tanstack/* (4 packages)" in grouped
    assert "langchain* (3 packages)" in grouped
    assert "fastapi" in grouped
    assert "celery" in grouped
    assert "pgvector" in grouped


def test_assemble_verified_facts_determinism():
    import json

    mock_graph = {
        "nodes": [
            {"id": "src/main.ts", "path": "src/main.ts", "is_entry": True, "line_count": 100},
            {"id": "src/utils/helper.ts", "path": "src/utils/helper.ts", "line_count": 25},
            {"id": "package.json", "path": "package.json", "line_count": 30},
        ],
        "edges": [["src/main.ts", "src/utils/helper.ts"]],
        "meta": {"cycles": []},
    }
    extractor = FactsExtractor(
        db=None,  # type: ignore
        repo_id=None,  # type: ignore
        repo_full_name="acme/deterministic-repo",
        graph_cache=mock_graph,
    )
    with patch.object(extractor, "extract_file_content", AsyncMock(return_value='{"name": "det", "scripts": {"dev": "vite"}}')):
        run1 = asyncio.run(extractor.assemble_verified_facts())
        run2 = asyncio.run(extractor.assemble_verified_facts())
        assert json.dumps(run1, sort_keys=True) == json.dumps(run2, sort_keys=True)


def test_command_string_equality_and_clean_provenance():
    extractor = FactsExtractor(
        db=None,  # type: ignore
        repo_id=None,  # type: ignore
        repo_full_name="acme/cmd-test",
    )
    pkg_json = json.dumps({
        "name": "cmd-test",
        "scripts": {
            "dev": "vite --host",
            "test": "node --test tests/*.test.js",
            "build": "vite build",
        },
    }, indent=2)
    with patch.object(extractor, "extract_file_content", AsyncMock(return_value=pkg_json)):
        mf = asyncio.run(extractor.extract_manifest_facts(test_modules_count=2))
        assert mf["run_command"] == "npm run dev"
        assert "(runs:" not in mf["run_command"]
        assert "scripts.dev: vite --host" in mf["run_command_provenance"]
        assert mf["test_command"] == "npm test"
        assert "(runs:" not in mf["test_command"]
        assert "scripts.test: node --test tests/*.test.js" in mf["test_command_provenance"]
        assert mf["build_command"] == "npm run build"


def test_snapshot_footer_age_and_staleness_note():
    from app.core.facts_extractor import format_snapshot_footer
    from datetime import datetime, timedelta, timezone

    now = datetime.now(timezone.utc)
    fresh_ts = (now - timedelta(days=2)).isoformat()
    stale_ts = (now - timedelta(days=20)).isoformat()

    fresh_footer = format_snapshot_footer({
        "commit_sha": "abc1234",
        "indexed_at": fresh_ts,
        "snapshot_age_days": 2,
    })
    assert "Commit: abc1234" in fresh_footer
    assert "(2 days old)" in fresh_footer
    assert "older than 14 days" not in fresh_footer

    stale_footer = format_snapshot_footer({
        "commit_sha": "def5678",
        "indexed_at": stale_ts,
        "snapshot_age_days": 20,
    })
    assert "Commit: def5678" in stale_footer
    assert "(20 days old)" in stale_footer
    assert "Note: Snapshot is older than 14 days; re-ingest for latest changes" in stale_footer


def test_python_relative_and_package_root_imports():
    from app.core.graph_builder import _extract_python_imports

    # 1. markupsafe pattern: indented relative import inside try/except + src/ package root
    markupsafe_paths = {
        "src/markupsafe/__init__.py",
        "src/markupsafe/_native.py",
        "tests/test_markupsafe.py",
    }
    init_code = (
        "try:\n"
        "    from ._speedups import _escape_inner\n"
        "except ImportError:\n"
        "    from ._native import _escape_inner\n"
    )
    init_deps = _extract_python_imports(init_code, "src/markupsafe/__init__.py", markupsafe_paths)
    assert init_deps == ["src/markupsafe/_native.py"]

    test_code = "from markupsafe import Markup, escape\n"
    test_deps = _extract_python_imports(test_code, "tests/test_markupsafe.py", markupsafe_paths)
    assert test_deps == ["src/markupsafe/__init__.py"]

    # 2. Luminary pattern: backend/ package root + from-package submodule imports
    luminary_paths = {
        "backend/main.py",
        "backend/database.py",
        "backend/routers/auth.py",
        "backend/routers/documents.py",
    }
    main_code = (
        "from database import engine, Base\n"
        "from routers import auth, documents\n"
    )
    main_deps = _extract_python_imports(main_code, "backend/main.py", luminary_paths)
    assert set(main_deps) == {
        "backend/database.py",
        "backend/routers/auth.py",
        "backend/routers/documents.py",
    }


def test_nearby_test_exact_stem_and_docstring_header_stopping():
    from app.core.facts_extractor import find_nearby_test
    from app.agent.devlens_agent import _extract_purpose_from_snippet

    all_paths = [
        "src/markupsafe/__init__.py",
        "src/markupsafe/_native.py",
        "tests/__init__.py",
        "tests/conftest.py",
        "tests/test_markupsafe.py",
    ]
    # __init__.py in markupsafe matches test_markupsafe.py (parent package stem), never tests/__init__.py
    assert find_nearby_test("src/markupsafe/__init__.py", all_paths) == "tests/test_markupsafe.py"
    # _native.py has no dedicated test_native.py, and must not match tests/__init__.py
    assert find_nearby_test("src/markupsafe/_native.py", all_paths) is None

    # Multi-line docstring with section underline and ALL-CAPS header stops at first title line
    luminary_docstring = (
        '"""\n'
        "security.py - Password Hashing and JWT Tokens\n"
        "───────────────────────────────────────────────\n"
        "WHY PASSLIB + BCRYPT?\n"
        "  Never store plain-text passwords in the database!\n"
        '"""\n'
    )
    assert (
        _extract_purpose_from_snippet(luminary_docstring)
        == "security.py - Password Hashing and JWT Tokens."
    )









