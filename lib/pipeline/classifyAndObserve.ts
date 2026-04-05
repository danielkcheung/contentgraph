import Anthropic from '@anthropic-ai/sdk'
import { LLMPhase1OutputSchema, type LLMPhase1Output } from '../schemas'
import type { ExtractedContent } from '../types'
import { stripJsonFences, filterValidEdges } from '../utils'

const SYSTEM_PROMPT = `You are a content analysis expert. Classify the content and map what it actually explains.

STEP 1 — CLASSIFY:
Determine:
- anchorType: Is the content primarily about a specific named thing ("entity"), about how something works or happens ("process"), or about comparing/choosing between options ("comparison_or_decision_topic")?
- primaryAnchor: The specific entity, process, or comparison being explained
- inferredTopic: The subject matter in one short phrase
- inferredAudience: Who this content is written for (be specific, e.g. "marketing professionals new to SEO", "developers familiar with REST APIs")
- inferredGoal: What the reader is trying to accomplish
- inferredFormat: The content format (e.g. "tutorial", "overview", "guide", "reference", "comparison article")
- inferredDepth: How deep the explanation goes ("introductory", "intermediate", "comprehensive")

STEP 2 — MAP OBSERVED CONCEPTS:
Identify every concept present in the content.
- id: slugified label (lowercase, hyphens, e.g. "schema-markup")
- label: the concept as it appears in the content
- explanatoryRole: one short phrase describing what function this concept serves in the explanation (e.g. "the main subject", "a prerequisite", "an output the anchor produces", "a constraint on usage", "a mechanism that enables the anchor", "a contrast or alternative")
- integrationState:
  - "well_integrated": mentioned multiple times with explicit relationships stated — clearly developed
  - "weakly_integrated": present but underdeveloped — thin coverage, vague description, or mentioned only once without context
  - "underexplained": the concept appears to be important for understanding the topic but is insufficiently explained given its role
  - "naming_inconsistent": referred to with multiple different names or labels that are not reconciled
- mentionCount: approximate number of times this concept appears
- isAnchor: true only for the primary anchor concept
- namingVariants: list only if integrationState is "naming_inconsistent"
- definitionSentence: the single sentence from the content that most clearly introduces or defines this concept — exact quote from the text, as written. If the content never defines it explicitly, use the sentence where it is most meaningfully described. Never paraphrase or use outside knowledge.
- evidence: 1–2 short sentences from the text where this concept appears

STEP 3 — MAP RELATIONSHIPS:
- id: "rel-1", "rel-2", etc.
- source/target: concept ids
- label: short verb phrase ("uses", "requires", "produces", "is a type of", "affects", "constrains", "contrasts with", "is part of")
- isExplicit: true if directly stated in the text, false if strongly implied but not stated

STEP 4 — EVALUATE QUESTION COVERAGE:
For each of the 8 diagnostic questions below, determine whether the content answers it.
- covered: true if the content clearly addresses the question, false if not
- evidence: if covered is true, include the single most relevant sentence from the text that answers the question (exact quote, as short as possible). Omit if not covered.

Questions:
1. whatIsIt — "What is it?" — Does the content define the concept clearly enough for a reader encountering it for the first time?
2. howDoesItWork — "How does it work?" — Does the content explain the mechanism, process, or logic by which this concept operates?
3. whatDoesItDependOn — "What does it depend on?" — Does the content identify what this concept requires, relies on, or presupposes to function?
4. whatDoesItAffectOrProduce — "What does it affect or produce?" — Does the content describe what changes, results, or outputs this concept creates?
5. whoInteractsWithIt — "Who interacts with it?" — Does the content identify the people, systems, or roles that use, implement, or are affected by this concept?
6. whatConstraintsMatter — "What constraints matter?" — Does the content explain limits, rules, edge cases, or conditions that affect how this concept behaves?
7. whatAlternativesOrDistinctionsMatter — "What alternatives or distinctions matter?" — Does the content compare this concept to related or competing approaches?
8. whatExampleGroundsIt — "What example grounds it?" — Does the content provide a concrete instance that makes the concept tangible?

Return ONLY valid JSON — no markdown, no preamble:
{
  "context": {
    "anchorType": "entity"|"process"|"comparison_or_decision_topic",
    "primaryAnchor": string,
    "inferredTopic": string,
    "inferredAudience": string,
    "inferredGoal": string,
    "inferredFormat": string,
    "inferredDepth": string
  },
  "observedMap": {
    "concepts": [{
      "id": string,
      "label": string,
      "explanatoryRole": string,
      "integrationState": "well_integrated"|"weakly_integrated"|"underexplained"|"naming_inconsistent",
      "mentionCount": number,
      "isAnchor": boolean,
      "namingVariants": string[] (only if naming_inconsistent),
      "evidence": string[],
      "definitionSentence": string
    }],
    "relationships": [{
      "id": string,
      "source": string,
      "target": string,
      "label": string,
      "isExplicit": boolean
    }]
  },
  "questionCoverage": {
    "whatIsIt": { "covered": boolean, "evidence": string (if covered) },
    "howDoesItWork": { "covered": boolean, "evidence": string (if covered) },
    "whatDoesItDependOn": { "covered": boolean, "evidence": string (if covered) },
    "whatDoesItAffectOrProduce": { "covered": boolean, "evidence": string (if covered) },
    "whoInteractsWithIt": { "covered": boolean, "evidence": string (if covered) },
    "whatConstraintsMatter": { "covered": boolean, "evidence": string (if covered) },
    "whatAlternativesOrDistinctionsMatter": { "covered": boolean, "evidence": string (if covered) },
    "whatExampleGroundsIt": { "covered": boolean, "evidence": string (if covered) }
  }}`

function buildUserMessage(extracted: ExtractedContent): string {
  const numbered = extracted.sentences.map((s, i) => `[${i}] ${s}`).join('\n')
  return `Classify and map the following content.\n\nSentence-indexed text:\n${numbered}\n\nFull text:\n${extracted.text}`
}

export async function classifyAndObserve(
  extracted: ExtractedContent,
  apiKey: string,
): Promise<LLMPhase1Output> {
  const client = new Anthropic({ apiKey })

  const message = await client.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 8192,
    system: SYSTEM_PROMPT,
    messages: [{ role: 'user', content: buildUserMessage(extracted) }],
  })

  const raw = message.content.filter(b => b.type === 'text').map(b => b.text).join('')
  const result = LLMPhase1OutputSchema.parse(JSON.parse(stripJsonFences(raw)))

  // Drop relationships referencing unknown concept ids
  const conceptIds = new Set(result.observedMap.concepts.map(c => c.id))
  return {
    ...result,
    observedMap: {
      ...result.observedMap,
      relationships: filterValidEdges(result.observedMap.relationships, conceptIds),
    },
  }
}
