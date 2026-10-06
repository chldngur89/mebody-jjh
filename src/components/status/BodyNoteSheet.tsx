/**
 * 마이 바디 노트 작성 시트.
 *
 * **20~30초 안에 끝나야 합니다.** 그래서 고르는 것만 있고 글쓰기는 선택입니다.
 * 매일 쓰는 것이라 한 번이라도 귀찮으면 다음 날 안 씁니다.
 *
 * 미션 피드백과 묻는 것이 다릅니다 — 저기는 "방금 한 동작", 여기는 "오늘 하루" 입니다.
 *
 * 의료 표현을 쓰지 않습니다. 「많이 불편」 이지 「통증 심함」 이 아니고,
 * 이 기록으로 무엇을 진단하지 않습니다.
 */
import { useEffect, useState } from 'react';
import {
  ACTIVITY_LABEL, BODY_ACTIVITIES, BODY_CONDITIONS, BODY_PARTS, BODY_SIDES,
  CONDITION_LABEL, PART_LABEL, SIDE_LABEL, kstToday, saveBodyNote,
  type BodyActivity, type BodyCondition, type BodyNote, type BodyPart, type BodySide,
} from '../../api/bodyNote';
import { BRAND, BRAND_CARD_BORDER, SURFACE } from '../../theme/brand';
import { useOverlayBack } from '../../utils/useOverlayBack';
import { CTA } from '../ui';

/** 고르는 칸 하나. 눌러서 켜고 끕니다. */
function Pick({ on, label, onClick }: { on: boolean; label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={on}
      className="mebody-hit"
      style={{
        minHeight: '44px',
        padding: '0 14px',
        borderRadius: 'var(--mebody-r-pill, 999px)',
        border: on ? '1px solid transparent' : BRAND_CARD_BORDER,
        background: on ? BRAND.green : BRAND.card,
        color: on ? 'var(--mebody-t-ffffff-2, #ffffff)' : BRAND.text,
        fontFamily: 'inherit',
        fontSize: '0.875rem',
        fontWeight: 800,
        cursor: 'pointer',
      }}
    >
      {label}
    </button>
  );
}

function Group({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <div style={{ fontSize: '0.9375rem', fontWeight: 900, color: BRAND.green, marginBottom: hint ? '2px' : '8px' }}>
        {title}
      </div>
      {hint && (
        <div style={{ fontSize: '0.75rem', color: BRAND.muted, fontWeight: 700, marginBottom: '8px' }}>{hint}</div>
      )}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>{children}</div>
    </div>
  );
}

export function BodyNoteSheet({
  existing,
  onClose,
  onSaved,
}: {
  /** 오늘 이미 적은 것이 있으면 그 값으로 시작합니다(수정). */
  existing: BodyNote | null;
  onClose: () => void;
  onSaved: (note: BodyNote) => void;
}) {
  const close = useOverlayBack(true, onClose);
  const [parts, setParts] = useState<BodyPart[]>(existing?.parts ?? []);
  const [side, setSide] = useState<BodySide | null>(existing?.side ?? null);
  const [activities, setActivities] = useState<BodyActivity[]>(existing?.activities ?? []);
  const [condition, setCondition] = useState<BodyCondition | null>(existing?.condition ?? null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // '없음' 을 고르면 다른 부위는 지웁니다. DB 트리거도 같은 일을 하지만,
  // 화면에서 바로 보이지 않으면 사용자는 둘 다 골라진 줄 압니다.
  useEffect(() => {
    if (parts.includes('none') && parts.length > 1) setParts(['none']);
  }, [parts]);

  const togglePart = (p: BodyPart) =>
    setParts((cur) => (p === 'none'
      ? (cur.includes('none') ? [] : ['none'])
      : cur.includes(p) ? cur.filter((x) => x !== p) : [...cur.filter((x) => x !== 'none'), p]));

  const toggleActivity = (a: BodyActivity) =>
    setActivities((cur) => (cur.includes(a) ? cur.filter((x) => x !== a) : [...cur, a]));

  const hurts = parts.length > 0 && !parts.includes('none');
  // 컨디션만 필수입니다. 나머지를 다 채우라고 하면 20초 안에 안 끝납니다.
  const canSave = condition != null && !saving;

  const submit = async () => {
    if (!canSave) return;
    setSaving(true);
    setError(null);
    try {
      const saved = await saveBodyNote({
        recordDate: kstToday(),
        parts,
        side: hurts ? side : null,
        activities,
        condition: condition as BodyCondition,
      });
      if (!saved) throw new Error('저장되지 않았습니다');
      onSaved(saved);
      close();
    } catch {
      setError('저장하지 못했습니다. 연결을 확인하고 다시 눌러주세요.');
      setSaving(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="오늘의 몸 기록"
      style={{
        position: 'fixed', inset: 0, zIndex: 60, background: BRAND.bg,
        display: 'flex', flexDirection: 'column', paddingTop: 'env(safe-area-inset-top)',
      }}
    >
      <header
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          gap: '12px', padding: '0 8px 0 18px', height: '56px', flexShrink: 0,
          borderBottom: '1px solid rgba(1,71,37,0.10)',
        }}
      >
        <strong style={{ fontSize: '1rem', color: BRAND.green }}>오늘의 몸 기록</strong>
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

      <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '18px', display: 'grid', gap: '20px' }}>
        <Group title="오늘 불편했던 곳" hint="여러 개 고를 수 있어요">
          {BODY_PARTS.map((p) => (
            <Pick key={p} on={parts.includes(p)} label={PART_LABEL[p]} onClick={() => togglePart(p)} />
          ))}
        </Group>

        {/* 불편한 곳이 없으면 좌우를 물을 이유가 없습니다. */}
        {hurts && (
          <Group title="어느 쪽이 더 편했나요">
            {BODY_SIDES.map((v) => (
              <Pick key={v} on={side === v} label={SIDE_LABEL[v]} onClick={() => setSide(side === v ? null : v)} />
            ))}
          </Group>
        )}

        <Group title="오늘 많이 했던 것" hint="여러 개 고를 수 있어요">
          {BODY_ACTIVITIES.map((a) => (
            <Pick key={a} on={activities.includes(a)} label={ACTIVITY_LABEL[a]} onClick={() => toggleActivity(a)} />
          ))}
        </Group>

        <Group title="오늘 컨디션">
          {BODY_CONDITIONS.map((v) => (
            <Pick key={v} on={condition === v} label={CONDITION_LABEL[v]} onClick={() => setCondition(v)} />
          ))}
        </Group>

        <p style={{ margin: 0, fontSize: '0.75rem', lineHeight: 1.6, color: BRAND.muted, wordBreak: 'keep-all' }}>
          오늘 느낀 것을 그대로 적어두는 기록입니다. 진단이나 치료를 대신하지 않아요.
          연결된 전문가가 있으면 이 기록을 함께 볼 수 있습니다.
        </p>

        {error && (
          <p role="alert" style={{ margin: 0, fontSize: '0.8125rem', fontWeight: 800, color: '#B3261E' }}>{error}</p>
        )}
      </div>

      {/* 아래 패딩에 --mebody-ad-inset 을 더합니다.
          네이티브에서 AdMob 배너가 웹뷰 **위에** 겹쳐 뜨므로, 이걸 빼면
          저장 버튼이 광고에 깔려 보이지 않습니다(실제로 가렸습니다). */}
      <div
        style={{
          flexShrink: 0,
          padding: '12px 18px',
          paddingBottom: 'calc(12px + var(--mebody-ad-inset, 0px) + env(safe-area-inset-bottom, 0px))',
          borderTop: `1px solid ${SURFACE.hairline}`,
        }}
      >
        {/* 버튼이 **막힌 이유를 말합니다.** 눌러도 아무 일이 없으면 왜인지 알 수 없습니다. */}
        <CTA onClick={submit} disabled={!canSave}>
          {saving ? '저장 중...' : condition == null ? '오늘 컨디션을 골라주세요' : existing ? '수정하기' : '기록하기'}
        </CTA>
      </div>
    </div>
  );
}
