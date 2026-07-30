import { useCallback, useEffect, useRef, useState } from 'react';
import type { User } from '@supabase/supabase-js';
import { ArrowLeft, ChevronRight, Crown, LayoutDashboard, LogOut, ShieldCheck, Sparkles, UserRound } from 'lucide-react';
import { fetchQuestionnaireResult, type BodyCodeContent, type QuestionnaireResponse } from '../api/questionnaire';
import { fetchLatestCompletedResultIdForUser, fetchMySubscription, type UserSubscription } from '../api/account';
import { fetchAppImages } from '../api/content';
import { supabase } from '../lib/supabase';
import { characterNames } from '../utils/bodyCodeCalculator';
import { LOCAL_FALLBACK_CHARACTER_IMAGE, resolveCharacterImageUrl } from '../utils/characterImages';
import { useMediaQuery } from '../utils/useMediaQuery';
import { ScrollIndicator } from './ScrollIndicator';

interface MyPageScreenProps {
  user: User | null;
  latestResultId?: string;
  latestBodyCode?: string;
  onBack?: () => void;
  onOpenLatestResult?: () => void;
  onOpenMembership?: () => void;
  onStartDiagnosis?: () => void;
  onRequireAuth?: () => void;
  onLatestResultResolved?: (resultId: string) => void;
  onLogout?: () => void | Promise<void>;
  previewMode?: boolean;
}

type ResultWithContent = QuestionnaireResponse & { body_code_content?: BodyCodeContent | null };
type UserRole = 'MEMBER' | 'SELLER' | 'ADMIN';
type RoleLookupResult = { role: UserRole | null; unavailable: boolean };

const ADMIN_CACHE_PREFIX = 'mebody:admin-role:';
const ADMIN_WEB_BASE_URL = String(import.meta.env.VITE_API_BASE_URL ?? '').replace(/\/$/, '');

function getDisplayName(user: User | null): string {
  if (!user) return '게스트';
  const metadataName = typeof user.user_metadata?.display_name === 'string' ? user.user_metadata.display_name.trim() : '';
  if (metadataName) return metadataName;
  return user.email?.split('@')[0] || '회원';
}

function getStatusLabel(subscription: UserSubscription | null): string {
  if (!subscription) return '플랜 미연결';
  if (subscription.status === 'trialing') return '체험 사용 중';
  if (subscription.status === 'past_due') return '결제 확인 필요';
  if (subscription.status === 'canceled') return '해지 예정';
  return '플랜 이용 중';
}

function getSummaryLine(content: BodyCodeContent | null): string {
  const line = content?.description
    ?.split(/[.\n]/)
    .map((text) => text.trim())
    .find(Boolean);

  return line || '최근 결과를 기준으로 다시 볼 수 있는 mebody 코드입니다.';
}

function formatKoreanDate(value?: string | null): string {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat('ko-KR', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  }).format(date);
}

function normalizeUserRole(role: unknown): UserRole | null {
  return role === 'MEMBER' || role === 'SELLER' || role === 'ADMIN' ? role : null;
}

function readCachedAdminFlag(userId: string | undefined): boolean {
  if (!userId || typeof window === 'undefined') return false;

  try {
    return window.sessionStorage.getItem(`${ADMIN_CACHE_PREFIX}${userId}`) === 'true';
  } catch {
    return false;
  }
}

function writeCachedAdminFlag(userId: string, isAdmin: boolean) {
  if (typeof window === 'undefined') return;

  try {
    const key = `${ADMIN_CACHE_PREFIX}${userId}`;
    if (isAdmin) {
      window.sessionStorage.setItem(key, 'true');
    } else {
      window.sessionStorage.removeItem(key);
    }
  } catch {
    // Storage can be unavailable in private mode; Supabase role lookup remains the source.
  }
}

async function fetchProfileRoleFromSupabase(userId: string, email?: string | null): Promise<RoleLookupResult> {
  const filters = [`id.eq.${userId}`, `auth_user_id.eq.${userId}`];
  if (email) filters.push(`email.eq.${email}`);

  const { data, error } = await supabase
    .from('user_profiles')
    .select('role')
    .or(filters.join(','))
    .limit(1)
    .maybeSingle();

  if (error) {
    console.warn('MyPageScreen profile role lookup failed:', error);
    return { role: null, unavailable: true };
  }

  return { role: normalizeUserRole(data?.role), unavailable: false };
}

export function MyPageScreen({
  user,
  latestResultId,
  latestBodyCode,
  onBack,
  onOpenLatestResult,
  onOpenMembership,
  onStartDiagnosis,
  onRequireAuth,
  onLatestResultResolved,
  onLogout,
  previewMode = false,
}: MyPageScreenProps) {
  const isDesktopMockup = useMediaQuery('(min-width: 768px)');
  const [latestResult, setLatestResult] = useState<ResultWithContent | null>(null);
  const [resolvedLatestResultId, setResolvedLatestResultId] = useState<string | undefined>(latestResultId);
  const [subscription, setSubscription] = useState<UserSubscription | null>(null);
  const [appImages, setAppImages] = useState<Record<string, string>>({});
  const [failedImageUrls, setFailedImageUrls] = useState<Set<string>>(new Set());
  const [resultLoading, setResultLoading] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [adminRoleUnavailable, setAdminRoleUnavailable] = useState(false);
  const [adminToolsOpen, setAdminToolsOpen] = useState(false);
  const effectiveLatestResultId = latestResultId ?? resolvedLatestResultId;
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchAppImages().then(setAppImages).catch(() => setAppImages({}));
  }, []);

  useEffect(() => {
    if (latestResultId) setResolvedLatestResultId(latestResultId);
  }, [latestResultId]);

  useEffect(() => {
    let cancelled = false;

    async function resolveLatestResultId() {
      if (!user || previewMode || latestResultId) return;

      setResultLoading(true);
      try {
        const resultId = await fetchLatestCompletedResultIdForUser(user.id);
        if (cancelled) return;

        setResolvedLatestResultId(resultId ?? undefined);
        if (resultId) {
          onLatestResultResolved?.(resultId);
        } else {
          setLatestResult(null);
          setResultLoading(false);
        }
      } catch (loadError) {
        if (cancelled) return;
        console.warn('MyPageScreen latest result id lookup failed:', loadError);
        setResolvedLatestResultId(undefined);
        setLatestResult(null);
        setResultLoading(false);
      }
    }

    resolveLatestResultId();
    return () => {
      cancelled = true;
    };
  }, [latestResultId, onLatestResultResolved, previewMode, user?.id]);

  useEffect(() => {
    let cancelled = false;

    async function loadLatestResult() {
      if (!user || !effectiveLatestResultId) {
        setLatestResult(null);
        setResultLoading(false);
        return;
      }

      setResultLoading(true);
      try {
        const resultData = await fetchQuestionnaireResult(effectiveLatestResultId);

        if (cancelled) return;
        setLatestResult((resultData as ResultWithContent | null) ?? null);
      } catch (loadError) {
        if (cancelled) return;
        console.warn('MyPageScreen latest result load failed:', loadError);
        setLatestResult(null);
      } finally {
        if (!cancelled) setResultLoading(false);
      }
    }

    loadLatestResult();
    return () => {
      cancelled = true;
    };
  }, [effectiveLatestResultId, user?.id]);

  useEffect(() => {
    let cancelled = false;

    async function loadSubscription() {
      if (!user) {
        setSubscription(null);
        return;
      }

      try {
        const subscriptionData = await fetchMySubscription(user.id);
        if (!cancelled) setSubscription(subscriptionData);
      } catch (loadError) {
        if (!cancelled) setSubscription(null);
        console.warn('MyPageScreen subscription load failed:', loadError);
      }
    }

    loadSubscription();
    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  useEffect(() => {
    let cancelled = false;

    async function loadAdminRole() {
      if (!user || previewMode) {
        setIsAdmin(false);
        setAdminRoleUnavailable(false);
        setAdminToolsOpen(false);
        return;
      }

      const isHardcodedAdmin = Boolean(user.email && ['chldngur89@gmail.com'].includes(user.email));
      const cachedAdmin = readCachedAdminFlag(user.id);
      if (cachedAdmin || isHardcodedAdmin) setIsAdmin(true);

      const profileRole = await fetchProfileRoleFromSupabase(user.id, user.email);
      if (!cancelled) {
        if (profileRole.unavailable) {
          const fallbackAdmin = cachedAdmin || isHardcodedAdmin;
          setIsAdmin(fallbackAdmin);
          setAdminRoleUnavailable(true);
          if (!fallbackAdmin) setAdminToolsOpen(false);
          return;
        }

        const verifiedAdmin = profileRole.role === 'ADMIN' || isHardcodedAdmin;

        setIsAdmin(verifiedAdmin);
        setAdminRoleUnavailable(false);
        if (!verifiedAdmin) setAdminToolsOpen(false);
        writeCachedAdminFlag(user.id, verifiedAdmin);
      }
    }

    loadAdminRole();
    return () => {
      cancelled = true;
    };
  }, [previewMode, user?.email, user?.id]);

  const handleImageError = useCallback((url: string) => {
    setFailedImageUrls((prev) => new Set(prev).add(url));
  }, []);

  const handleOpenAdminConsole = useCallback(async () => {
    if (!ADMIN_WEB_BASE_URL) {
      window.alert('관리자 웹 콘솔 주소가 설정되어 있지 않습니다. 배포 환경변수 VITE_API_BASE_URL을 확인해주세요.');
      return;
    }

    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => controller.abort(), 1200);

    try {
      const response = await fetch(`${ADMIN_WEB_BASE_URL}/api/public/config`, { signal: controller.signal });

      if (!response.ok) {
        window.alert('관리자 웹 콘솔 서버가 응답하지 않습니다. 배포된 API 서버 상태와 VITE_API_BASE_URL 값을 확인해주세요.');
        return;
      }
    } catch {
      window.alert('관리자 웹 콘솔에 연결할 수 없습니다. 배포된 API 서버와 CORS 설정을 확인해주세요.');
      return;
    } finally {
      window.clearTimeout(timeoutId);
    }

    window.open(`${ADMIN_WEB_BASE_URL}/admin`, '_blank', 'noopener,noreferrer');
  }, []);

  const isPreviewMode = previewMode && !user;
  const normalizedLatestBodyCode = (latestBodyCode ?? '').trim().toUpperCase();
  const bodyCode = (latestResult?.calculated_code || normalizedLatestBodyCode || (isPreviewMode ? 'FRRS' : '')).toUpperCase();
  const content = latestResult?.body_code_content ?? null;
  const characterName = content?.character_name || (bodyCode ? characterNames[bodyCode] : '나의 mebody 코드');
  const summaryLine = latestResult
    ? getSummaryLine(content)
    : isPreviewMode
      ? '가입 후에는 최근 결과와 코드 플랜, 멤버십 상태를 이 화면에서 이어서 확인합니다.'
      : normalizedLatestBodyCode
        ? '이 계정의 저장된 mebody 코드입니다. 상세 결과를 새로 생성하면 코드 플랜과 미션이 자동으로 연결됩니다.'
        : getSummaryLine(content);
  const characterImage = bodyCode ? resolveCharacterImageUrl(bodyCode, appImages, failedImageUrls) : '';
  const latestResultDate = formatKoreanDate(latestResult?.completed_at || latestResult?.updated_at || latestResult?.created_at);
  const displayName = user ? getDisplayName(user) : 'Preview';
  const displayEmail = user?.email ?? 'preview@mebody.app';
  const effectiveStatusLabel = isPreviewMode ? '체험 사용 중' : getStatusLabel(subscription);

  if (!user && !isPreviewMode) {
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
        <div
          style={{
            position: 'relative',
            zIndex: 1,
            display: 'flex',
            height: '100%',
            flexDirection: 'column',
            padding: '22px 24px 20px',
            fontFamily: '"SUIT Variable","Pretendard Variable","Noto Sans KR",sans-serif',
          }}
        >
          <div style={{ marginBottom: '18px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                borderRadius: '999px',
                border: '1px solid rgba(255,255,255,0.4)',
                background: 'rgba(255,255,255,0.72)',
                padding: '9px 16px',
                boxShadow: '0 10px 20px rgba(15, 23, 42, 0.08)',
                backdropFilter: 'blur(12px)',
              }}
            >
              <Sparkles size={18} color="#014725" />
              <span style={{ fontSize: '13px', fontWeight: 700, color: '#1f2937' }}>MEBODY</span>
            </div>
            {onBack && (
              <button
                type="button"
                onClick={onBack}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  borderRadius: '999px',
                  border: '1px solid rgba(255,255,255,0.4)',
                  background: 'rgba(255,255,255,0.72)',
                  padding: '9px 14px',
                  color: '#374151',
                  fontSize: '12px',
                  fontWeight: 700,
                  boxShadow: '0 10px 20px rgba(15, 23, 42, 0.08)',
                  backdropFilter: 'blur(12px)',
                  cursor: 'pointer',
                }}
              >
                <ArrowLeft size={14} />
                뒤로
              </button>
            )}
          </div>

          <div
            style={{
              flex: 1,
              borderRadius: '28px',
              background: 'rgba(255,255,255,0.78)',
              boxShadow: '0 24px 48px rgba(15, 23, 42, 0.12)',
              backdropFilter: 'blur(20px)',
              padding: '28px 24px',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center',
              textAlign: 'center',
            }}
          >
            <div style={{ width: '84px', height: '84px', margin: '0 auto 18px', borderRadius: '24px', background: 'linear-gradient(135deg, #016B38 0%, #014725 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 14px 30px rgba(1,71,37,0.30)' }}>
              <LayoutDashboard size={34} color="#ffffff" />
            </div>
            <h1 style={{ fontSize: '28px', fontWeight: 800, color: '#111827', marginBottom: '10px' }}>내 페이지는 로그인 후 연결됩니다</h1>
            <p style={{ fontSize: '14px', lineHeight: 1.65, color: '#4b5563', marginBottom: '20px', wordBreak: 'keep-all' }}>
              회원가입하면 몸BTI 결과, 코드 플랜, 오늘의 미션을 계정에 저장하고 다음 방문에서도 이어서 확인할 수 있습니다.
            </p>
            {onRequireAuth && (
              <button
                type="button"
                onClick={onRequireAuth}
                style={{
                  display: 'inline-flex',
                  width: '100%',
                  height: '56px',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  borderRadius: '18px',
                  border: 'none',
                  background: 'linear-gradient(90deg, #016B38 0%, #014725 100%)',
                  color: '#ffffff',
                  fontSize: '16px',
                  fontWeight: 800,
                  boxShadow: '0 14px 28px rgba(1,71,37,0.25)',
                  cursor: 'pointer',
                }}
              >
                회원가입 / 로그인
                <ChevronRight size={18} />
              </button>
            )}
          </div>
        </div>
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
            top: '56px',
            left: '-84px',
            width: '300px',
            height: '300px',
            borderRadius: '999px',
            background: 'rgba(52, 211, 153, 0.16)',
            filter: 'blur(58px)',
          }}
        />
        <div
          style={{
            position: 'absolute',
            bottom: '60px',
            right: '-96px',
            width: '320px',
            height: '320px',
            borderRadius: '999px',
            background: 'rgba(45, 212, 191, 0.15)',
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
          padding: '22px 24px 20px',
          fontFamily: '"SUIT Variable","Pretendard Variable","Noto Sans KR",sans-serif',
        }}
      >
        <div style={{ marginBottom: '18px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              borderRadius: '999px',
              border: '1px solid rgba(255,255,255,0.4)',
              background: 'rgba(255,255,255,0.72)',
              padding: '9px 16px',
              boxShadow: '0 10px 20px rgba(15, 23, 42, 0.08)',
              backdropFilter: 'blur(12px)',
            }}
          >
            <Sparkles size={18} color="#014725" />
            <span style={{ fontSize: '13px', fontWeight: 700, color: '#1f2937' }}>MEBODY</span>
          </div>
          {onBack && (
            <button
              type="button"
              onClick={onBack}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                borderRadius: '999px',
                border: '1px solid rgba(255,255,255,0.4)',
                background: 'rgba(255,255,255,0.72)',
                padding: '9px 14px',
                color: '#374151',
                fontSize: '12px',
                fontWeight: 700,
                boxShadow: '0 10px 20px rgba(15, 23, 42, 0.08)',
                backdropFilter: 'blur(12px)',
                cursor: 'pointer',
              }}
            >
              <ArrowLeft size={14} />
              뒤로
            </button>
          )}
        </div>

        <div
          ref={scrollRef}
          style={{
            flex: 1,
            overflowY: 'auto',
            borderRadius: '28px',
            background: 'rgba(255,255,255,0.78)',
            boxShadow: '0 24px 48px rgba(15, 23, 42, 0.12)',
            backdropFilter: 'blur(20px)',
            padding: '24px',
            paddingBottom: 'calc(24px + env(safe-area-inset-bottom))',
          }}
        >
          <div
            style={{
              borderRadius: '22px',
              background: 'linear-gradient(135deg, rgba(236,253,245,0.95) 0%, rgba(240,253,250,0.95) 100%)',
              border: '1px solid rgba(167,243,208,0.95)',
              padding: '20px',
              marginBottom: '16px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '14px' }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: '11px', fontWeight: 800, letterSpacing: '0.16em', color: '#014725', marginBottom: '8px' }}>MY PAGE</div>
                <h1 style={{ fontSize: '26px', lineHeight: 1.25, fontWeight: 800, color: '#111827', marginBottom: '6px', wordBreak: 'keep-all' }}>
                  {displayName}님 계정과
                  <br />
                  최근 결과를 확인합니다
                </h1>
                <p style={{ fontSize: '14px', lineHeight: 1.6, color: '#4b5563', wordBreak: 'break-all' }}>{displayEmail}</p>
              </div>
              <div
                style={{
                  width: '54px',
                  height: '54px',
                  borderRadius: '18px',
                  background: '#ffffff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: '0 10px 20px rgba(15, 23, 42, 0.08)',
                  flexShrink: 0,
                }}
              >
                <UserRound size={24} color="#014725" />
              </div>
            </div>

            <div style={{ marginTop: '14px', display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
              <span style={{ borderRadius: '999px', background: '#ffffff', padding: '7px 12px', fontSize: '12px', fontWeight: 700, color: '#047857' }}>
                {effectiveStatusLabel}
              </span>
              <span style={{ borderRadius: '999px', background: 'rgba(255,255,255,0.82)', padding: '7px 12px', fontSize: '12px', fontWeight: 700, color: '#4b5563' }}>
                최근 결과 {bodyCode || '없음'}
              </span>
            </div>
          </div>

          {isAdmin && (
            <div
              style={{
                borderRadius: '22px',
                border: '1px solid rgba(1,71,37,0.28)',
                background: 'linear-gradient(135deg, rgba(240,253,250,0.96) 0%, rgba(255,255,255,0.98) 100%)',
                padding: '18px',
                marginBottom: '16px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
                <ShieldCheck size={20} color="#014725" />
                <div>
                  <div style={{ fontSize: '11px', fontWeight: 800, letterSpacing: '0.14em', color: '#014725', marginBottom: '4px' }}>ADMIN</div>
                  <h3 style={{ fontSize: '18px', fontWeight: 800, color: '#111827' }}>관리자 도구</h3>
                </div>
              </div>
              <p style={{ fontSize: '14px', lineHeight: 1.6, color: '#4b5563', marginBottom: '12px', wordBreak: 'keep-all' }}>
                {adminRoleUnavailable
                  ? '이전 세션에서 관리자 권한이 확인되었습니다. 현재 DB role 재확인이 지연되어 웹 콘솔은 서버 상태를 확인한 뒤 연결합니다.'
                  : 'Supabase DB에서 관리자 권한이 확인되었습니다. 모바일에서는 바로가기만 제공하고 실제 관리는 웹 콘솔에서 진행합니다.'}
              </p>
              <button
                type="button"
                onClick={handleOpenAdminConsole}
                style={{
                  display: 'inline-flex',
                  width: '100%',
                  height: '52px',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  borderRadius: '16px',
                  border: 'none',
                  background: 'linear-gradient(90deg, #014725 0%, #014725 100%)',
                  color: '#ffffff',
                  fontSize: '15px',
                  fontWeight: 800,
                  boxShadow: '0 14px 28px rgba(15,118,110,0.18)',
                  cursor: 'pointer',
                }}
              >
                관리자 웹 콘솔 열기
                <ChevronRight size={18} />
              </button>
              <button
                type="button"
                onClick={() => setAdminToolsOpen((open) => !open)}
                style={{
                  marginTop: '10px',
                  display: 'inline-flex',
                  width: '100%',
                  height: '44px',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  borderRadius: '14px',
                  border: '1px solid rgba(167,243,208,0.95)',
                  background: 'rgba(255,255,255,0.88)',
                  color: '#014725',
                  fontSize: '13px',
                  fontWeight: 800,
                  cursor: 'pointer',
                }}
              >
                {adminToolsOpen ? '모바일 관리 항목 닫기' : '모바일 관리 항목 보기'}
              </button>
              {adminToolsOpen && (
                <div style={{ marginTop: '14px', display: 'grid', gap: '10px' }}>
                  {[
                    ['회원 관리', '회원 목록, 권한, 상태 변경 기능 준비 중'],
                    ['이미지 관리', 'Supabase Storage 캐릭터/축 이미지 관리 준비 중'],
                    ['서비스 설정', '문항, 콘텐츠, 노출 문구 관리 준비 중'],
                  ].map(([title, desc]) => (
                    <button
                      key={title}
                      type="button"
                      onClick={() => window.alert(`${title} 기능은 현재 준비 중이며, 실제 서버와 연결되어 있지 않습니다.`)}
                      style={{
                        textAlign: 'left',
                        cursor: 'pointer',
                        display: 'block',
                        width: '100%',
                        borderRadius: '16px',
                        border: '1px solid rgba(167,243,208,0.9)',
                        background: 'rgba(255,255,255,0.86)',
                        padding: '13px 14px',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px', marginBottom: '6px' }}>
                        <strong style={{ fontSize: '14px', color: '#111827' }}>{title}</strong>
                        <span style={{ borderRadius: '999px', background: '#ecfdf5', padding: '4px 8px', fontSize: '11px', fontWeight: 900, color: '#047857' }}>
                          준비 중
                        </span>
                      </div>
                      <p style={{ margin: 0, fontSize: '12px', lineHeight: 1.55, color: '#64748b', wordBreak: 'keep-all' }}>{desc}</p>
                    </button>
                  ))}
                  <div
                    style={{
                      borderRadius: '16px',
                      background: 'rgba(236,253,245,0.75)',
                      padding: '12px 14px',
                      fontSize: '12px',
                      lineHeight: 1.55,
                      color: '#047857',
                      fontWeight: 800,
                      wordBreak: 'keep-all',
                    }}
                  >
                    버튼을 눌렀을 때 API 서버가 응답하지 않으면 안내창만 표시합니다. 서버가 정상일 때는 설정된 관리자 웹 콘솔로 이동합니다.
                  </div>
                </div>
              )}
            </div>
          )}

          <div
            style={{
              borderRadius: '22px',
              border: '1px solid rgba(229,231,235,0.95)',
              background: '#ffffff',
              padding: '18px',
              marginBottom: '16px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', marginBottom: '14px' }}>
              <div>
                <div style={{ fontSize: '11px', fontWeight: 800, letterSpacing: '0.14em', color: '#014725', marginBottom: '4px' }}>LATEST RESULT</div>
                <h2 style={{ fontSize: '20px', fontWeight: 800, color: '#111827' }}>최근 mebody 코드</h2>
              </div>
              {bodyCode ? (
                <div style={{ borderRadius: '999px', background: 'rgba(236,253,245,0.92)', padding: '8px 12px', fontSize: '13px', fontWeight: 800, color: '#047857' }}>{bodyCode}</div>
              ) : null}
            </div>

            {resultLoading ? (
              <div style={{ display: 'grid', gap: '12px' }} aria-label="최근 결과 로딩 중">
                <div style={{ height: '18px', width: '58%', borderRadius: '999px', background: 'linear-gradient(90deg, #f1f5f9 0%, #e2e8f0 50%, #f8fafc 100%)' }} />
                <div style={{ height: '14px', width: '84%', borderRadius: '999px', background: '#f1f5f9' }} />
                <div style={{ height: '14px', width: '66%', borderRadius: '999px', background: '#f1f5f9' }} />
                <p style={{ margin: 0, fontSize: '13px', lineHeight: 1.6, color: '#64748b', fontWeight: 800, wordBreak: 'keep-all' }}>
                  최신 mebody 코드를 확인하고 있습니다.
                </p>
              </div>
            ) : latestResult || isPreviewMode || Boolean(normalizedLatestBodyCode) ? (
              <div style={{ display: 'grid', gap: '14px' }}>
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
                    gap: '8px',
                  }}
                >
                  <div style={{ borderRadius: '14px', background: 'rgba(236,253,245,0.86)', padding: '10px 12px' }}>
                    <div style={{ fontSize: '10px', fontWeight: 900, letterSpacing: '0.12em', color: '#014725', marginBottom: '4px' }}>현재 저장 코드</div>
                    <div style={{ fontSize: '15px', fontWeight: 900, color: '#111827' }}>{bodyCode}</div>
                  </div>
                  <div style={{ borderRadius: '14px', background: 'rgba(248,250,252,0.96)', padding: '10px 12px' }}>
                    <div style={{ fontSize: '10px', fontWeight: 900, letterSpacing: '0.12em', color: '#64748b', marginBottom: '4px' }}>마지막 진단일</div>
                    <div style={{ fontSize: '13px', fontWeight: 900, color: '#111827' }}>{latestResultDate || (normalizedLatestBodyCode ? '기존 저장 코드' : '확인 중')}</div>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '14px', alignItems: 'center' }}>
                  <div
                    style={{
                      width: '94px',
                      height: '110px',
                      borderRadius: '18px',
                      background: 'linear-gradient(135deg, rgba(236,253,245,0.95) 0%, rgba(255,255,255,0.95) 100%)',
                      border: '1px solid rgba(209,250,229,0.95)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      overflow: 'hidden',
                      flexShrink: 0,
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
                      <div style={{ fontSize: '28px', fontWeight: 800, color: '#014725' }}>{bodyCode}</div>
                    )}
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: '17px', fontWeight: 800, color: '#111827', marginBottom: '6px' }}>{characterName}</div>
                    <p style={{ fontSize: '14px', lineHeight: 1.6, color: '#4b5563', wordBreak: 'keep-all' }}>{summaryLine}</p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={onOpenLatestResult}
                  style={{
                    display: 'inline-flex',
                    width: '100%',
                    height: '52px',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px',
                    borderRadius: '16px',
                    border: '1px solid rgba(167,243,208,0.95)',
                    background: 'rgba(236,253,245,0.9)',
                    color: '#047857',
                    fontSize: '15px',
                    fontWeight: 800,
                    cursor: onOpenLatestResult ? 'pointer' : 'default',
                    opacity: onOpenLatestResult ? 1 : 0.76,
                  }}
                >
                  {isPreviewMode ? '가입 후 최근 결과 보기' : '코드 플랜 / 오늘의 미션 보기'}
                  <ChevronRight size={18} />
                </button>
              </div>
            ) : (
              <div style={{ display: 'grid', gap: '12px' }}>
                <p style={{ fontSize: '15px', lineHeight: 1.65, color: '#374151', wordBreak: 'keep-all' }}>
                  아직 저장된 몸BTI가 없습니다. 빠르게 결과를 확인해 보세요. 완료하면 코드 플랜과 오늘의 미션이 계정에 바로 연결됩니다.
                </p>
                <div
                  style={{
                    borderRadius: '16px',
                    background: 'rgba(236,253,245,0.86)',
                    border: '1px solid rgba(167,243,208,0.9)',
                    padding: '13px 14px',
                    color: '#047857',
                    fontSize: '13px',
                    fontWeight: 800,
                    lineHeight: 1.55,
                    wordBreak: 'keep-all',
                  }}
                >
                  약 3~5분 소요 · 완료 후 바로 결과와 오늘의 미션 확인
                </div>
                {onStartDiagnosis && (
                  <button
                    type="button"
                    onClick={onStartDiagnosis}
                    style={{
                      display: 'inline-flex',
                      width: '100%',
                      height: '52px',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '8px',
                      borderRadius: '16px',
                      border: 'none',
                      background: 'linear-gradient(90deg, #016B38 0%, #014725 100%)',
                      color: '#ffffff',
                      fontSize: '15px',
                      fontWeight: 800,
                      boxShadow: '0 14px 28px rgba(1,71,37,0.18)',
                      cursor: 'pointer',
                    }}
                  >
                    빠르게 코드 확인하기
                    <ChevronRight size={18} />
                  </button>
                )}
              </div>
            )}
          </div>

          <div
            style={{
              borderRadius: '22px',
              border: '1px solid rgba(229,231,235,0.95)',
              background: '#ffffff',
              padding: '18px',
              marginBottom: onLogout && user && !isPreviewMode ? '16px' : 0,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
              <Crown size={20} color="#014725" />
              <div>
                <div style={{ fontSize: '11px', fontWeight: 800, letterSpacing: '0.14em', color: '#014725', marginBottom: '4px' }}>MEMBERSHIP</div>
                <h3 style={{ fontSize: '18px', fontWeight: 800, color: '#111827' }}>멤버십 / 결제</h3>
              </div>
            </div>
            <p style={{ fontSize: '14px', lineHeight: 1.6, color: '#4b5563', marginBottom: '12px', wordBreak: 'keep-all' }}>
              {subscription
                ? '현재 계정에 구독 정보가 연결되어 있습니다. 결제 상태와 플랜 정보를 여기서 관리할 수 있습니다.'
                : '결과 저장과 이후 확장 기능 연결을 위해 멤버십을 설정할 수 있습니다.'}
            </p>
            {onOpenMembership && (
              <button
                type="button"
                onClick={onOpenMembership}
                style={{
                  display: 'inline-flex',
                  width: '100%',
                  height: '52px',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  borderRadius: '16px',
                  border: 'none',
                  background: 'linear-gradient(90deg, #016B38 0%, #014725 100%)',
                  color: '#ffffff',
                  fontSize: '15px',
                  fontWeight: 800,
                  boxShadow: '0 14px 28px rgba(1,71,37,0.18)',
                  cursor: 'pointer',
                }}
              >
                코드 플랜 / 결제 보기
                <ChevronRight size={18} />
              </button>
            )}
          </div>

          {onLogout && user && !isPreviewMode && (
            <button
              type="button"
              onClick={onLogout}
              style={{
                display: 'inline-flex',
                width: '100%',
                height: '52px',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                borderRadius: '16px',
                border: '1px solid rgba(229,231,235,0.95)',
                background: 'rgba(255,255,255,0.78)',
                color: '#4b5563',
                fontSize: '15px',
                fontWeight: 800,
                cursor: 'pointer',
              }}
            >
              <LogOut size={18} />
              로그아웃
            </button>
          )}
        </div>
        <ScrollIndicator containerRef={scrollRef} bottomOffset="30px" />
      </div>
    </div>
  );
}
