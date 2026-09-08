/**
 * 적립 주사위
 *
 * 눈은 서버가 정합니다(claim_daily_routine_reward). 이 컴포넌트는 굴러가는 동안
 * 임의의 눈을 빠르게 바꿔 보여주다가, value 가 들어오면 그 눈에서 멈춥니다.
 * 값을 스스로 만들지 않습니다.
 */
import { useEffect, useRef, useState } from 'react';
import { AXIS_GREEN_THEME } from '../data/axisTheme';

/** 주사위 눈 배치 (3x3 격자에서 점이 찍히는 칸) */
const PIPS: Record<number, number[]> = {
  1: [4],
  2: [0, 8],
  3: [0, 4, 8],
  4: [0, 2, 6, 8],
  5: [0, 2, 4, 6, 8],
  6: [0, 2, 3, 5, 6, 8],
};

function DiceFace({ value, size = 72 }: { value: number; size?: number }) {
  const pips = PIPS[value] ?? PIPS[1];
  const gap = Math.round(size * 0.14);
  const dot = Math.round(size * 0.15);
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: Math.round(size * 0.22),
        background: '#ffffff',
        border: `2px solid ${AXIS_GREEN_THEME.borderStrong}`,
        boxShadow: '0 10px 24px rgba(1,71,37,0.18)',
        display: 'grid',
        gridTemplateColumns: 'repeat(3, 1fr)',
        gridTemplateRows: 'repeat(3, 1fr)',
        padding: gap,
        boxSizing: 'border-box',
        placeItems: 'center',
      }}
    >
      {Array.from({ length: 9 }, (_, i) => (
        <span
          key={i}
          style={{
            width: dot,
            height: dot,
            borderRadius: '999px',
            background: pips.includes(i) ? '#014725' : 'transparent',
          }}
        />
      ))}
    </div>
  );
}

interface RewardDiceProps {
  /** 서버가 정한 눈. null 이면 굴러가는 중입니다. */
  value: number | null;
  /** 굴러가는 중인지 */
  rolling: boolean;
  size?: number;
}

export function RewardDice({ value, rolling, size = 72 }: RewardDiceProps) {
  const [face, setFace] = useState(value ?? 1);
  const timerRef = useRef<ReturnType<typeof setInterval>>();

  useEffect(() => {
    if (!rolling) {
      if (timerRef.current) clearInterval(timerRef.current);
      if (value != null) setFace(value);
      return;
    }
    // 굴러가는 표현일 뿐, 여기서 나온 값은 적립에 쓰이지 않습니다.
    timerRef.current = setInterval(() => {
      setFace((current) => {
        let next = current;
        while (next === current) next = 1 + Math.floor(Math.random() * 6);
        return next;
      });
    }, 90);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [rolling, value]);

  return (
    <div
      aria-live="polite"
      aria-label={rolling ? '주사위를 굴리는 중' : `주사위 ${face}`}
      style={{
        display: 'inline-block',
        transition: 'transform 160ms ease-out',
        transform: rolling ? 'rotate(-8deg) scale(1.04)' : 'rotate(0deg) scale(1)',
      }}
    >
      <DiceFace value={face} size={size} />
    </div>
  );
}
