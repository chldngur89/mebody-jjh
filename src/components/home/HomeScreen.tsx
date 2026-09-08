/**
 * 홈 탭 — 시안(mebody_V1_routine_timeline_reward.html)의 result 페이지 구성.
 *
 *   hero-card        코드 + 아이덴티티 배지 + 캐릭터
 *   01               나의 움직임 경향 (한 줄 이해)
 *   02               4축 상세 — .axis-row 게이지
 *   03               지금 가장 먼저 해보세요 → 공통 스트레칭(미션 탭)
 *   04               자세 사용 설명서(유튜브) + 상품 2개 + 광고 + direction-card
 *
 * 데이터는 useResultData 가 전부 준비합니다(기존 ResultScreen 로직 그대로).
 * 이 파일은 화면만 담당합니다.
 */
import { useState } from 'react';
import { Check, ChevronRight, ExternalLink, Plus } from 'lucide-react';
import { AdSlot } from '../AdSlot';
import { AxisTrack, Card, CTA, Chip, DirectionCard, PageTitle, SectionHeading } from '../ui';
import { BRAND, SURFACE } from '../../theme/brand';
import { getCharacterStorageUrl, preloadCharacterImage } from '../../utils/characterImages';
import { useResultData } from './resultData';
import { addToCart } from '../../lib/cart';

export interface HomeScreenProps {
  questionnaireId?: string;
  isLoggedIn?: boolean;
  isPaid?: boolean;
  onResultLoad?: (bodyCode: string) => void;
  /** 03 "지금 시작하기" — 미션 탭으로 */
  onStartCare?: () => void;
  /** direction-card CTA — 루틴(14일) 탭으로 */
  onOpenRoutine?: () => void;
  /** 상품 더 보기 — 마켓 탭으로 */
  onOpenMarket?: () => void;
  onRemeasure?: () => void;
  onGoAuth?: () => void;
  /** 이미 알고 있는 코드. 결과 조회를 기다리지 않고 이미지를 먼저 띄웁니다. */
  initialBodyCode?: string;
}

/** 축 게이지 위치. percentLeft 가 클수록 왼쪽으로 치우칩니다. */
function knobPercent(percentLeft: number): number {
  return Math.max(0, Math.min(100, 100 - percentLeft));
}

export function HomeScreen({
  questionnaireId,
  isLoggedIn = false,
  isPaid = false,
  onResultLoad,
  onStartCare,
  onOpenRoutine,
  onOpenMarket,
  onRemeasure,
  onGoAuth,
  initialBodyCode,
}: HomeScreenProps) {
  /** 방금 담은 상품에 체크 표시를 잠깐 보여줍니다 */
  const [justAdded, setJustAdded] = useState<string | null>(null);
  const data = useResultData(questionnaireId, isLoggedIn, onResultLoad);

  // 코드를 이미 알면 결과 조회를 기다리지 않고 이미지를 먼저 받아 둡니다.
  if (initialBodyCode) preloadCharacterImage(initialBodyCode);

  if (data.isLoading) {
    const earlyImage = getCharacterStorageUrl(initialBodyCode);
    return (
      <Card padding="26px 20px 22px" style={{ textAlign: 'center' }}>
        {earlyImage && (
          <img src={earlyImage} alt="" style={{ width: '130px', height: '190px', objectFit: 'contain', margin: '0 auto 18px', display: 'block' }} />
        )}
        {initialBodyCode && (
          <div style={{ fontSize: '42px', lineHeight: 1, letterSpacing: '-1px', fontWeight: 800, color: BRAND.green }}>
            {initialBodyCode}
          </div>
        )}
        <p style={{ marginTop: '14px', color: BRAND.muted, fontSize: '13px' }}>결과를 불러오는 중...</p>
      </Card>
    );
  }
  if (data.error || !data.result) {
    return (
      <Card>
        <PageTitle eyebrow="RESULT" title="결과를 찾을 수 없습니다" lead={data.error ?? '결과 화면에서 다시 진입해 주세요.'} />
        {onRemeasure && <CTA onClick={onRemeasure}>32문항 다시 측정하기</CTA>}
      </Card>
    );
  }

  const primaryAxis = data.axisRows[0];

  return (
    <div style={{ display: 'grid', gap: '14px' }}>
      {/* ── hero-card ─────────────────────────────────────────────── */}
      <Card padding="26px 20px 22px" style={{ textAlign: 'center', position: 'relative', overflow: 'hidden' }}>
        {/* .hero-glow */}
        <span style={{ position: 'absolute', width: '180px', height: '180px', left: '-70px', top: '-50px', borderRadius: '50%', background: '#EEF4EC' }} />
        <span style={{ position: 'absolute', width: '150px', height: '150px', right: '-60px', bottom: '-70px', borderRadius: '50%', background: '#EEF4EC' }} />

        <div style={{ position: 'relative' }}>
          {data.characterImage && (
            <img
              src={data.characterImage}
              alt={data.characterName}
              onError={() => data.handleImageError(data.characterImage)}
              style={{ width: '130px', height: '190px', objectFit: 'contain', margin: '0 auto 18px', display: 'block' }}
            />
          )}
          <div style={{ fontSize: '42px', lineHeight: 1, letterSpacing: '-1px', fontWeight: 800, color: BRAND.green, marginBottom: '12px' }}>
            {data.bodyCode}
          </div>
          <Chip tone="solid">{data.characterName}</Chip>
          <p style={{ margin: '12px 0 0', color: BRAND.muted, fontSize: '14px', lineHeight: 1.6, wordBreak: 'keep-all' }}>
            {data.summaryLine}
          </p>
        </div>
      </Card>

      {/* ── 01 나의 움직임 경향 ────────────────────────────────────── */}
      <Card>
        <SectionHeading kicker="내 상태" title="나의 움직임 경향" />
        <div style={{ background: SURFACE.subtle, borderRadius: '14px', padding: '14px', fontSize: '14px', lineHeight: 1.7, color: BRAND.text, wordBreak: 'keep-all' }}>
          {data.axisDetails.map((d) => d.code).join(' · ')} — {data.summaryLine}
        </div>
      </Card>

      {/* ── 02 4축 상세 ───────────────────────────────────────────── */}
      <Card>
        <SectionHeading kicker="내 상태" title="4축 상세 결과" hint="중앙에 가까울수록 균형" />
        <div style={{ display: 'grid', gap: '18px' }}>
          {data.axisRows.map((row) => (
            <AxisTrack
              key={row.key}
              label={row.title.replace(/\s*(위치|높이|회전|유연성)$/, '')}
              leftLabel={row.labelLeft}
              rightLabel={row.labelRight}
              value={knobPercent(row.percentLeft)}
            />
          ))}
        </div>
      </Card>

      {/* ── 03 지금 가장 먼저 해보세요 = 공통 스트레칭 ──────────────── */}
      <Card tone="green" padding="20px">
        <SectionHeading kicker="미션" title="지금 가장 먼저 해보세요" inverse />
        <Chip tone="onGreen">1순위 {primaryAxis?.title ?? '관리'}</Chip>
        <h3 style={{ fontSize: '23px', margin: '12px 0 8px', fontWeight: 800, wordBreak: 'keep-all' }}>
          매일 하는 공통 스트레칭
        </h3>
        <p style={{ margin: 0, color: 'rgba(255,255,255,.78)', fontSize: '14px', lineHeight: 1.6, wordBreak: 'keep-all' }}>
          목 → 어깨 → 골반 → 하체를 순서대로. 코드에 따라 달라지는 건 순서가 아니라 세트 수예요.
        </p>
        <div style={{ marginTop: '12px', fontSize: '12px', color: 'rgba(255,255,255,.7)' }}>◷ 약 15분 · 5단계</div>
        <CTA variant="light" onClick={onStartCare}>
          지금 시작하기 <ChevronRight size={18} />
        </CTA>
      </Card>

      {/* ── 04 자세 사용 설명서 ───────────────────────────────────── */}
      <Card>
        <SectionHeading kicker="가이드" title="mebody 자세 사용 설명서" />
        <div style={{ display: 'grid', gap: '12px' }}>
          {data.youtubeVideos.slice(0, 2).map((video) => (
            <a
              key={video.videoId}
              href={video.url}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: 'flex',
                gap: '12px',
                alignItems: 'center',
                textDecoration: 'none',
                color: 'inherit',
                border: `1px solid ${SURFACE.hairline}`,
                borderRadius: '18px',
                padding: '10px',
                background: BRAND.card,
              }}
            >
              <img src={video.thumbnail} alt="" style={{ width: '108px', height: '68px', objectFit: 'cover', borderRadius: '12px', flexShrink: 0 }} />
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: '14px', fontWeight: 800, wordBreak: 'keep-all' }}>{video.title}</div>
                <div style={{ fontSize: '11px', color: BRAND.muted, marginTop: '4px', wordBreak: 'keep-all' }}>{video.subtitle}</div>
                <div style={{ fontSize: '12px', color: BRAND.green, fontWeight: 800, marginTop: '6px', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                  유튜브에서 보기 <ExternalLink size={12} />
                </div>
              </div>
            </a>
          ))}
        </div>
      </Card>

      {/* 상품 2개 — 전체는 마켓 탭 */}
      <Card>
        <SectionHeading kicker="마켓" title="결과에 맞는 용품" />
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
          {data.storeItems.slice(0, 2).map((item) => (
            <div key={item.name} style={{ border: `1px solid ${SURFACE.hairline}`, borderRadius: '18px', padding: '12px', background: BRAND.card, position: 'relative' }}>
              <div
                style={{
                  height: '90px',
                  background: SURFACE.placeholder,
                  borderRadius: '14px',
                  marginBottom: '10px',
                  overflow: 'hidden',
                  display: 'grid',
                  placeItems: 'center',
                }}
              >
                {item.imageUrl ? (
                  <img src={item.imageUrl} alt="" loading="lazy" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                ) : (
                  <span style={{ fontSize: '11px', color: '#B4C0B6' }}>제품 이미지</span>
                )}
              </div>
              <small style={{ color: BRAND.muted, fontSize: '11px' }}>{item.badge}</small>
              <h3 style={{ fontSize: '14px', margin: '5px 0', fontWeight: 800, wordBreak: 'keep-all' }}>{item.name}</h3>
              <strong style={{ fontSize: '14px', color: BRAND.green }}>{item.priceLabel}</strong>
              {item.id && item.priceKrw !== null && (
                <button
                  type="button"
                  aria-label={`${item.name} 담기`}
                  onClick={() => {
                    addToCart(item.id as string);
                    setJustAdded(item.id as string);
                    window.setTimeout(() => setJustAdded((id) => (id === item.id ? null : id)), 1200);
                  }}
                  style={{
                    position: 'absolute',
                    right: '10px',
                    bottom: '10px',
                    width: '28px',
                    height: '28px',
                    borderRadius: '50%',
                    border: 0,
                    background: BRAND.green,
                    color: '#ffffff',
                    display: 'grid',
                    placeItems: 'center',
                    cursor: 'pointer',
                  }}
                >
                  {justAdded === item.id ? <Check size={15} /> : <Plus size={15} />}
                </button>
              )}
            </div>
          ))}
        </div>
        {onOpenMarket && (
          <CTA variant="outline" onClick={onOpenMarket}>
            마켓에서 전체 보기 <ChevronRight size={18} />
          </CTA>
        )}
      </Card>

      {/* 광고 — 무료 사용자만 */}
      <AdSlot
        isPaid={isPaid}
        placement="result_bottom"
        house={{
          title: '14일 관리로 이어서 해보세요',
          body: '내 코드에 맞는 미션이 하루 한 가지씩 배정됩니다. 첫 14일은 무료입니다.',
        }}
      />

      {/* direction-card — 14일 루틴 진입 */}
      <DirectionCard
        kicker="루틴"
        title={`${data.bodyCode}는 이렇게 관리해보세요`}
        steps={[
          { title: '먼저 풀어주기', desc: primaryAxis ? `${primaryAxis.title} 부위부터` : '뻣뻣하게 느껴지는 부위' },
          { title: '움직여보기', desc: '골반과 몸통의 좌우 움직임' },
          { title: '힘 채우기', desc: '내 코드에 맞는 지지 근력' },
        ]}
        action={
          <CTA variant="light" onClick={isLoggedIn ? onOpenRoutine : onGoAuth}>
            {isLoggedIn ? '나의 14일 루틴 시작하기' : '회원가입하고 시작하기'} <ChevronRight size={18} />
          </CTA>
        }
      />

      {onRemeasure && (
        <button
          type="button"
          onClick={onRemeasure}
          style={{ border: 0, background: 'transparent', padding: '10px 4px', fontSize: '13px', fontWeight: 800, color: BRAND.muted, fontFamily: 'inherit', cursor: 'pointer' }}
        >
          32문항 다시 측정하기
        </button>
      )}
    </div>
  );
}
