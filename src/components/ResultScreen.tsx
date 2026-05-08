import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, ChevronRight, ExternalLink, X } from 'lucide-react';
import { fetchQuestionnaireResult, fetchQuestions, type BodyCodeContent, type Question, type QuestionnaireResponse } from '../api/questionnaire';
import {
  fetchAppContent,
  fetchAppImages,
} from '../api/content';
import { AXIS_GREEN_THEME } from '../data/axisTheme';
import { SUPABASE_STORAGE_PUBLIC } from '../lib/supabase';
import { ScrollIndicator } from './ScrollIndicator';
import { characterNames, getAxisScoreBreakdown } from '../utils/bodyCodeCalculator';
import { LOCAL_FALLBACK_CHARACTER_IMAGE, resolveCharacterImageUrl } from '../utils/characterImages';
import { useMediaQuery } from '../utils/useMediaQuery';

type AxisKey = 'neck' | 'shoulder' | 'pelvis' | 'flexibility';
type ResultWithContent = QuestionnaireResponse & { body_code_content?: BodyCodeContent | null };

type AxisRow = {
  key: AxisKey;
  title: string;
  labelLeft: string;
  labelRight: string;
  leftColor: string;
  rightColor: string;
  surface: string;
  percentLeft: number;
  percentRight: number;
  summary: string;
};

type YoutubeVideo = {
  videoId: string;
  title: string;
  subtitle: string;
  url: string;
  thumbnail: string;
};

type StoreItem = {
  name: string;
  desc: string;
  priceLabel: string;
  badge: string;
  ctaLabel: string;
};

type ResultSaveStatus = 'idle' | 'saving' | 'saved' | 'failed';

interface ResultScreenProps {
  questionnaireId?: string;
  onRestart?: () => void;
  onBack?: () => void;
  onResultLoad?: (bodyCode: string) => void;
  isLoggedIn?: boolean;
  isAdmin?: boolean;
  onGoAuth?: () => void;
  onContinue?: () => void;
  onPreviewContinue?: () => void;
  resultSaveStatus?: ResultSaveStatus;
}

const AXIS_META: Record<
  AxisKey,
  {
    title: string;
    left: string;
    right: string;
    leftColor: string;
    rightColor: string;
    surface: string;
  }
> = {
  neck: {
    title: '목 위치',
    left: '전방',
    right: '중앙',
    leftColor: AXIS_GREEN_THEME.primary,
    rightColor: AXIS_GREEN_THEME.deep,
    surface: AXIS_GREEN_THEME.cardSurfaces[0],
  },
  shoulder: {
    title: '어깨 높이',
    left: '오른쪽 높음',
    right: '왼쪽 높음',
    leftColor: AXIS_GREEN_THEME.primary,
    rightColor: AXIS_GREEN_THEME.deep,
    surface: AXIS_GREEN_THEME.cardSurfaces[1],
  },
  pelvis: {
    title: '골반 회전',
    left: '오른쪽 회전',
    right: '왼쪽 회전',
    leftColor: AXIS_GREEN_THEME.primary,
    rightColor: AXIS_GREEN_THEME.deep,
    surface: AXIS_GREEN_THEME.cardSurfaces[2],
  },
  flexibility: {
    title: '하체 유연성',
    left: '유연',
    right: '뻣뻣',
    leftColor: AXIS_GREEN_THEME.primary,
    rightColor: AXIS_GREEN_THEME.deep,
    surface: AXIS_GREEN_THEME.cardSurfaces[3],
  },
};

const DEFAULT_YOUTUBE_VIDEOS: YoutubeVideo[] = [
  {
    videoId: 'OU4CdtJWPZs',
    title: '당신도 아마 일자목일 겁니다. 일자목 5분만에 C자 만드는 방법',
    subtitle: '목 정렬과 거북목 완화를 위한 mebody 루틴',
    url: 'https://www.youtube.com/watch?v=OU4CdtJWPZs',
    thumbnail: 'https://i.ytimg.com/vi/OU4CdtJWPZs/hqdefault.jpg',
  },
  {
    videoId: 'Q6WaIrMdZRw',
    title: '코어 근육 그렇게 운동하는 거 아닙니다. 2단계 코어 강화 루틴',
    subtitle: '코드 플랜과 함께 보기 좋은 코어 안정화 루틴',
    url: 'https://www.youtube.com/watch?v=Q6WaIrMdZRw',
    thumbnail: 'https://i.ytimg.com/vi/Q6WaIrMdZRw/hqdefault.jpg',
  },
];

const DEFAULT_STORE_ITEMS: StoreItem[] = [
  {
    name: 'MEBODY 리커버리 폼롤러',
    desc: '전신 근막 이완과 루틴 전후 워밍업에 쓰기 좋은 기본형 폼롤러입니다.',
    priceLabel: '39,000원',
    badge: 'BEST',
    ctaLabel: '구매하기 준비 중',
  },
  {
    name: 'MEBODY 딥 마사지볼 세트',
    desc: '어깨, 둔근, 발바닥처럼 국소 자극이 필요한 부위에 쓰는 더블볼 세트입니다.',
    priceLabel: '18,000원',
    badge: 'RECOVERY',
    ctaLabel: '구매하기 준비 중',
  },
  {
    name: 'MEBODY 스트레칭 밴드',
    desc: '하체 유연성과 골반 정렬 루틴에 맞춰 가볍게 당길 수 있는 저항 밴드입니다.',
    priceLabel: '24,000원',
    badge: 'ROUTINE',
    ctaLabel: '구매하기 준비 중',
  },
  {
    name: 'MEBODY 밸런스 서포트 쿠션',
    desc: '앉는 자세에서 체중 분산을 도와 장시간 한 자세에 머무는 시간을 줄여줍니다.',
    priceLabel: '32,000원',
    badge: 'POSTURE',
    ctaLabel: '구매하기 준비 중',
  },
];

function pickSummaryLine(content: BodyCodeContent | null): string {
  const fromDescription = content?.description
    ?.split(/[.\n]/)
    .map((sentence) => sentence.trim())
    .find(Boolean);

  return fromDescription || '현재 몸이 가장 자주 쓰는 보상 패턴을 기준으로 mebody 코드를 정리했습니다.';
}

function getAxisSentence(content: BodyCodeContent | null, key: AxisKey, fallback: string) {
  if (key === 'neck') return content?.neck_result || fallback;
  if (key === 'shoulder') return content?.shoulder_result || fallback;
  if (key === 'pelvis') return content?.pelvis_result || fallback;
  return content?.flexibility_result || fallback;
}

function renderPercentBar(percentLeft: number, percentRight: number, leftColor: string, rightColor: string) {
  const leftTextColor = percentLeft >= 16 ? '#ffffff' : '#111827';
  const rightTextColor = percentRight >= 16 ? '#ffffff' : '#111827';

  return (
    <div
      style={{
        position: 'relative',
        height: '24px',
        borderRadius: '999px',
        overflow: 'hidden',
        background: AXIS_GREEN_THEME.track,
      }}
    >
      <div style={{ display: 'flex', width: '100%', height: '100%' }}>
        <div style={{ width: `${percentLeft}%`, background: leftColor }} />
        <div style={{ width: `${percentRight}%`, background: rightColor }} />
      </div>
      <div
        style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 10px',
          fontSize: '12px',
          fontWeight: 800,
          letterSpacing: '-0.01em',
        }}
      >
        <span style={{ color: leftTextColor }}>{percentLeft}%</span>
        <span style={{ color: rightTextColor }}>{percentRight}%</span>
      </div>
    </div>
  );
}

function normalizeStorageImageUrl(raw?: string | null): string {
  const trimmed = String(raw ?? '').trim();
  if (!trimmed || trimmed.includes('your-bucket.supabase.co')) return '';

  if (/^https?:\/\//i.test(trimmed)) {
    if (trimmed.includes('/storage/v1/object/public/images/')) {
      const path = trimmed.split('/storage/v1/object/public/images/')[1] ?? '';
      if (path === 'bodyTypesImage.png' && SUPABASE_STORAGE_PUBLIC) {
        return `${SUPABASE_STORAGE_PUBLIC}/body-types/bodyTypesImage.png`;
      }
    }
    return trimmed;
  }

  if (!SUPABASE_STORAGE_PUBLIC) return '';
  let path = trimmed.replace(/^\/+/, '');
  if (path.startsWith('images/')) path = path.replace(/^images\/+/, '');
  if (path === 'bodyTypesImage.png') path = 'body-types/bodyTypesImage.png';
  return `${SUPABASE_STORAGE_PUBLIC}/${path}`;
}

function pickUsableImageUrl(candidates: Array<string | undefined>, failedImageUrls: Set<string>): string {
  for (const candidate of candidates) {
    const normalized = normalizeStorageImageUrl(candidate);
    if (normalized && !failedImageUrls.has(normalized)) return normalized;
  }
  return '';
}

function extractYoutubeVideoId(value?: string): string {
  const raw = String(value ?? '').trim();
  if (!raw) return '';
  if (/^[a-zA-Z0-9_-]{11}$/.test(raw)) return raw;

  try {
    const url = new URL(raw);
    if (url.hostname.includes('youtu.be')) return url.pathname.replace(/^\//, '').slice(0, 11);
    if (url.searchParams.get('v')) return String(url.searchParams.get('v')).slice(0, 11);
    const match = url.pathname.match(/\/shorts\/([a-zA-Z0-9_-]{11})/);
    if (match) return match[1];
  } catch {
    return '';
  }

  return '';
}

function parseYoutubeVideos(raw: unknown): YoutubeVideo[] {
  const videos = Array.isArray(raw) ? raw : [];
  const normalized = videos
    .map((item, index) => {
      if (!item || typeof item !== 'object') return null;
      const videoId = extractYoutubeVideoId('videoId' in item ? String(item.videoId ?? '') : 'url' in item ? String(item.url ?? '') : '');
      if (!videoId) return null;
      const title = typeof item.title === 'string' && item.title.trim() ? item.title.trim() : `추천 루틴 ${index + 1}`;
      const subtitle = typeof item.subtitle === 'string' && item.subtitle.trim() ? item.subtitle.trim() : '결과와 함께 보기 좋은 mebody 루틴';
      return {
        videoId,
        title,
        subtitle,
        url: `https://www.youtube.com/watch?v=${videoId}`,
        thumbnail: `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
      };
    })
    .filter((item): item is YoutubeVideo => Boolean(item));

  return normalized.slice(0, 2);
}

function buildStoreItems(products: BodyCodeContent['health_products'] | undefined, bodyCode: string): StoreItem[] {
  const productList = Array.isArray(products) ? products : [];
  if (productList.length === 0) return DEFAULT_STORE_ITEMS;

  const fallbackPrices = ['39,000원', '18,000원', '24,000원', '32,000원'];
  return productList.slice(0, 4).map((item, index) => ({
    name: item?.name?.trim() || `${bodyCode} 추천 용품 ${index + 1}`,
    desc: item?.desc?.trim() || '결과 코드에 맞춰 사용할 수 있는 회복/자세 보조 용품입니다.',
    priceLabel: fallbackPrices[index % fallbackPrices.length],
    badge: index === 0 ? `${bodyCode} PICK` : 'MEBODY STORE',
    ctaLabel: '구매하기 준비 중',
  }));
}

export function ResultScreen({
  questionnaireId,
  onRestart,
  onBack,
  onResultLoad,
  isLoggedIn = false,
  isAdmin = false,
  onGoAuth,
  onContinue,
  onPreviewContinue,
  resultSaveStatus = 'idle',
}: ResultScreenProps) {
  const isDesktopMockup = useMediaQuery('(min-width: 768px)');
  const [result, setResult] = useState<ResultWithContent | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [appImages, setAppImages] = useState<Record<string, string>>({});
  const [appContent, setAppContent] = useState<Record<string, string | unknown>>({});
  const [failedImageUrls, setFailedImageUrls] = useState<Set<string>>(new Set());
  const [scoringQuestions, setScoringQuestions] = useState<Question[]>([]);
  const [axisModalOpen, setAxisModalOpen] = useState(false);
  const [bodyTypesModalOpen, setBodyTypesModalOpen] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const bodyTypesRef = useRef<HTMLElement | null>(null);
  const routineRef = useRef<HTMLElement | null>(null);
  const storeRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    fetchAppImages().then(setAppImages).catch(() => setAppImages({}));
    fetchAppContent(['result_youtube_videos']).then(setAppContent).catch(() => setAppContent({}));
    fetchQuestions().then(setScoringQuestions).catch(() => setScoringQuestions([]));
  }, []);

  useEffect(() => {
    if (!questionnaireId) {
      setIsLoading(false);
      return;
    }

    let cancelled = false;
    setIsLoading(true);
    setError(null);

    fetchQuestionnaireResult(questionnaireId)
      .then((data) => {
        if (cancelled) return;
        const nextResult = (data as ResultWithContent) ?? null;
        setResult(nextResult);
        if (nextResult?.calculated_code) onResultLoad?.(nextResult.calculated_code);
      })
      .catch((loadError) => {
        if (cancelled) return;
        console.error('Failed to load result:', loadError);
        setError('결과를 찾을 수 없습니다.');
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [questionnaireId, onResultLoad]);

  const handleImageError = useCallback((url: string) => {
    setFailedImageUrls((prev) => new Set(prev).add(url));
  }, []);

  const bodyCode = result?.calculated_code || '----';
  const content = result?.body_code_content ?? null;
  const summaryLine = pickSummaryLine(content);
  const characterName = content?.character_name || characterNames[bodyCode] || '나의 mebody 코드';
  const characterImage = resolveCharacterImageUrl(bodyCode, appImages, failedImageUrls);
  const axisPercent = result?.answers ? getAxisScoreBreakdown(result.answers, scoringQuestions) : null;

  const axisRows = useMemo<AxisRow[]>(() => {
    if (!axisPercent) return [];

    return (Object.keys(AXIS_META) as AxisKey[]).map((key) => {
      const meta = AXIS_META[key];
      const percentLeft = axisPercent[key].percentLeft;
      const percentRight = axisPercent[key].percentRight;
      const dominantLabel = percentLeft >= percentRight ? meta.left : meta.right;
      return {
        key,
        title: meta.title,
        labelLeft: meta.left,
        labelRight: meta.right,
        leftColor: meta.leftColor,
        rightColor: meta.rightColor,
        surface: meta.surface,
        percentLeft,
        percentRight,
        summary: getAxisSentence(content, key, `${meta.title} 축에서 ${dominantLabel} 방향이 더 강하게 나타났습니다.`),
      };
    });
  }, [axisPercent, content]);

  const axisDetails = useMemo(() => {
    if (bodyCode.length !== 4) return [];

    return [
      { key: 'neck' as const, code: bodyCode[0], title: '목 위치', description: getAxisSentence(content, 'neck', '목 위치 정렬 패턴입니다.') },
      { key: 'shoulder' as const, code: bodyCode[1], title: '어깨 높이', description: getAxisSentence(content, 'shoulder', '어깨 높이 패턴입니다.') },
      { key: 'pelvis' as const, code: bodyCode[2], title: '골반 회전', description: getAxisSentence(content, 'pelvis', '골반 회전 패턴입니다.') },
      { key: 'flexibility' as const, code: bodyCode[3], title: '하체 유연성', description: getAxisSentence(content, 'flexibility', '하체 유연성 패턴입니다.') },
    ];
  }, [bodyCode, content]);

  const ctaEyebrow = isLoggedIn ? 'CODE PLAN · MISSION' : 'CODE PLAN';
  const ctaTitle = isLoggedIn ? '코드 플랜 및 오늘의 미션' : '회원가입 후 내 코드 플랜 받기';
  const ctaButtonLabel = isLoggedIn ? '코드 플랜 및 오늘의 미션 보기' : '회원가입 후 내 코드 플랜 받기';
  const ctaItems = isLoggedIn
    ? [
        '오늘의 미션 수행률과 지금 해야 할 액션을 이어서 확인합니다.',
        '나의 mebody 코드 가이드와 자세 사용 설명서로 연결됩니다.',
        '맞춤 15분 케어 루틴을 바로 확인할 수 있습니다.',
      ]
    : [
        '지난 결과를 저장하고 재방문 시 바로 이어서 볼 수 있습니다.',
        '나의 mebody 코드 가이드와 다음 장 코드 플랜이 연결됩니다.',
        '맞춤 15분 케어 루틴과 이후 확장 기능을 이어서 확인할 수 있습니다.',
      ];

  const bodyTypesImageUrl = useMemo(
    () =>
      pickUsableImageUrl(
        [
          appImages.body_types_image,
          `${SUPABASE_STORAGE_PUBLIC}/body-types/bodyTypesImage.png`,
        ],
        failedImageUrls,
      ),
    [appImages.body_types_image, failedImageUrls],
  );

  const youtubeVideos = useMemo(() => {
    const parsed = parseYoutubeVideos(appContent.result_youtube_videos);
    return parsed.length ? parsed : DEFAULT_YOUTUBE_VIDEOS;
  }, [appContent]);

  const storeItems = useMemo(() => buildStoreItems(content?.health_products, bodyCode), [content?.health_products, bodyCode]);

  const handleContinue = () => {
    if (isLoggedIn) {
      onContinue?.();
      return;
    }
    onGoAuth?.();
  };

  const scrollToSection = (target: 'bodyTypes' | 'routine' | 'store') => {
    const ref = target === 'bodyTypes' ? bodyTypesRef : target === 'routine' ? routineRef : storeRef;
    ref.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };



  if (isLoading) {
    return (
      <div className="bg-white rounded-3xl shadow-xl overflow-hidden" style={{ minHeight: '100dvh' }}>
        <div style={{ height: '100%', display: 'flex', flexDirection: 'column', padding: '28px 24px', gap: '18px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ width: '126px', height: '42px', borderRadius: '999px', background: '#ecfdf5' }} />
            <div style={{ width: '78px', height: '42px', borderRadius: '999px', background: '#f8fafc' }} />
          </div>
          <div
            style={{
              borderRadius: '28px',
              border: `1px solid ${AXIS_GREEN_THEME.border}`,
              background: 'linear-gradient(135deg, rgba(236,253,245,0.96) 0%, rgba(255,255,255,0.98) 100%)',
              padding: '22px',
              display: 'grid',
              gap: '14px',
            }}
          >
            <div style={{ fontSize: '11px', fontWeight: 900, letterSpacing: '0.14em', color: '#059669' }}>RESULT</div>
            <div style={{ height: '28px', width: '64%', borderRadius: '999px', background: '#d1fae5' }} />
            <div style={{ height: '14px', width: '92%', borderRadius: '999px', background: '#f1f5f9' }} />
            <div style={{ height: '14px', width: '74%', borderRadius: '999px', background: '#f1f5f9' }} />
          </div>
          <div style={{ display: 'grid', gap: '12px' }}>
            {Array.from({ length: 3 }).map((_, index) => (
              <div key={index} style={{ height: '86px', borderRadius: '22px', border: `1px solid ${AXIS_GREEN_THEME.border}`, background: '#ffffff' }} />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white rounded-3xl shadow-xl overflow-hidden flex flex-col items-center justify-center px-6" style={{ minHeight: '100dvh' }}>
        <div className="text-red-500 mb-4">{error}</div>
        {onRestart && (
          <button onClick={onRestart} className="bg-emerald-500 text-white px-6 py-3 rounded-xl">
            다시 시작하기
          </button>
        )}
      </div>
    );
  }

  if (!result) {
    return (
      <div className="bg-white rounded-3xl shadow-xl overflow-hidden flex items-center justify-center" style={{ minHeight: '100dvh' }}>
        <div className="text-gray-500">결과를 찾을 수 없습니다.</div>
      </div>
    );
  }

  return (
    <div
      style={{
        position: 'relative',
        overflow: 'hidden',
        minHeight: '100dvh',
        borderRadius: isDesktopMockup ? '32px' : 0,
        background: 'linear-gradient(145deg, #ecfdf5 0%, #f3fdfb 42%, #f0fdfa 100%)',
        boxShadow: '0 24px 60px rgba(15, 23, 42, 0.13)',
      }}
    >
      <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none' }}>
        <div
          style={{
            position: 'absolute',
            top: '48px',
            left: '-80px',
            width: '280px',
            height: '280px',
            borderRadius: '999px',
            background: 'rgba(52, 211, 153, 0.15)',
            filter: 'blur(60px)',
          }}
        />
        <div
          style={{
            position: 'absolute',
            bottom: '52px',
            right: '-96px',
            width: '320px',
            height: '320px',
            borderRadius: '999px',
            background: 'rgba(45, 212, 191, 0.14)',
            filter: 'blur(72px)',
          }}
        />
      </div>

      <div
        style={{
          position: 'relative',
          zIndex: 1,
          display: 'flex',
          height: '100%',
          flexDirection: 'column',
          fontFamily: '"SUIT Variable","Pretendard Variable","Noto Sans KR",sans-serif',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            padding: '22px 24px 18px',
            background: 'rgba(255,255,255,0.52)',
            backdropFilter: 'blur(18px)',
          }}
        >
          {(onBack ?? onRestart) && (
            <button
              type="button"
              onClick={onBack ?? onRestart}
              style={{
                width: '38px',
                height: '38px',
                borderRadius: '999px',
                border: '1px solid rgba(255,255,255,0.42)',
                background: 'rgba(255,255,255,0.74)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#374151',
                cursor: 'pointer',
                boxShadow: '0 10px 20px rgba(15, 23, 42, 0.08)',
              }}
              title="뒤로"
            >
              <ArrowLeft size={18} />
            </button>
          )}
          <div style={{ minWidth: 0 }}>
            <h1 style={{ fontSize: '22px', fontWeight: 800, color: '#111827', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>나의 mebody 코드</h1>
          </div>
        </div>

        <div ref={scrollRef} style={{ flex: 1, overflowY: 'auto', padding: '18px 24px 24px', display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'grid', gap: '16px', margin: 'auto 0' }}>
            <section
              style={{
                borderRadius: '30px',
                background: 'rgba(255,255,255,0.80)',
                boxShadow: '0 24px 48px rgba(15, 23, 42, 0.12)',
                backdropFilter: 'blur(20px)',
                padding: '22px',
              }}
            >
              <div style={{ display: 'grid', gridTemplateColumns: '118px 1fr', gap: '18px', alignItems: 'start' }}>
                <div>
                  <div
                    style={{
                      width: '118px',
                      height: '144px',
                      borderRadius: '26px',
                      background: 'linear-gradient(135deg, rgba(236,253,245,0.96) 0%, rgba(255,255,255,0.96) 100%)',
                      border: '1px solid rgba(209,250,229,0.95)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      overflow: 'hidden',
                      boxShadow: '0 16px 30px rgba(15, 23, 42, 0.08)',
                      marginBottom: '10px',
                    }}
                  >
                    {characterImage && characterImage !== LOCAL_FALLBACK_CHARACTER_IMAGE ? (
                      <img
                        src={characterImage}
                        alt={bodyCode}
                        style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                        onError={() => handleImageError(characterImage)}
                      />
                    ) : (
                      <div style={{ fontSize: '34px', fontWeight: 800, color: '#059669' }}>{bodyCode}</div>
                    )}
                  </div>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: '30px', lineHeight: 1, fontWeight: 800, letterSpacing: '-0.04em', color: '#111827', marginBottom: '6px' }}>{bodyCode}</div>
                    <div style={{ fontSize: '15px', fontWeight: 700, color: '#374151', wordBreak: 'keep-all' }}>{characterName}</div>
                  </div>
                </div>

                <div style={{ display: 'grid', gap: '10px' }}>
                  {axisDetails.map((detail) => (
                    <div
                      key={detail.key}
                      style={{
                        borderRadius: '18px',
                        background: AXIS_META[detail.key].surface,
                        border: `1px solid ${AXIS_GREEN_THEME.border}`,
                        padding: '12px 14px',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                        <span
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            minWidth: '26px',
                            height: '26px',
                            borderRadius: '999px',
                            background: 'rgba(255,255,255,0.94)',
                            fontSize: '12px',
                            fontWeight: 800,
                            color: '#111827',
                          }}
                        >
                          {detail.code}
                        </span>
                        <div style={{ fontSize: '13px', fontWeight: 800, color: '#111827' }}>{detail.title}</div>
                      </div>
                      <div style={{ fontSize: '13px', lineHeight: 1.65, color: '#4b5563', wordBreak: 'keep-all' }}>{detail.description}</div>
                    </div>
                  ))}
                </div>
              </div>
            </section>




            <section
              ref={bodyTypesRef}
              style={{
                borderRadius: '22px',
                border: `1px solid ${AXIS_GREEN_THEME.border}`,
                background: '#ffffff',
                padding: '18px',
              }}
            >
              <div style={{ fontSize: '12px', fontWeight: 800, color: '#059669', marginBottom: '6px' }}>한 줄 이해</div>
              <div style={{ fontSize: '16px', lineHeight: 1.7, fontWeight: 700, color: '#111827', wordBreak: 'keep-all' }}>{summaryLine}</div>
            </section>

            <section
              onClick={() => axisRows.length > 0 && setAxisModalOpen(true)}
              style={{
                borderRadius: '22px',
                border: `1px solid ${AXIS_GREEN_THEME.borderStrong}`,
                background: '#ffffff',
                padding: '18px',
                cursor: axisRows.length > 0 ? 'pointer' : 'default',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', marginBottom: '14px' }}>
                <div>
                  <div style={{ fontSize: '11px', fontWeight: 800, letterSpacing: '0.14em', color: '#059669', marginBottom: '4px' }}>4 AXIS GRAPH</div>
                  <h2 style={{ fontSize: '19px', fontWeight: 800, color: '#111827' }}>4축 퍼센티지 그래프</h2>
                </div>
                <div style={{ fontSize: '12px', fontWeight: 700, color: '#6b7280' }}>탭해서 크게 보기</div>
              </div>

              <div style={{ display: 'grid', gap: '16px' }}>
                {axisRows.map((row) => (
                  <div key={row.key}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px', marginBottom: '7px' }}>
                      <div style={{ fontSize: '14px', fontWeight: 800, color: '#111827' }}>{row.title}</div>
                      <div style={{ fontSize: '12px', fontWeight: 700, color: '#6b7280' }}>{row.summary}</div>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', marginBottom: '7px', fontSize: '11px', fontWeight: 700, color: '#6b7280' }}>
                      <span>{row.labelLeft}</span>
                      <span>{row.labelRight}</span>
                    </div>
                    {renderPercentBar(row.percentLeft, row.percentRight, row.leftColor, row.rightColor)}
                  </div>
                ))}
              </div>
            </section>

            <section
              ref={routineRef}
              style={{
                borderRadius: '22px',
                border: `1px solid ${AXIS_GREEN_THEME.border}`,
                background: '#ffffff',
                padding: '18px',
              }}
            >
              <div style={{ fontSize: '11px', fontWeight: 800, letterSpacing: '0.14em', color: '#059669', marginBottom: '4px' }}>{ctaEyebrow}</div>
              <h2 style={{ fontSize: '19px', fontWeight: 800, color: '#111827', marginBottom: '10px' }}>{ctaTitle}</h2>
              <div style={{ display: 'grid', gap: '8px', marginBottom: '14px' }}>
                {ctaItems.map((item) => (
                  <div key={item} style={{ display: 'flex', gap: '10px', fontSize: '14px', lineHeight: 1.6, color: '#374151' }}>
                    <span style={{ color: '#10b981', fontWeight: 800 }}>•</span>
                    <span>{item}</span>
                  </div>
                ))}
              </div>
              <button
                type="button"
                onClick={handleContinue}
                style={{
                  display: 'inline-flex',
                  width: '100%',
                  height: '54px',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  borderRadius: '16px',
                  border: 'none',
                  background: 'linear-gradient(90deg, #10b981 0%, #14b8a6 100%)',
                  color: '#ffffff',
                  fontSize: '15px',
                  fontWeight: 800,
                  boxShadow: '0 14px 28px rgba(20,184,166,0.22)',
                  cursor: 'pointer',
                }}
              >
                {ctaButtonLabel}
                <ChevronRight size={18} />
              </button>
              {!isLoggedIn && onPreviewContinue && (
                <button
                  type="button"
                  onClick={onPreviewContinue}
                  style={{
                    marginTop: '10px',
                    width: '100%',
                    border: 'none',
                    background: 'transparent',
                    color: '#0f766e',
                    fontSize: '13px',
                    fontWeight: 700,
                    textDecoration: 'underline',
                    textUnderlineOffset: '3px',
                    cursor: 'pointer',
                  }}
                >
                  임시: 회원가입된 것처럼 다음 페이지 미리보기
                </button>
              )}
            </section>

            <section
              ref={storeRef}
              style={{
                borderRadius: '22px',
                border: `1px solid ${AXIS_GREEN_THEME.border}`,
                background: '#ffffff',
                padding: '18px',
              }}
            >
              <div style={{ fontSize: '11px', fontWeight: 800, letterSpacing: '0.14em', color: '#059669', marginBottom: '4px' }}>16 BODY TYPES</div>
              <h2 style={{ fontSize: '19px', fontWeight: 800, color: '#111827', marginBottom: '8px' }}>전체 16가지 체형 분류</h2>
              <p style={{ fontSize: '13px', lineHeight: 1.65, color: '#4b5563', marginBottom: '14px', wordBreak: 'keep-all' }}>
                전체 맵에서 나의 위치를 보고, 다른 코드와 어떤 차이가 있는지도 함께 확인할 수 있습니다.
              </p>
              {bodyTypesImageUrl ? (
                <button
                  type="button"
                  onClick={() => setBodyTypesModalOpen(true)}
                  style={{
                    width: '100%',
                    padding: 0,
                    border: `1px solid ${AXIS_GREEN_THEME.border}`,
                    borderRadius: '20px',
                    overflow: 'hidden',
                    background: '#f8fafc',
                    marginBottom: '10px',
                    cursor: 'zoom-in',
                  }}
                >
                  <img
                    src={bodyTypesImageUrl}
                    alt="전체 16가지 체형 분류"
                    style={{ width: '100%', display: 'block' }}
                    onError={() => handleImageError(bodyTypesImageUrl)}
                  />
                </button>
              ) : (
                <div style={{ borderRadius: '20px', border: `1px dashed ${AXIS_GREEN_THEME.borderStrong}`, background: 'rgba(244,251,249,0.96)', padding: '22px 18px', textAlign: 'center', color: '#4b5563', fontSize: '13px', lineHeight: 1.7, marginBottom: '10px' }}>
                  16가지 체형 전체 이미지를 아직 연결하지 않았습니다. 아래 코드 목록으로 먼저 전체 구성을 볼 수 있습니다.
                </div>
              )}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px', fontSize: '12px', color: '#4b5563' }}>
                <span>
                  내 코드: <strong style={{ color: '#047857' }}>{bodyCode}</strong> {characterNames[bodyCode] ? `· ${characterNames[bodyCode]}` : ''}
                </span>
                {bodyTypesImageUrl && <span style={{ fontWeight: 700, color: '#0f766e' }}>사진 탭해서 크게 보기</span>}
              </div>
            </section>

            <section
              style={{
                borderRadius: '22px',
                border: `1px solid ${AXIS_GREEN_THEME.border}`,
                background: '#ffffff',
                padding: '18px',
              }}
            >
              <div style={{ fontSize: '11px', fontWeight: 800, letterSpacing: '0.14em', color: '#059669', marginBottom: '4px' }}>MEBODY ROUTINE</div>
              <h2 style={{ fontSize: '19px', fontWeight: 800, color: '#111827', marginBottom: '12px' }}>추천 mebody 루틴</h2>
              <div style={{ display: 'grid', gap: '12px' }}>
                {youtubeVideos.map((video) => (
                  <a
                    key={video.videoId}
                    href={video.url}
                    target="_blank"
                    rel="noreferrer"
                    style={{
                      display: 'grid',
                      gridTemplateColumns: '132px 1fr',
                      gap: '14px',
                      borderRadius: '20px',
                      border: `1px solid ${AXIS_GREEN_THEME.border}`,
                      background: 'rgba(244,251,249,0.84)',
                      padding: '12px',
                      textDecoration: 'none',
                    }}
                  >
                    <div style={{ borderRadius: '14px', overflow: 'hidden', background: '#d1fae5', minHeight: '84px' }}>
                      <img src={video.thumbnail} alt={video.title} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                    </div>
                    <div style={{ minWidth: 0, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: '8px' }}>
                      <div>
                        <div style={{ fontSize: '14px', fontWeight: 800, lineHeight: 1.5, color: '#111827', wordBreak: 'keep-all', marginBottom: '6px' }}>{video.title}</div>
                        <div style={{ fontSize: '12px', lineHeight: 1.6, color: '#4b5563', wordBreak: 'keep-all' }}>{video.subtitle}</div>
                      </div>
                      <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '12px', fontWeight: 800, color: '#047857' }}>
                        유튜브에서 보기
                        <ExternalLink size={14} />
                      </div>
                    </div>
                  </a>
                ))}
              </div>
            </section>

            <section
              style={{
                borderRadius: '22px',
                border: `1px solid ${AXIS_GREEN_THEME.border}`,
                background: '#ffffff',
                padding: '18px',
              }}
            >
              <div style={{ fontSize: '11px', fontWeight: 800, letterSpacing: '0.14em', color: '#059669', marginBottom: '4px' }}>MEBODY STORE</div>
              <h2 style={{ fontSize: '19px', fontWeight: 800, color: '#111827', marginBottom: '8px' }}>건강/헬스 용품 스토어</h2>
              <p style={{ fontSize: '13px', lineHeight: 1.65, color: '#4b5563', marginBottom: '14px', wordBreak: 'keep-all' }}>
                결과 코드에 맞춰 같이 쓰면 좋은 회복/자세 보조 용품을 가상 스토어 형태로 구성했습니다.
              </p>
              <div style={{ display: 'grid', gap: '12px' }}>
                {storeItems.map((item) => (
                  <div
                    key={item.name}
                    style={{
                      borderRadius: '20px',
                      border: `1px solid ${AXIS_GREEN_THEME.border}`,
                      background: 'linear-gradient(135deg, rgba(255,255,255,1) 0%, rgba(244,251,249,0.88) 100%)',
                      padding: '16px',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px', marginBottom: '8px' }}>
                      <span style={{ fontSize: '10px', fontWeight: 800, letterSpacing: '0.14em', color: '#0f766e' }}>{item.badge}</span>
                      <span style={{ fontSize: '14px', fontWeight: 800, color: '#111827' }}>{item.priceLabel}</span>
                    </div>
                    <div style={{ fontSize: '16px', fontWeight: 800, color: '#111827', marginBottom: '6px', wordBreak: 'keep-all' }}>{item.name}</div>
                    <div style={{ fontSize: '13px', lineHeight: 1.65, color: '#4b5563', wordBreak: 'keep-all', marginBottom: '12px' }}>{item.desc}</div>
                    <button
                      type="button"
                      disabled
                      style={{
                        width: '100%',
                        height: '44px',
                        borderRadius: '14px',
                        border: `1px solid ${AXIS_GREEN_THEME.border}`,
                        background: 'rgba(228,244,240,0.88)',
                        color: '#0f766e',
                        fontSize: '13px',
                        fontWeight: 800,
                        cursor: 'default',
                      }}
                    >
                      {item.ctaLabel}
                    </button>
                  </div>
                ))}
              </div>
            </section>
          </div>
        </div>
        <ScrollIndicator containerRef={scrollRef} bottomOffset="72px" />
      </div>

      {axisModalOpen && (
        <div
          onClick={() => setAxisModalOpen(false)}
          style={{
            position: 'absolute',
            inset: 0,
            background: 'rgba(15,23,42,0.32)',
            backdropFilter: 'blur(12px)',
            display: 'flex',
            alignItems: 'flex-end',
            justifyContent: 'center',
            padding: '24px',
            zIndex: 20,
          }}
        >
          <div
            onClick={(event) => event.stopPropagation()}
            style={{
              width: '100%',
              borderRadius: '28px',
              background: 'rgba(255,255,255,0.96)',
              boxShadow: '0 24px 60px rgba(15, 23, 42, 0.24)',
              padding: '22px 20px 20px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px', marginBottom: '16px' }}>
              <div>
                <div style={{ fontSize: '11px', fontWeight: 800, letterSpacing: '0.14em', color: '#059669', marginBottom: '4px' }}>GRAPH DETAIL</div>
                <h2 style={{ fontSize: '21px', fontWeight: 800, color: '#111827', marginBottom: '6px' }}>나의 mebody 코드 : {bodyCode}</h2>
                <p style={{ fontSize: '14px', lineHeight: 1.6, color: '#4b5563', wordBreak: 'keep-all' }}>
                  각 축이 어느 방향에 더 가까운지 큰 그래프로 확인할 수 있습니다.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setAxisModalOpen(false)}
                style={{
                  width: '34px',
                  height: '34px',
                  borderRadius: '999px',
                  border: `1px solid ${AXIS_GREEN_THEME.border}`,
                  background: '#ffffff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  color: '#4b5563',
                  flexShrink: 0,
                }}
              >
                <X size={16} />
              </button>
            </div>

            <div style={{ display: 'grid', gap: '16px', marginBottom: '16px' }}>
              {axisRows.map((row) => (
                <div
                  key={`modal-${row.key}`}
                  style={{
                    borderRadius: '18px',
                    background: row.surface,
                    border: `1px solid ${AXIS_GREEN_THEME.border}`,
                    padding: '16px',
                  }}
                >
                  <div style={{ fontSize: '15px', fontWeight: 800, color: '#111827', marginBottom: '6px' }}>{row.title}</div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', marginBottom: '8px', fontSize: '12px', fontWeight: 700, color: '#6b7280' }}>
                    <span>{row.labelLeft}</span>
                    <span>{row.labelRight}</span>
                  </div>
                  {renderPercentBar(row.percentLeft, row.percentRight, row.leftColor, row.rightColor)}
                  <div style={{ marginTop: '10px', fontSize: '13px', lineHeight: 1.65, color: '#4b5563', wordBreak: 'keep-all' }}>{row.summary}</div>
                </div>
              ))}
            </div>

            <button
              type="button"
              onClick={handleContinue}
              style={{
                display: 'inline-flex',
                width: '100%',
                height: '54px',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                borderRadius: '16px',
                border: 'none',
                background: 'linear-gradient(90deg, #10b981 0%, #14b8a6 100%)',
                color: '#ffffff',
                fontSize: '15px',
                fontWeight: 800,
                boxShadow: '0 14px 28px rgba(20,184,166,0.22)',
                cursor: 'pointer',
              }}
            >
              {ctaButtonLabel}
              <ChevronRight size={18} />
            </button>
          </div>
        </div>
      )}

      {bodyTypesModalOpen && bodyTypesImageUrl && (
        <div
          onClick={() => setBodyTypesModalOpen(false)}
          style={{
            position: 'absolute',
            inset: 0,
            background: 'rgba(15,23,42,0.40)',
            backdropFilter: 'blur(14px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '20px',
            zIndex: 21,
          }}
        >
          <div
            onClick={(event) => event.stopPropagation()}
            style={{
              width: '100%',
              maxHeight: '100%',
              borderRadius: '28px',
              background: 'rgba(255,255,255,0.96)',
              boxShadow: '0 24px 60px rgba(15, 23, 42, 0.24)',
              padding: '18px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', marginBottom: '12px' }}>
              <div>
                <div style={{ fontSize: '11px', fontWeight: 800, letterSpacing: '0.14em', color: '#059669', marginBottom: '4px' }}>16 BODY TYPES</div>
                <h2 style={{ fontSize: '20px', fontWeight: 800, color: '#111827' }}>전체 16가지 체형 분류</h2>
              </div>
              <button
                type="button"
                onClick={() => setBodyTypesModalOpen(false)}
                style={{
                  width: '34px',
                  height: '34px',
                  borderRadius: '999px',
                  border: `1px solid ${AXIS_GREEN_THEME.border}`,
                  background: '#ffffff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  color: '#4b5563',
                  flexShrink: 0,
                }}
              >
                <X size={16} />
              </button>
            </div>
            <div style={{ borderRadius: '20px', overflow: 'hidden', border: `1px solid ${AXIS_GREEN_THEME.border}`, background: '#f8fafc' }}>
              <img src={bodyTypesImageUrl} alt="전체 16가지 체형 분류 확대" style={{ width: '100%', display: 'block' }} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
