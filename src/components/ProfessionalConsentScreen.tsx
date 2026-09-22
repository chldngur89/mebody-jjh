/**
 * 전문가 초대 동의 화면.
 *
 * 트레이너가 보낸 링크(`/?invite=<token>`)를 열면 나오는 한 장입니다.
 * **기존 화면은 건드리지 않습니다.** 이 화면을 지나면 평소의 흐름으로 돌아갑니다.
 *
 * 화면이 지켜야 할 것:
 *
 * - 동의는 **누르는 것**이지 링크를 여는 것이 아닙니다. 링크를 열었다고 자동으로 연결되면
 *   카카오톡 미리보기 크롤러나 실수로 누른 손가락이 동의를 대신하게 됩니다.
 * - 무엇을 보여주는지 **먼저** 말합니다. 체형 코드와 4축 요약이고, 문항별 답변은 아닙니다.
 * - 언제든 끊을 수 있다는 것도 같이 말합니다. 거둘 수 없는 동의는 동의가 아닙니다.
 * - 로그인이 필요하면 그 이유를 말하고 로그인으로 보냅니다. "지금 로그인한 사람" 을 묶기
 *   때문에, 링크를 받은 사람이 아닌 다른 계정이 묶일 수 없습니다.
 */
import { useEffect, useState } from 'react';
import { CTA, Card, PageTitle } from './ui';
import { BRAND, BRAND_PAGE_BG, SHELL } from '../theme/brand';
import { acceptInvite, previewInvite, type InvitePreview } from '../api/professionalInvite';
import { track } from '../lib/analytics';

const TYPE_LABEL: Record<string, string> = {
  PERSONAL_TRAINER: '퍼스널 트레이너',
  PHYSIO: '물리치료사',
};

interface Props {
  token: string;
  /** 로그인해 있으면 그 사람으로 묶습니다. 없으면 로그인 화면으로 보냅니다. */
  signedIn: boolean;
  onRequireAuth: () => void;
  /** 동의를 마쳤거나 건너뛰었을 때. 평소 흐름으로 돌려보냅니다. */
  onDone: (outcome: { accepted: boolean; hasResult?: boolean }) => void;
}

export function ProfessionalConsentScreen({ token, signedIn, onRequireAuth, onDone }: Props) {
  const [preview, setPreview] = useState<InvitePreview | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    track('invite_opened');
    previewInvite(token)
      .then((value) => { if (!cancelled) setPreview(value); })
      .catch((err) => { if (!cancelled) setError((err as Error).message); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [token]);

  const name = preview?.professionalName ?? '전문가';
  const typeLabel = TYPE_LABEL[preview?.professionalType ?? ''] ?? '전문가';

  const handleAccept = async () => {
    if (!signedIn) {
      onRequireAuth();
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const result = await acceptInvite(token);
      track('invite_accepted');
      onDone({ accepted: true, hasResult: result.hasResult });
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={{
      minHeight: 'var(--mebody-app-height, 100dvh)',
      background: BRAND_PAGE_BG,
      display: 'flex', justifyContent: 'center',
    }}>
      <div style={{ width: `min(${SHELL.maxWidth}px, 100%)`, padding: '32px 16px 40px' }}>
        <PageTitle title="내 결과 보여주기" />

        {loading && (
          <p style={{ color: BRAND.muted, fontSize: '0.95rem', marginTop: '16px' }}>초대를 확인하고 있습니다…</p>
        )}

        {!loading && !preview?.valid && (
          <Card style={{ marginTop: '18px' }}>
            <p style={{ margin: 0, color: BRAND.text, fontWeight: 700 }}>
              {preview?.reason ?? error ?? '만료되었거나 사용할 수 없는 링크입니다.'}
            </p>
            <p style={{ margin: '10px 0 0', color: BRAND.muted, fontSize: '0.9rem', lineHeight: 1.6 }}>
              링크는 7일이 지나면 만료되고, 한 번 쓰면 다시 쓸 수 없습니다.
              보내주신 분께 새 링크를 요청해주세요.
            </p>
            <CTA variant="outline" onClick={() => onDone({ accepted: false })} style={{ marginTop: '18px' }}>
              그냥 시작하기
            </CTA>
          </Card>
        )}

        {!loading && preview?.valid && (
          <>
            <Card tone="green" style={{ marginTop: '18px' }}>
              <p style={{ margin: 0, color: BRAND.onGreen, fontSize: '1.05rem', fontWeight: 800 }}>
                {name} {typeLabel}님이
              </p>
              <p style={{ margin: '4px 0 0', color: BRAND.onGreen, fontSize: '1.05rem', fontWeight: 800 }}>
                내 체형 결과를 요청했습니다
              </p>
            </Card>

            <Card style={{ marginTop: '14px' }}>
              <p style={{ margin: 0, fontWeight: 800, color: BRAND.text }}>보여주는 것</p>
              <ul style={{ margin: '10px 0 0', paddingLeft: '18px', color: BRAND.muted, fontSize: '0.92rem', lineHeight: 1.75 }}>
                <li>체형 코드와 4축 요약(목·어깨·골반·하체)</li>
                <li>진단을 마친 날짜</li>
                <li>14일 루틴의 미션 수행 기록 — 며칠에 몇 개를 했는지</li>
                <li>미션 뒤에 남긴 느낌·난이도와 <b>메모 내용</b></li>
              </ul>

              <p style={{ margin: '16px 0 0', fontWeight: 800, color: BRAND.text }}>할 수 있는 것</p>
              <ul style={{ margin: '10px 0 0', paddingLeft: '18px', color: BRAND.muted, fontSize: '0.92rem', lineHeight: 1.75 }}>
                <li>내 오늘 미션에 동작을 <b>추가</b>할 수 있습니다 (하루 3개까지)</li>
                <li>그 동작에 짧은 메모를 붙일 수 있습니다</li>
              </ul>
              <p style={{ margin: '8px 0 0', paddingLeft: '2px', color: BRAND.muted, fontSize: '0.84rem', lineHeight: 1.7 }}>
                동작은 MEBODY 가 준비한 목록에서만 고를 수 있습니다. 전문가가 새로운 동작이나
                설명을 직접 써 넣을 수는 없습니다.
              </p>
              <p style={{ margin: '16px 0 0', fontWeight: 800, color: BRAND.text }}>보여주지 않는 것</p>
              <ul style={{ margin: '10px 0 0', paddingLeft: '18px', color: BRAND.muted, fontSize: '0.92rem', lineHeight: 1.75 }}>
                <li>32문항에 어떻게 답했는지</li>
                <li>이메일·휴대폰 번호 같은 연락처</li>
                <li>주문·결제 내역</li>
              </ul>
              <p style={{
                margin: '16px 0 0', padding: '12px 14px', borderRadius: '12px',
                background: BRAND.mint, color: BRAND.text, fontSize: '0.88rem', lineHeight: 1.7,
              }}>
                <b>언제든 끊을 수 있습니다.</b> 내 상태 → 연결된 전문가에서 해지하면
                그 순간부터 아무것도 보이지 않습니다.
              </p>
            </Card>

            {error && (
              <p style={{ color: '#B3261E', fontSize: '0.9rem', marginTop: '14px' }}>{error}</p>
            )}

            <CTA onClick={handleAccept} disabled={submitting} style={{ marginTop: '20px' }}>
              {submitting ? '처리 중…' : signedIn ? '결과 보여주기에 동의' : '로그인하고 동의하기'}
            </CTA>
            <CTA variant="outline" onClick={() => onDone({ accepted: false })} style={{ marginTop: '10px' }}>
              지금은 하지 않기
            </CTA>

            {!signedIn && (
              <p style={{ color: BRAND.muted, fontSize: '0.82rem', marginTop: '12px', lineHeight: 1.6 }}>
                동의는 로그인한 본인만 할 수 있습니다. 링크를 받은 사람이 아닌 다른 계정이
                연결되는 일을 막기 위해서입니다.
              </p>
            )}
          </>
        )}
      </div>
    </div>
  );
}
