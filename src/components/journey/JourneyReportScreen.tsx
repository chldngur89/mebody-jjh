/**
 * Journey Report — Day 7 주간 리포트 / Day 14 진척 확인
 *
 * 집계는 journeyRules.buildReportPayload 가 하고, 결과는 journey_reports 에 1회만 저장됩니다.
 * (UNIQUE (user_journey_id, report_type, day_no) 로 중복 생성이 막혀 있습니다)
 */

import { useEffect, useRef, useState } from 'react'
import type { User } from '@supabase/supabase-js'
import { ArrowLeft, ChevronRight, TrendingUp } from 'lucide-react'
import { AXIS_GREEN_THEME } from '../../data/axisTheme'
import { useMediaQuery } from '../../utils/useMediaQuery'
import { ScrollIndicator } from '../ScrollIndicator'
import {
  buildReport,
  fetchActiveJourney,
  type JourneyReport,
  type JourneyReportType,
} from '../../api/journey'
import type { JourneyReportPayload } from '../../utils/journeyRules'
import { AXIS_LABEL, JourneyNotice, JourneyPrimaryButton, JourneyScreenShell } from './journeyShared'

interface JourneyReportScreenProps {
  user: User | null
  reportType: JourneyReportType
  dayNo: number
  onBack?: () => void
  onNext?: () => void
}

const FEELING_LABEL: Record<string, string> = {
  BETTER: '가벼워졌다',
  SAME: '비슷하다',
  UNCOMFORTABLE: '불편했다',
}

const DIFFICULTY_LABEL: Record<string, string> = {
  EASY: '쉬웠다',
  GOOD: '적당했다',
  HARD: '힘들었다',
}

function StatRow({ label, value, total }: { label: string; value: number; total: number }) {
  const percent = total > 0 ? Math.round((value / total) * 100) : 0
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '10px', marginBottom: '6px' }}>
        <div style={{ fontSize: '13px', fontWeight: 800, color: '#111827' }}>{label}</div>
        <div style={{ fontSize: '12px', fontWeight: 800, color: '#7c8794' }}>{value}회</div>
      </div>
      <div style={{ height: '10px', borderRadius: '999px', background: AXIS_GREEN_THEME.track, overflow: 'hidden' }}>
        <div
          style={{
            width: `${percent}%`,
            height: '100%',
            background: 'linear-gradient(90deg, #016B38 0%, #014725 100%)',
          }}
        />
      </div>
    </div>
  )
}

function Card({ title, eyebrow, children }: { title: string; eyebrow?: string; children: React.ReactNode }) {
  return (
    <section
      style={{
        borderRadius: '24px',
        border: `1px solid ${AXIS_GREEN_THEME.border}`,
        background: '#ffffff',
        padding: '20px 18px',
      }}
    >
      {eyebrow && (
        <div style={{ fontSize: '11px', fontWeight: 900, letterSpacing: '0.14em', color: '#014725', marginBottom: '6px' }}>
          {eyebrow}
        </div>
      )}
      <h2 style={{ fontSize: '18px', fontWeight: 900, color: '#111827', marginBottom: '14px' }}>{title}</h2>
      {children}
    </section>
  )
}

export function JourneyReportScreen({ user, reportType, dayNo, onBack, onNext }: JourneyReportScreenProps) {
  const isDesktopMockup = useMediaQuery('(min-width: 768px)')
  const scrollRef = useRef<HTMLDivElement>(null)
  const [report, setReport] = useState<JourneyReport | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    let cancelled = false

    async function load() {
      if (!user) {
        setIsLoading(false)
        return
      }
      setIsLoading(true)
      try {
        const journey = await fetchActiveJourney(user.id)
        if (cancelled || !journey) {
          setReport(null)
          return
        }
        const built = await buildReport(journey, reportType, dayNo)
        if (!cancelled) setReport(built)
      } catch (error) {
        console.warn('JourneyReportScreen load failed:', error)
        if (!cancelled) setReport(null)
      } finally {
        if (!cancelled) setIsLoading(false)
      }
    }

    load()
    return () => {
      cancelled = true
    }
  }, [user?.id, reportType, dayNo])

  const payload: JourneyReportPayload | null = report?.payload ?? null
  const isProgressCheck = reportType === 'progress_check'
  const feelingTotal = payload
    ? payload.feeling.BETTER + payload.feeling.SAME + payload.feeling.UNCOMFORTABLE
    : 0
  const difficultyTotal = payload
    ? payload.difficulty.EASY + payload.difficulty.GOOD + payload.difficulty.HARD
    : 0

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
        <h1 style={{ fontSize: '22px', fontWeight: 800, color: '#111827' }}>
          {isProgressCheck ? '2주 진척 확인' : '주간 리포트'}
        </h1>
      </div>

      <div ref={scrollRef} style={{ flex: 1, overflowY: 'auto', padding: '18px 24px 24px', display: 'grid', gap: '16px' }}>
        {isLoading ? (
          <div style={{ padding: '40px 0', textAlign: 'center', color: '#6b7280', fontSize: '14px' }}>집계하는 중...</div>
        ) : !payload ? (
          <JourneyNotice>아직 리포트를 만들 수 없습니다. 진행 중인 저니가 있는지 확인해 주세요.</JourneyNotice>
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
                DAY {payload.period.from_day}–{payload.period.to_day}
              </div>
              <div style={{ display: 'flex', alignItems: 'flex-end', gap: '10px', marginBottom: '14px' }}>
                <div style={{ fontSize: '46px', lineHeight: 1, fontWeight: 900, color: '#111827' }}>
                  {payload.completion.rate}%
                </div>
                <div style={{ fontSize: '14px', fontWeight: 800, color: '#6b7280', paddingBottom: '4px' }}>수행률</div>
              </div>
              <div style={{ height: '14px', borderRadius: '999px', background: AXIS_GREEN_THEME.track, overflow: 'hidden', marginBottom: '12px' }}>
                <div
                  style={{
                    width: `${payload.completion.rate}%`,
                    height: '100%',
                    background: 'linear-gradient(90deg, #016B38 0%, #014725 100%)',
                  }}
                />
              </div>
              <div style={{ display: 'flex', gap: '16px', fontSize: '13px', fontWeight: 800, color: '#4b5563' }}>
                <span>완료 {payload.completion.completed}</span>
                <span>건너뜀 {payload.completion.skipped}</span>
                <span>전체 {payload.completion.scheduled}</span>
              </div>
            </section>

            <div
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: '10px',
                borderRadius: '20px',
                border: `1px solid ${AXIS_GREEN_THEME.borderStrong}`,
                background: 'rgba(228,244,240,0.9)',
                padding: '16px',
              }}
            >
              <TrendingUp size={18} color="#014725" style={{ flexShrink: 0, marginTop: '2px' }} />
              <div style={{ fontSize: '14px', lineHeight: 1.7, fontWeight: 700, color: '#014725', wordBreak: 'keep-all' }}>
                {payload.next_hint}
              </div>
            </div>

            {feelingTotal > 0 && (
              <Card eyebrow="FEELING" title="몸 상태 기록">
                <div style={{ display: 'grid', gap: '12px' }}>
                  {(Object.keys(payload.feeling) as Array<keyof typeof payload.feeling>).map((key) => (
                    <StatRow key={key} label={FEELING_LABEL[key] ?? key} value={payload.feeling[key]} total={feelingTotal} />
                  ))}
                </div>
              </Card>
            )}

            {difficultyTotal > 0 && (
              <Card eyebrow="DIFFICULTY" title="난이도 기록">
                <div style={{ display: 'grid', gap: '12px' }}>
                  {(Object.keys(payload.difficulty) as Array<keyof typeof payload.difficulty>).map((key) => (
                    <StatRow
                      key={key}
                      label={DIFFICULTY_LABEL[key] ?? key}
                      value={payload.difficulty[key]}
                      total={difficultyTotal}
                    />
                  ))}
                </div>
              </Card>
            )}

            {Object.keys(payload.axis_focus).length > 0 && (
              <Card eyebrow="FOCUS" title="어디를 가장 많이 관리했나요">
                <div style={{ display: 'grid', gap: '9px' }}>
                  {Object.entries(payload.axis_focus)
                    .sort((left, right) => right[1] - left[1])
                    .map(([key, count]) => (
                      <div key={key} style={{ display: 'flex', justifyContent: 'space-between', gap: '10px' }}>
                        <span style={{ fontSize: '14px', fontWeight: 800, color: '#111827' }}>
                          {AXIS_LABEL[key] ?? key}
                        </span>
                        <span style={{ fontSize: '13px', fontWeight: 800, color: AXIS_GREEN_THEME.text }}>{count}회</span>
                      </div>
                    ))}
                </div>
              </Card>
            )}

            {payload.excluded_content_keys.length > 0 && (
              <JourneyNotice>
                불편하다고 표시한 동작 {payload.excluded_content_keys.length}개는 남은 기간 동안 다른 동작으로 대체됩니다.
              </JourneyNotice>
            )}

            {isProgressCheck && onNext && (
              <JourneyPrimaryButton label="다음 저니 확인하기" onClick={onNext} icon={<ChevronRight size={18} />} />
            )}
            {!isProgressCheck && onBack && (
              <JourneyPrimaryButton label="오늘 미션으로 돌아가기" onClick={onBack} icon={<ChevronRight size={18} />} />
            )}
          </>
        )}
      </div>
      <ScrollIndicator containerRef={scrollRef} bottomOffset="30px" />
    </JourneyScreenShell>
  )
}
