/**
 * Journey Intro — 결과에서 넘어와 14일 관리를 시작하는 화면
 *
 * 결과·축 데이터는 코드 플랜과 같은 useCodePlanData 를 재사용합니다.
 * 관리 우선순위는 journeyRules.buildAxisPriority 로 계산하며,
 * 이 값이 그대로 user_journeys.axis_priority 스냅샷이 됩니다.
 */

import { useEffect, useMemo, useRef, useState } from 'react'
import type { User } from '@supabase/supabase-js'
import { ArrowLeft, CalendarDays, ChevronRight, Sparkles } from 'lucide-react'
import { useCodePlanData } from '../codePlanShared'
import { AXIS_GREEN_THEME } from '../../data/axisTheme'
import { useMediaQuery } from '../../utils/useMediaQuery'
import { ScrollIndicator } from '../ScrollIndicator'
import { LOCAL_FALLBACK_CHARACTER_IMAGE } from '../../utils/characterImages'
import { buildAxisPriority } from '../../utils/journeyRules'
import {
  fetchActiveJourney,
  fetchJourneyComparison,
  fetchLastCompletedJourney,
  isPersistedResultId,
  startJourney,
  type JourneyComparison,
  type UserJourney,
} from '../../api/journey'
import { JourneyCompareCard } from './JourneyCompareCard'
import {
  AXIS_LABEL,
  JourneyNotice,
  JourneyPrimaryButton,
  JourneyScreenShell,
} from './journeyShared'

interface JourneyIntroScreenProps {
  user: User | null
  questionnaireId?: string
  onBack?: () => void
  onRequireAuth?: () => void
  onStarted?: () => void
  onStartDiagnosis?: () => void
}

export function JourneyIntroScreen({
  user,
  questionnaireId,
  onBack,
  onRequireAuth,
  onStarted,
  onStartDiagnosis,
}: JourneyIntroScreenProps) {
  const isDesktopMockup = useMediaQuery('(min-width: 768px)')
  const scrollRef = useRef<HTMLDivElement>(null)
  const data = useCodePlanData(questionnaireId)

  const [existingJourney, setExistingJourney] = useState<UserJourney | null>(null)
  const [isChecking, setIsChecking] = useState(Boolean(user))
  const [isStarting, setIsStarting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [comparison, setComparison] = useState<JourneyComparison | null>(null)

  const axisPriority = useMemo(() => buildAxisPriority(data.axisRows), [data.axisRows])

  useEffect(() => {
    let cancelled = false
    if (!user) {
      setExistingJourney(null)
      setIsChecking(false)
      return
    }

    setIsChecking(true)
    fetchActiveJourney(user.id)
      .then((journey) => {
        if (!cancelled) setExistingJourney(journey)
      })
      .finally(() => {
        if (!cancelled) setIsChecking(false)
      })

    return () => {
      cancelled = true
    }
  }, [user?.id])

  // 재측정하고 돌아온 경우: 지난 저니의 결과와 지금 결과를 대조한다.
  useEffect(() => {
    let cancelled = false
    if (!user || !questionnaireId) {
      setComparison(null)
      return
    }

    void (async () => {
      try {
        const lastJourney = await fetchLastCompletedJourney(user.id)
        if (cancelled || !lastJourney?.questionnaire_response_id) return
        const result = await fetchJourneyComparison(lastJourney.questionnaire_response_id, questionnaireId)
        if (!cancelled) setComparison(result)
      } catch (compareError) {
        console.warn('JourneyIntroScreen comparison failed:', compareError)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [user?.id, questionnaireId])

  const handleStart = async () => {
    if (!user) {
      onRequireAuth?.()
      return
    }
    if (existingJourney) {
      onStarted?.()
      return
    }
    if (axisPriority.length === 0) {
      setError('결과 데이터를 불러오지 못했습니다. 결과 화면에서 다시 진입해 주세요.')
      return
    }

    setIsStarting(true)
    setError(null)
    try {
      const journey = await startJourney({
        userId: user.id,
        questionnaireResponseId: questionnaireId,
        bodyCode: data.bodyCode,
        axisPriority,
      })
      if (!journey) {
        setError('아직 저니를 시작할 수 없습니다. 잠시 후 다시 시도해 주세요.')
        return
      }
      onStarted?.()
    } catch (startError) {
      console.warn('JourneyIntroScreen start failed:', startError)
      setError('저니를 시작하지 못했습니다. 잠시 후 다시 시도해 주세요.')
    } finally {
      setIsStarting(false)
    }
  }

  const canUseResult = isPersistedResultId(questionnaireId)
  const primaryLabel = !user
    ? '로그인하고 14일 관리 시작하기'
    : existingJourney
      ? '진행 중인 저니 이어서 하기'
      : isStarting
        ? '시작하는 중...'
        : '14일 관리 시작하기'

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
        <h1 style={{ fontSize: '22px', fontWeight: 800, color: '#111827' }}>14일 스타터 저니</h1>
      </div>

      <div ref={scrollRef} style={{ flex: 1, overflowY: 'auto', padding: '18px 24px 24px', display: 'grid', gap: '16px' }}>
        <section
          style={{
            borderRadius: '30px',
            background: 'rgba(255,255,255,0.84)',
            boxShadow: '0 22px 46px rgba(15, 23, 42, 0.10)',
            backdropFilter: 'blur(20px)',
            padding: '22px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '16px' }}>
            <div
              style={{
                width: '72px',
                height: '82px',
                borderRadius: '20px',
                background: 'linear-gradient(135deg, rgba(236,253,245,0.96) 0%, rgba(255,255,255,0.96) 100%)',
                border: '1px solid rgba(209,250,229,0.95)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                overflow: 'hidden',
                flexShrink: 0,
              }}
            >
              {data.characterImage && data.characterImage !== LOCAL_FALLBACK_CHARACTER_IMAGE ? (
                <img
                  src={data.characterImage}
                  alt={data.bodyCode}
                  style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                  onError={() => data.handleImageError(data.characterImage)}
                />
              ) : (
                <div style={{ fontSize: '22px', fontWeight: 900, color: '#014725' }}>{data.bodyCode}</div>
              )}
            </div>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: '11px', fontWeight: 900, letterSpacing: '0.14em', color: '#014725', marginBottom: '6px' }}>
                MY CODE
              </div>
              <div style={{ fontSize: '24px', lineHeight: 1.1, fontWeight: 900, color: '#111827', marginBottom: '4px' }}>
                {data.bodyCode}
              </div>
              <div style={{ fontSize: '13px', fontWeight: 700, color: '#4b5563', wordBreak: 'keep-all' }}>
                {data.characterName}
              </div>
            </div>
          </div>

          <div
            style={{
              borderRadius: '20px',
              background: 'rgba(228,244,240,0.86)',
              border: `1px solid ${AXIS_GREEN_THEME.border}`,
              padding: '16px 18px',
            }}
          >
            <div style={{ fontSize: '12px', fontWeight: 900, color: '#014725', marginBottom: '10px' }}>관리 우선순위</div>
            {axisPriority.length > 0 ? (
              <div style={{ display: 'grid', gap: '10px' }}>
                {axisPriority.slice(0, 2).map((entry) => (
                  <div key={entry.axis} style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <span
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        minWidth: '26px',
                        height: '26px',
                        borderRadius: '999px',
                        background: entry.rank === 1 ? 'linear-gradient(135deg, #016B38 0%, #014725 100%)' : '#ffffff',
                        color: entry.rank === 1 ? '#ffffff' : '#014725',
                        border: `1px solid ${AXIS_GREEN_THEME.borderStrong}`,
                        fontSize: '12px',
                        fontWeight: 900,
                        flexShrink: 0,
                      }}
                    >
                      {entry.rank}
                    </span>
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div style={{ fontSize: '15px', fontWeight: 900, color: '#111827', wordBreak: 'keep-all' }}>
                        {AXIS_LABEL[entry.axis] ?? entry.axis} · {entry.label}
                      </div>
                    </div>
                    <div style={{ fontSize: '13px', fontWeight: 900, color: AXIS_GREEN_THEME.text, flexShrink: 0 }}>
                      {entry.percent}%
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ fontSize: '13px', lineHeight: 1.65, color: '#6b7280', wordBreak: 'keep-all' }}>
                {data.isLoading ? '결과를 불러오는 중입니다.' : '연결된 결과가 없습니다. 결과 화면에서 다시 진입해 주세요.'}
              </div>
            )}
          </div>
        </section>

        {comparison && <JourneyCompareCard comparison={comparison} />}

        <section
          style={{
            borderRadius: '24px',
            border: `1px solid ${AXIS_GREEN_THEME.border}`,
            background: '#ffffff',
            padding: '20px 18px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
            <CalendarDays size={18} color="#014725" />
            <h2 style={{ fontSize: '19px', fontWeight: 900, color: '#111827' }}>14일 동안 이렇게 진행합니다</h2>
          </div>
          <div style={{ display: 'grid', gap: '11px' }}>
            {[
              { day: 'DAY 1–6', text: '1순위와 2순위 축을 하루씩 번갈아 짧게 관리합니다.' },
              { day: 'DAY 7', text: '한 주를 정리하는 주간 리포트를 확인합니다.' },
              { day: 'DAY 8–13', text: '피드백에 맞춰 시간과 강도를 조정해 이어갑니다.' },
              { day: 'DAY 14', text: '2주 변화를 확인하고 다음 저니를 추천받습니다.' },
            ].map((item) => (
              <div key={item.day} style={{ display: 'grid', gridTemplateColumns: '82px 1fr', gap: '12px', alignItems: 'start' }}>
                <div style={{ fontSize: '11px', fontWeight: 900, color: AXIS_GREEN_THEME.text, paddingTop: '2px' }}>
                  {item.day}
                </div>
                <div style={{ fontSize: '14px', lineHeight: 1.65, color: '#4b5563', wordBreak: 'keep-all' }}>{item.text}</div>
              </div>
            ))}
          </div>
        </section>

        <section
          style={{
            borderRadius: '24px',
            border: `1px solid ${AXIS_GREEN_THEME.border}`,
            background: '#ffffff',
            padding: '20px 18px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
            <Sparkles size={18} color="#014725" />
            <h2 style={{ fontSize: '19px', fontWeight: 900, color: '#111827' }}>하루 5분이면 충분합니다</h2>
          </div>
          <p style={{ fontSize: '14px', lineHeight: 1.75, color: '#4b5563', wordBreak: 'keep-all' }}>
            매일 이완 90초와 스트레칭 30초씩 3세트, 약 3분짜리 한 가지를 제안합니다.
            수행 후 남긴 느낌과 난이도에 따라 다음 날 미션의 시간과 강도가 조정됩니다.
          </p>
        </section>

        {!canUseResult && user && (
          <JourneyNotice>
            이 결과는 계정에 저장되지 않아 저니에 연결할 수 없습니다. 로그인 상태에서 진단을 다시 완료하면 저니를 시작할 수 있습니다.
            {onStartDiagnosis && (
              <button
                type="button"
                onClick={onStartDiagnosis}
                style={{
                  display: 'block',
                  marginTop: '10px',
                  border: 'none',
                  background: 'transparent',
                  padding: 0,
                  color: '#014725',
                  fontSize: '13px',
                  fontWeight: 800,
                  fontFamily: 'inherit',
                  textDecoration: 'underline',
                  textUnderlineOffset: '3px',
                  cursor: 'pointer',
                }}
              >
                진단 다시 하기
              </button>
            )}
          </JourneyNotice>
        )}

        {error && (
          <div
            style={{
              borderRadius: '16px',
              border: '1px solid rgba(239,68,68,0.28)',
              background: 'rgba(254,242,242,0.9)',
              padding: '14px 16px',
              fontSize: '13px',
              lineHeight: 1.65,
              color: '#b91c1c',
              wordBreak: 'keep-all',
            }}
          >
            {error}
          </div>
        )}

        <JourneyPrimaryButton
          label={primaryLabel}
          onClick={handleStart}
          disabled={isStarting || isChecking || data.isLoading}
          icon={<ChevronRight size={18} />}
        />
      </div>
      <ScrollIndicator containerRef={scrollRef} bottomOffset="30px" />
    </JourneyScreenShell>
  )
}
