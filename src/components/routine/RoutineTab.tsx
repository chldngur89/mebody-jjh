/**
 * 루틴 탭 — 유료 14일 저니.
 *
 * 무료 회원(첫 저니도 이미 쓴 경우)에게는 잠금 카드를 보여줍니다.
 * **실제 차단은 RLS(can_start_journey)가 합니다.** 이 화면은 안내만 합니다 —
 * 화면에서만 막으면 API 로 우회되므로, 서버 판정과 화면 안내를 분리해 둡니다.
 */
import { ChevronRight, Lock } from 'lucide-react';
import type { Entitlement } from '../../api/entitlement';
import { BRAND, SURFACE } from '../../theme/brand';
import { Card, CTA, Chip, DirectionCard, PageTitle, ProgressTrack, SectionHeading } from '../ui';

export interface RoutineTabProps {
  entitlement: Entitlement;
  isLoggedIn: boolean;
  /** 진행 중인 저니 요약 */
  journeyProgress?: { progress: number; dayNo: number; totalDays: number; completed: number; total: number };
  onOpenJourney?: () => void;
  onOpenMembership?: () => void;
  onRequireAuth?: () => void;
}

export function RoutineTab({
  entitlement,
  isLoggedIn,
  journeyProgress,
  onOpenJourney,
  onOpenMembership,
  onRequireAuth,
}: RoutineTabProps) {
  if (!isLoggedIn) {
    return (
      <div style={{ display: 'grid', gap: '14px' }}>
        <PageTitle eyebrow="MY ROUTINE" title="14일 루틴" lead="내 코드에 맞는 미션이 하루 한 가지씩 배정됩니다." />
        <Card>
          <CTA onClick={onRequireAuth}>로그인 / 회원가입</CTA>
        </Card>
      </div>
    );
  }

  // 진행 중
  if (journeyProgress) {
    return (
      <div style={{ display: 'grid', gap: '14px' }}>
        <PageTitle eyebrow="MY ROUTINE" title="14일 루틴" lead="오늘 배정된 미션을 이어서 하세요." />
        <Card>
          <SectionHeading kicker="진행 중" title={`DAY ${journeyProgress.dayNo} / ${journeyProgress.totalDays}`} />
          <ProgressTrack
            percent={(journeyProgress.dayNo / Math.max(1, journeyProgress.totalDays)) * 100}
            label="14일 관리"
            value={`오늘 ${journeyProgress.completed} / ${journeyProgress.total} 완료`}
          />
          <CTA onClick={onOpenJourney}>
            오늘의 미션 하러 가기 <ChevronRight size={18} />
          </CTA>
        </Card>
        <DirectionCard
          kicker="어떻게 진행되나요"
          title="14일 동안 이렇게 이어집니다"
          steps={[
            { title: 'DAY 1–6', desc: '1순위와 2순위 축을 하루씩 번갈아 짧게 관리합니다.' },
            { title: 'DAY 7', desc: '한 주를 정리하는 주간 리포트를 확인합니다.' },
            { title: 'DAY 8–14', desc: '피드백에 맞춰 강도를 조정하고, 2주 변화를 확인합니다.' },
          ]}
        />
      </div>
    );
  }

  // 시작 가능 (첫 저니 무료 또는 멤버십)
  if (entitlement.canStartJourney) {
    const isFreeTrial = !entitlement.isPaid && entitlement.journeyCount === 0;
    return (
      <div style={{ display: 'grid', gap: '14px' }}>
        <PageTitle eyebrow="MY ROUTINE" title="14일 루틴" lead="내 코드와 관리 우선순위에 맞춰 하루 한 가지씩 배정됩니다." />
        <Card tone="green">
          {isFreeTrial && <Chip tone="onGreen">첫 14일 무료</Chip>}
          <h2 style={{ fontSize: '23px', fontWeight: 800, margin: '12px 0 8px', wordBreak: 'keep-all' }}>
            지금 시작할 수 있어요
          </h2>
          <p style={{ margin: 0, color: 'rgba(255,255,255,.78)', fontSize: '14px', lineHeight: 1.6, wordBreak: 'keep-all' }}>
            {isFreeTrial
              ? '첫 14일은 무료입니다. 끝까지 해보고 이어갈지 정하세요.'
              : '멤버십 이용 중이라 언제든 새로 시작할 수 있습니다.'}
          </p>
          <CTA variant="light" onClick={onOpenJourney}>
            14일 관리 시작하기 <ChevronRight size={18} />
          </CTA>
        </Card>
        <DirectionCard
          kicker="어떻게 진행되나요"
          title="14일 동안 이렇게 이어집니다"
          steps={[
            { title: 'DAY 1–6', desc: '1순위와 2순위 축을 하루씩 번갈아 짧게 관리합니다.' },
            { title: 'DAY 7', desc: '한 주를 정리하는 주간 리포트를 확인합니다.' },
            { title: 'DAY 8–14', desc: '피드백에 맞춰 강도를 조정하고, 2주 변화를 확인합니다.' },
          ]}
        />
      </div>
    );
  }

  // 체험 소진 + 무구독 → 잠금
  return (
    <div style={{ display: 'grid', gap: '14px' }}>
      <PageTitle eyebrow="MY ROUTINE" title="14일 루틴" lead="멤버십 회원이 이용할 수 있는 개인화 루틴입니다." />

      <Card>
        <div style={{ display: 'grid', placeItems: 'center', gap: '10px', padding: '16px 0 6px' }}>
          <div
            style={{
              width: '52px',
              height: '52px',
              borderRadius: '999px',
              background: SURFACE.subtle,
              display: 'grid',
              placeItems: 'center',
            }}
          >
            <Lock size={22} color={BRAND.green} />
          </div>
          <h2 style={{ fontSize: '19px', fontWeight: 800, margin: 0, textAlign: 'center', wordBreak: 'keep-all' }}>
            무료 체험을 모두 사용했습니다
          </h2>
          <p style={{ margin: 0, fontSize: '13px', lineHeight: 1.7, color: BRAND.muted, textAlign: 'center', wordBreak: 'keep-all' }}>
            멤버십에 가입하면 14일 루틴을 계속 이어갈 수 있습니다.
            <br />
            공통 스트레칭과 적립은 지금처럼 무료로 계속 이용하실 수 있어요.
          </p>
        </div>
        <CTA onClick={onOpenMembership}>
          멤버십 보기 <ChevronRight size={18} />
        </CTA>
      </Card>

      <Card>
        <SectionHeading kicker="멤버십" title="무엇이 열리나요" />
        <ul style={{ margin: 0, paddingLeft: '18px', fontSize: '13px', lineHeight: 1.9, color: BRAND.muted }}>
          <li>14일 관리 무제한</li>
          <li>광고 없이 이용</li>
          <li>미션 · 공통 스트레칭 적립 2배</li>
          <li>mebody 상품 구매 시 결제액의 5% 적립</li>
          <li>주간 리포트와 2주 재측정 비교</li>
        </ul>
      </Card>
    </div>
  );
}
