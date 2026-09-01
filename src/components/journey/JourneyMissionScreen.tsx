/**
 * Journey Mission — 미션 실행 화면
 *
 * 콘텐츠 본문과 시간 규격은 immediate_action_content 를 그대로 씁니다.
 * 배정된 planned_duration_sec 에 맞춰 각 단계 시간을 비례 조정합니다.
 * 완료하면 곧바로 피드백 시트를 띄우고, 그 값이 다음 미션 추천에 반영됩니다.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { User } from '@supabase/supabase-js'
import { ArrowLeft, Check, Pause, Play, SkipForward } from 'lucide-react'
import { AXIS_GREEN_THEME } from '../../data/axisTheme'
import { useMediaQuery } from '../../utils/useMediaQuery'
import { ScrollIndicator } from '../ScrollIndicator'
import { fetchImmediateActionData, type ImmediateActionContent } from '../../api/content'
import {
  claimMissionReward,
  completeMission,
  fetchRewardRules,
  saveMissionFeedback,
  startMission,
  type RewardClaim,
  type UserMission,
} from '../../api/journey'
import {
  buildMissionSteps,
  type MissionDifficultyRating,
  type MissionFeeling,
} from '../../utils/journeyRules'
import { MissionFeedbackSheet } from './MissionFeedbackSheet'
import { JourneyScreenShell, formatDuration, missionTypeLabel } from './journeyShared'

interface JourneyMissionScreenProps {
  user: User | null
  mission: UserMission | null
  onBack?: () => void
  onDone?: () => void
}

export function JourneyMissionScreen({ user, mission, onBack, onDone }: JourneyMissionScreenProps) {
  const isDesktopMockup = useMediaQuery('(min-width: 768px)')
  const scrollRef = useRef<HTMLDivElement>(null)

  const [content, setContent] = useState<ImmediateActionContent | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [stepIndex, setStepIndex] = useState(0)
  const [remaining, setRemaining] = useState(0)
  const [isRunning, setIsRunning] = useState(false)
  const [hasStarted, setHasStarted] = useState(false)
  const [showFeedback, setShowFeedback] = useState(false)
  const [imageFailed, setImageFailed] = useState(false)
  const [reward, setReward] = useState<RewardClaim | null>(null)
  const [rewardDisclosure, setRewardDisclosure] = useState<string>('')
  const [isSaving, setIsSaving] = useState(false)

  useEffect(() => {
    let cancelled = false
    setIsLoading(true)
    fetchImmediateActionData()
      .then((data) => {
        if (cancelled || !mission) return
        setContent(data.contents.find((item) => item.content_key === mission.content_key) ?? null)
      })
      .catch(() => {
        if (!cancelled) setContent(null)
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [mission?.content_key])

  const steps = useMemo(
    () => (content && mission ? buildMissionSteps(content, mission) : []),
    [content, mission],
  )

  const currentStep = steps[stepIndex] ?? null
  const stepImageUrl =
    currentStep?.kind === 'release' ? content?.release_image_url : content?.stretch_image_url
  const totalSeconds = useMemo(() => steps.reduce((sum, step) => sum + step.seconds, 0), [steps])
  const elapsedBefore = useMemo(
    () => steps.slice(0, stepIndex).reduce((sum, step) => sum + step.seconds, 0),
    [steps, stepIndex],
  )
  const overallProgress =
    totalSeconds > 0
      ? Math.min(100, Math.round(((elapsedBefore + ((currentStep?.seconds ?? 0) - remaining)) / totalSeconds) * 100))
      : 0

  useEffect(() => {
    if (currentStep) setRemaining(currentStep.seconds)
    setImageFailed(false)
  }, [currentStep?.key])

  const finishMission = useCallback(async () => {
    setIsRunning(false)
    setShowFeedback(true)
    if (!mission) return

    await completeMission(mission.id)
    // 금액은 서버가 정한다. 실패해도 미션 완료는 유지된다.
    const [claim, rules] = await Promise.all([claimMissionReward(mission.id), fetchRewardRules()])
    setReward(claim)
    setRewardDisclosure(rules.find((rule) => rule.code === 'daily_mission')?.disclosure ?? '')
  }, [mission])

  // setState 업데이터는 순수해야 하므로 단계 전환은 여기서 한 번에 처리한다.
  // (업데이터 안에서 DB 쓰기나 다른 setState 를 부르면 React 가 업데이터를 재실행할 때 중복 실행될 수 있다)
  const goNextStep = useCallback(() => {
    const next = stepIndex + 1
    if (next < steps.length) {
      setStepIndex(next)
      setRemaining(steps[next].seconds)
      return
    }
    void finishMission()
  }, [stepIndex, steps, finishMission])

  // 타이머는 남은 시간만 줄인다.
  useEffect(() => {
    if (!isRunning) return undefined
    const timer = setInterval(() => {
      setRemaining((value) => (value > 0 ? value - 1 : 0))
    }, 1000)
    return () => clearInterval(timer)
  }, [isRunning])

  // 0 이 되면 다음 단계로. 부작용은 업데이터가 아니라 effect 에서 일으킨다.
  useEffect(() => {
    if (!isRunning || remaining > 0 || steps.length === 0) return
    goNextStep()
  }, [isRunning, remaining, steps.length, goNextStep])

  const handleStart = async () => {
    if (!hasStarted && mission) {
      setHasStarted(true)
      await startMission(mission.id)
    }
    setIsRunning(true)
  }

  const handleSubmitFeedback = async (feeling: MissionFeeling, difficulty: MissionDifficultyRating) => {
    if (!mission || !user) {
      onDone?.()
      return
    }
    setIsSaving(true)
    try {
      await saveMissionFeedback({ missionId: mission.id, userId: user.id, feeling, difficulty })
    } finally {
      setIsSaving(false)
      onDone?.()
    }
  }

  if (!mission) {
    return (
      <JourneyScreenShell isDesktopMockup={isDesktopMockup}>
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#6b7280', fontSize: '14px' }}>
          연결된 미션이 없습니다.
        </div>
      </JourneyScreenShell>
    )
  }

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
        <div style={{ minWidth: 0 }}>
          <h1 style={{ fontSize: '20px', fontWeight: 800, color: '#111827', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {content?.display_name ?? '미션'}
          </h1>
        </div>
      </div>

      <div ref={scrollRef} style={{ flex: 1, overflowY: 'auto', padding: '18px 24px 24px', display: 'grid', gap: '16px' }}>
        {isLoading ? (
          <div style={{ padding: '40px 0', textAlign: 'center', color: '#6b7280', fontSize: '14px' }}>불러오는 중...</div>
        ) : !content || steps.length === 0 ? (
          <div
            style={{
              borderRadius: '18px',
              border: `1px solid ${AXIS_GREEN_THEME.border}`,
              background: 'rgba(244,251,249,0.96)',
              padding: '16px',
              fontSize: '14px',
              lineHeight: 1.7,
              color: '#4b5563',
            }}
          >
            미션 콘텐츠를 불러오지 못했습니다.
          </div>
        ) : (
          <>
            <section
              style={{
                borderRadius: '28px',
                background: 'rgba(255,255,255,0.86)',
                boxShadow: '0 22px 46px rgba(15, 23, 42, 0.10)',
                backdropFilter: 'blur(20px)',
                padding: '24px 20px',
                textAlign: 'center',
              }}
            >
              <div style={{ fontSize: '11px', fontWeight: 900, letterSpacing: '0.16em', color: '#014725', marginBottom: '10px' }}>
                {missionTypeLabel(mission.mission_type)} · {stepIndex + 1} / {steps.length}
              </div>
              <div style={{ fontSize: '17px', fontWeight: 900, color: '#111827', marginBottom: '4px', wordBreak: 'keep-all' }}>
                {currentStep?.title}
              </div>
              <div style={{ fontSize: '12px', fontWeight: 800, color: AXIS_GREEN_THEME.textSoft, marginBottom: '18px' }}>
                {currentStep?.meta}
              </div>

              <div
                style={{
                  fontSize: '56px',
                  lineHeight: 1,
                  fontWeight: 900,
                  letterSpacing: '-0.04em',
                  color: '#111827',
                  fontVariantNumeric: 'tabular-nums',
                  marginBottom: '18px',
                }}
              >
                {String(Math.floor(remaining / 60)).padStart(2, '0')}:{String(remaining % 60).padStart(2, '0')}
              </div>

              <div style={{ height: '12px', borderRadius: '999px', background: AXIS_GREEN_THEME.track, overflow: 'hidden', marginBottom: '8px' }}>
                <div
                  style={{
                    width: `${overallProgress}%`,
                    height: '100%',
                    background: 'linear-gradient(90deg, #016B38 0%, #014725 100%)',
                    transition: 'width 400ms linear',
                  }}
                />
              </div>
              <div style={{ fontSize: '11px', fontWeight: 800, color: '#7c8794', marginBottom: '18px' }}>
                전체 {formatDuration(totalSeconds)} · {overallProgress}%
              </div>

              <div style={{ display: 'flex', gap: '10px' }}>
                <button
                  type="button"
                  onClick={() => (isRunning ? setIsRunning(false) : handleStart())}
                  style={{
                    flex: 1,
                    display: 'inline-flex',
                    height: '54px',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px',
                    borderRadius: '16px',
                    border: 'none',
                    background: 'linear-gradient(90deg, #016B38 0%, #014725 100%)',
                    color: '#ffffff',
                    fontSize: '15px',
                    fontWeight: 800,
                    fontFamily: 'inherit',
                    boxShadow: '0 14px 28px rgba(1,71,37,0.22)',
                    cursor: 'pointer',
                  }}
                >
                  {isRunning ? <Pause size={18} /> : <Play size={18} />}
                  {isRunning ? '일시정지' : hasStarted ? '이어서 하기' : '시작하기'}
                </button>
                <button
                  type="button"
                  onClick={goNextStep}
                  style={{
                    width: '54px',
                    height: '54px',
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    borderRadius: '16px',
                    border: `1px solid ${AXIS_GREEN_THEME.borderStrong}`,
                    background: '#ffffff',
                    color: '#014725',
                    cursor: 'pointer',
                    flexShrink: 0,
                  }}
                  title="다음 단계"
                  aria-label="다음 단계"
                >
                  <SkipForward size={18} />
                </button>
              </div>
            </section>

            <section
              style={{
                borderRadius: '24px',
                border: `1px solid ${AXIS_GREEN_THEME.border}`,
                background: '#ffffff',
                padding: '18px',
              }}
            >
              <div style={{ fontSize: '11px', fontWeight: 900, letterSpacing: '0.14em', color: '#014725', marginBottom: '10px' }}>
                수행 방법
              </div>
              {stepImageUrl && !imageFailed && (
                <div style={{ borderRadius: '14px', overflow: 'hidden', border: `1px solid ${AXIS_GREEN_THEME.border}`, background: '#ffffff', marginBottom: '12px' }}>
                  <img
                    src={stepImageUrl}
                    alt={`${currentStep?.title ?? '동작'} 이미지`}
                    onError={() => setImageFailed(true)}
                    style={{ width: '100%', display: 'block' }}
                  />
                </div>
              )}
              <ol style={{ display: 'grid', gap: '8px', paddingLeft: '18px', fontSize: '14px', lineHeight: 1.7, color: '#4b5563', wordBreak: 'keep-all' }}>
                {(currentStep?.lines ?? []).map((line, index) => (
                  <li key={index}>{line}</li>
                ))}
              </ol>
              {content.target_muscle && (
                <div
                  style={{
                    marginTop: '12px',
                    display: 'inline-flex',
                    borderRadius: '999px',
                    background: AXIS_GREEN_THEME.surface,
                    border: `1px solid ${AXIS_GREEN_THEME.border}`,
                    padding: '6px 10px',
                    fontSize: '12px',
                    fontWeight: 800,
                    color: AXIS_GREEN_THEME.text,
                  }}
                >
                  타겟 근육: {content.target_muscle}
                </div>
              )}
            </section>

            {content.caution && (
              <div
                style={{
                  borderRadius: '16px',
                  background: 'rgba(255,251,235,0.88)',
                  border: '1px solid rgba(245,158,11,0.22)',
                  padding: '13px 14px',
                  fontSize: '12px',
                  lineHeight: 1.6,
                  color: '#92400e',
                  wordBreak: 'keep-all',
                }}
              >
                주의: {content.caution}
              </div>
            )}

            <button
              type="button"
              onClick={() => void finishMission()}
              style={{
                display: 'inline-flex',
                width: '100%',
                height: '50px',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                borderRadius: '16px',
                border: `1px solid ${AXIS_GREEN_THEME.borderStrong}`,
                background: '#ffffff',
                color: '#014725',
                fontSize: '14px',
                fontWeight: 800,
                fontFamily: 'inherit',
                cursor: 'pointer',
              }}
            >
              <Check size={16} />
              완료로 표시하기
            </button>
          </>
        )}
      </div>
      <ScrollIndicator containerRef={scrollRef} bottomOffset="30px" />

      {showFeedback && (
        <MissionFeedbackSheet
          missionTitle={content?.display_name ?? mission.content_key}
          isSaving={isSaving}
          reward={reward}
          rewardDisclosure={rewardDisclosure}
          onSubmit={(feeling, difficulty) => void handleSubmitFeedback(feeling, difficulty)}
          onSkip={() => onDone?.()}
        />
      )}
    </JourneyScreenShell>
  )
}
