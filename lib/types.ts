// ─── Content context ──────────────────────────────────────────────────────────

export type AnchorType = 'entity' | 'process' | 'comparison_or_decision_topic'

export interface ContentContext {
  anchorType: AnchorType
  primaryAnchor: string
  inferredTopic: string
  inferredAudience: string
  inferredGoal: string
  inferredFormat: string
  inferredDepth: string
}

// ─── Observed map ─────────────────────────────────────────────────────────────

export type IntegrationState =
  | 'well_integrated'
  | 'weakly_integrated'
  | 'underexplained'
  | 'naming_inconsistent'

export interface ObservedConcept {
  id: string
  label: string
  explanatoryRole: string
  integrationState: IntegrationState
  mentionCount: number
  isAnchor: boolean
  namingVariants?: string[]
  evidence: string[]
  definitionSentence: string
}

export interface ObservedRelationship {
  id: string
  source: string
  target: string
  label: string
  isExplicit: boolean
}

export interface ObservedMap {
  concepts: ObservedConcept[]
  relationships: ObservedRelationship[]
}

// ─── Explanation framework ────────────────────────────────────────────────────

export type ExplanatoryBasis = 'observed_in_text' | 'strong_topic_inference' | 'optional_enrichment'
export type AlreadyPresent = 'yes' | 'no' | 'partial'
export type ExplanatoryPriority = 'essential' | 'important' | 'useful'

export interface RecommendedConcept {
  id: string
  label: string
  isAnchor: boolean
  explanatoryRole: string
  whyItMatters: string
  reasonLabel: string
  relationshipToAnchor: string
  relatedConcepts: string[]
  priority: ExplanatoryPriority
  basis: ExplanatoryBasis
  alreadyPresent: AlreadyPresent
}

export interface RecommendedRelationship {
  id: string
  source: string
  target: string
  label: string
  basis: ExplanatoryBasis
}

export interface QuestionCoverageItem {
  covered: boolean
  evidence?: string
}

export interface QuestionCoverage {
  whatIsIt: QuestionCoverageItem
  howDoesItWork: QuestionCoverageItem
  whatDoesItDependOn: QuestionCoverageItem
  whatDoesItAffectOrProduce: QuestionCoverageItem
  whoInteractsWithIt: QuestionCoverageItem
  whatConstraintsMatter: QuestionCoverageItem
  whatAlternativesOrDistinctionsMatter: QuestionCoverageItem
  whatExampleGroundsIt: QuestionCoverageItem
}

export interface ExplanationFramework {
  concepts: RecommendedConcept[]
  relationships: RecommendedRelationship[]
}

// ─── Writing guidance ─────────────────────────────────────────────────────────

export interface WritingGuidanceItem {
  instruction: string
  example: string
}

export interface SentenceGuidance {
  concepts: string[]
  guidance: string
  example: string
}

export interface WritingGuidance {
  summary: string
  toAdd: WritingGuidanceItem[]
  toClarify: WritingGuidanceItem[]
  toMakeExplicit: WritingGuidanceItem[]
  sentenceGuidance: SentenceGuidance[]
}

// ─── Extraction ───────────────────────────────────────────────────────────────

export interface ExtractedContent {
  text: string
  sentences: string[]
  diagnostics: ExtractionDiagnostics
}

export interface ExtractionDiagnostics {
  inputType: 'text' | 'html'
  method: 'main' | 'article' | 'paragraphs' | 'passthrough'
  sentenceCount: number
  characterCount: number
  warning?: string
}

// ─── NDJSON stream events ─────────────────────────────────────────────────────

export type StreamEvent =
  | { stage: 'extracted_content'; data: ExtractedContent }
  | { stage: 'observed_analysis'; data: { context: ContentContext; observedMap: ObservedMap; questionCoverage: QuestionCoverage } }
  | { stage: 'explanation_framework'; data: ExplanationFramework }
  | { stage: 'writing_guidance'; data: WritingGuidance }
  | { stage: 'error'; data: { message: string } }

// ─── API request ──────────────────────────────────────────────────────────────

export type AnalyzeRequest =
  | { phase: 1; inputType: 'text' | 'html'; content: string }
  | { phase: 2; context: ContentContext; observedMap: ObservedMap; questionCoverage: QuestionCoverage }
