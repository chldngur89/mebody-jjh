/**
 * 진단 소개 화면의 4축 안내.
 *
 * 이전에는 `/intro-axes.png` 한 장(정적 이미지)이었습니다. 축을 글과 그림으로만
 * 설명해서, 결과 화면에서 실제로 보게 되는 "게이지가 어느 쪽으로 치우쳤나" 와
 * 연결되지 않았습니다.
 *
 * 그래서 **결과 화면의 「4축 상세 결과」와 똑같은 블록**을 그대로 씁니다.
 * 같은 AxisTrack 컴포넌트에 같은 배치이고, 손잡이만 축을 하나씩 짚어 가며
 * 움직입니다. 소개에서 본 그림이 결과에서 그대로 나옵니다.
 *
 * - 동작 줄이기(prefers-reduced-motion)면 순회하지 않고 전부 중앙에 세워 둡니다.
 * - 화면이 짧으면(compact) 위아래 간격만 줄입니다.
 */
import { useEffect, useState } from 'react';
import { AxisTrack } from './ui';
import { BRAND } from '../theme/brand';

interface AxisIntro {
  label: string;
  leftLabel: string;
  rightLabel: string;
  /** 순회할 때 손잡이가 멈추는 두 위치(0~100, 50 이 중앙). 예시 값입니다. */
  demo: [number, number];
}

const AXES: AxisIntro[] = [
  { label: '목', leftLabel: '전방', rightLabel: '중앙', demo: [20, 80] },
  { label: '어깨', leftLabel: '오른쪽 높음', rightLabel: '왼쪽 높음', demo: [28, 74] },
  { label: '골반', leftLabel: '오른쪽 회전', rightLabel: '왼쪽 회전', demo: [70, 32] },
  { label: '하체', leftLabel: '유연', rightLabel: '뻣뻣', demo: [24, 76] },
];

const STEP_MS = 2000;

export function AxisIntroDemo({ compact = false }: { compact?: boolean }) {
  const [step, setStep] = useState(0);
  const [reduceMotion, setReduceMotion] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReduceMotion(mq.matches);
    const onChange = () => setReduceMotion(mq.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  useEffect(() => {
    if (reduceMotion) return;
    const id = window.setInterval(() => setStep((n) => n + 1), STEP_MS);
    return () => window.clearInterval(id);
  }, [reduceMotion]);

  const activeIndex = reduceMotion ? -1 : step % AXES.length;

  return (
    <div
      style={{
        borderRadius: '18px',
        border: '1px solid var(--mebody-b-k12, rgba(1, 71, 37, 0.12))',
        background: BRAND.card,
        padding: compact ? '16px 16px 12px' : '20px',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'flex-end', marginBottom: '12px' }}>
        <span style={{ fontSize: '0.75rem', color: BRAND.muted, fontWeight: 700 }}>중앙에 가까울수록 균형</span>
      </div>

      <div className="mebody-axis-demo" style={{ display: 'grid', gap: compact ? '12px' : '14px' }}>
        {AXES.map((axis, index) => (
          <AxisTrack
            key={axis.label}
            label={axis.label}
            leftLabel={axis.leftLabel}
            rightLabel={axis.rightLabel}
            // 동작을 줄인 경우 전부 중앙. 그 외에는 지금 짚는 축만 움직입니다.
            value={reduceMotion ? 50 : index === activeIndex ? axis.demo[step % 2] : 50}
          />
        ))}
      </div>
    </div>
  );
}
