/**
 * MEBODY Journey — 화면 공용 데이터/토큰
 *
 * 기존 코드 플랜과 같은 시각 언어(AXIS_GREEN_THEME)와 같은 콘텐츠 소스를 씁니다.
 * 미션 본문은 immediate_action_content 를 그대로 조회합니다.
 */

import { useEffect, useMemo, useState } from 'react'
import type { User } from '@supabase/supabase-js'
import { fetchImmediateActionData, type ImmediateActionContent } from '../../api/content'
import {
  calculateDayProgress,
  fetchRewardBalance,
  ensureDayMissions,
  fetchActiveJourney,
  fetchJourneyTemplate,
  type JourneyTemplate,
  type UserJourney,
  type UserMission,
} from '../../api/journey'
import type { JourneyDayKind } from '../../utils/journeyRules'
import { AXIS_GREEN_THEME } from '../../data/axisTheme'

export const JOURNEY_FONT_STACK =
  '"SUIT Variable","Pretendard Variable","Noto Sans KR",sans-serif'

export const JOURNEY_BACKGROUND =
  'linear-gradient(145deg, #ecfdf5 0%, #f3fdfb 42%, #f0fdfa 100%)'

export const AXIS_LABEL: Record<string, string> = {
  neck: '목 위치',
  shoulder: '어깨 높이',
  pelvis: '골반 회전',
  lower: '하체 유연성',
}

/** 가용 시간 선택지. journey_content_tags 의 단위 콘텐츠는 약 3분입니다. */
export const DURATION_OPTIONS = [
  { minutes: 5, label: '5분', desc: '한 가지만 짧게' },
  { minutes: 15, label: '15분', desc: '여유 있게' },
] as const

export function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds}초`
  const minutes = Math.floor(seconds / 60)
  const rest = seconds % 60
  return rest === 0 ? `${minutes}분` : `${minutes}분 ${rest}초`
}

export function missionTypeLabel(type: string): string {
  if (type === 'release') return '이완'
  if (type === 'stretch') return '스트레칭'
  return '이완 + 스트레칭'
}

export interface JourneyTodayState {
  isLoading: boolean
  journey: UserJourney | null
  template: JourneyTemplate | null
  dayNo: number
  dayKind: JourneyDayKind
  missions: UserMission[]
  contentByKey: Map<string, ImmediateActionContent>
  progress: number
  isRestart: boolean
  /** 스키마 미적용 등으로 Journey 를 쓸 수 없는 상태 */
  unavailable: boolean
  rewardBalance: number
}

/**
 * 오늘의 미션을 보장하고 화면에 필요한 데이터를 모읍니다.
 * 마이그레이션 전이면 unavailable=true 로 떨어지고 화면은 안내만 보여줍니다.
 */
export function useJourneyToday(user: User | null, availableMinutes = 5): JourneyTodayState {
  const [isLoading, setIsLoading] = useState(true)
  const [journey, setJourney] = useState<UserJourney | null>(null)
  const [template, setTemplate] = useState<JourneyTemplate | null>(null)
  const [dayNo, setDayNo] = useState(1)
  const [dayKind, setDayKind] = useState<JourneyDayKind>('normal')
  const [missions, setMissions] = useState<UserMission[]>([])
  const [contents, setContents] = useState<ImmediateActionContent[]>([])
  const [isRestart, setIsRestart] = useState(false)
  const [unavailable, setUnavailable] = useState(false)
  const [rewardBalance, setRewardBalance] = useState(0)

  useEffect(() => {
    let cancelled = false

    async function load() {
      if (!user) {
        setIsLoading(false)
        setJourney(null)
        setMissions([])
        return
      }

      setIsLoading(true)
      try {
        const [activeJourney, actionData, balance] = await Promise.all([
          fetchActiveJourney(user.id),
          fetchImmediateActionData().catch(() => ({ discomfortMappings: [], axisMappings: [], contents: [] })),
          fetchRewardBalance(user.id).catch(() => 0),
        ])
        if (cancelled) return

        setContents(actionData.contents)
        setRewardBalance(balance)

        if (!activeJourney) {
          setJourney(null)
          setMissions([])
          setIsLoading(false)
          return
        }

        setJourney(activeJourney)
        const [today, loadedTemplate] = await Promise.all([
          ensureDayMissions(activeJourney, { availableMinutes }),
          fetchJourneyTemplate(activeJourney.template_code),
        ])
        if (cancelled) return

        setTemplate(loadedTemplate)
        if (!today) {
          setUnavailable(true)
          setMissions([])
        } else {
          setUnavailable(false)
          setDayNo(today.dayNo)
          setDayKind(today.dayKind)
          setMissions(today.missions)
          setIsRestart(today.isRestart)
        }
      } catch (error) {
        if (cancelled) return
        console.warn('useJourneyToday failed:', error)
        setUnavailable(true)
      } finally {
        if (!cancelled) setIsLoading(false)
      }
    }

    load()
    return () => {
      cancelled = true
    }
  }, [user?.id, availableMinutes])

  const contentByKey = useMemo(
    () => new Map(contents.map((content) => [content.content_key, content])),
    [contents],
  )

  const progress = useMemo(() => calculateDayProgress(missions), [missions])

  return {
    isLoading,
    journey,
    template,
    dayNo,
    dayKind,
    missions,
    contentByKey,
    progress,
    isRestart,
    unavailable,
    rewardBalance,
  }
}

// --- 공용 UI 조각 -----------------------------------------------------------

export function JourneyScreenShell({
  isDesktopMockup,
  children,
}: {
  isDesktopMockup: boolean
  children: React.ReactNode
}) {
  return (
    <div
      style={{
        position: 'relative',
        overflow: 'hidden',
        minHeight: '100dvh',
        borderRadius: isDesktopMockup ? '32px' : 0,
        background: JOURNEY_BACKGROUND,
        boxShadow: '0 24px 60px rgba(15, 23, 42, 0.13)',
      }}
    >
      <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none' }}>
        <div
          style={{
            position: 'absolute',
            top: '54px',
            left: '-88px',
            width: '300px',
            height: '300px',
            borderRadius: '999px',
            background: 'rgba(52, 211, 153, 0.18)',
            filter: 'blur(58px)',
          }}
        />
        <div
          style={{
            position: 'absolute',
            bottom: '72px',
            right: '-96px',
            width: '320px',
            height: '320px',
            borderRadius: '999px',
            background: 'rgba(45, 212, 191, 0.16)',
            filter: 'blur(72px)',
          }}
        />
      </div>
      <div
        style={{
          position: 'relative',
          zIndex: 1,
          display: 'flex',
          height: '100%',
          flexDirection: 'column',
          fontFamily: JOURNEY_FONT_STACK,
        }}
      >
        {children}
      </div>
    </div>
  )
}

export function JourneyPrimaryButton({
  label,
  onClick,
  disabled = false,
  icon,
}: {
  label: string
  onClick?: () => void
  disabled?: boolean
  icon?: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      style={{
        display: 'inline-flex',
        width: '100%',
        height: '54px',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '8px',
        borderRadius: '16px',
        border: 'none',
        background: disabled ? '#cbd5e1' : 'linear-gradient(90deg, #016B38 0%, #014725 100%)',
        color: '#ffffff',
        fontSize: '15px',
        fontWeight: 800,
        fontFamily: 'inherit',
        boxShadow: disabled ? 'none' : '0 14px 28px rgba(1,71,37,0.22)',
        cursor: disabled ? 'default' : 'pointer',
      }}
    >
      {label}
      {icon}
    </button>
  )
}

export function JourneyNotice({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        borderRadius: '18px',
        border: `1px solid ${AXIS_GREEN_THEME.border}`,
        background: 'rgba(244,251,249,0.96)',
        padding: '16px',
        fontSize: '14px',
        lineHeight: 1.7,
        color: '#4b5563',
        wordBreak: 'keep-all',
      }}
    >
      {children}
    </div>
  )
}
