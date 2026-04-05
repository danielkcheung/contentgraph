'use client'

import { useState, useCallback, useRef } from 'react'
import type {
  ExtractedContent,
  ContentContext,
  ObservedMap,
  QuestionCoverage,
  ExplanationFramework,
  WritingGuidance,
  StreamEvent,
} from '@/lib/types'

export type AnalysisPhase = 'idle' | 'phase1' | 'phase1_done' | 'phase2' | 'done' | 'error'

export interface AnalysisData {
  extractedContent?: ExtractedContent
  contentContext?: ContentContext
  observedMap?: ObservedMap
  questionCoverage?: QuestionCoverage
  explanationFramework?: ExplanationFramework
  writingGuidance?: WritingGuidance
}

async function consumeNDJSON(res: Response, onEvent: (event: StreamEvent) => void) {
  if (!res.body) throw new Error('No response body')
  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split('\n')
    buffer = lines.pop() ?? ''
    for (const line of lines) {
      const trimmed = line.trim()
      if (!trimmed) continue
      try { onEvent(JSON.parse(trimmed)) } catch { /* skip malformed */ }
    }
  }
}

const MAPPING_MESSAGES = [
  'Mapping concepts and relationships…',
  'Identifying key entities…',
  'Tracing relationships…',
  'Assessing integration quality…',
  'Evaluating content coverage…',
]

export function useAnalysis() {
  const [phase, setPhase] = useState<AnalysisPhase>('idle')
  const [data, setData] = useState<AnalysisData>({})
  const [error, setError] = useState<string>()
  const [currentStage, setCurrentStage] = useState<string>()
  const cycleRef = useRef<ReturnType<typeof setInterval> | undefined>(undefined)

  const analyzePhase1 = useCallback(async (
    content: string,
    inputType: 'text' | 'html',
    apiKey: string,
  ) => {
    setPhase('phase1')
    setData({})
    setError(undefined)
    setCurrentStage('Classifying content…')

    try {
      const res = await fetch('/api/analyze-content', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify({ phase: 1, inputType, content }),
      })

      if (!res.ok) throw new Error(await res.text().catch(() => `HTTP ${res.status}`))

      await consumeNDJSON(res, event => {
        if (event.stage === 'error') throw new Error(event.data.message)
        if (event.stage === 'extracted_content') {
          let cycleIdx = 0
          setCurrentStage(MAPPING_MESSAGES[0])
          cycleRef.current = setInterval(() => {
            cycleIdx = (cycleIdx + 1) % MAPPING_MESSAGES.length
            setCurrentStage(MAPPING_MESSAGES[cycleIdx])
          }, 2500)
          setData(d => ({ ...d, extractedContent: event.data }))
        }
        if (event.stage === 'observed_analysis') {
          clearInterval(cycleRef.current)
          setData(d => ({
            ...d,
            contentContext: event.data.context,
            observedMap: event.data.observedMap,
            questionCoverage: event.data.questionCoverage,
          }))
        }
      })

      setPhase('phase1_done')
      setCurrentStage(undefined)
    } catch (err) {
      clearInterval(cycleRef.current)
      setError(err instanceof Error ? err.message : 'Unknown error')
      setPhase('error')
      setCurrentStage(undefined)
    }
  }, [])

  const analyzePhase2 = useCallback(async (apiKey: string) => {
    setData(current => {
      if (!current.contentContext || !current.observedMap) return current

      setPhase('phase2')
      setCurrentStage('Building explanation framework…')

      fetch('/api/analyze-content', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          phase: 2,
          context: current.contentContext,
          observedMap: current.observedMap,
          questionCoverage: current.questionCoverage,
        }),
      }).then(async res => {
        if (!res.ok) throw new Error(await res.text().catch(() => `HTTP ${res.status}`))

        await consumeNDJSON(res, event => {
          if (event.stage === 'error') throw new Error(event.data.message)
          if (event.stage === 'explanation_framework') {
            setCurrentStage('Generating writing guidance…')
            setData(d => ({ ...d, explanationFramework: event.data }))
          }
          if (event.stage === 'writing_guidance') {
            setData(d => ({ ...d, writingGuidance: event.data }))
            setPhase('done')
            setCurrentStage(undefined)
          }
        })
      }).catch(err => {
        setError(err instanceof Error ? err.message : 'Unknown error')
        setPhase('error')
        setCurrentStage(undefined)
      })

      return current
    })
  }, [])

  const reset = useCallback(() => {
    setPhase('idle')
    setData({})
    setError(undefined)
    setCurrentStage(undefined)
  }, [])

  return { phase, data, error, currentStage, analyzePhase1, analyzePhase2, reset }
}
