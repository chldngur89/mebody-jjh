import { useRef, useState, type MouseEvent as ReactMouseEvent } from 'react';
import { BRAND_PAGE_BG } from '../theme/brand';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { preferredScrollBehavior } from '../lib/viewport';
import { useMediaQuery } from '../utils/useMediaQuery';
import { ScrollIndicator } from './ScrollIndicator';

interface ConsentScreenProps {
  onBack?: () => void;
  onAgree: () => void;
}

function isInteractiveTarget(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) return false;
  return Boolean(target.closest('button, a, input, label, textarea, select, [role="button"]'));
}

export function ConsentScreen({ onAgree }: ConsentScreenProps) {
  const isDesktopMockup = useMediaQuery('(min-width: 768px)');
  const screenHeight = isDesktopMockup ? '100%' : 'var(--mebody-app-height)';

  const [detailsOpen, setDetailsOpen] = useState(false);
  const [agreeContent, setAgreeContent] = useState(false);
  const [agreePrivacy, setAgreePrivacy] = useState(false);
  const consentScrollRef = useRef<HTMLDivElement>(null);

  const canProceed = agreeContent && agreePrivacy;

  const scrollToBottom = () => {
    const el = consentScrollRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior: preferredScrollBehavior() });
  };

  const handleSurfaceClick = (event: ReactMouseEvent) => {
    if (isInteractiveTarget(event.target)) return;
    scrollToBottom();
  };

  return (
    <div
      className="mebody-app-surface"
      onClick={handleSurfaceClick}
      style={{
        position: 'relative',
        overflow: 'hidden',
        height: screenHeight,
        minHeight: screenHeight,
        maxHeight: screenHeight,
        borderRadius: isDesktopMockup ? '32px' : 0,
        background: BRAND_PAGE_BG,
        boxShadow: isDesktopMockup ? '0 24px 60px rgba(15, 23, 42, 0.13)' : 'none',
        boxSizing: 'border-box',
        paddingTop: 'env(safe-area-inset-top)',
        paddingBottom: 'env(safe-area-inset-bottom)',
      }}
    >
      <div
        style={{
          position: 'relative',
          zIndex: 1,
          display: 'flex',
          height: '100%',
          flexDirection: 'column',
          padding: isDesktopMockup ? '16px 20px 16px' : '8px 12px 8px',
          boxSizing: 'border-box',
        }}
      >
        <div
          style={{
            flex: 1,
            minHeight: 0,
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            borderRadius: '20px',
            background: '#ffffff',
            boxShadow: '0 12px 28px rgba(15, 23, 42, 0.08)',
            padding: isDesktopMockup ? '20px 20px 16px' : '16px 14px 12px',
          }}
        >
          <div style={{ marginBottom: '12px', textAlign: 'center', flexShrink: 0 }}>
            <div style={{ fontSize: '11px', fontWeight: 800, letterSpacing: '0.12em', color: '#014725', marginBottom: '8px' }}>
              시작 전 안내
            </div>
            <h1
              style={{
                fontSize: isDesktopMockup ? '24px' : '22px',
                lineHeight: 1.3,
                fontWeight: 850,
                color: '#111827',
                marginBottom: '8px',
                wordBreak: 'keep-all',
                letterSpacing: '-0.03em',
              }}
            >
              체크를 시작하기 전에
              <br />
              아래 내용을 확인해 주세요
            </h1>
            <p style={{ fontSize: '13px', lineHeight: 1.55, color: '#4b5563', wordBreak: 'keep-all' }}>
              몇 분 걸리는 셀프 체크예요. 의료 진단이나 치료를 대신하지 않습니다.
            </p>
          </div>

          <div
            style={{
              flex: 1,
              position: 'relative',
              minHeight: 0,
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            <div
              ref={consentScrollRef}
              style={{ flex: 1, overflowY: 'auto', paddingRight: '2px', minHeight: 0, WebkitOverflowScrolling: 'touch' }}
            >
              <div
                style={{
                  borderRadius: '14px',
                  background: '#f3faf6',
                  padding: '14px 14px',
                  marginBottom: '10px',
                }}
              >
                <ul style={{ display: 'grid', gap: '10px', fontSize: '13px', lineHeight: 1.55, color: '#374151' }}>
                  <li style={{ display: 'flex', gap: '10px' }}>
                    <span style={{ color: '#016B38', fontWeight: 800, flexShrink: 0 }}>1</span>
                    <span>질문에 답하면 지금의 자세·체형 경향을 mebody 코드로 보여줍니다.</span>
                  </li>
                  <li style={{ display: 'flex', gap: '10px' }}>
                    <span style={{ color: '#016B38', fontWeight: 800, flexShrink: 0 }}>2</span>
                    <span>생활 습관, 환경, 컨디션에 따라 결과는 달라질 수 있어요.</span>
                  </li>
                  <li style={{ display: 'flex', gap: '10px' }}>
                    <span style={{ color: '#016B38', fontWeight: 800, flexShrink: 0 }}>3</span>
                    <span>질병 진단·통증 판독·치료/교정 처방은 포함되지 않습니다.</span>
                  </li>
                  <li style={{ display: 'flex', gap: '10px' }}>
                    <span style={{ color: '#016B38', fontWeight: 800, flexShrink: 0 }}>4</span>
                    <span>통증이나 이상이 있으면 먼저 전문가 상담을 우선해 주세요.</span>
                  </li>
                </ul>
              </div>

              <div
                style={{
                  borderRadius: '14px',
                  border: '1px solid #e5e7eb',
                  background: '#ffffff',
                  overflow: 'hidden',
                  marginBottom: '10px',
                }}
              >
                <button
                  type="button"
                  onClick={() => setDetailsOpen((open) => !open)}
                  style={{
                    display: 'flex',
                    width: '100%',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '12px 14px',
                    background: '#f9fafb',
                    color: '#1f2937',
                    fontSize: '13px',
                    fontWeight: 700,
                    cursor: 'pointer',
                  }}
                >
                  <span>자세히 보기</span>
                  {detailsOpen ? <ChevronUp size={18} color="#6b7280" /> : <ChevronDown size={18} color="#6b7280" />}
                </button>
                {detailsOpen && (
                  <div style={{ borderTop: '1px solid #f3f4f6', padding: '12px 14px', display: 'grid', gap: '12px' }}>
                    <div>
                      <div style={{ fontSize: '13px', fontWeight: 800, color: '#111827', marginBottom: '4px' }}>제공하는 것</div>
                      <p style={{ fontSize: '13px', lineHeight: 1.55, color: '#4b5563', wordBreak: 'keep-all' }}>
                        설문 기반의 체형 코드와, 결과를 이해하기 위한 웰니스 가이드입니다.
                      </p>
                    </div>
                    <div>
                      <div style={{ fontSize: '13px', fontWeight: 800, color: '#111827', marginBottom: '4px' }}>제공하지 않는 것</div>
                      <p style={{ fontSize: '13px', lineHeight: 1.55, color: '#4b5563', wordBreak: 'keep-all' }}>
                        질병 진단, 통증 판독, 치료·재활·교정 처방은 하지 않으며 의학적 판단을 대신하지 않습니다.
                      </p>
                    </div>
                    <div>
                      <div style={{ fontSize: '13px', fontWeight: 800, color: '#111827', marginBottom: '4px' }}>결과 저장</div>
                      <p style={{ fontSize: '13px', lineHeight: 1.55, color: '#4b5563', wordBreak: 'keep-all' }}>
                        로그인하면 설문 결과가 계정에 연결되어 다음에 다시 볼 수 있습니다.
                      </p>
                    </div>
                  </div>
                )}
              </div>

              <div style={{ display: 'grid', gap: '8px', paddingBottom: '8px' }}>
                <label
                  style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '12px',
                    borderRadius: '14px',
                    background: '#ffffff',
                    padding: '12px 14px',
                    border: '1px solid #e5e7eb',
                    cursor: 'pointer',
                  }}
                >
                  <input
                    type="checkbox"
                    checked={agreeContent}
                    onChange={(event) => setAgreeContent(event.target.checked)}
                    style={{ position: 'absolute', width: 1, height: 1, opacity: 0, pointerEvents: 'none' }}
                  />
                  <span
                    aria-hidden
                    style={{
                      width: '22px',
                      height: '22px',
                      marginTop: '1px',
                      borderRadius: '6px',
                      border: agreeContent ? '2px solid #016B38' : '2px solid #9ca3af',
                      background: agreeContent ? '#016B38' : '#ffffff',
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                      boxSizing: 'border-box',
                    }}
                  >
                    {agreeContent && <span style={{ color: '#ffffff', fontSize: '14px', fontWeight: 900, lineHeight: 1 }}>✓</span>}
                  </span>
                  <span style={{ fontSize: '14px', lineHeight: 1.5, color: '#374151', wordBreak: 'keep-all', flex: 1 }}>
                    위 안내를 확인했고, 의료 진단이 아님을 이해했습니다.
                  </span>
                </label>

                <label
                  style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '12px',
                    borderRadius: '14px',
                    background: '#ffffff',
                    padding: '12px 14px',
                    border: '1px solid #e5e7eb',
                    cursor: 'pointer',
                  }}
                >
                  <input
                    type="checkbox"
                    checked={agreePrivacy}
                    onChange={(event) => setAgreePrivacy(event.target.checked)}
                    style={{ position: 'absolute', width: 1, height: 1, opacity: 0, pointerEvents: 'none' }}
                  />
                  <span
                    aria-hidden
                    style={{
                      width: '22px',
                      height: '22px',
                      marginTop: '1px',
                      borderRadius: '6px',
                      border: agreePrivacy ? '2px solid #016B38' : '2px solid #9ca3af',
                      background: agreePrivacy ? '#016B38' : '#ffffff',
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                      boxSizing: 'border-box',
                    }}
                  >
                    {agreePrivacy && <span style={{ color: '#ffffff', fontSize: '14px', fontWeight: 900, lineHeight: 1 }}>✓</span>}
                  </span>
                  <span style={{ fontSize: '14px', lineHeight: 1.5, color: '#374151', wordBreak: 'keep-all', flex: 1 }}>
                    개인정보 처리방침과 이용약관에 동의합니다.
                  </span>
                </label>
              </div>
            </div>
            <ScrollIndicator containerRef={consentScrollRef} bottomOffset="24px" />
          </div>

          <button
            type="button"
            onClick={canProceed ? onAgree : scrollToBottom}
            aria-disabled={!canProceed}
            style={{
              marginTop: '10px',
              flexShrink: 0,
              display: 'inline-flex',
              width: '100%',
              height: '52px',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              borderRadius: '14px',
              border: 'none',
              background: canProceed ? 'linear-gradient(90deg, #016B38 0%, #014725 100%)' : '#e5e7eb',
              color: canProceed ? '#ffffff' : '#9ca3af',
              fontSize: '16px',
              fontWeight: 800,
              boxShadow: canProceed ? '0 12px 24px rgba(1,71,37,0.22)' : 'none',
              cursor: 'pointer',
            }}
          >
            {canProceed ? '동의하고 시작하기' : '아래로 내려 동의하기'}
            <span style={{ fontSize: '18px' }}>→</span>
          </button>
        </div>
      </div>
    </div>
  );
}
