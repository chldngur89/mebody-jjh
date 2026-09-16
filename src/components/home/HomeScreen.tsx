/**
 * 홈 탭 — 오늘 할 일 1개를 최상단에 고정하고, 결과는 한 줄 액션 + 접기로 정리합니다.
 */
import { useState, type CSSProperties } from 'react';
import { ChevronDown, ChevronRight, ChevronUp, ExternalLink } from 'lucide-react';
import { AdSlot } from '../AdSlot';
import { AxisTrack, Card, CTA, Chip, DirectionCard, PageTitle, SectionHeading } from '../ui';
import { BRAND, SURFACE } from '../../theme/brand';
import { CTA as COPY_CTA, PRODUCT } from '../../theme/copy';
import { getCharacterStorageUrl, preloadCharacterImage } from '../../utils/characterImages';
import { ResultShareCard } from './ResultShareCard';
import { useResultData } from './resultData';
import type { CodePlanJourneyProgress } from '../codePlanShared';

export interface HomeScreenProps {
  questionnaireId?: string;
  isLoggedIn?: boolean;
  isPaid?: boolean;
  onResultLoad?: (bodyCode: string) => void;
  /** 공통 스트레칭(미션 탭) */
  onStartCare?: () => void;
  /** 14일 루틴 탭 / 오늘 저니 */
  onOpenRoutine?: () => void;
  onOpenJourneyToday?: () => void;
  onOpenMarket?: () => void;
  onRemeasure?: () => void;
  onGoAuth?: () => void;
  /** 휴대폰으로 결과 보관(가입) */
  initialBodyCode?: string;
  journeyProgress?: CodePlanJourneyProgress | null;
}

function knobPercent(percentLeft: number): number {
  return Math.max(0, Math.min(100, 100 - percentLeft));
}

/** 오늘 할 일 카드의 한 줄. position:relative 라 버튼의 ::after 가 이 줄을 덮습니다. */
const HOME_TODAY_ROW: CSSProperties = {
  position: 'relative',
  display: 'flex',
  alignItems: 'center',
  gap: '14px',
  padding: '15px 0',
};
const HOME_TODAY_TITLE: CSSProperties = {
  fontSize: '1.0625rem',
  margin: '0 0 3px',
  fontWeight: 800,
  wordBreak: 'keep-all',
};
const HOME_TODAY_DETAIL: CSSProperties = {
  margin: 0,
  color: 'rgba(255,255,255,.82)',
  fontSize: '0.8125rem',
  lineHeight: 1.45,
  wordBreak: 'keep-all',
};
const HOME_TODAY_PILL: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: '2px',
  flexShrink: 0,
  minHeight: '44px',
  padding: '0 14px 0 16px',
  border: 0,
  borderRadius: '999px',
  background: '#ffffff',
  color: BRAND.green,
  fontFamily: 'inherit',
  fontSize: '0.875rem',
  fontWeight: 800,
  cursor: 'pointer',
};

export function HomeScreen({
  questionnaireId,
  isLoggedIn = false,
  isPaid = false,
  onResultLoad,
  onStartCare,
  onOpenRoutine,
  onOpenJourneyToday,
  onOpenMarket,
  onRemeasure,
  onGoAuth,
  initialBodyCode,
  journeyProgress = null,
}: HomeScreenProps) {
  // 홈은 기본으로 전부 펼쳐 둡니다. 접기는 원할 때만 쓰는 선택지입니다.
  const [detailsOpen, setDetailsOpen] = useState(true);
  const data = useResultData(questionnaireId, isLoggedIn, onResultLoad, initialBodyCode);

  if (initialBodyCode) preloadCharacterImage(initialBodyCode);

  if (data.isLoading) {
    const earlyImage = getCharacterStorageUrl(initialBodyCode);
    return (
      <Card padding="26px 20px 22px" style={{ textAlign: 'center' }}>
        {earlyImage && (
          <img src={earlyImage} alt="" style={{ width: '130px', height: '190px', objectFit: 'contain', margin: '0 auto 18px', display: 'block' }} />
        )}
        {initialBodyCode && (
          <div style={{ fontSize: '2.625rem', lineHeight: 1, letterSpacing: '-1px', fontWeight: 800, color: BRAND.green }}>
            {initialBodyCode}
          </div>
        )}
        <p style={{ marginTop: '14px', color: BRAND.muted, fontSize: '0.8125rem' }}>결과를 불러오는 중...</p>
      </Card>
    );
  }
  if (data.error || !data.result) {
    return (
      <Card>
        <PageTitle eyebrow="RESULT" title="결과를 찾을 수 없습니다" lead={data.error ?? '결과 화면에서 다시 진입해 주세요.'} />
        {onRemeasure && <CTA onClick={onRemeasure}>mebody Code 다시 확인하기</CTA>}
      </Card>
    );
  }

  const primaryAxis = data.axisRows[0];
  const axisCodeLine =
    data.axisDetails.length > 0 ? data.axisDetails.map((d) => d.code).join(' · ') : data.bodyCode;
  const tendencyLine =
    data.axisDetails.length > 0 ? `${axisCodeLine} — ${data.summaryLine}` : data.summaryLine;
  const careMinutes = data.recommendedStartMinutes;
  const journey = journeyProgress;
  const hasJourney = Boolean(journey && journey.total > 0);
  const remaining = hasJourney
    ? Math.max(0, (journey?.total ?? 0) - (journey?.completed ?? 0))
    : 1;
  const todayDone = hasJourney && remaining === 0;
  const openToday = () => {
    if (onOpenJourneyToday) onOpenJourneyToday();
    else if (journey?.onOpen) journey.onOpen();
    else onOpenRoutine?.();
  };

  return (
    <div style={{ display: 'grid', gap: '14px' }}>
      {/* 어제 미완료 리마인더 */}
      {journeyProgress?.yesterdayIncomplete && (
        <button
          type="button"
          onClick={openToday}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '12px',
            width: '100%',
            border: `1px solid ${SURFACE.hairline}`,
            borderRadius: '16px',
            background: '#FFF8EB',
            padding: '14px 16px',
            cursor: 'pointer',
            fontFamily: 'inherit',
            textAlign: 'left',
          }}
        >
          <span>
            <strong style={{ display: 'block', fontSize: '0.875rem', color: BRAND.text, fontWeight: 800 }}>
              어제 미완료 · 이어서
            </strong>
            <span style={{ fontSize: '0.75rem', color: BRAND.muted, fontWeight: 600 }}>
              밀린 미션부터 가볍게 이어서 해보세요
            </span>
          </span>
          <ChevronRight size={18} color={BRAND.green} />
        </button>
      )}

      {/* 오늘 할 일 1개 — 최상단 고정 */}
      {/* 오늘 할 일 — 한 칸에 [루틴] / [미션] 두 줄.
          루틴이 진행 중이면 루틴을 위에 둡니다(프로그램이 상위, 오늘 미션이 그 안의 하루).
          루틴이 없으면 미션 한 줄만 나와 신규 사용자 화면은 짧게 유지됩니다.
          버튼은 오른쪽 작은 알약이지만 터치는 **줄 전체**가 받습니다(.mebody-card-hit) —
          하루의 주 동작을 엄지가 닿기 힘든 오른쪽으로 몰지 않으려는 것입니다. */}
      <Card tone="green" padding="2px 20px">
        {hasJourney && (
          <div style={HOME_TODAY_ROW}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <h2 style={HOME_TODAY_TITLE}>{PRODUCT.program}</h2>
              <p style={HOME_TODAY_DETAIL}>
                {`DAY ${journey?.dayNo ?? 1} / ${journey?.totalDays ?? 14}`}
                {typeof journey?.progress === 'number' ? ` · ${Math.round(journey.progress)}% 진행` : ''}
              </p>
            </div>
            <button
              type="button"
              className="mebody-card-hit"
              onClick={isLoggedIn ? onOpenRoutine : onGoAuth}
              style={HOME_TODAY_PILL}
            >
              루틴 보기
              <ChevronRight size={16} />
            </button>
          </div>
        )}

        <div style={hasJourney ? { ...HOME_TODAY_ROW, borderTop: '1px solid rgba(255,255,255,.18)' } : HOME_TODAY_ROW}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <h2 style={HOME_TODAY_TITLE}>
              {todayDone ? '오늘의 미션 완료' : hasJourney ? `오늘의 미션 ${remaining}개` : '오늘의 미션 1개'}
            </h2>
            <p style={HOME_TODAY_DETAIL}>
              {todayDone
                ? `${journey?.dayNo ?? ''}일차를 마쳤어요`
                : hasJourney
                  ? `약 ${careMinutes}분 · ${journey?.completed ?? 0}/${journey?.total ?? 0} 완료`
                  : `약 ${careMinutes}분 · ${data.oneLineAction}`}
            </p>
          </div>
          <button
            type="button"
            className="mebody-card-hit"
            onClick={hasJourney ? openToday : onStartCare}
            style={HOME_TODAY_PILL}
          >
            {todayDone ? '기록 보기' : hasJourney ? '이어서' : '시작하기'}
            <ChevronRight size={16} />
          </button>
        </div>
      </Card>

      {/* 결과 요약 + 한 줄 액션 (항상 같은 자리) */}
      <Card padding="22px 20px 18px" style={{ textAlign: 'center', position: 'relative', overflow: 'hidden' }}>
        <span style={{ position: 'absolute', width: '160px', height: '160px', left: '-60px', top: '-40px', borderRadius: '50%', background: '#EEF4EC' }} />
        <div style={{ position: 'relative' }}>
          {data.characterImage && (
            <img
              src={data.characterImage}
              alt={data.characterName}
              onError={() => data.handleImageError(data.characterImage)}
              style={{ width: '96px', height: '140px', objectFit: 'contain', margin: '0 auto 12px', display: 'block' }}
            />
          )}
          <div style={{ fontSize: '2.25rem', lineHeight: 1, letterSpacing: '-1px', fontWeight: 800, color: BRAND.green, marginBottom: '10px' }}>
            {data.bodyCode}
          </div>
          <Chip tone="solid">{data.characterName}</Chip>
          {data.identityTitle && (
            <p style={{ margin: '10px 0 0', color: BRAND.green, fontSize: '0.875rem', fontWeight: 800, wordBreak: 'keep-all' }}>
              {data.identityTitle}
            </p>
          )}
          <p style={{ margin: '10px 0 0', color: BRAND.muted, fontSize: '0.84375rem', lineHeight: 1.55, wordBreak: 'keep-all' }}>
            {data.summaryLine}
          </p>

          {/* 결과 한 줄 액션 — 고정 자리 */}
          <div
            style={{
              marginTop: '14px',
              borderRadius: '14px',
              background: SURFACE.subtle,
              padding: '12px 14px',
              textAlign: 'left',
            }}
          >
            <div style={{ fontSize: '0.6875rem', fontWeight: 800, letterSpacing: '0.06em', color: BRAND.green, marginBottom: '4px' }}>
              지금 바로 할 수 있는 것
            </div>
            <div style={{ fontSize: '0.875rem', fontWeight: 800, color: BRAND.text, wordBreak: 'keep-all', lineHeight: 1.45 }}>
              {data.oneLineAction}
            </div>
          </div>

          {/* 4축은 공유 카드와 한 박스에 둡니다 — 공유되는 내용이 곧 이 축이라
              따로 떼어 접어두면 무엇을 공유하는지 보이지 않습니다. */}
          {data.axisRows.length > 0 && (
            <div style={{ marginTop: '16px', textAlign: 'left' }}>
              <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: '10px', marginBottom: '12px' }}>
                <strong style={{ fontSize: '0.9375rem', fontWeight: 800, color: BRAND.text }}>4축 상세 결과</strong>
                <span style={{ fontSize: '0.75rem', color: BRAND.muted, fontWeight: 700, flexShrink: 0 }}>중앙에 가까울수록 균형</span>
              </div>
              <div style={{ display: 'grid', gap: '14px' }}>
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
            </div>
          )}

          <ResultShareCard
            embedded
            axes={data.axisRows.map((row) => ({
              title: row.title,
              labelLeft: row.labelLeft,
              labelRight: row.labelRight,
              percentLeft: row.percentLeft,
            }))}
            bodyCode={data.bodyCode}
            characterName={data.characterName}
            summaryLine={data.summaryLine}
            tendencyLine={tendencyLine}
            shareTitle={data.shareTitle ?? undefined}
            shareDescription={data.shareDescription ?? undefined}
          />
        </div>
      </Card>

      {/* 나머지 접기 */}
      <button
        type="button"
        onClick={() => setDetailsOpen((v) => !v)}
        aria-expanded={detailsOpen}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '6px',
          width: '100%',
          minHeight: '44px',
          border: `1px solid ${SURFACE.hairline}`,
          borderRadius: '14px',
          background: BRAND.card,
          color: BRAND.green,
          fontWeight: 800,
          fontSize: '0.875rem',
          fontFamily: 'inherit',
          cursor: 'pointer',
        }}
      >
        {detailsOpen ? '간단히 보기' : '가이드·마켓 더 보기'}
        {detailsOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
      </button>

      {detailsOpen && (
        <>

          <Card>
            <SectionHeading kicker="가이드" title={`${PRODUCT.mark} 자세 사용 설명서`} />
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
                    <div style={{ fontSize: '0.875rem', fontWeight: 800, wordBreak: 'keep-all' }}>{video.title}</div>
                    <div style={{ fontSize: '0.75rem', color: BRAND.muted, marginTop: '4px', wordBreak: 'keep-all' }}>{video.subtitle}</div>
                    <div style={{ fontSize: '0.8125rem', color: BRAND.green, fontWeight: 800, marginTop: '6px', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                      유튜브에서 보기 <ExternalLink size={12} />
                    </div>
                  </div>
                </a>
              ))}
            </div>
          </Card>

          <Card>
            <SectionHeading kicker="마켓" title="결과에 맞는 용품" />
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              {data.storeItems.slice(0, 2).map((item) => (
                <div
                  key={item.name}
                  style={{
                    position: 'relative',
                    border: `1px solid ${SURFACE.hairline}`,
                    borderRadius: '18px',
                    padding: '12px',
                    background: BRAND.card,
                  }}
                >
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
                      <span style={{ fontSize: '0.75rem', color: '#B4C0B6' }}>제품 이미지</span>
                    )}
                  </div>
                  <small style={{ color: BRAND.muted, fontSize: '0.75rem' }}>{item.badge}</small>
                  <h3 style={{ fontSize: '0.875rem', margin: '5px 0', fontWeight: 800, wordBreak: 'keep-all' }}>{item.name}</h3>
                  <strong style={{ fontSize: '0.875rem', color: BRAND.green }}>{item.priceLabel}</strong>
                  {/*
                    카드 전체가 마켓으로 가는 버튼입니다.
                    이전에는 카드가 아무 반응이 없고 작은 '+' 만 조용히 장바구니에 담았는데,
                    홈에는 장바구니로 가는 길이 없어서 담긴 것을 확인할 수가 없었습니다.
                    홈은 보여주기만 하고, 담기는 마켓에서 합니다.
                    (<h3> 를 <button> 안에 넣을 수 없으므로 덮는 버튼을 씁니다)
                  */}
                  {onOpenMarket && (
                    <button
                      type="button"
                      onClick={onOpenMarket}
                      aria-label={`${item.name} — 마켓에서 보기`}
                      style={{
                        position: 'absolute',
                        inset: 0,
                        border: 0,
                        borderRadius: '18px',
                        background: 'transparent',
                        cursor: 'pointer',
                      }}
                    />
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

          <AdSlot
            isPaid={isPaid}
            placement="result_bottom"
            house={{
              title: '14일 루틴으로 이어서 해보세요',
              body: '내 코드에 맞는 미션이 하루 한 가지씩 배정됩니다. 첫 14일은 무료입니다.',
            }}
          />

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
                {isLoggedIn ? COPY_CTA.missionStart : COPY_CTA.authSignup} <ChevronRight size={18} />
              </CTA>
            }
          />

          {onRemeasure && (
            <button
              type="button"
              onClick={onRemeasure}
              style={{ border: 0, background: 'transparent', minHeight: '44px', padding: '10px 4px', fontSize: '0.8125rem', fontWeight: 800, color: BRAND.muted, fontFamily: 'inherit', cursor: 'pointer' }}
            >
              mebody Code 다시 확인하기
            </button>
          )}
        </>
      )}
    </div>
  );
}
