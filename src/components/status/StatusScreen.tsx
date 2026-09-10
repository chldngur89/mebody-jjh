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
import { ChevronRight, LogOut } from 'lucide-react';
import { fetchRewardBalance } from '../../api/journey';
import { fetchChallengeStatus, type ChallengeStatus } from '../../api/routineHistory';
import { BRAND, SURFACE } from '../../theme/brand';
import { CTA as COPY_CTA, PRODUCT } from '../../theme/copy';
import { getCharacterStorageUrl } from '../../utils/characterImages';
import { Card, CTA, Chip, PageTitle, ProgressTrack, SectionHeading, TextLink } from '../ui';
import { MeasurementSection, MembershipSection, OrdersSection, ProfileSection } from './StatusSections';

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
  onSubscriptionChanged,
}: StatusScreenProps) {
  const [balance, setBalance] = useState(0);
  const [challenge, setChallenge] = useState<ChallengeStatus | null>(null);

  useEffect(() => {
    if (!user?.id) {
      setBalance(0);
      setChallenge(null);
      return;
    }
    let cancelled = false;
    void (async () => {
      const [b, c] = await Promise.all([
        fetchRewardBalance(user.id).catch(() => 0),
        fetchChallengeStatus(),
      ]);
      if (cancelled) return;
      setBalance(b);
      setChallenge(c);
    })();
    return () => {
      cancelled = true;
    };
  }, [user?.id]);

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
              <h2 style={{ fontSize: '18px', fontWeight: 800, margin: 0 }}>{name} 회원님</h2>
              {isPaid && <Chip tone="solid">VIP</Chip>}
            </div>
          </div>
          <div style={{ textAlign: 'right', flexShrink: 0 }}>
            <small style={{ fontSize: '10px', color: BRAND.muted, letterSpacing: '0.08em' }}>적립금</small>
            <div style={{ fontSize: '20px', fontWeight: 900, color: BRAND.green }}>{balance.toLocaleString()}원</div>
          </div>
        </div>

        {/* .status-exp-track 을 "14일 관리 진행률" 로 씁니다 */}
        <ProgressTrack
          percent={journeyPercent}
          label="14일 관리"
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
              color: '#ffffff',
              display: 'grid',
              placeItems: 'center',
              fontWeight: 900,
              fontSize: '15px',
            }}
          >
            {bodyCode ?? '----'}
          </div>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: '16px', fontWeight: 800, wordBreak: 'keep-all' }}>{characterName ?? `나의 ${PRODUCT.codeName}`}</div>
            <TextLink onClick={() => onOpenResult?.()}>결과 자세히 보기 →</TextLink>
          </div>
        </div>
      </Card>

      {/* 14일 관리 */}
      <Card>
        <SectionHeading kicker="루틴" title="14일 관리" />
        <p style={{ margin: 0, fontSize: '14px', lineHeight: 1.6, color: BRAND.muted, wordBreak: 'keep-all' }}>
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

      {/* 관리 기록 */}
      <Card>
        <SectionHeading
          kicker="미션"
          title="관리 기록"
          hint={challenge ? `${challenge.monthStart.slice(5, 7)}월` : undefined}
        />
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
          <div style={{ background: SURFACE.subtle, borderRadius: '14px', padding: '14px' }}>
            <div style={{ fontSize: '11px', color: BRAND.muted, fontWeight: 800 }}>이번 주</div>
            <div style={{ fontSize: '22px', fontWeight: 900, color: BRAND.green, marginTop: '4px' }}>
              {challenge?.weekDone ?? 0}
              <span style={{ fontSize: '13px', color: BRAND.muted, fontWeight: 700 }}> / {challenge?.weekRequired ?? 7}일</span>
            </div>
          </div>
          <div style={{ background: SURFACE.subtle, borderRadius: '14px', padding: '14px' }}>
            <div style={{ fontSize: '11px', color: BRAND.muted, fontWeight: 800 }}>이번 달</div>
            <div style={{ fontSize: '22px', fontWeight: 900, color: BRAND.green, marginTop: '4px' }}>
              {challenge?.monthDone ?? 0}
              <span style={{ fontSize: '13px', color: BRAND.muted, fontWeight: 700 }}> / {challenge?.monthRequired ?? 20}일</span>
            </div>
          </div>
        </div>
        <ProgressTrack
          percent={((challenge?.monthDone ?? 0) / Math.max(1, challenge?.monthRequired ?? 20)) * 100}
          label="월간 완주"
          value={challenge?.monthClaimed ? '보너스 받음' : `${challenge?.monthRequired ?? 20}일 달성 시 50원`}
        />
      </Card>

      <Card>
        <div style={{ display: 'grid', gap: '10px' }}>
          {onStartDiagnosis && (
            <CTA variant="outline" onClick={onStartDiagnosis} style={{ marginTop: 0 }}>
              32문항 다시 측정하기
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
                fontSize: '13px',
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
        </div>
      </Card>
    </div>
  );
}
