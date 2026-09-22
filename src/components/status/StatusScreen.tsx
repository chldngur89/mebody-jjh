/**
 * 내 상태 탭 — 시안의 status 페이지.
 *
 * 기존 "내 페이지"(MyPageScreen)를 대체합니다. 두 개가 거의 같은 내용을 다르게
 * 보여주고 있어서 하나로 합쳤습니다.
 *
 * 시안과 다른 점(사용자 확정):
 *   · 레벨(Lv.10) 없음 → 누적 적립금 + 연속 관리 일수
 *   · EXP 게이지 → 이번 달 공통 스트레칭 달성률 (.status-exp-track 스타일 그대로)
 *   · 사진 기록(정면/측면/후면) 제외
 */
import { useEffect, useState } from 'react';
import type { User } from '@supabase/supabase-js';
import { AlertTriangle, ChevronRight, LogOut, RotateCw } from 'lucide-react';
import { fetchRewardBalance } from '../../api/journey';
import { fetchRewardMonthStatus, fetchRewardRules, type RewardMonthStatus } from '../../api/routineReward';
import { fetchChallengeStatus, type ChallengeStatus } from '../../api/routineHistory';
import { BRAND, SURFACE } from '../../theme/brand';
import { CTA as COPY_CTA, PRODUCT } from '../../theme/copy';
import { getCharacterStorageUrl } from '../../utils/characterImages';
import { Card, CTA, Chip, PageTitle, ProgressTrack, SectionHeading, TextLink } from '../ui';
import { MeasurementSection, MembershipSection, OrdersSection, ProfessionalSection, ProfileSection } from './StatusSections';
import { confirmDialog } from '../../lib/confirmDialog';
import { AccountDeletionError, deleteMyAccount } from '../../api/accountDeletion';

export interface StatusScreenProps {
  user: User | null;
  bodyCode?: string;
  characterName?: string;
  /** 활성 구독 여부 */
  isPaid?: boolean;
  tier?: string;
  /** 진행 중인 저니 요약 */
  journeyProgress?: { progress: number; dayNo: number; totalDays: number; completed: number; total: number };
  onOpenResult?: (id?: string) => void;
  onOpenRoutine?: () => void;
  onOpenMembership?: () => void;
  onStartDiagnosis?: () => void;
  onRequireAuth?: () => void;
  onLogout?: () => void | Promise<void>;
  /** 탈퇴가 끝난 뒤. 세션을 지우고 첫 화면으로 보냅니다. */
  onAccountDeleted?: () => void | Promise<void>;
  /** 멤버십을 해지하면 자격을 다시 읽도록 알립니다 */
  onSubscriptionChanged?: () => void;
}

function displayName(user: User | null): string {
  const meta = user?.user_metadata as Record<string, unknown> | undefined;
  const name = typeof meta?.display_name === 'string' ? meta.display_name.trim() : '';
  if (name) return name;
  return user?.email?.split('@')[0] ?? '회원';
}

export function StatusScreen({
  user,
  bodyCode,
  characterName,
  isPaid = false,
  journeyProgress,
  onOpenResult,
  onOpenRoutine,
  onOpenMembership,
  onStartDiagnosis,
  onRequireAuth,
  onLogout,
  onAccountDeleted,
  onSubscriptionChanged,
}: StatusScreenProps) {
  const [balance, setBalance] = useState(0);
  /** 월간 챌린지 보너스 금액. 규칙에서 읽습니다 — 화면에 숫자를 박으면 어긋납니다. */
  const [monthlyBonus, setMonthlyBonus] = useState<number | null>(null);
  useEffect(() => {
    let cancelled = false;
    void fetchRewardRules().then((rules) => {
      if (cancelled) return;
      const rule = rules.monthly_challenge;
      setMonthlyBonus(rule?.fixedAmount ?? rule?.maxAmount ?? null);
    });
    return () => { cancelled = true; };
  }, []);
  const [challenge, setChallenge] = useState<ChallengeStatus | null>(null);
  /**
   * 불러오기 실패를 따로 들고 다닙니다.
   *
   * 예전에는 실패를 0원으로 바꿔 그렸습니다. 사용자는 "적립금이 없다" 와 구분할 수 없었고,
   * 챌린지 쪽은 실패를 받는 곳이 아예 없어 Promise.all 이 거부되면 화면이 멈췄습니다.
   */
  const [loadFailed, setLoadFailed] = useState(false);
  /** 이번 달 무료 적립 현황. 상한을 숨기면 꽝이 운처럼 보입니다. */
  const [monthStatus, setMonthStatus] = useState<RewardMonthStatus | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (!user?.id) {
      setBalance(0);
      setChallenge(null);
      setLoadFailed(false);
      return;
    }
    let cancelled = false;
    void (async () => {
      const [b, c, m] = await Promise.all([
        fetchRewardBalance(user.id).then((v) => ({ ok: true as const, v })).catch(() => ({ ok: false as const })),
        fetchChallengeStatus().then((v) => ({ ok: true as const, v })).catch(() => ({ ok: false as const })),
        // 이번 달 현황은 보조 정보입니다. 못 읽어도 나머지 화면은 그대로 그립니다
        // (057 미적용 환경에서도 죽지 않아야 합니다).
        fetchRewardMonthStatus().catch(() => null),
      ]);
      if (cancelled) return;
      setBalance(b.ok ? b.v : 0);
      setChallenge(c.ok ? c.v : null);
      setMonthStatus(m);
      setLoadFailed(!b.ok || !c.ok);
    })();
    return () => {
      cancelled = true;
    };
  }, [user?.id, reloadKey]);

  const removeAccount = async () => {
    // 되돌릴 수 없으므로 두 번 묻습니다. 첫 번째는 무엇이 사라지고 무엇이 남는지,
    // 두 번째는 마지막 확인입니다.
    const understood = await confirmDialog({
      title: '정말 탈퇴하시겠어요?',
      body: '진단 결과, 14일 관리 기록, 적립금, 배송지가 모두 삭제되고 되돌릴 수 없습니다. '
        + '주문과 결제 기록은 법에 따라 보관 기간 동안 남지만, 누구의 것인지는 알 수 없게 됩니다.',
      confirmLabel: '계속',
      destructive: true,
    });
    if (!understood) return;

    const finalOk = await confirmDialog({
      title: '마지막 확인입니다',
      body: '이 계정과 기록을 지금 삭제합니다. 같은 이메일로 다시 가입할 수는 있지만 기록은 돌아오지 않습니다.',
      confirmLabel: '탈퇴하기',
      destructive: true,
    });
    if (!finalOk) return;

    setDeleting(true);
    try {
      const result = await deleteMyAccount();
      const kept = result.keptOrders + result.keptPayments;
      await confirmDialog({
        title: '탈퇴가 완료되었습니다',
        body: kept > 0
          ? `그동안 이용해주셔서 감사합니다. 주문 ${result.keptOrders}건과 결제 ${result.keptPayments}건은 법에 따라 보관 기간 동안 남습니다.`
          : '그동안 이용해주셔서 감사합니다.',
        confirmLabel: '확인',
        destructive: false,
      });
      await onAccountDeleted?.();
    } catch (err) {
      await confirmDialog({
        title: '탈퇴하지 못했습니다',
        body: err instanceof AccountDeletionError ? err.message : '잠시 후 다시 시도해주세요.',
        confirmLabel: '확인',
        destructive: false,
      });
    } finally {
      setDeleting(false);
    }
  };

  if (!user) {
    return (
      <div style={{ display: 'grid', gap: '14px' }}>
        <PageTitle eyebrow="MY STATUS" title="내 상태" lead="로그인하면 내 코드와 적립금, 관리 기록을 이어서 볼 수 있습니다." />
        <Card>
          <CTA onClick={onRequireAuth}>로그인 / 회원가입</CTA>
        </Card>
      </div>
    );
  }

  const name = displayName(user);
  const avatar = getCharacterStorageUrl(bodyCode);
  const journeyPercent = journeyProgress
    ? Math.round((journeyProgress.dayNo / Math.max(1, journeyProgress.totalDays)) * 100)
    : 0;

  return (
    <div style={{ display: 'grid', gap: '14px' }}>
      <PageTitle eyebrow="MY STATUS" title="내 상태" />

      {loadFailed && (
        <Card padding="14px 16px">
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
            <AlertTriangle size={16} color="#dc2626" />
            <span style={{ flex: 1, minWidth: '160px', fontSize: '0.8125rem', lineHeight: 1.55, color: BRAND.text, wordBreak: 'keep-all' }}>
              적립금과 관리 기록을 불러오지 못했습니다. 아래 숫자가 실제와 다를 수 있어요.
            </span>
            <button
              type="button"
              onClick={() => setReloadKey((n) => n + 1)}
              style={{
                border: `1px solid ${SURFACE.hairline}`, background: '#ffffff', borderRadius: '10px',
                padding: '8px 12px', fontSize: '0.8125rem', fontWeight: 800, color: BRAND.green,
                fontFamily: 'inherit', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '6px',
              }}
            >
              <RotateCw size={14} /> 다시 시도
            </button>
          </div>
        </Card>
      )}

      {/* .status-user-summary — 최상단 */}
      <Card>
        <div style={{ display: 'flex', gap: '14px', alignItems: 'center' }}>
          <div
            style={{
              flex: '0 0 56px',
              width: '56px',
              height: '56px',
              borderRadius: '18px',
              background: SURFACE.subtle,
              display: 'grid',
              placeItems: 'center',
              overflow: 'hidden',
            }}
          >
            {avatar ? (
              <img src={avatar} alt="" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
            ) : (
              <span style={{ fontWeight: 900, color: BRAND.green }}>{name.slice(0, 1)}</span>
            )}
          </div>
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
              <h2 style={{ fontSize: '1.125rem', fontWeight: 800, margin: 0 }}>{name} 회원님</h2>
              {isPaid && <Chip tone="solid">VIP</Chip>}
            </div>
          </div>
          <div style={{ textAlign: 'right', flexShrink: 0 }}>
            <small style={{ fontSize: '0.6875rem', color: BRAND.muted, letterSpacing: '0.08em' }}>적립금</small>
            <div style={{ fontSize: '1.25rem', fontWeight: 900, color: BRAND.green }}>{balance.toLocaleString()}원</div>
            {monthStatus && (
              <small style={{ fontSize: '0.625rem', color: BRAND.muted, display: 'block', marginTop: '2px' }}>
                이번 달 {monthStatus.earned} / {monthStatus.cap}원
              </small>
            )}
          </div>
        </div>

        {/* .status-exp-track 을 "14일 관리 진행률" 로 씁니다 */}
        <ProgressTrack
          percent={journeyPercent}
          label="14일 루틴"
          value={journeyProgress ? `DAY ${journeyProgress.dayNo} / ${journeyProgress.totalDays}` : '진행 중 아님'}
          foot={journeyProgress ? `오늘 ${journeyProgress.completed} / ${journeyProgress.total} 완료` : undefined}
        />
      </Card>

      {/* 내 정보 — 미등록이면 빨간 경고 + 펼침 */}
      <ProfileSection user={user} />

      {/* 내 코드 */}
      <Card>
        <SectionHeading title="나의 결과" />
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div
            style={{
              flex: '0 0 64px',
              height: '64px',
              borderRadius: '20px',
              background: BRAND.green,
              color: 'var(--mebody-t-ffffff-2, #ffffff)',
              display: 'grid',
              placeItems: 'center',
              fontWeight: 900,
              fontSize: '0.9375rem',
            }}
          >
            {bodyCode ?? '----'}
          </div>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: '1rem', fontWeight: 800, wordBreak: 'keep-all' }}>{characterName ?? `나의 ${PRODUCT.codeName}`}</div>
            <TextLink onClick={() => onOpenResult?.()}>결과 자세히 보기 →</TextLink>
          </div>
        </div>
      </Card>

      {/* 14일 관리 */}
      <Card>
        <SectionHeading kicker="내 진행" title="14일 루틴" />
        <p style={{ margin: 0, fontSize: '0.875rem', lineHeight: 1.6, color: BRAND.muted, wordBreak: 'keep-all' }}>
          {journeyProgress
            ? `진행 중입니다. DAY ${journeyProgress.dayNo} / ${journeyProgress.totalDays}`
            : '내 코드에 맞는 미션이 하루 한 가지씩 배정됩니다.'}
        </p>
        <CTA variant="outline" onClick={onOpenRoutine}>
          {journeyProgress ? COPY_CTA.missionToday : COPY_CTA.missionStart} <ChevronRight size={18} />
        </CTA>
      </Card>

      {/* 멤버십 — 갱신일과 해지까지 (해지도 서버가 처리합니다) */}
      <MembershipSection
        user={user}
        isPaid={isPaid}
        onOpenMembership={onOpenMembership}
        onChanged={onSubscriptionChanged}
      />

      {/* 주문 내역 */}
      <OrdersSection user={user} onChanged={onSubscriptionChanged} />

      {/* 측정 기록 — 지난 진단과 변화 */}
      <MeasurementSection user={user} onOpenResult={onOpenResult} />

      <ProfessionalSection user={user} />

      {/* 관리 기록 */}
      <Card>
        <SectionHeading
          kicker="미션"
          title="관리 기록"
          hint={challenge ? `${challenge.monthStart.slice(5, 7)}월` : undefined}
        />
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
          <div style={{ background: SURFACE.subtle, borderRadius: '14px', padding: '14px' }}>
            <div style={{ fontSize: '0.75rem', color: BRAND.muted, fontWeight: 800 }}>이번 주</div>
            <div style={{ fontSize: '1.375rem', fontWeight: 900, color: BRAND.green, marginTop: '4px' }}>
              {challenge?.weekDone ?? 0}
              <span style={{ fontSize: '0.8125rem', color: BRAND.muted, fontWeight: 700 }}> / {challenge?.weekRequired ?? 7}일</span>
            </div>
          </div>
          <div style={{ background: SURFACE.subtle, borderRadius: '14px', padding: '14px' }}>
            <div style={{ fontSize: '0.75rem', color: BRAND.muted, fontWeight: 800 }}>이번 달</div>
            <div style={{ fontSize: '1.375rem', fontWeight: 900, color: BRAND.green, marginTop: '4px' }}>
              {challenge?.monthDone ?? 0}
              <span style={{ fontSize: '0.8125rem', color: BRAND.muted, fontWeight: 700 }}> / {challenge?.monthRequired ?? 20}일</span>
            </div>
          </div>
        </div>
        <ProgressTrack
          percent={((challenge?.monthDone ?? 0) / Math.max(1, challenge?.monthRequired ?? 20)) * 100}
          label="월간 완주"
          value={challenge?.monthClaimed ? '보너스 받음' : `${challenge?.monthRequired ?? 20}일 달성${monthlyBonus == null ? '' : ` · ${monthlyBonus}원`}`}
        />
      </Card>

      <Card>
        <div style={{ display: 'grid', gap: '10px' }}>
          {onStartDiagnosis && (
            <CTA variant="outline" onClick={onStartDiagnosis} style={{ marginTop: 0 }}>
              mebody Code 다시 확인하기
            </CTA>
          )}
          {onLogout && (
            <button
              type="button"
              onClick={() => void onLogout()}
              style={{
                border: 0,
                background: 'transparent',
                padding: '10px 4px',
                fontSize: '0.8125rem',
                fontWeight: 800,
                color: BRAND.muted,
                fontFamily: 'inherit',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px',
              }}
            >
              <LogOut size={15} /> 로그아웃
            </button>
          )}
          {onAccountDeleted && (
            <button
              type="button"
              onClick={() => void removeAccount()}
              disabled={deleting}
              style={{
                border: 0,
                background: 'transparent',
                padding: '4px 4px 2px',
                fontSize: '0.75rem',
                fontWeight: 700,
                color: '#dc2626',
                fontFamily: 'inherit',
                cursor: deleting ? 'default' : 'pointer',
                opacity: deleting ? 0.55 : 1,
                textDecoration: 'underline',
                textUnderlineOffset: '3px',
              }}
            >
              {deleting ? '탈퇴 처리 중...' : '회원 탈퇴'}
            </button>
          )}
        </div>
      </Card>
    </div>
  );
}
