import { useRef } from 'react';
import { ArrowLeft, ChevronRight, Sparkles } from 'lucide-react';
import { CodePlanDetailContent, useCodePlanData, type CodePlanJourneyProgress } from './codePlanShared';
import { useMediaQuery } from '../utils/useMediaQuery';
import { ScrollIndicator } from './ScrollIndicator';

interface CodePlanScreenProps {
  questionnaireId?: string;
  isLoggedIn?: boolean;
  previewMode?: boolean;
  onBack?: () => void;
  onRequireAuth?: () => void;
  onNextGuide?: () => void;
  /** Journey 가 진행 중일 때만 전달합니다. 없으면 기존 로컬 수행률 동작 유지. */
  journeyProgress?: CodePlanJourneyProgress;
}

export function CodePlanScreen({ questionnaireId, isLoggedIn = false, previewMode = false, onBack, onRequireAuth, onNextGuide, journeyProgress }: CodePlanScreenProps) {
  const isDesktopMockup = useMediaQuery('(min-width: 768px)');
  const scrollRef = useRef<HTMLDivElement>(null);

  const data = useCodePlanData(questionnaireId);

  if (!isLoggedIn && !previewMode) {
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
              <Sparkles size={34} color="#ffffff" />
            </div>
            <h1 style={{ fontSize: '28px', fontWeight: 800, color: '#111827', marginBottom: '10px' }}>코드 플랜은 로그인 후 연결됩니다</h1>
            <p style={{ fontSize: '14px', lineHeight: 1.65, color: '#4b5563', marginBottom: '20px', wordBreak: 'keep-all' }}>
              결과 저장과 다음 장 코드 플랜은 계정 연결 후 이어서 확인할 수 있습니다.
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

  if (data.isLoading) {
    return (
      <div className="bg-white rounded-3xl shadow-xl overflow-hidden flex items-center justify-center" style={{ minHeight: '100dvh' }}>
        <div className="text-gray-500">로딩 중...</div>
      </div>
    );
  }

  if (data.error) {
    return (
      <div className="bg-white rounded-3xl shadow-xl overflow-hidden flex flex-col items-center justify-center px-6" style={{ minHeight: '100dvh' }}>
        <div className="text-red-500 mb-4">{data.error}</div>
      </div>
    );
  }

  if (!data.result) {
    return (
      <div className="bg-white rounded-3xl shadow-xl overflow-hidden flex items-center justify-center" style={{ minHeight: '100dvh' }}>
        <div className="text-gray-500">연결된 결과가 없습니다.</div>
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
            top: '54px',
            left: '-88px',
            width: '300px',
            height: '300px',
            borderRadius: '999px',
            background: 'rgba(52, 211, 153, 0.18)',
            filter: 'blur(58px)',
          }}
        />
        <div
          style={{
            position: 'absolute',
            bottom: '72px',
            right: '-96px',
            width: '320px',
            height: '320px',
            borderRadius: '999px',
            background: 'rgba(45, 212, 191, 0.16)',
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
          {onBack && (
            <button
              type="button"
              onClick={onBack}
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
            <h1 style={{ fontSize: '22px', fontWeight: 800, color: '#111827', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>Code Plan</h1>
          </div>
        </div>

        <div ref={scrollRef} style={{ flex: 1, overflowY: 'auto', padding: '18px 24px 24px', display: 'grid', gap: '16px' }}>
          {previewMode && !isLoggedIn && (
            <div
              style={{
                borderRadius: '18px',
                border: '1px solid rgba(167,243,208,0.95)',
                background: 'rgba(236,253,245,0.92)',
                padding: '14px 16px',
                fontSize: '13px',
                lineHeight: 1.65,
                color: '#065f46',
                wordBreak: 'keep-all',
              }}
            >
              임시 미리보기 화면입니다. 실제로는 회원가입 후 이 코드 플랜과 다음 페이지를 이어서 보게 됩니다.
            </div>
          )}
          <CodePlanDetailContent data={data} hideGuideSection journeyProgress={journeyProgress} />
          {onNextGuide && (
            <button
              type="button"
              onClick={onNextGuide}
              style={{
                display: 'inline-flex',
                width: '100%',
                height: '54px',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                borderRadius: '16px',
                border: 'none',
                background: 'linear-gradient(90deg, #016B38 0%, #014725 100%)',
                color: '#ffffff',
                fontSize: '15px',
                fontWeight: 800,
                boxShadow: '0 14px 28px rgba(1,71,37,0.22)',
                cursor: 'pointer',
              }}
            >
              다음 페이지: 자세 사용 설명서
              <ChevronRight size={18} />
            </button>
          )}
        </div>
        <ScrollIndicator containerRef={scrollRef} bottomOffset="30px" />
      </div>
    </div>
  );
}
