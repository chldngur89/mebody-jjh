/**
 * Mission Feedback — 미션 완료 후 느낌·난이도를 받는 바텀 시트
 *
 * 여기서 받은 값이 journey_mission_feedback 에 저장되고,
 * 다음 날 미션의 강도·시간·콘텐츠 선택에 그대로 반영됩니다(journeyRules 참조).
 */

import { useState } from 'react'
import { Check, X } from 'lucide-react'
import { AXIS_GREEN_THEME } from '../../data/axisTheme'
import type { MissionDifficultyRating, MissionFeeling } from '../../utils/journeyRules'

interface MissionFeedbackSheetProps {
  missionTitle: string
  isSaving?: boolean
  /** 서버가 정한 적립 금액. 클라이언트가 계산하지 않습니다. */
  reward?: { amount: number; alreadyClaimed: boolean; balance: number } | null
  rewardDisclosure?: string
  onSubmit: (feeling: MissionFeeling, difficulty: MissionDifficultyRating) => void
  onSkip: () => void
}

const FEELING_OPTIONS: Array<{ value: MissionFeeling; label: string; desc: string }> = [
  { value: 'BETTER', label: '가벼워졌다', desc: '하고 나서 편해졌어요' },
  { value: 'SAME', label: '비슷하다', desc: '큰 차이는 모르겠어요' },
  { value: 'UNCOMFORTABLE', label: '불편했다', desc: '이 동작은 맞지 않았어요' },
]

const DIFFICULTY_OPTIONS: Array<{ value: MissionDifficultyRating; label: string; desc: string }> = [
  { value: 'EASY', label: '쉬웠다', desc: '더 해도 될 것 같아요' },
  { value: 'GOOD', label: '적당했다', desc: '지금 강도가 좋아요' },
  { value: 'HARD', label: '힘들었다', desc: '조금 줄이고 싶어요' },
]

function OptionGroup<T extends string>({
  title,
  options,
  value,
  onChange,
}: {
  title: string
  options: Array<{ value: T; label: string; desc: string }>
  value: T | null
  onChange: (value: T) => void
}) {
  return (
    <div>
      <div style={{ fontSize: '12px', fontWeight: 900, color: '#014725', marginBottom: '10px' }}>{title}</div>
      <div style={{ display: 'grid', gap: '8px' }}>
        {options.map((option) => {
          const selected = value === option.value
          return (
            <button
              key={option.value}
              type="button"
              onClick={() => onChange(option.value)}
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr auto',
                alignItems: 'center',
                gap: '12px',
                width: '100%',
                borderRadius: '16px',
                border: `1px solid ${selected ? AXIS_GREEN_THEME.borderStrong : AXIS_GREEN_THEME.border}`,
                background: selected ? 'rgba(228,244,240,0.92)' : '#ffffff',
                padding: '14px 16px',
                textAlign: 'left',
                fontFamily: 'inherit',
                cursor: 'pointer',
              }}
            >
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: '15px', fontWeight: 900, color: '#111827', marginBottom: '3px' }}>
                  {option.label}
                </div>
                <div style={{ fontSize: '12px', fontWeight: 700, color: '#7c8794', wordBreak: 'keep-all' }}>
                  {option.desc}
                </div>
              </div>
              <div
                aria-hidden
                style={{
                  width: '22px',
                  height: '22px',
                  borderRadius: '999px',
                  border: `2px solid ${selected ? AXIS_GREEN_THEME.primary : '#cbd5e1'}`,
                  background: selected ? 'linear-gradient(135deg, #016B38 0%, #014725 100%)' : '#ffffff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                {selected && <Check size={13} color="#ffffff" strokeWidth={3} />}
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}

export function MissionFeedbackSheet({ missionTitle, isSaving = false, reward, rewardDisclosure, onSubmit, onSkip }: MissionFeedbackSheetProps) {
  const [feeling, setFeeling] = useState<MissionFeeling | null>(null)
  const [difficulty, setDifficulty] = useState<MissionDifficultyRating | null>(null)
  const canSubmit = Boolean(feeling && difficulty) && !isSaving

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 90,
        display: 'flex',
        alignItems: 'flex-end',
        justifyContent: 'center',
        background: 'rgba(15,23,42,0.34)',
        backdropFilter: 'blur(14px)',
        padding: '18px',
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '430px',
          maxHeight: '88vh',
          overflowY: 'auto',
          borderRadius: '30px',
          background: 'linear-gradient(180deg, rgba(255,255,255,0.98) 0%, rgba(236,253,245,0.98) 100%)',
          border: `1px solid ${AXIS_GREEN_THEME.border}`,
          boxShadow: '0 28px 80px rgba(15,23,42,0.24)',
          padding: '22px 20px 20px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '14px', marginBottom: '18px' }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: '11px', fontWeight: 900, letterSpacing: '0.16em', color: '#014725', marginBottom: '6px' }}>
              MISSION FEEDBACK
            </div>
            <h2 style={{ fontSize: '22px', lineHeight: 1.25, fontWeight: 900, color: '#111827', wordBreak: 'keep-all' }}>
              오늘 어땠나요?
            </h2>
            <div style={{ marginTop: '6px', fontSize: '13px', fontWeight: 700, color: '#6b7280', wordBreak: 'keep-all' }}>
              {missionTitle}
            </div>
          </div>
          <button
            type="button"
            onClick={onSkip}
            style={{
              width: '36px',
              height: '36px',
              borderRadius: '999px',
              border: `1px solid ${AXIS_GREEN_THEME.border}`,
              background: '#ffffff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#374151',
              cursor: 'pointer',
              flexShrink: 0,
            }}
            aria-label="건너뛰기"
          >
            <X size={18} />
          </button>
        </div>

        {reward && (
          <div
            style={{
              borderRadius: '18px',
              background: 'linear-gradient(135deg, rgba(232,245,238,0.96) 0%, rgba(255,255,255,0.98) 100%)',
              border: `1px solid ${AXIS_GREEN_THEME.borderStrong}`,
              padding: '16px',
              marginBottom: '18px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: '11px', fontWeight: 900, letterSpacing: '0.14em', color: '#014725', marginBottom: '5px' }}>
                  {reward.alreadyClaimed ? '이미 적립됨' : '오늘의 적립'}
                </div>
                <div style={{ fontSize: '26px', lineHeight: 1, fontWeight: 900, color: '#111827' }}>
                  +{reward.amount}원
                </div>
              </div>
              <div style={{ textAlign: 'right', flexShrink: 0 }}>
                <div style={{ fontSize: '11px', fontWeight: 800, color: '#7c8794', marginBottom: '4px' }}>총 적립금</div>
                <div style={{ fontSize: '17px', fontWeight: 900, color: '#014725' }}>{reward.balance}원</div>
              </div>
            </div>
            {rewardDisclosure && (
              <div style={{ marginTop: '10px', fontSize: '11px', lineHeight: 1.55, color: '#6b7280', wordBreak: 'keep-all' }}>
                {rewardDisclosure}
              </div>
            )}
          </div>
        )}

        <div style={{ display: 'grid', gap: '18px', marginBottom: '20px' }}>
          <OptionGroup title="몸 상태" options={FEELING_OPTIONS} value={feeling} onChange={setFeeling} />
          <OptionGroup title="난이도" options={DIFFICULTY_OPTIONS} value={difficulty} onChange={setDifficulty} />
        </div>

        <div
          style={{
            borderRadius: '14px',
            background: 'rgba(244,251,249,0.96)',
            border: `1px solid ${AXIS_GREEN_THEME.border}`,
            padding: '12px 14px',
            fontSize: '12px',
            lineHeight: 1.6,
            color: '#6b7280',
            wordBreak: 'keep-all',
            marginBottom: '14px',
          }}
        >
          남겨주신 답변에 따라 다음 미션의 시간과 강도가 조정됩니다. 불편했던 동작은 남은 기간 동안 다른 동작으로 바뀝니다.
        </div>

        <button
          type="button"
          onClick={() => feeling && difficulty && onSubmit(feeling, difficulty)}
          disabled={!canSubmit}
          style={{
            display: 'inline-flex',
            width: '100%',
            height: '54px',
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: '16px',
            border: 'none',
            background: canSubmit ? 'linear-gradient(90deg, #016B38 0%, #014725 100%)' : '#cbd5e1',
            color: '#ffffff',
            fontSize: '15px',
            fontWeight: 800,
            fontFamily: 'inherit',
            cursor: canSubmit ? 'pointer' : 'default',
          }}
        >
          {isSaving ? '저장 중...' : '기록하고 마치기'}
        </button>
        <button
          type="button"
          onClick={onSkip}
          disabled={isSaving}
          style={{
            marginTop: '10px',
            width: '100%',
            border: 'none',
            background: 'transparent',
            color: '#6b7280',
            fontSize: '13px',
            fontWeight: 700,
            fontFamily: 'inherit',
            cursor: 'pointer',
          }}
        >
          나중에 남기기
        </button>
      </div>
    </div>
  )
}
