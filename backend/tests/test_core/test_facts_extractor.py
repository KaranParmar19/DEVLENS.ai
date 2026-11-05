"""
Unit tests for FactsExtractor
Verifies deterministic fact computation, risk scoring, and candidate starter selection.
"""

import pytest
from app.core.facts_extractor import (
    is_test_file,
    is_config_file,
    is_generated_file,
    classify_risk_level,
    FactsExtractor,
    RiskThresholds,
)


def test_file_type_classifiers():
    # Test file classifier
    assert is_test_file("src/components/button.test.tsx") is True
    assert is_test_file("tests/unit/test_auth.py") is True
    assert is_test_file("src/__tests__/utils.ts") is True
    assert is_test_file("src/components/button.tsx") is False

    # Config file classifier
    assert is_config_file("vite.config.ts") is True
    assert is_config_file("tsconfig.json") is True
    assert is_config_file("package.json") is True
    assert is_config_file("src/services/api.ts") is False

    # Generated file classifier
    assert is_generated_file("dist/bundle.js") is True
    assert is_generated_file("src/types/schema.d.ts") is True
    assert is_generated_file("src/types/models.ts") is False


def test_risk_classification():
    custom_thresholds = RiskThresholds(
        HIGH_DEPENDENTS_MIN=5,
        HIGH_COUPLING_MIN=0.5,
        HIGH_COMBINED_DEPS_MIN=3,
        MEDIUM_DEPENDENTS_MIN=1,
        MEDIUM_DEPENDENCIES_MIN=8,
        MEDIUM_COUPLING_MIN=0.3,
    )

    # Entry point is always High
    assert classify_risk_level(0, 0, 0.0, is_entry=True, thresholds=custom_thresholds) == "High"

    # High dependents
    assert classify_risk_level(5, 2, 0.1, is_entry=False, thresholds=custom_thresholds) == "High"

    # High combined dependents and coupling
    assert classify_risk_level(3, 2, 0.6, is_entry=False, thresholds=custom_thresholds) == "High"

    # Medium risk
    assert classify_risk_level(2, 2, 0.1, is_entry=False, thresholds=custom_thresholds) == "Medium"
    assert classify_risk_level(0, 10, 0.1, is_entry=False, thresholds=custom_thresholds) == "Medium"
    assert classify_risk_level(0, 2, 0.4, is_entry=False, thresholds=custom_thresholds) == "Medium"

    # Low risk (isolated leaf)
    assert classify_risk_level(0, 2, 0.1, is_entry=False, thresholds=custom_thresholds) == "Low"


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
    # 1. Include src/utils/math.ts (it has low dependents, has a nearby test src/utils/math.test.ts)
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
