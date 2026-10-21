/**
 * 결과 데이터 — ResultScreen 에 있던 로딩/파생 로직을 그대로 옮겼습니다.
 *
 * 홈(HomeScreen)을 시안 디자인으로 새로 쓰면서, 계산 규칙은 손대지 않고
 * 화면만 갈아끼우기 위해 분리합니다. 축 계산·폴백·유튜브 파싱은 동일합니다.
 *
 * 첫 화면/공유 카피는 body_code_content.identity_* / share_* 단일 출처.
 * body_code_result_sections 는 코드 플랜 전용 — Home 에서는 읽지 않습니다.
 */
import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { getAxisContributions } from '../../utils/axisContributions';
import { focusLabel } from '../../theme/focusLabels';
import { ArrowLeft, ChevronRight, ExternalLink, X } from 'lucide-react';
import { fetchQuestionnaireResult, fetchQuestions, fetchBodyCodeContentWithFallback, type BodyCodeContent, type Question, type QuestionnaireResponse } from '../../api/questionnaire';
import {
  fetchAppContent,
  fetchAppImages,
  fetchStoreProducts,
  type StoreProduct,
} from '../../api/content';
import { AXIS_GREEN_THEME } from '../../data/axisTheme';
import { PRODUCT } from '../../theme/copy';
import { AXIS_LABELS } from '../../theme/axisLabels';
import { fetchYoutubeTitles } from '../../lib/youtubeTitle';
import { fetchRewardBalance } from '../../api/journey';
import { previewRewardUse } from '../../api/orders';
import { SUPABASE_STORAGE_PUBLIC, supabase } from '../../lib/supabase';
import { characterNames, getAxisScoreBreakdown, getResultCertainty, type ResultCertainty } from '../../utils/bodyCodeCalculator';
import { LOCAL_FALLBACK_CHARACTER_IMAGE, resolveCharacterImageUrl } from '../../utils/characterImages';

export type { AxisKey } from '../../theme/axisLabels';
import type { AxisKey } from '../../theme/axisLabels';
type ResultWithContent = QuestionnaireResponse & { body_code_content?: BodyCodeContent | null };

export type AxisRow = {
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

export type YoutubeVideo = {
  videoId: string;
  title: string;
  subtitle: string;
  url: string;
  thumbnail: string;
};

export type StoreItem = {
  /** products 테이블의 id. 있으면 홈에서 바로 장바구니에 담을 수 있습니다. */
  id?: string;
  name: string;
  desc: string;
  priceLabel: string;
  badge: string;
  ctaLabel: string;
  imageUrl?: string;
  priceKrw?: number | null;
};

type ResultSaveStatus = 'idle' | 'saving' | 'saved' | 'failed';

interface ResultScreenProps {
  questionnaireId?: string;
  onRestart?: () => void;
  onBack?: () => void;
  onResultLoad?: (bodyCode: string) => void;
  isLoggedIn?: boolean;
  /** 활성 구독 보유 — true 면 광고를 렌더하지 않습니다 */
  isPaid?: boolean;
  isAdmin?: boolean;
  onGoAuth?: () => void;
  onContinue?: () => void;
  onPreviewContinue?: () => void;
  /** 처음부터 32문항을 다시 재고 싶을 때. 랜딩이 결과로 바로 오게 바뀌어 여기에 길을 둡니다. */
  onRemeasure?: () => void;
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
  // 축 이름과 좌·우 라벨은 **theme/axisLabels 한 곳**에서 옵니다.
  // 친구 공유 카드도 같은 값을 읽습니다 — 여기에 베껴 적으면 내 화면과
  // 친구 화면이 같은 축을 다르게 부르게 됩니다.
  neck: { ...AXIS_LABELS.neck, leftColor: AXIS_GREEN_THEME.primary, rightColor: AXIS_GREEN_THEME.deep, surface: AXIS_GREEN_THEME.cardSurfaces[0] },
  shoulder: { ...AXIS_LABELS.shoulder, leftColor: AXIS_GREEN_THEME.primary, rightColor: AXIS_GREEN_THEME.deep, surface: AXIS_GREEN_THEME.cardSurfaces[1] },
  pelvis: { ...AXIS_LABELS.pelvis, leftColor: AXIS_GREEN_THEME.primary, rightColor: AXIS_GREEN_THEME.deep, surface: AXIS_GREEN_THEME.cardSurfaces[2] },
  flexibility: { ...AXIS_LABELS.flexibility, leftColor: AXIS_GREEN_THEME.primary, rightColor: AXIS_GREEN_THEME.deep, surface: AXIS_GREEN_THEME.cardSurfaces[3] },
};

/**
 * 결과 화면 '가이드' 영상.
 *
 * **16코드 전부에게 같은 영상이 나갑니다.** 코드별로 고르지 않습니다 —
 * 코드별 영상이 준비돼 있지 않은데 고르는 척하면 없는 것을 있다고 말하게 됩니다.
 * 섹션 제목이 「가이드 · mebody 자세 사용 설명서」인 이유도 같습니다
 * (옆의 마켓은 「결과에 맞는 용품」이라 거기만 코드를 봅니다).
 *
 * **우리 채널 것만 둡니다** — youtube.com/@mebody_health. 바깥 채널을 섞으면
 * 앱이 남의 주장을 대신 하게 됩니다.
 *
 * 여기 title 은 **받아오기 전에 잠깐 보이는 값**일 뿐입니다. 실제 제목은
 * lib/youtubeTitle 이 영상에서 직접 가져와 덮어씁니다 — 손으로 맞추던 때는
 * 라벨이 「코어 강화 루틴」인데 열리는 영상은 마사지볼 목·어깨 이완이었습니다
 * (2026-10-21 확인). subtitle 은 화면에서 쓰지 않습니다.
 */
const DEFAULT_YOUTUBE_VIDEOS: YoutubeVideo[] = [
  {
    videoId: 'OU4CdtJWPZs',
    title: '당신도 아마 일자목일 겁니다. 일자목 5분만에 C자 만드는 방법',
    // subtitle 은 화면에서 쓰지 않습니다. 타입 호환을 위해 빈 값으로 둡니다.
    subtitle: '',
    url: 'https://www.youtube.com/watch?v=OU4CdtJWPZs',
    thumbnail: 'https://i.ytimg.com/vi/OU4CdtJWPZs/hqdefault.jpg',
  },
  {
    videoId: 'Q6WaIrMdZRw',
    title: '마사지볼로 10분만에 목 돌아가게 만드는 방법',
    subtitle: '',
    url: 'https://www.youtube.com/watch?v=Q6WaIrMdZRw',
    thumbnail: 'https://i.ytimg.com/vi/Q6WaIrMdZRw/hqdefault.jpg',
  },
];

const DEFAULT_STORE_ITEMS: StoreItem[] = [
  {
    name: 'mebody 리커버리 폼롤러',
    desc: '전신 근막 이완과 루틴 전후 워밍업에 쓰기 좋은 기본형 폼롤러입니다.',
    priceLabel: '가격 준비 중',
    badge: 'BEST',
    ctaLabel: '구매하기 준비 중',
  },
  {
    name: 'mebody 딥 마사지볼 세트',
    desc: '어깨, 둔근, 발바닥처럼 국소 자극이 필요한 부위에 쓰는 더블볼 세트입니다.',
    priceLabel: '가격 준비 중',
    badge: 'RECOVERY',
    ctaLabel: '구매하기 준비 중',
  },
  {
    name: 'mebody 스트레칭 밴드',
    desc: '하체 유연성과 골반 정렬 루틴에 맞춰 가볍게 당길 수 있는 저항 밴드입니다.',
    priceLabel: '가격 준비 중',
    badge: 'ROUTINE',
    ctaLabel: '구매하기 준비 중',
  },
  {
    name: 'mebody 밸런스 서포트 쿠션',
    desc: '앉는 자세에서 체중 분산을 도와 장시간 한 자세에 머무는 시간을 줄여줍니다.',
    priceLabel: '가격 준비 중',
    badge: 'POSTURE',
    ctaLabel: '구매하기 준비 중',
  },
];

function pickSummaryLine(content: BodyCodeContent | null): string {
  const fromIdentity = content?.identity_summary?.trim();
  if (fromIdentity) return fromIdentity;

  const fromDescription = content?.description
    ?.split(/[.\n]/)
    .map((sentence) => sentence.trim())
    .find(Boolean);

  return fromDescription || `현재 몸이 가장 자주 쓰는 사용 패턴을 기준으로 ${PRODUCT.codeName}를 정리했습니다.`;
}

function asStringList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map((item) => String(item ?? '').trim()).filter(Boolean);
}

function getAxisSentence(content: BodyCodeContent | null, key: AxisKey, fallback: string) {
  if (key === 'neck') return content?.neck_result || fallback;
  if (key === 'shoulder') return content?.shoulder_result || fallback;
  if (key === 'pelvis') return content?.pelvis_result || fallback;
  return content?.flexibility_result || fallback;
}

function renderPercentBar(percentLeft: number, percentRight: number, leftColor: string, rightColor: string) {
  const leftTextColor = percentLeft >= 16 ? '#ffffff' : '#014725';
  const rightTextColor = percentRight >= 16 ? '#ffffff' : '#014725';

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
          fontSize: '0.8125rem',
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

function formatPrice(price: number | null): string {
  if (price === null || !Number.isFinite(price)) return '가격 준비 중';
  return `${new Intl.NumberFormat('ko-KR').format(price)}원`;
}

/**
 * 스토어 상품.
 * products 테이블(ACTIVE)이 있으면 그것을 쓰고 — 서버에 올리면 앱에 바로 반영된다 —
 * 없을 때만 기존 body_code_content.health_products 로 폴백한다.
 */
function buildStoreItems(
  serverProducts: StoreProduct[],
  fallbackProducts: BodyCodeContent['health_products'] | undefined,
  bodyCode: string,
): StoreItem[] {
  if (serverProducts.length > 0) {
    return serverProducts.slice(0, 6).map((product, index) => ({
      id: product.id,
      name: product.name || `상품 ${index + 1}`,
      desc: product.description || '결과 코드에 맞춰 사용할 수 있는 회복/자세 보조 용품입니다.',
      priceLabel: formatPrice(product.price),
      badge: index === 0 ? `${bodyCode} PICK` : 'mebody 스토어',
      ctaLabel: '장바구니에 담기',
      imageUrl: product.imageUrl,
      priceKrw: product.price,
    }));
  }

  const productList = Array.isArray(fallbackProducts) ? fallbackProducts : [];
  if (productList.length === 0) return DEFAULT_STORE_ITEMS;

  return productList.slice(0, 4).map((item, index) => ({
    name: item?.name?.trim() || `${bodyCode} 추천 용품 ${index + 1}`,
    desc: item?.desc?.trim() || '결과 코드에 맞춰 사용할 수 있는 회복/자세 보조 용품입니다.',
    priceLabel: '가격 준비 중',
    badge: index === 0 ? `${bodyCode} PICK` : 'mebody 스토어',
    ctaLabel: '구매하기 준비 중',
  }));
}


// ---------------------------------------------------------------------------
// 훅 — 위 헬퍼들을 써서 화면이 필요한 값을 한 번에 돌려줍니다.
// 로직은 ResultScreen 의 useEffect/useMemo 를 그대로 옮긴 것입니다.
// ---------------------------------------------------------------------------

export interface ResultData {
  isLoading: boolean;
  error: string | null
  /** 못 불러온 이유. 'offline' 이면 결과가 없는 게 아니라 연결이 끊긴 것입니다. */
  errorKind: 'missing' | 'offline' | null;
  result: ResultWithContent | null;
  content: BodyCodeContent | null;
  bodyCode: string;
  characterName: string;
  characterImage: string;
  /** identity_title — 유형 부제 */
  identityTitle: string | null;
  summaryLine: string;
  identityKeywords: string[];
  shareTitle: string | null;
  shareDescription: string | null;
  strategyTitle: string | null;
  strategySummary: string | null;
  journeyTitle: string | null;
  /** starter_focus 첫 항목 또는 strategy — 홈 '지금 바로' 한 줄 */
  oneLineAction: string;
  recommendedStartMinutes: number;
  axisRows: AxisRow[];
  /**
   * 무엇을 확인했고 무엇을 확인하지 못했는가.
   * 응답을 아직 못 읽었으면 null — 「또렷하다」가 아니라 「모른다」 입니다.
   */
  certainty: ResultCertainty | null;
  axisDetails: Array<{ key: AxisKey; code: string; title: string; description: string }>;
  /** 각 축을 가장 크게 가른 내 답변. "왜 이 코드인지" 를 보여주는 데 씁니다. */
  axisReasons: Record<AxisKey, Array<{ questionCode: string; summary: string; side: 'left' | 'right' }>>;
  youtubeVideos: YoutubeVideo[];
  storeItems: ReturnType<typeof buildStoreItems>;
  rewardBalance: number;
  handleImageError: (url: string) => void;
}

export function useResultData(
  questionnaireId: string | undefined,
  isLoggedIn: boolean,
  onResultLoad?: (bodyCode: string) => void,
  initialBodyCode?: string,
): ResultData {
  const [result, setResult] = useState<ResultWithContent | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  /**
   * 못 불러온 **이유**를 구분합니다.
   *
   * 예전에는 "결과가 없다" 와 "연결이 안 됐다" 가 같은 문장을 썼습니다. 그래서 비행기모드로
   * 앱을 열면 "저장된 결과를 찾지 못했습니다. 다시 분석하면 새 결과를 만들 수 있어요" 가
   * 떴습니다. 결과는 멀쩡히 있는데요. 그 말을 믿은 사람은 32문항을 다시 풉니다
   * (테스터 체험기 1-2).
   */
  const [errorKind, setErrorKind] = useState<'missing' | 'offline' | null>(null);
  const [appImages, setAppImages] = useState<Record<string, string>>({});
  const [appContent, setAppContent] = useState<Record<string, string | unknown>>({});
  const [failedImageUrls, setFailedImageUrls] = useState<Set<string>>(new Set());
  const [scoringQuestions, setScoringQuestions] = useState<Question[]>([]);
  const [storeProducts, setStoreProducts] = useState<StoreProduct[]>([]);
  const [rewardBalance, setRewardBalance] = useState(0);

  useEffect(() => {
    fetchAppImages().then(setAppImages).catch(() => setAppImages({}));
    fetchAppContent(['result_youtube_videos']).then(setAppContent).catch(() => setAppContent({}));
    fetchQuestions().then(setScoringQuestions).catch(() => setScoringQuestions([]));
    fetchStoreProducts().then(setStoreProducts).catch(() => setStoreProducts([]));
  }, []);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    setError(null);
    setErrorKind(null);

    const applyCodeOnlyFallback = async (code: string) => {
      const content = await fetchBodyCodeContentWithFallback(code);
      if (cancelled) return;
      const now = new Date().toISOString();
      setResult({
        id: `profile-code-${code}`,
        answers: {},
        calculated_code: code,
        status: 'completed',
        created_at: now,
        updated_at: now,
        completed_at: now,
        body_code_content: content,
      });
      onResultLoad?.(code);
      setError(null);
    };

    if (!questionnaireId) {
      const code = initialBodyCode?.trim();
      if (!code) {
        setResult(null);
        setIsLoading(false);
        return;
      }
      void applyCodeOnlyFallback(code).finally(() => {
        if (!cancelled) setIsLoading(false);
      });
      return () => {
        cancelled = true;
      };
    }

    fetchQuestionnaireResult(questionnaireId)
      .then(async (data) => {
        if (cancelled) return;
        const nextResult = (data as ResultWithContent) ?? null;
        if (nextResult?.calculated_code) {
          setResult(nextResult);
          onResultLoad?.(nextResult.calculated_code);
          return;
        }
        const code = initialBodyCode?.trim();
        if (code) {
          await applyCodeOnlyFallback(code);
          return;
        }
        setResult(null);
        setErrorKind('missing');
        setError('저장된 결과를 찾지 못했습니다. 홈에서 다시 분석하면 새 결과를 만들 수 있어요.');
      })
      .catch(async (loadError) => {
        if (cancelled) return;
        console.error('Failed to load result:', loadError);
        const code = initialBodyCode?.trim();
        if (code) {
          try {
            await applyCodeOnlyFallback(code);
            return;
          } catch {
            /* fall through */
          }
        }
        // 연결이 끊긴 것이면 **결과가 없다고 말하지 않습니다.** 결과는 그대로 있습니다.
        const offline = typeof navigator !== 'undefined' && navigator.onLine === false;
        setErrorKind(offline ? 'offline' : 'missing');
        setError(offline
          ? '지금은 연결이 안 돼서 결과를 불러오지 못했습니다. 연결되면 그대로 다시 보여드릴게요.'
          : '결과를 불러오지 못했습니다. 잠시 뒤 다시 시도해 주세요.');
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [questionnaireId, initialBodyCode, onResultLoad]);

  useEffect(() => {
    let cancelled = false;
    if (!isLoggedIn) {
      setRewardBalance(0);
      return;
    }
    supabase.auth.getUser().then(({ data }) => {
      const userId = data.user?.id;
      if (!userId) return;
      fetchRewardBalance(userId)
        .then((balance) => {
          if (!cancelled) setRewardBalance(balance);
        })
        .catch(() => undefined);
    });
    return () => {
      cancelled = true;
    };
  }, [isLoggedIn]);

  const handleImageError = useCallback((url: string) => {
    setFailedImageUrls((prev) => new Set(prev).add(url));
  }, []);

  const bodyCode = result?.calculated_code || '----';
  const content = result?.body_code_content ?? null;
  const summaryLine = pickSummaryLine(content);
  const characterName = content?.character_name || characterNames[bodyCode] || `나의 ${PRODUCT.codeName}`;
  const characterImage = resolveCharacterImageUrl(bodyCode, appImages, failedImageUrls);
  const axisPercent = result?.answers ? getAxisScoreBreakdown(result.answers, scoringQuestions) : null;
  /**
   * 무엇을 확인했고 무엇을 확인하지 못했는가. 코드 문자열에는 드러나지 않습니다.
   * 완전 동점이어도 코드는 FRRS 가 나오므로(계산기 주석 참고) 화면은 이걸 따로 받아야
   * 확인하지 못한 것을 확인한 것처럼 말하지 않습니다.
   */
  const certainty = useMemo<ResultCertainty | null>(
    () => (result?.answers ? getResultCertainty(result.answers) : null),
    [result?.answers],
  );
  const identityTitle = content?.identity_title?.trim() || null;
  const identityKeywords = asStringList(content?.identity_keywords);
  const shareTitle = content?.share_title?.trim() || null;
  const shareDescription = content?.share_description?.trim() || null;
  const strategyTitle = content?.strategy_title?.trim() || null;
  const strategySummary = content?.strategy_summary?.trim() || null;
  const journeyTitle = content?.journey_title?.trim() || null;
  const starterFocus = asStringList(content?.starter_focus);
  // starter_focus 는 'foot_support' 같은 내부 키입니다. 그대로 쓰면 화면에 그 키가 나갑니다.
  const oneLineAction =
    focusLabel(starterFocus[0]) ||
    strategyTitle ||
    journeyTitle ||
    '목·어깨부터 가볍게 풀어보기';
  const recommendedStartMinutes =
    typeof content?.recommended_start_minutes === 'number' && content.recommended_start_minutes > 0
      ? content.recommended_start_minutes
      : 5;

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

  /**
   * 왜 이 코드가 나왔는지 — 내 답변에서 다시 셉니다.
   * 점수 계산에는 손대지 않고 같은 표를 읽기만 합니다.
   */
  const axisReasons = useMemo(() => {
    const all = getAxisContributions(result?.answers);
    const pick = (list: typeof all.neck) =>
      list.slice(0, 2).map((x) => ({ questionCode: x.questionCode, summary: x.summary, side: x.side }));
    return {
      neck: pick(all.neck),
      shoulder: pick(all.shoulder),
      pelvis: pick(all.pelvis),
      flexibility: pick(all.flexibility),
    };
  }, [result?.answers]);

  const axisDetails = useMemo(() => {
    if (bodyCode.length !== 4) return [];
    return [
      { key: 'neck' as const, code: bodyCode[0], title: '목 위치', description: getAxisSentence(content, 'neck', '목 위치 정렬 패턴입니다.') },
      { key: 'shoulder' as const, code: bodyCode[1], title: '어깨 높이', description: getAxisSentence(content, 'shoulder', '어깨 높이 패턴입니다.') },
      { key: 'pelvis' as const, code: bodyCode[2], title: '골반 회전', description: getAxisSentence(content, 'pelvis', '골반 회전 패턴입니다.') },
      { key: 'flexibility' as const, code: bodyCode[3], title: '하체 유연성', description: getAxisSentence(content, 'flexibility', '하체 유연성 패턴입니다.') },
    ];
  }, [bodyCode, content]);

  const youtubeVideosBase = useMemo(() => {
    const parsed = parseYoutubeVideos(appContent.result_youtube_videos);
    return parsed.length ? parsed : DEFAULT_YOUTUBE_VIDEOS;
  }, [appContent]);

  /**
   * 제목은 **영상에서 받아옵니다.**
   *
   * 저장된 라벨은 사람이 손으로 맞춰야 해서 언젠가 어긋납니다(실제로 어긋나 있었습니다).
   * 받아오기 전·실패했을 때만 저장된 값을 씁니다 — 제목이 비어 화면이 뜨지 않게.
   */
  const [liveTitles, setLiveTitles] = useState<Record<string, string>>({});
  useEffect(() => {
    const ids = youtubeVideosBase.map((v) => v.videoId).filter(Boolean);
    if (ids.length === 0) return;
    let cancelled = false;
    void fetchYoutubeTitles(ids).then((map) => {
      if (!cancelled) setLiveTitles(map);
    });
    return () => {
      cancelled = true;
    };
  }, [youtubeVideosBase]);

  const youtubeVideos = useMemo(
    () => youtubeVideosBase.map((v) => ({ ...v, title: liveTitles[v.videoId] || v.title })),
    [youtubeVideosBase, liveTitles],
  );

  const storeItems = useMemo(
    () => buildStoreItems(storeProducts, content?.health_products, bodyCode),
    [storeProducts, content?.health_products, bodyCode],
  );

  return {
    isLoading, error, errorKind, result, content, bodyCode, characterName, characterImage,
    identityTitle, summaryLine, identityKeywords, shareTitle, shareDescription,
    strategyTitle, strategySummary, journeyTitle, oneLineAction, recommendedStartMinutes,
    axisRows, certainty, axisDetails, axisReasons, youtubeVideos, storeItems, rewardBalance, handleImageError,
  };
}
