import Anthropic from '@anthropic-ai/sdk'
import { LLMWritingGuidanceOutputSchema, type LLMWritingGuidanceOutput } from '../schemas'
import type { ContentContext, ExplanationFramework, QuestionCoverage } from '../types'
import { stripJsonFences } from '../utils'

const SYSTEM_PROMPT = `You are an editorial writing coach. You are given the complete Proposed Graph for a topic — a structured set of concepts and relationships that should be covered in the content. Your job is to generate specific, actionable writing guidance to help the writer move from their current state of coverage toward full coverage of this graph.

RULES:
1. Use constructive, plain-English language. Write as a skilled editor, not a systems analyst.
2. Be specific to this content, this audience, and this topic. No generic advice.
3. Work at the sentence and paragraph level where useful.
4. Focus only on the highest-impact gaps.
5. You MUST only reference concepts by their exact labels as given in the framework — do not introduce, invent, or paraphrase any concept names.
6. Every instruction must name the specific concept or relationship from the framework.

Provide:
- summary: 2–3 sentences naming the primary topic and its most important coverage gaps. Reference specific concept labels from the framework — no generic language.
- toAdd: up to 5 items for framework concepts not yet covered in the content, ordered by priority. Each item has "instruction" (what the writer should add, naming the concept) and "example" (a short illustrative sentence — do NOT wrap in quotes).
- toClarify: up to 5 items for framework concepts already present but weakly explained. Each item has "instruction" and "example" (do NOT wrap in quotes).
- toMakeExplicit: up to 5 items for framework relationships that are implied or absent. "instruction" names the exact connection to state; "example" shows how to phrase it (do NOT wrap in quotes).
- sentenceGuidance: up to 5 items for the most important multi-concept sequences from the framework. "concepts" MUST be an array of exact framework concept labels (2–4 labels); "guidance" explains how to sequence or connect them in writing; "example" is a concrete sentence showing the connection — do NOT wrap in quotes.

Return ONLY valid JSON — no markdown, no preamble:
{
  "summary": string,
  "toAdd": [{ "instruction": string, "example": string }],
  "toClarify": [{ "instruction": string, "example": string }],
  "toMakeExplicit": [{ "instruction": string, "example": string }],
  "sentenceGuidance": [{ "concepts": string[], "guidance": string, "example": string }]
}`

function buildUserMessage(
  context: ContentContext,
  framework: ExplanationFramework,
  questionCoverage: QuestionCoverage,
): string {
  // Build the full concept list from the framework — this is the only source of truth
  const conceptLines = framework.concepts.map(c => {
    const coverage = c.alreadyPresent === 'yes' ? 'covered' : c.alreadyPresent === 'partial' ? 'partially covered' : 'not covered'
    return `- "${c.label}" [${coverage}, ${c.priority}, ${c.basis}]: ${c.whyItMatters}`
  }).join('\n')

  // Build relationship list from the framework
  const conceptLabelById = new Map(framework.concepts.map(c => [c.id, c.label]))
  const relLines = framework.relationships.map(r => {
    const src = conceptLabelById.get(r.source) ?? r.source
    const tgt = conceptLabelById.get(r.target) ?? r.target
    return `- "${src}" ${r.label} "${tgt}" [${r.basis}]`
  }).join('\n')

  const unanswered = (Object.entries(questionCoverage) as [string, { covered: boolean }][])
    .filter(([, v]) => !v.covered)
    .map(([k]) => k)

  return `Primary anchor: ${context.primaryAnchor}
Anchor type: ${context.anchorType}
Audience: ${context.inferredAudience}
Goal: ${context.inferredGoal}
Depth: ${context.inferredDepth}

FRAMEWORK CONCEPTS — only these labels may appear in your guidance:
${conceptLines}

FRAMEWORK RELATIONSHIPS — connections that should be made explicit in the content:
${relLines || '(none)'}

Questions the content does not currently answer:
${unanswered.length > 0 ? unanswered.join(', ') : '(all covered)'}

Generate writing guidance strictly based on the framework above.`
}

export async function generateWritingGuidance(
  context: ContentContext,
  framework: ExplanationFramework,
  questionCoverage: QuestionCoverage,
  apiKey: string,
): Promise<LLMWritingGuidanceOutput> {
  const client = new Anthropic({ apiKey })

  const message = await client.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 4096,
    system: SYSTEM_PROMPT,
    messages: [{ role: 'user', content: buildUserMessage(context, framework, questionCoverage) }],
  })

  const raw = message.content.filter(b => b.type === 'text').map(b => b.text).join('')
  return LLMWritingGuidanceOutputSchema.parse(JSON.parse(stripJsonFences(raw)))
}
