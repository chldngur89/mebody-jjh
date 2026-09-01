/**
 * Journey Next — Day 14 이후 다음 저니 추천
 *
 * 추천은 journeyRules.recommendNextJourney 규칙으로 결정합니다(AI 없음).
 * 재측정은 기존 진단 흐름(startNewDiagnosis)을 그대로 씁니다.
 */

import { useEffect, useRef, useState } from 'react'
import type { User } from '@supabase/supabase-js'
import { ArrowLeft, ChevronRight, RefreshCw, Repeat } from 'lucide-react'
import { AXIS_GREEN_THEME } from '../../data/axisTheme'
import { useMediaQuery } from '../../utils/useMediaQuery'
import { ScrollIndicator } from '../ScrollIndicator'
import {
  claimJourneyReward,
  completeJourney,
  fetchActiveJourney,
  fetchJourneyComparison,
  fetchReport,
  startJourney,
  type JourneyComparison,
  type UserJourney,
} from '../../api/journey'
import { fetchLatestCompletedResultForUser } from '../../api/account'
import { JourneyCompareCard } from './JourneyCompareCard'
import {
  recommendNextJourney,
  type NextJourneyRecommendation,
  type JourneyReportPayload,
} from '../../utils/journeyRules'
import { AXIS_LABEL, JourneyNotice, JourneyPrimaryButton, JourneyScreenShell } from './journeyShared'

interface JourneyNextScreenProps {
  user: User | null
  onBack?: () => void
  onRemeasure?: () => void
  onStartedNext?: () => void
}

export function JourneyNextScreen({ user, onBack, onRemeasure, onStartedNext }: JourneyNextScreenProps) {
  const isDesktopMockup = useMediaQuery('(min-width: 768px)')
  const scrollRef = useRef<HTMLDivElement>(null)

  const [journey, setJourney] = useState<UserJourney | null>(null)
  const [recommendation, setRecommendation] = useState<NextJourneyRecommendation | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isWorking, setIsWorking] = useState(false)
  const [comparison, setComparison] = useState<JourneyComparison | null>(null)
  const [bonus, setBonus] = useState<{ amount: number; balance: number } | null>(null)

  useEffect(() => {
    let cancelled = false

    async function load() {
      if (!user) {
        setIsLoading(false)
        return
      }
      setIsLoading(true)
      try {
        const active = await fetchActiveJourney(user.id)
        if (cancelled) return
        setJourney(active)
        if (!active) return

        const report = await fetchReport(active.id, 'progress_check', 14)
        if (cancelled) return
        const payload = report?.payload as JourneyReportPayload | undefined
        setRecommendation(payload ? recommendNextJourney(payload) : null)

        // 저니 시작 이후 새 결과가 있으면 전후 비교를 보여준다.
        const latest = await fetchLatestCompletedResultForUser(user.id)
        if (cancelled || !latest) return
        const compared = await fetchJourneyComparison(active.questionnaire_response_id, latest.id)
        if (!cancelled) setComparison(compared)
      } catch (error) {
        console.warn('JourneyNextScreen load failed:', error)
      } finally {
        if (!cancelled) setIsLoading(false)
      }
    }

    load()
    return () => {
      cancelled = true
    }
  }, [user?.id])

  /** 현재 저니를 완료 처리하고 같은 결과로 새 저니를 시작합니다. */
  const handleStartNext = async () => {
    if (!user || !journey) return
    setIsWorking(true)
    try {
      await completeJourney(journey.id)
      // 완주 보너스는 저니가 completed 가 된 뒤에만 지급된다
      const claim = await claimJourneyReward(journey.id)
      if (claim) setBonus({ amount: claim.amount, balance: claim.balance })

      // focusRank 2 추천이면 우선순위를 회전시켜 2순위 축부터 시작합니다.
      const rotated =
        recommendation?.focusRank === 2 && journey.axis_priority.length > 1
          ? [...journey.axis_priority.slice(1), journey.axis_priority[0]].map((entry, index) => ({
              ...entry,
              rank: index + 1,
            }))
          : journey.axis_priority

      await startJourney({
        userId: user.id,
        questionnaireResponseId: journey.questionnaire_response_id ?? undefined,
        bodyCode: journey.body_code ?? undefined,
        axisPriority: rotated,
        templateCode: journey.template_code,
      })
      onStartedNext?.()
    } catch (error) {
      console.warn('handleStartNext failed:', error)
    } finally {
      setIsWorking(false)
    }
  }

  const handleRemeasure = async () => {
    if (journey) {
      setIsWorking(true)
      try {
        await completeJourney(journey.id)
        const claim = await claimJourneyReward(journey.id)
        if (claim) setBonus({ amount: claim.amount, balance: claim.balance })
      } finally {
        setIsWorking(false)
      }
    }
    onRemeasure?.()
  }

  const nextFocus =
    recommendation?.focusRank === 2 ? journey?.axis_priority[1] : journey?.axis_priority[0]

  return (
    <JourneyScreenShell isDesktopMockup={isDesktopMockup}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          padding: '22px 24px 18px',
          background: 'rgba(255,255,255,0.52)',
          backdropFilter: 'blur(18px)',
        }}
      >
        {onBack && (
          <button
            type="button"
            onClick={onBack}
            style={{
              width: '38px',
              height: '38px',
              borderRadius: '999px',
              border: '1px solid rgba(255,255,255,0.42)',
              background: 'rgba(255,255,255,0.74)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#374151',
              cursor: 'pointer',
              boxShadow: '0 10px 20px rgba(15, 23, 42, 0.08)',
            }}
            title="뒤로"
          >
            <ArrowLeft size={18} />
          </button>
        )}
        <h1 style={{ fontSize: '22px', fontWeight: 800, color: '#111827' }}>다음 저니</h1>
      </div>

      <div ref={scrollRef} style={{ flex: 1, overflowY: 'auto', padding: '18px 24px 24px', display: 'grid', gap: '16px' }}>
        {isLoading ? (
          <div style={{ padding: '40px 0', textAlign: 'center', color: '#6b7280', fontSize: '14px' }}>불러오는 중...</div>
        ) : !journey ? (
          <JourneyNotice>진행 중인 저니가 없습니다.</JourneyNotice>
        ) : (
          <>
            <section
              style={{
                borderRadius: '28px',
                background: 'rgba(255,255,255,0.86)',
                boxShadow: '0 22px 46px rgba(15, 23, 42, 0.10)',
                backdropFilter: 'blur(20px)',
                padding: '22px 20px',
              }}
            >
              <div style={{ fontSize: '11px', fontWeight: 900, letterSpacing: '0.16em', color: '#014725', marginBottom: '10px' }}>
                RECOMMENDED
              </div>
              <h2 style={{ fontSize: '22px', lineHeight: 1.3, fontWeight: 900, color: '#111827', marginBottom: '10px', wordBreak: 'keep-all' }}>
                {recommendation?.title ?? '재측정하고 다음 저니 이어가기'}
              </h2>
              <p style={{ fontSize: '14px', lineHeight: 1.75, color: '#4b5563', wordBreak: 'keep-all' }}>
                {recommendation?.reason ??
                  '2주 동안의 변화를 32문항으로 확인한 뒤 새 우선순위로 이어가는 것을 추천합니다.'}
              </p>

              {nextFocus && (
                <div
                  style={{
                    marginTop: '14px',
                    borderRadius: '16px',
                    background: 'rgba(228,244,240,0.86)',
                    border: `1px solid ${AXIS_GREEN_THEME.border}`,
                    padding: '13px 15px',
                    fontSize: '13px',
                    fontWeight: 800,
                    color: '#014725',
                    wordBreak: 'keep-all',
                  }}
                >
                  다음 중심 축: {AXIS_LABEL[nextFocus.axis] ?? nextFocus.axis} · {nextFocus.label}
                </div>
              )}
            </section>

            {bonus && (
              <div
                style={{
                  borderRadius: '20px',
                  background: 'linear-gradient(135deg, rgba(232,245,238,0.96) 0%, rgba(255,255,255,0.98) 100%)',
                  border: `1px solid ${AXIS_GREEN_THEME.borderStrong}`,
                  padding: '18px',
                }}
              >
                <div style={{ fontSize: '11px', fontWeight: 900, letterSpacing: '0.14em', color: '#014725', marginBottom: '6px' }}>
                  14일 완주 보너스
                </div>
                <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: '12px' }}>
                  <div style={{ fontSize: '28px', lineHeight: 1, fontWeight: 900, color: '#111827' }}>+{bonus.amount}원</div>
                  <div style={{ fontSize: '13px', fontWeight: 800, color: '#014725' }}>총 {bonus.balance}원</div>
                </div>
              </div>
            )}

            {comparison && <JourneyCompareCard comparison={comparison} />}

            <section
              style={{
                borderRadius: '24px',
                border: `1px solid ${AXIS_GREEN_THEME.border}`,
                background: '#ffffff',
                padding: '20px 18px',
              }}
            >
              <h3 style={{ fontSize: '17px', fontWeight: 900, color: '#111827', marginBottom: '14px' }}>어떻게 이어갈까요?</h3>
              <div style={{ display: 'grid', gap: '10px' }}>
                <button
                  type="button"
                  onClick={() => void handleRemeasure()}
                  disabled={isWorking}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '36px 1fr auto',
                    alignItems: 'center',
                    gap: '12px',
                    borderRadius: '18px',
                    border: `1px solid ${recommendation?.kind === 'remeasure' ? AXIS_GREEN_THEME.borderStrong : AXIS_GREEN_THEME.border}`,
                    background: recommendation?.kind === 'remeasure' ? 'rgba(228,244,240,0.9)' : '#ffffff',
                    padding: '16px',
                    textAlign: 'left',
                    fontFamily: 'inherit',
                    cursor: isWorking ? 'default' : 'pointer',
                  }}
                >
                  <RefreshCw size={20} color="#014725" />
                  <div>
                    <div style={{ fontSize: '15px', fontWeight: 900, color: '#111827', marginBottom: '3px' }}>
                      32문항 재측정하기
                    </div>
                    <div style={{ fontSize: '12px', fontWeight: 700, color: '#7c8794', wordBreak: 'keep-all' }}>
                      2주 뒤 지금 상태로 우선순위를 새로 잡습니다
                    </div>
                  </div>
                  <ChevronRight size={18} color="#7c8794" />
                </button>

                <button
                  type="button"
                  onClick={() => void handleStartNext()}
                  disabled={isWorking}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '36px 1fr auto',
                    alignItems: 'center',
                    gap: '12px',
                    borderRadius: '18px',
                    border: `1px solid ${recommendation?.kind !== 'remeasure' ? AXIS_GREEN_THEME.borderStrong : AXIS_GREEN_THEME.border}`,
                    background: recommendation?.kind !== 'remeasure' ? 'rgba(228,244,240,0.9)' : '#ffffff',
                    padding: '16px',
                    textAlign: 'left',
                    fontFamily: 'inherit',
                    cursor: isWorking ? 'default' : 'pointer',
                  }}
                >
                  <Repeat size={20} color="#014725" />
                  <div>
                    <div style={{ fontSize: '15px', fontWeight: 900, color: '#111827', marginBottom: '3px' }}>
                      {isWorking ? '준비하는 중...' : '재측정 없이 바로 이어가기'}
                    </div>
                    <div style={{ fontSize: '12px', fontWeight: 700, color: '#7c8794', wordBreak: 'keep-all' }}>
                      지금 결과 그대로 새 14일을 시작합니다
                    </div>
                  </div>
                  <ChevronRight size={18} color="#7c8794" />
                </button>
              </div>
            </section>

            <JourneyNotice>
              구독으로 이어지는 장기 저니는 아직 준비 중입니다. 지금은 재측정과 이어가기 두 가지로 계속할 수 있습니다.
            </JourneyNotice>

            {onBack && (
              <JourneyPrimaryButton label="나중에 정하기" onClick={onBack} icon={<ChevronRight size={18} />} />
            )}
          </>
        )}
      </div>
      <ScrollIndicator containerRef={scrollRef} bottomOffset="30px" />
    </JourneyScreenShell>
  )
}
