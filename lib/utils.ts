// ─── Node colour map (shared across graph + findings components) ─────────────

export const NODE_OBS_COLORS: Record<string, { bg: string; border: string }> = {
  integrated:     { bg: 'var(--node-obs-integrated-bg)',     border: 'var(--node-obs-integrated-border)' },
  weak:           { bg: 'var(--node-obs-weak-bg)',           border: 'var(--node-obs-weak-border)' },
  underexplained: { bg: 'var(--node-obs-underexplained-bg)', border: 'var(--node-obs-underexplained-border)' },
  inconsistent:   { bg: 'var(--node-obs-inconsistent-bg)',   border: 'var(--node-obs-inconsistent-border)' },
  disconnected:   { bg: 'var(--node-obs-disconnected-bg)',   border: 'var(--node-obs-disconnected-border)' },
}

// ─── Integration / basis key maps ────────────────────────────────────────────

export const INTEGRATION_KEY: Record<string, string> = {
  well_integrated:     'integrated',
  weakly_integrated:   'weak',
  underexplained:      'underexplained',
  naming_inconsistent: 'inconsistent',
}

export const BASIS_KEY: Record<string, string> = {
  observed_in_text:       'observed',
  strong_topic_inference: 'inferred',
  optional_enrichment:    'optional',
}

// ─── LLM output helpers ──────────────────────────────────────────────────────

/** Strip wrapping curly/straight quotes the LLM sometimes adds to example strings. */
export function stripQuotes(s: string): string {
  return s.replace(/^[""\u201c\u201d]+|[""\u201c\u201d]+$/g, '').trim()
}

/** Strip accidental markdown code fences from LLM text output. */
export function stripJsonFences(raw: string): string {
  return raw.replace(/^```(?:json)?\n?/m, '').replace(/\n?```$/m, '').trim()
}

/** Drop edges whose source or target IDs are not in the node set. */
export function filterValidEdges<T extends { source: string; target: string }>(
  edges: T[],
  nodeIds: Set<string>,
): T[] {
  return edges.filter(e => nodeIds.has(e.source) && nodeIds.has(e.target))
}

/**
 * Convert a label or LLM-generated ID to a canonical slug.
 * "Schema Markup" → "schema-markup"
 * "googleSearch" → "googlesearch" (use normalizeForMatching for cross-comparison)
 */
export function slugify(s: string): string {
  return s.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
}

/**
 * Aggressively strip all non-alphanumeric chars for fuzzy concept ID matching.
 * Lets "googleSearch", "google-search", "google_search", "Google Search" all match.
 */
export function normalizeForMatching(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]/g, '')
}

// ─── SVO helper ──────────────────────────────────────────────────────────────

/**
 * Compute Subject–Verb–Object triples for edges connected to a given node.
 * Works with any node/edge shapes that have {id, label} / {source, target, label}.
 */
export function computeSVOs(
  nodeId: string,
  nodes: { id: string; label: string }[],
  edges: { source: string; target: string; label: string }[],
): string[] {
  const nodeMap = new Map(nodes.map(n => [n.id, n.label]))
  return edges
    .filter(e => e.source === nodeId || e.target === nodeId)
    .map(e => {
      const s = nodeMap.get(e.source)
      const t = nodeMap.get(e.target)
      return s && t ? `${s} ${e.label} ${t}` : null
    })
    .filter((x): x is string => x !== null)
}

// ─── Tooltip positioning ─────────────────────────────────────────────────────

/** Horizontal centre-clamp: keep tooltip inside container with padding. */
export function clampTooltipLeft(
  cursorX: number,
  tooltipW: number,
  containerW: number,
  pad = 4,
): number {
  return Math.min(Math.max(cursorX - tooltipW / 2, pad), containerW - tooltipW - pad)
}

/** Vertical: place tooltip above cursor, clamped so it doesn't go off the top. */
export function clampTooltipTop(cursorY: number, tooltipH: number, pad = 4): number {
  return Math.max(cursorY - tooltipH - 16, pad)
}
