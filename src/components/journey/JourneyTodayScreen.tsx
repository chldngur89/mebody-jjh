/**
 * Journey Today — Day N 의 오늘 미션 화면
 *
 * 미션 본문은 immediate_action_content 를 그대로 씁니다(코드 플랜과 같은 소스).
 * 미션 실행 타이머와 피드백은 Phase 4 에서 onOpenMission 으로 연결합니다.
 */

import { useRef, useState } from 'react'
import type { User } from '@supabase/supabase-js'
import { ArrowLeft, ChevronDown, ChevronRight, ChevronUp, RotateCcw } from 'lucide-react'
import { AXIS_GREEN_THEME } from '../../data/axisTheme'
import { useMediaQuery } from '../../utils/useMediaQuery'
import { ScrollIndicator } from '../ScrollIndicator'
import type { UserMission } from '../../api/journey'
import type { ImmediateActionContent } from '../../api/content'
import {
  DURATION_OPTIONS,
  JourneyNotice,
  JourneyScreenShell,
  formatDuration,
  missionTypeLabel,
  useJourneyToday,
} from './journeyShared'

interface JourneyTodayScreenProps {
  user: User | null
  onBack?: () => void
  onOpenMission?: (mission: UserMission) => void
  onOpenReport?: (dayNo: number, kind: 'weekly' | 'progress_check') => void
  onStartJourney?: () => void
}

function splitSteps(text: string): string[] {
  return text
    .split(/\s+\/\s+/)
    .map((step) => step.trim().replace(/^\d+\.\s*/, ''))
    .filter(Boolean)
}

function MissionCard({
  mission,
  content,
  index,
  onOpenMission,
}: {
  mission: UserMission
  content?: ImmediateActionContent
  index: number
  onOpenMission?: (mission: UserMission) => void
}) {
  const [open, setOpen] = useState(index === 0)
  const isCompleted = mission.status === 'completed'
  const showRelease = mission.mission_type !== 'stretch'
  const showStretch = mission.mission_type !== 'release'

  return (
    <section
      style={{
        borderRadius: '24px',
        border: `1px solid ${isCompleted ? AXIS_GREEN_THEME.borderStrong : AXIS_GREEN_THEME.border}`,
        background: '#ffffff',
        overflow: 'hidden',
      }}
    >
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        style={{
          display: 'grid',
          gridTemplateColumns: '28px 1fr auto',
          alignItems: 'center',
          gap: '13px',
          width: '100%',
          padding: '18px',
          background: isCompleted ? 'rgba(228,244,240,0.72)' : '#ffffff',
          border: 'none',
          textAlign: 'left',
          fontFamily: 'inherit',
          cursor: 'pointer',
        }}
      >
        <div
          aria-hidden
          style={{
            width: '28px',
            height: '28px',
            borderRadius: '10px',
            border: `2px solid ${isCompleted ? AXIS_GREEN_THEME.primary : '#cbd5e1'}`,
            background: isCompleted ? 'linear-gradient(135deg, #016B38 0%, #014725 100%)' : '#ffffff',
            boxShadow: 'inset 0 0 0 3px rgba(255,255,255,0.85)',
          }}
        />
        <div style={{ minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '11px', fontWeight: 900, color: AXIS_GREEN_THEME.text }}>
              {missionTypeLabel(mission.mission_type)}
            </span>
            <span
              style={{
                borderRadius: '999px',
                background: '#ffffff',
                border: `1px solid ${AXIS_GREEN_THEME.border}`,
                padding: '3px 8px',
                fontSize: '10px',
                lineHeight: 1,
                fontWeight: 900,
                color: '#7c8794',
              }}
            >
              {formatDuration(mission.planned_duration_sec)}
            </span>
          </div>
          <div style={{ fontSize: '17px', lineHeight: 1.35, fontWeight: 900, color: '#111827', wordBreak: 'keep-all' }}>
            {content?.display_name ?? mission.content_key}
          </div>
          {content?.target_muscle && (
            <div style={{ marginTop: '5px', fontSize: '12px', fontWeight: 700, color: '#6b7280' }}>
              타겟 근육: {content.target_muscle}
            </div>
          )}
        </div>
        {open ? <ChevronUp size={18} color="#7c8794" /> : <ChevronDown size={18} color="#7c8794" />}
      </button>

      {open && content && (
        <div style={{ borderTop: `1px solid ${AXIS_GREEN_THEME.border}`, padding: '16px 18px 18px', display: 'grid', gap: '12px' }}>
          {showRelease && (
            <div
              style={{
                borderRadius: '18px',
                background: 'rgba(244,251,249,0.96)',
                border: `1px solid ${AXIS_GREEN_THEME.border}`,
                padding: '15px',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', marginBottom: '9px' }}>
                <div style={{ fontSize: '14px', fontWeight: 900, color: '#111827', wordBreak: 'keep-all' }}>
                  {content.release_title}
                </div>
                <div style={{ flexShrink: 0, fontSize: '11px', fontWeight: 800, color: AXIS_GREEN_THEME.text }}>
                  {content.release_tool} · {content.release_duration_sec ?? 90}초
                </div>
              </div>
              <ol style={{ display: 'grid', gap: '6px', paddingLeft: '18px', fontSize: '13px', lineHeight: 1.65, color: '#4b5563', wordBreak: 'keep-all' }}>
                {splitSteps(content.release_content).map((step, stepIndex) => (
                  <li key={stepIndex}>{step}</li>
                ))}
              </ol>
            </div>
          )}

          {showStretch && (
            <div
              style={{
                borderRadius: '18px',
                background: 'rgba(244,251,249,0.96)',
                border: `1px solid ${AXIS_GREEN_THEME.border}`,
                padding: '15px',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', marginBottom: '9px' }}>
                <div style={{ fontSize: '14px', fontWeight: 900, color: '#111827', wordBreak: 'keep-all' }}>
                  {content.stretch_title}
                </div>
                <div style={{ flexShrink: 0, fontSize: '11px', fontWeight: 800, color: AXIS_GREEN_THEME.text }}>
                  {content.stretch_duration_sec ?? 30}초 × {content.sets ?? 3}세트
                </div>
              </div>
              <ol style={{ display: 'grid', gap: '6px', paddingLeft: '18px', fontSize: '13px', lineHeight: 1.65, color: '#4b5563', wordBreak: 'keep-all' }}>
                {splitSteps(content.stretch_content).map((step, stepIndex) => (
                  <li key={stepIndex}>{step}</li>
                ))}
              </ol>
            </div>
          )}

          {content.caution && (
            <div
              style={{
                borderRadius: '16px',
                background: 'rgba(255,251,235,0.88)',
                border: '1px solid rgba(245,158,11,0.22)',
                padding: '12px',
                fontSize: '12px',
                lineHeight: 1.6,
                color: '#92400e',
                wordBreak: 'keep-all',
              }}
            >
              주의: {content.caution}
            </div>
          )}

          {onOpenMission && (
            <button
              type="button"
              onClick={() => onOpenMission(mission)}
              style={{
                display: 'inline-flex',
                width: '100%',
                height: '48px',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px',
                borderRadius: '14px',
                border: 'none',
                background: isCompleted ? 'rgba(228,244,240,0.9)' : 'linear-gradient(90deg, #016B38 0%, #014725 100%)',
                color: isCompleted ? '#014725' : '#ffffff',
                fontSize: '14px',
                fontWeight: 800,
                fontFamily: 'inherit',
                cursor: 'pointer',
              }}
            >
              {isCompleted ? '다시 보기' : '미션 시작하기'}
              <ChevronRight size={16} />
            </button>
          )}
        </div>
      )}
    </section>
  )
}

export function JourneyTodayScreen({
  user,
  onBack,
  onOpenMission,
  onOpenReport,
  onStartJourney,
}: JourneyTodayScreenProps) {
  const isDesktopMockup = useMediaQuery('(min-width: 768px)')
  const scrollRef = useRef<HTMLDivElement>(null)
  const [availableMinutes, setAvailableMinutes] = useState<number>(DURATION_OPTIONS[0].minutes)
  const state = useJourneyToday(user, availableMinutes)

  const totalDays = state.template?.duration_days ?? 14
  const completedCount = state.missions.filter((mission) => mission.status === 'completed').length

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
        <h1 style={{ fontSize: '22px', fontWeight: 800, color: '#111827' }}>오늘의 미션</h1>
      </div>

      <div ref={scrollRef} style={{ flex: 1, overflowY: 'auto', padding: '18px 24px 24px', display: 'grid', gap: '16px' }}>
        {state.isLoading ? (
          <div style={{ padding: '40px 0', textAlign: 'center', color: '#6b7280', fontSize: '14px' }}>불러오는 중...</div>
        ) : !user ? (
          <JourneyNotice>저니는 로그인 후 이용할 수 있습니다.</JourneyNotice>
        ) : state.unavailable ? (
          <JourneyNotice>
            저니 데이터를 아직 사용할 수 없습니다. 관리자에게 <code>db/journey</code> 마이그레이션 적용을 요청해 주세요.
          </JourneyNotice>
        ) : !state.journey ? (
          <>
            <JourneyNotice>진행 중인 저니가 없습니다. 결과 화면에서 14일 관리를 시작할 수 있습니다.</JourneyNotice>
            {onStartJourney && (
              <button
                type="button"
                onClick={onStartJourney}
                style={{
                  height: '50px',
                  borderRadius: '16px',
                  border: 'none',
                  background: 'linear-gradient(90deg, #016B38 0%, #014725 100%)',
                  color: '#ffffff',
                  fontSize: '15px',
                  fontWeight: 800,
                  fontFamily: 'inherit',
                  cursor: 'pointer',
                }}
              >
                저니 소개 보기
              </button>
            )}
          </>
        ) : (
          <>
            <section
              style={{
                borderRadius: '28px',
                background: 'rgba(255,255,255,0.84)',
                boxShadow: '0 22px 46px rgba(15, 23, 42, 0.10)',
                backdropFilter: 'blur(20px)',
                padding: '20px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: '12px', marginBottom: '14px' }}>
                <div>
                  <div style={{ fontSize: '11px', fontWeight: 900, letterSpacing: '0.14em', color: '#014725', marginBottom: '6px' }}>
                    DAY {state.dayNo} / {totalDays}
                  </div>
                  <div style={{ fontSize: '26px', lineHeight: 1.1, fontWeight: 900, color: '#111827' }}>
                    {state.progress}%
                  </div>
                </div>
                <div style={{ fontSize: '13px', fontWeight: 800, color: state.progress > 0 ? AXIS_GREEN_THEME.text : '#6b7280' }}>
                  {state.missions.length > 0 ? `${completedCount} / ${state.missions.length} 완료` : '오늘 미션 없음'}
                </div>
              </div>
              <div style={{ height: '14px', borderRadius: '999px', background: AXIS_GREEN_THEME.track, overflow: 'hidden' }}>
                <div
                  style={{
                    width: `${state.progress}%`,
                    height: '100%',
                    background: 'linear-gradient(90deg, #016B38 0%, #014725 100%)',
                    transition: 'width 260ms ease',
                  }}
                />
              </div>

              <div style={{ display: 'flex', gap: '8px', marginTop: '16px' }}>
                {DURATION_OPTIONS.map((option) => {
                  const selected = option.minutes === availableMinutes
                  return (
                    <button
                      key={option.minutes}
                      type="button"
                      onClick={() => setAvailableMinutes(option.minutes)}
                      style={{
                        flex: 1,
                        borderRadius: '14px',
                        border: `1px solid ${selected ? AXIS_GREEN_THEME.borderStrong : AXIS_GREEN_THEME.border}`,
                        background: selected ? 'rgba(228,244,240,0.9)' : '#ffffff',
                        padding: '10px 12px',
                        fontFamily: 'inherit',
                        cursor: 'pointer',
                        textAlign: 'left',
                      }}
                    >
                      <div style={{ fontSize: '14px', fontWeight: 900, color: selected ? '#014725' : '#111827' }}>
                        {option.label}
                      </div>
                      <div style={{ fontSize: '11px', fontWeight: 700, color: '#7c8794', marginTop: '2px' }}>{option.desc}</div>
                    </button>
                  )
                })}
              </div>
              <div style={{ marginTop: '8px', fontSize: '11px', lineHeight: 1.5, color: '#9ca3af', wordBreak: 'keep-all' }}>
                가용 시간은 다음 날 미션부터 반영됩니다. 오늘 배정된 미션은 그대로 유지됩니다.
              </div>

              <div
                style={{
                  marginTop: '14px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '12px',
                  borderRadius: '16px',
                  background: 'rgba(228,244,240,0.86)',
                  border: `1px solid ${AXIS_GREEN_THEME.border}`,
                  padding: '13px 15px',
                }}
              >
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: '11px', fontWeight: 900, color: '#014725', marginBottom: '4px' }}>내 적립금</div>
                  <div style={{ fontSize: '12px', fontWeight: 700, color: '#4b5563', wordBreak: 'keep-all' }}>
                    미션마다 적립 · 14일 완주까지 최대 50원 보너스
                  </div>
                </div>
                <div style={{ flexShrink: 0, fontSize: '20px', fontWeight: 900, color: '#014725' }}>
                  {state.rewardBalance}원
                </div>
              </div>
            </section>

            {state.isRestart && (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '10px',
                  borderRadius: '18px',
                  border: `1px solid ${AXIS_GREEN_THEME.borderStrong}`,
                  background: 'rgba(228,244,240,0.9)',
                  padding: '15px 16px',
                }}
              >
                <RotateCcw size={18} color="#014725" style={{ flexShrink: 0, marginTop: '2px' }} />
                <div style={{ fontSize: '13px', lineHeight: 1.65, color: '#014725', wordBreak: 'keep-all' }}>
                  오랜만이에요. 오늘은 부담을 줄인 짧은 복귀 미션 하나만 준비했습니다.
                </div>
              </div>
            )}

            {state.missions.length === 0 ? (
              <JourneyNotice>오늘 배정된 미션이 없습니다. 내일 다시 확인해 주세요.</JourneyNotice>
            ) : (
              state.missions.map((mission, index) => (
                <MissionCard
                  key={mission.id}
                  mission={mission}
                  content={state.contentByKey.get(mission.content_key)}
                  index={index}
                  onOpenMission={onOpenMission}
                />
              ))
            )}

            {(state.dayKind === 'weekly_report' || state.dayKind === 'progress_check') && onOpenReport && (
              <button
                type="button"
                onClick={() =>
                  onOpenReport(state.dayNo, state.dayKind === 'weekly_report' ? 'weekly' : 'progress_check')
                }
                style={{
                  display: 'inline-flex',
                  width: '100%',
                  height: '52px',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  borderRadius: '16px',
                  border: `1px solid ${AXIS_GREEN_THEME.borderStrong}`,
                  background: '#ffffff',
                  color: '#014725',
                  fontSize: '15px',
                  fontWeight: 800,
                  fontFamily: 'inherit',
                  cursor: 'pointer',
                }}
              >
                {state.dayKind === 'weekly_report' ? '주간 리포트 보기' : '2주 변화 확인하기'}
                <ChevronRight size={18} />
              </button>
            )}
          </>
        )}
      </div>
      <ScrollIndicator containerRef={scrollRef} bottomOffset="30px" />
    </JourneyScreenShell>
  )
}
