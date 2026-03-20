import { useCallback, useEffect, useState } from 'react';
import type { User } from '@supabase/supabase-js';
import { ArrowLeft, ChevronRight, Crown, LayoutDashboard, Sparkles, UserRound } from 'lucide-react';
import { fetchQuestionnaireResult, type BodyCodeContent, type QuestionnaireResponse } from '../api/questionnaire';
import { fetchMySubscription, type UserSubscription } from '../api/account';
import { fetchAppImages } from '../api/content';
import { characterNames } from '../utils/bodyCodeCalculator';
import { LOCAL_FALLBACK_CHARACTER_IMAGE, resolveCharacterImageUrl } from '../utils/characterImages';

interface MyPageScreenProps {
  user: User | null;
  latestResultId?: string;
  onBack?: () => void;
  onOpenLatestResult?: () => void;
  onOpenMembership?: () => void;
  onStartDiagnosis?: () => void;
  onRequireAuth?: () => void;
  previewMode?: boolean;
}

type ResultWithContent = QuestionnaireResponse & { body_code_content?: BodyCodeContent | null };

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

export function MyPageScreen({
  user,
  latestResultId,
  onBack,
  onOpenLatestResult,
  onOpenMembership,
  onStartDiagnosis,
  onRequireAuth,
  previewMode = false,
}: MyPageScreenProps) {
  const [latestResult, setLatestResult] = useState<ResultWithContent | null>(null);
  const [subscription, setSubscription] = useState<UserSubscription | null>(null);
  const [appImages, setAppImages] = useState<Record<string, string>>({});
  const [failedImageUrls, setFailedImageUrls] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAppImages().then(setAppImages).catch(() => setAppImages({}));
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      if (!user) {
        setLatestResult(null);
        setSubscription(null);
        setLoading(false);
        return;
      }

      setLoading(true);
      try {
        const [resultData, subscriptionData] = await Promise.all([
          latestResultId ? fetchQuestionnaireResult(latestResultId) : Promise.resolve(null),
          fetchMySubscription(user.id),
        ]);

        if (cancelled) return;
        setLatestResult((resultData as ResultWithContent | null) ?? null);
        setSubscription(subscriptionData);
      } catch (loadError) {
        if (cancelled) return;
        console.warn('MyPageScreen load failed:', loadError);
        setLatestResult(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [latestResultId, user]);

  const handleImageError = useCallback((url: string) => {
    setFailedImageUrls((prev) => new Set(prev).add(url));
  }, []);

  const isPreviewMode = previewMode && !user;
  const bodyCode = latestResult?.calculated_code || (isPreviewMode ? 'FRRS' : '');
  const content = latestResult?.body_code_content ?? null;
  const characterName = content?.character_name || (bodyCode ? characterNames[bodyCode] : '나의 mebody 코드');
  const summaryLine = latestResult ? getSummaryLine(content) : isPreviewMode ? '가입 후에는 최근 결과와 코드 플랜, 멤버십 상태를 이 화면에서 이어서 확인합니다.' : getSummaryLine(content);
  const characterImage = bodyCode ? resolveCharacterImageUrl(bodyCode, appImages, failedImageUrls) : '';
  const displayName = user ? getDisplayName(user) : 'Preview';
  const displayEmail = user?.email ?? 'preview@mebody.app';
  const effectiveStatusLabel = isPreviewMode ? '체험 사용 중' : getStatusLabel(subscription);

  if (!user && !isPreviewMode) {
    return (
      <div
        style={{
          position: 'relative',
          overflow: 'hidden',
          height: '844px',
          borderRadius: '32px',
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
              <Sparkles size={18} color="#059669" />
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
            <div style={{ width: '84px', height: '84px', margin: '0 auto 18px', borderRadius: '24px', background: 'linear-gradient(135deg, #10b981 0%, #14b8a6 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 14px 30px rgba(16,185,129,0.30)' }}>
              <LayoutDashboard size={34} color="#ffffff" />
            </div>
            <h1 style={{ fontSize: '28px', fontWeight: 800, color: '#111827', marginBottom: '10px' }}>내 페이지는 로그인 후 연결됩니다</h1>
            <p style={{ fontSize: '14px', lineHeight: 1.65, color: '#4b5563', marginBottom: '20px', wordBreak: 'keep-all' }}>
              계정 정보, 최근 결과, 멤버십 상태는 로그인 후 이 화면에서 관리할 수 있습니다.
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
                  background: 'linear-gradient(90deg, #10b981 0%, #14b8a6 100%)',
                  color: '#ffffff',
                  fontSize: '16px',
                  fontWeight: 800,
                  boxShadow: '0 14px 28px rgba(20,184,166,0.25)',
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
        height: '844px',
        borderRadius: '32px',
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
            <Sparkles size={18} color="#059669" />
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
            overflowY: 'auto',
            borderRadius: '28px',
            background: 'rgba(255,255,255,0.78)',
            boxShadow: '0 24px 48px rgba(15, 23, 42, 0.12)',
            backdropFilter: 'blur(20px)',
            padding: '24px',
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
                <div style={{ fontSize: '11px', fontWeight: 800, letterSpacing: '0.16em', color: '#059669', marginBottom: '8px' }}>MY PAGE</div>
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
                <UserRound size={24} color="#059669" />
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
                <div style={{ fontSize: '11px', fontWeight: 800, letterSpacing: '0.14em', color: '#059669', marginBottom: '4px' }}>LATEST RESULT</div>
                <h2 style={{ fontSize: '20px', fontWeight: 800, color: '#111827' }}>최근 mebody 코드</h2>
              </div>
              {bodyCode ? (
                <div style={{ borderRadius: '999px', background: 'rgba(236,253,245,0.92)', padding: '8px 12px', fontSize: '13px', fontWeight: 800, color: '#047857' }}>{bodyCode}</div>
              ) : null}
            </div>

            {loading ? (
              <div style={{ fontSize: '14px', color: '#6b7280' }}>최근 결과를 불러오는 중...</div>
            ) : latestResult || isPreviewMode ? (
              <div style={{ display: 'grid', gap: '14px' }}>
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
                      <div style={{ fontSize: '28px', fontWeight: 800, color: '#059669' }}>{bodyCode}</div>
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
                  {isPreviewMode ? '가입 후 최근 결과 보기' : '최근 결과 보기'}
                  <ChevronRight size={18} />
                </button>
              </div>
            ) : (
              <div style={{ display: 'grid', gap: '12px' }}>
                <p style={{ fontSize: '14px', lineHeight: 1.6, color: '#6b7280', wordBreak: 'keep-all' }}>
                  아직 계정에 연결된 최근 결과가 없습니다. 새 진단을 완료하면 여기에 가장 최근 결과가 표시됩니다.
                </p>
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
                      background: 'linear-gradient(90deg, #10b981 0%, #14b8a6 100%)',
                      color: '#ffffff',
                      fontSize: '15px',
                      fontWeight: 800,
                      boxShadow: '0 14px 28px rgba(20,184,166,0.18)',
                      cursor: 'pointer',
                    }}
                  >
                    새 진단 시작하기
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
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
              <Crown size={20} color="#0f766e" />
              <div>
                <div style={{ fontSize: '11px', fontWeight: 800, letterSpacing: '0.14em', color: '#059669', marginBottom: '4px' }}>MEMBERSHIP</div>
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
                  background: 'linear-gradient(90deg, #10b981 0%, #14b8a6 100%)',
                  color: '#ffffff',
                  fontSize: '15px',
                  fontWeight: 800,
                  boxShadow: '0 14px 28px rgba(20,184,166,0.18)',
                  cursor: 'pointer',
                }}
              >
                코드 플랜 / 결제 보기
                <ChevronRight size={18} />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
