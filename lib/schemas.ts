import { z } from 'zod'

// ─── Phase 1 output ───────────────────────────────────────────────────────────

export const ContentContextSchema = z.object({
  anchorType: z.enum(['entity', 'process', 'comparison_or_decision_topic']),
  primaryAnchor: z.string(),
  inferredTopic: z.string(),
  inferredAudience: z.string(),
  inferredGoal: z.string(),
  inferredFormat: z.string(),
  inferredDepth: z.string(),
})

export const ObservedConceptSchema = z.object({
  id: z.string(),
  label: z.string(),
  explanatoryRole: z.string(),
  integrationState: z.enum(['well_integrated', 'weakly_integrated', 'underexplained', 'naming_inconsistent']),
  mentionCount: z.number(),
  isAnchor: z.boolean(),
  namingVariants: z.array(z.string()).optional(),
  evidence: z.array(z.string()),
  definitionSentence: z.string(),
})

export const ObservedRelationshipSchema = z.object({
  id: z.string(),
  source: z.string(),
  target: z.string(),
  label: z.string(),
  isExplicit: z.boolean(),
})

const QuestionCoverageItemSchema = z.object({
  covered: z.boolean(),
  evidence: z.string().optional(),
})

export const QuestionCoverageSchema = z.object({
  whatIsIt: QuestionCoverageItemSchema,
  howDoesItWork: QuestionCoverageItemSchema,
  whatDoesItDependOn: QuestionCoverageItemSchema,
  whatDoesItAffectOrProduce: QuestionCoverageItemSchema,
  whoInteractsWithIt: QuestionCoverageItemSchema,
  whatConstraintsMatter: QuestionCoverageItemSchema,
  whatAlternativesOrDistinctionsMatter: QuestionCoverageItemSchema,
  whatExampleGroundsIt: QuestionCoverageItemSchema,
})

export const LLMPhase1OutputSchema = z.object({
  context: ContentContextSchema,
  observedMap: z.object({
    concepts: z.array(ObservedConceptSchema),
    relationships: z.array(ObservedRelationshipSchema),
  }),
  questionCoverage: QuestionCoverageSchema,
})

export type LLMPhase1Output = z.infer<typeof LLMPhase1OutputSchema>

// ─── Phase 2a: explanation framework ─────────────────────────────────────────

export const RecommendedConceptSchema = z.object({
  id: z.string(),
  label: z.string(),
  isAnchor: z.boolean(),
  explanatoryRole: z.string(),
  whyItMatters: z.string(),
  reasonLabel: z.string(),
  relationshipToAnchor: z.string(),
  relatedConcepts: z.array(z.string()),
  priority: z.enum(['essential', 'important', 'useful']),
  basis: z.enum(['observed_in_text', 'strong_topic_inference', 'optional_enrichment']),
  alreadyPresent: z.enum(['yes', 'no', 'partial']),
})

export const RecommendedRelationshipSchema = z.object({
  id: z.string(),
  source: z.string(),
  target: z.string(),
  label: z.string(),
  basis: z.enum(['observed_in_text', 'strong_topic_inference', 'optional_enrichment']),
})

export const LLMFrameworkOutputSchema = z.object({
  concepts: z.array(RecommendedConceptSchema),
  relationships: z.array(RecommendedRelationshipSchema),
})

export type LLMFrameworkOutput = z.infer<typeof LLMFrameworkOutputSchema>

// ─── Phase 2b: writing guidance ───────────────────────────────────────────────

const WritingGuidanceItemSchema = z.object({
  instruction: z.string(),
  example: z.string(),
})

export const LLMWritingGuidanceOutputSchema = z.object({
  summary: z.string(),
  toAdd: z.array(WritingGuidanceItemSchema),
  toClarify: z.array(WritingGuidanceItemSchema),
  toMakeExplicit: z.array(WritingGuidanceItemSchema),
  sentenceGuidance: z.array(z.object({
    concepts: z.array(z.string()),
    guidance: z.string(),
    example: z.string(),
  })),
})

export type LLMWritingGuidanceOutput = z.infer<typeof LLMWritingGuidanceOutputSchema>
