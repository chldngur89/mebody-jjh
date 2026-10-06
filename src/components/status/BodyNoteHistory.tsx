/**
 * 바디 노트 기록 — 쌓이는 것이 보여야 매일 적을 이유가 생깁니다.
 *
 * 형태는 습관 기록 앱들이 쓰는 표준을 따릅니다.
 *   · 최근 7일 점 스트립 — 오늘 적었는지, 며칠 이어졌는지가 한눈에
 *   · 날짜별 한 줄 — 「10/06 · 어깨 · 오른쪽 · 오래 앉기 · 보통」
 * 새로 발명하지 않습니다. 사용자가 다른 앱에서 이미 배운 모양이 가장 빨리 읽힙니다.
 *
 * 색은 **판정이 아닙니다.** 컨디션 네 단계를 구분만 하고, 빨강처럼 경고로 읽히는 색을
 * 쓰지 않습니다. 이 앱은 진단하지 않습니다 — 사용자가 느낀 것을 적어 둘 뿐입니다.
 */
import { useEffect, useState } from 'react';
import {
  CONDITION_LABEL, fetchBodyNoteHistory, kstToday, summarize,
  type BodyCondition, type BodyNote,
} from '../../api/bodyNote';
import { BRAND, SURFACE } from '../../theme/brand';
import { useOverlayBack } from '../../utils/useOverlayBack';

/** 컨디션 네 단계의 점 색. 경고색을 쓰지 않습니다. */
const DOT: Record<BodyCondition, string> = {
  comfortable: 'var(--mebody-green, #014725)',
  usual: '#4E8C6A',
  slightly_uncomfortable: '#C8A24A',
  very_uncomfortable: '#A8762B',
};

function iso(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** 최근 7일 점 스트립. 적은 날은 컨디션 색, 안 적은 날은 빈 원. */
export function BodyNoteStrip({ notes }: { notes: BodyNote[] }) {
  const byDate = new Map(notes.map((n) => [n.recordDate, n]));
  const today = new Date(`${kstToday()}T00:00:00`);
  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(today);
    d.setDate(d.getDate() - (6 - i));
    return d;
  });
  const DOW = ['일', '월', '화', '수', '목', '금', '토'];
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '6px' }}>
      {days.map((d) => {
        const key = iso(d);
        const note = byDate.get(key);
        const isToday = key === kstToday();
        return (
          <div key={key} style={{ display: 'grid', justifyItems: 'center', gap: '5px' }}>
            <span style={{ fontSize: '0.625rem', fontWeight: 800, color: BRAND.muted }}>{DOW[d.getDay()]}</span>
            <span
              aria-label={`${d.getMonth() + 1}월 ${d.getDate()}일 ${note ? CONDITION_LABEL[note.condition] : '기록 없음'}`}
              style={{
                width: '22px', height: '22px', borderRadius: '50%',
                background: note ? DOT[note.condition] : 'transparent',
                border: note ? '1px solid transparent' : `1px dashed ${SURFACE.hairline}`,
                outline: isToday ? `2px solid ${BRAND.green}` : 'none',
                outlineOffset: '2px',
              }}
            />
          </div>
        );
      })}
    </div>
  );
}

/** 날짜 한 줄 — 10/06 형태 */
function shortDate(s: string): string {
  const [, m, d] = s.split('-');
  return `${Number(m)}/${Number(d)}`;
}

export function BodyNoteRow({ note }: { note: BodyNote }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'auto auto 1fr', gap: '10px', alignItems: 'center' }}>
      <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: DOT[note.condition] }} />
      <span style={{ fontSize: '0.8125rem', fontWeight: 900, color: BRAND.green, minWidth: '38px' }}>
        {shortDate(note.recordDate)}
      </span>
      <span style={{ fontSize: '0.8125rem', fontWeight: 700, color: BRAND.text, wordBreak: 'keep-all' }}>
        {summarize(note)}
      </span>
    </div>
  );
}

/** 전체 기록 — 시트로 띄웁니다. 탭을 새로 만들지 않습니다. */
export function BodyNoteHistorySheet({ onClose }: { onClose: () => void }) {
  const close = useOverlayBack(true, onClose);
  const [notes, setNotes] = useState<BodyNote[] | null>(null);

  useEffect(() => {
    let alive = true;
    void fetchBodyNoteHistory(120)
      .then((rows) => { if (alive) setNotes(rows); })
      .catch(() => { if (alive) setNotes([]); });
    return () => { alive = false; };
  }, []);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="몸 기록 전체"
      style={{
        position: 'fixed', inset: 0, zIndex: 60, background: BRAND.bg,
        display: 'flex', flexDirection: 'column', paddingTop: 'env(safe-area-inset-top)',
      }}
    >
      <header
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px',
          padding: '0 8px 0 18px', height: '56px', flexShrink: 0,
          borderBottom: `1px solid ${SURFACE.hairline}`,
        }}
      >
        <strong style={{ fontSize: '1rem', color: BRAND.green }}>몸 기록</strong>
        <button
          type="button" onClick={close} className="mebody-hit"
          style={{
            border: 0, background: 'transparent', color: BRAND.green, fontFamily: 'inherit',
            fontWeight: 800, fontSize: '0.875rem', minHeight: '44px', padding: '0 12px', cursor: 'pointer',
          }}
        >
          닫기
        </button>
      </header>

      <div
        style={{
          flex: 1, minHeight: 0, overflowY: 'auto', padding: '18px',
          paddingBottom: 'calc(18px + var(--mebody-ad-inset, 0px) + env(safe-area-inset-bottom, 0px))',
          display: 'grid', gap: '16px', alignContent: 'start',
        }}
      >
        {notes == null ? (
          <p style={{ margin: 0, fontSize: '0.875rem', color: BRAND.muted }}>불러오는 중...</p>
        ) : notes.length === 0 ? (
          <p style={{ margin: 0, fontSize: '0.875rem', lineHeight: 1.6, color: BRAND.muted, wordBreak: 'keep-all' }}>
            아직 기록이 없어요. 오늘부터 하나씩 쌓아보세요.
          </p>
        ) : (
          <>
            <BodyNoteStrip notes={notes} />
            <div style={{ display: 'grid', gap: '14px' }}>
              {notes.map((n) => <BodyNoteRow key={n.id} note={n} />)}
            </div>
            <p style={{ margin: 0, fontSize: '0.75rem', lineHeight: 1.6, color: BRAND.muted, wordBreak: 'keep-all' }}>
              내가 느낀 것을 적어둔 기록입니다. 진단이나 치료를 대신하지 않아요.
            </p>
          </>
        )}
      </div>
    </div>
  );
}
