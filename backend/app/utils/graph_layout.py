"""
DevLens AI — Graph Layout Utility
Computes Fruchterman-Reingold spring layout using NetworkX/scipy and
normalizes node positions to percentage coordinates (0–100) suitable
for the frontend's SVG canvas.

The frontend ArchNode type expects:
    { id, x, y, label, path, desc }
where x and y are 0–100 percentages.
"""

import math
from typing import Any

import networkx as nx


def compute_layout(
    graph: nx.DiGraph,
    width: float = 100.0,
    height: float = 100.0,
    seed: int = 42,
    k: float | None = None,
    iterations: int = 50,
) -> dict[str, tuple[float, float]]:
    """
    Compute Fruchterman-Reingold spring layout for a directed graph.

    Returns:
        dict mapping node_id → (x_pct, y_pct) where both are in [0, 100].

    Args:
        graph:      NetworkX DiGraph.
        width:      Canvas width percentage (default 100 → output is 0–100).
        height:     Canvas height percentage (default 100).
        seed:       Random seed for reproducibility.
        k:          Optimal node distance. None → auto-computed.
        iterations: Layout spring iterations (more = better quality, slower).
    """
    if len(graph.nodes) == 0:
        return {}

    if len(graph.nodes) == 1:
        # Single node → center it
        return {list(graph.nodes)[0]: (50.0, 50.0)}

    # NetworkX FR layout returns positions in [-1, 1] range
    positions = nx.spring_layout(
        graph,
        k=k,
        seed=seed,
        iterations=iterations,
    )

    return normalize_positions(positions, width=width, height=height)


def normalize_positions(
    positions: dict[str, tuple[float, float]],
    width: float = 100.0,
    height: float = 100.0,
    padding: float = 8.0,
) -> dict[str, tuple[float, float]]:
    """
    Normalize raw layout positions to canvas percentage coordinates.

    Applies padding so nodes don't sit exactly on the edge of the canvas.
    Input positions can be in any range (NetworkX uses [-1, 1] typically).

    Args:
        positions:  {node_id: (x, y)} raw positions from layout algorithm.
        width:      Target canvas width in percentage units (default 100).
        height:     Target canvas height in percentage units (default 100).
        padding:    Minimum margin from canvas edges in percentage units.

    Returns:
        {node_id: (x_pct, y_pct)} with all values clamped to [padding, width-padding].
    """
    if not positions:
        return {}

    xs = [p[0] for p in positions.values()]
    ys = [p[1] for p in positions.values()]

    min_x, max_x = min(xs), max(xs)
    min_y, max_y = min(ys), max(ys)

    # Avoid division by zero for single-dimension layouts
    x_range = max_x - min_x if max_x != min_x else 1.0
    y_range = max_y - min_y if max_y != min_y else 1.0

    usable_width = width - 2 * padding
    usable_height = height - 2 * padding

    normalized: dict[str, tuple[float, float]] = {}
    for node_id, (x, y) in positions.items():
        nx_pct = padding + ((x - min_x) / x_range) * usable_width
        ny_pct = padding + ((y - min_y) / y_range) * usable_height
        # Round to 1 decimal for cleaner JSON
        normalized[node_id] = (round(nx_pct, 1), round(ny_pct, 1))

    return normalized


def hierarchical_layout(
    graph: nx.DiGraph,
    width: float = 100.0,
    height: float = 100.0,
) -> dict[str, tuple[float, float]]:
    """
    Compute a hierarchical (top-down) layout for DAGs.

    Better than spring layout when the graph is a proper dependency tree.
    Falls back to spring layout if the graph has cycles.

    Returns:
        {node_id: (x_pct, y_pct)}
    """
    try:
        # topological_generations gives layers (0 = roots/entry points)
        generations = list(nx.topological_generations(graph))
    except nx.NetworkXUnfeasible:
        # Graph has cycles — fall back to spring layout
        return compute_layout(graph, width=width, height=height)

    if not generations:
        return {}

    num_layers = len(generations)
    positions: dict[str, tuple[float, float]] = {}

    for layer_idx, layer_nodes in enumerate(generations):
        # Y position: evenly spaced from top (5%) to bottom (95%)
        y = 5.0 + (layer_idx / max(num_layers - 1, 1)) * 90.0

        num_nodes = len(layer_nodes)
        for node_idx, node_id in enumerate(sorted(layer_nodes)):
            # X position: evenly spaced within the layer
            if num_nodes == 1:
                x = 50.0
            else:
                x = 5.0 + (node_idx / (num_nodes - 1)) * 90.0
            positions[node_id] = (round(x, 1), round(y, 1))

    return positions


def pick_best_layout(
    graph: nx.DiGraph,
    width: float = 100.0,
    height: float = 100.0,
) -> dict[str, tuple[float, float]]:
    """
    Automatically pick the best layout algorithm for the given graph.

    - DAG (no cycles): hierarchical layout (cleaner for dependency trees)
    - Has cycles:      spring (Fruchterman-Reingold) layout

    Returns:
        {node_id: (x_pct, y_pct)}
    """
    if nx.is_directed_acyclic_graph(graph):
        return hierarchical_layout(graph, width=width, height=height)
    return compute_layout(graph, width=width, height=height)
