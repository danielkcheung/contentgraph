import Anthropic from '@anthropic-ai/sdk'
import { LLMFrameworkOutputSchema, type LLMFrameworkOutput } from '../schemas'
import type { ContentContext, ObservedMap } from '../types'
import { stripJsonFences, filterValidEdges, slugify, normalizeForMatching } from '../utils'

const SYSTEM_PROMPT = `You are an editorial content strategist. Build the minimal complete explanatory framework for a topic given a content analysis.

GOAL: Identify every concept that materially improves explanation for this specific audience and goal. Exclude loosely related, redundant, or neighboring-topic concepts.

Stop adding concepts when the topic is sufficiently explained for the stated audience and depth. Do not over-expand into neighboring topics.

For each concept in the framework:
- id: slugified label
- label: concept name
- isAnchor: true only for the primary anchor
- explanatoryRole: one short phrase (e.g. "the mechanism that enables the anchor", "a prerequisite the reader needs to understand first", "an output that motivates understanding the anchor", "a constraint on when/how it applies", "a grounding example")
- whyItMatters: one sentence — why this concept helps explain the anchor to this specific audience
- reasonLabel: short label for inclusion reason (e.g. "prerequisite", "mechanism", "output", "constraint", "example", "contrast", "actor", "application", "definition")
- relationshipToAnchor: short phrase ("enables", "is required by", "is produced by", "constrains", "is an example of", "is an alternative to", "uses", "is a type of")
- relatedConcepts: labels of 1–3 other concepts in the framework this connects to most
- priority: "essential" (understanding fails without it) | "important" (significantly aids understanding) | "useful" (enriches but not required)
- basis: "observed_in_text" (already in content) | "strong_topic_inference" (clearly needed for this topic and audience) | "optional_enrichment" (adds depth, not required for basic understanding)
- alreadyPresent: "yes" (well covered in existing content) | "partial" (present but underdeveloped) | "no" (not in content)

For relationships between framework concepts:
- id: "frel-1", "frel-2", etc.
- source/target: concept ids
- label: short verb phrase
- basis: same enum as concept basis

IMPORTANT: Every non-anchor concept MUST appear in at least one relationship (as source or target). A concept with no edges is disconnected from the graph — do not include it, or add the missing relationship.

Return ONLY valid JSON — no markdown, no preamble:
{
  "concepts": [...],
  "relationships": [...]
}`

function buildUserMessage(context: ContentContext, observedMap: ObservedMap): string {
  const conceptSummary = observedMap.concepts.map(c =>
    `- ${c.label} [${c.integrationState}]: ${c.explanatoryRole} (${c.mentionCount} mention${c.mentionCount !== 1 ? 's' : ''})`
  ).join('\n')

  const relSummary = observedMap.relationships.map(r => {
    const src = observedMap.concepts.find(c => c.id === r.source)?.label ?? r.source
    const tgt = observedMap.concepts.find(c => c.id === r.target)?.label ?? r.target
    return `- ${src} ${r.label} ${tgt}${r.isExplicit ? '' : ' (implied)'}`
  }).join('\n')

  return `Primary anchor: ${context.primaryAnchor}
Anchor type: ${context.anchorType}
Topic: ${context.inferredTopic}
Audience: ${context.inferredAudience}
Goal: ${context.inferredGoal}
Format: ${context.inferredFormat}
Depth: ${context.inferredDepth}

Concepts observed in the content:
${conceptSummary || '(none)'}

Relationships observed:
${relSummary || '(none)'}

Build the minimal complete explanation framework for this topic and audience.`
}

export async function buildExplanationFramework(
  context: ContentContext,
  observedMap: ObservedMap,
  apiKey: string,
): Promise<LLMFrameworkOutput> {
  const client = new Anthropic({ apiKey })

  const message = await client.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 8192,
    system: SYSTEM_PROMPT,
    messages: [{ role: 'user', content: buildUserMessage(context, observedMap) }],
  })

  const raw = message.content.filter(b => b.type === 'text').map(b => b.text).join('')
  const result = LLMFrameworkOutputSchema.parse(JSON.parse(stripJsonFences(raw)))

  // ── Step 1: Re-derive concept IDs from labels (don't trust LLM slugification) ──
  // This makes IDs deterministic and eliminates any mismatch caused by the LLM
  // using underscores, camelCase, or different word boundaries in concept IDs.

  const oldIdToNew = new Map<string, string>() // LLM id → canonical id
  const fuzzyToNew = new Map<string, string>() // normalizedForMatching → canonical id

  const normalizedConcepts = result.concepts.map(c => {
    const newId = slugify(c.label)
    oldIdToNew.set(c.id, newId)
    oldIdToNew.set(slugify(c.id), newId)     // also map slug of old id
    fuzzyToNew.set(normalizeForMatching(c.label), newId)
    fuzzyToNew.set(normalizeForMatching(c.id), newId)
    return { ...c, id: newId }
  })

  // ── Step 2: Remap relationship source/target to canonical IDs ──
  // Try: exact old ID → slugified old ID → fuzzy match → fallback slug
  function remapId(raw: string): string {
    return oldIdToNew.get(raw)
      ?? oldIdToNew.get(slugify(raw))
      ?? fuzzyToNew.get(normalizeForMatching(raw))
      ?? slugify(raw)
  }

  const remappedRels = result.relationships.map(r => ({
    ...r,
    source: remapId(r.source),
    target: remapId(r.target),
  }))

  // ── Step 3: Filter to edges where both endpoints are valid concept IDs ──
  const conceptIds = new Set(normalizedConcepts.map(c => c.id))
  const validRels = filterValidEdges(remappedRels, conceptIds)

  // ── Step 4: Fallback — wire any still-unconnected concept to the anchor ──
  const connected = new Set<string>()
  validRels.forEach(r => { connected.add(r.source); connected.add(r.target) })

  const anchor = normalizedConcepts.find(c => c.isAnchor)
  const fallbackRels = anchor
    ? normalizedConcepts
        .filter(c => !c.isAnchor && !connected.has(c.id))
        .map((c, i) => ({
          id: `frel-fallback-${i}`,
          source: anchor.id,
          target: c.id,
          label: c.relationshipToAnchor,
          basis: c.basis,
        }))
    : []

  return { concepts: normalizedConcepts, relationships: [...validRels, ...fallbackRels] }
}
