import { useState } from 'react';
import { ChevronDown, ChevronUp, ArrowLeft, Sparkles } from 'lucide-react';

interface ConsentScreenProps {
  onBack?: () => void;
  onAgree: () => void;
}

export function ConsentScreen({ onBack, onAgree }: ConsentScreenProps) {
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [agreeContent, setAgreeContent] = useState(false);
  const [agreePrivacy, setAgreePrivacy] = useState(false);

  const canProceed = agreeContent && agreePrivacy;

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
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            borderRadius: '28px',
            background: 'rgba(255,255,255,0.78)',
            boxShadow: '0 24px 48px rgba(15, 23, 42, 0.12)',
            backdropFilter: 'blur(20px)',
            padding: '24px',
          }}
        >
          <div style={{ marginBottom: '18px' }}>
            <div style={{ fontSize: '11px', fontWeight: 800, letterSpacing: '0.16em', color: '#059669', marginBottom: '8px' }}>CONSENT</div>
            <h1 style={{ fontSize: '28px', lineHeight: 1.3, fontWeight: 800, color: '#111827', marginBottom: '10px', wordBreak: 'keep-all' }}>
              mebody 체형 분석 전
              <br />
              안내 및 동의
            </h1>
            <p style={{ fontSize: '14px', lineHeight: 1.65, color: '#4b5563', wordBreak: 'keep-all' }}>
              웰니스 가이드를 위한 셀프 체크 서비스이며 의료행위를 대신하지 않습니다.
            </p>
          </div>

          <div style={{ flex: 1, overflowY: 'auto', paddingRight: '2px' }}>
            <div
              style={{
                borderRadius: '18px',
                border: '1px solid rgba(209,250,229,0.95)',
                background: 'rgba(236,253,245,0.92)',
                padding: '16px 18px',
                marginBottom: '16px',
              }}
            >
              <ul style={{ display: 'grid', gap: '10px', fontSize: '14px', lineHeight: 1.6, color: '#374151' }}>
                <li style={{ display: 'flex', gap: '10px' }}>
                  <span style={{ color: '#10b981', fontWeight: 800 }}>•</span>
                  <span>본 서비스는 웰니스 가이드를 위한 체형(자세) 분석입니다.</span>
                </li>
                <li style={{ display: 'flex', gap: '10px' }}>
                  <span style={{ color: '#10b981', fontWeight: 800 }}>•</span>
                  <span>40문항 응답을 바탕으로 현재의 mebody 코드를 추정합니다.</span>
                </li>
                <li style={{ display: 'flex', gap: '10px' }}>
                  <span style={{ color: '#10b981', fontWeight: 800 }}>•</span>
                  <span>개인차, 생활 습관, 환경, 컨디션에 따라 결과는 달라질 수 있습니다.</span>
                </li>
                <li style={{ display: 'flex', gap: '10px' }}>
                  <span style={{ color: '#10b981', fontWeight: 800 }}>•</span>
                  <span>의료행위(진단·치료·교정·재활)가 아니며 의학적 판단을 대체하지 않습니다.</span>
                </li>
                <li style={{ display: 'flex', gap: '10px' }}>
                  <span style={{ color: '#10b981', fontWeight: 800 }}>•</span>
                  <span>통증이나 이상 증상이 있다면 전문가 상담을 우선해주세요.</span>
                </li>
              </ul>
            </div>

            <div
              style={{
                borderRadius: '18px',
                border: '1px solid rgba(229,231,235,0.95)',
                background: '#ffffff',
                overflow: 'hidden',
                marginBottom: '18px',
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
                  padding: '16px 18px',
                  background: 'rgba(249,250,251,0.92)',
                  color: '#1f2937',
                  fontSize: '15px',
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                <span>자세히 보기</span>
                {detailsOpen ? <ChevronUp size={18} color="#6b7280" /> : <ChevronDown size={18} color="#6b7280" />}
              </button>
              {detailsOpen && (
                <div style={{ borderTop: '1px solid rgba(243,244,246,1)', padding: '16px 18px', display: 'grid', gap: '14px' }}>
                  <div>
                    <div style={{ fontSize: '13px', fontWeight: 800, color: '#111827', marginBottom: '4px' }}>제공 범위</div>
                    <p style={{ fontSize: '14px', lineHeight: 1.65, color: '#4b5563', wordBreak: 'keep-all' }}>
                      40문항 설문을 바탕으로 현재의 정렬 패턴과 mebody 코드를 추정하고, 결과 이해를 위한 가이드를 제공합니다.
                    </p>
                  </div>
                  <div>
                    <div style={{ fontSize: '13px', fontWeight: 800, color: '#111827', marginBottom: '4px' }}>비제공 범위</div>
                    <p style={{ fontSize: '14px', lineHeight: 1.65, color: '#4b5563', wordBreak: 'keep-all' }}>
                      질병 진단, 통증 판독, 치료·재활·교정 처방은 제공하지 않으며, 의학적 판단을 대신하지 않습니다.
                    </p>
                  </div>
                  <div>
                    <div style={{ fontSize: '13px', fontWeight: 800, color: '#111827', marginBottom: '4px' }}>개인차 및 이용</div>
                    <p style={{ fontSize: '14px', lineHeight: 1.65, color: '#4b5563', wordBreak: 'keep-all' }}>
                      개인차, 환경, 생활 습관, 컨디션에 따라 결과는 달라질 수 있으며, 회원가입 시 설문 결과는 계정과 연결됩니다.
                    </p>
                  </div>
                </div>
              )}
            </div>

            <div style={{ display: 'grid', gap: '12px' }}>
              <label
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '12px',
                  borderRadius: '16px',
                  background: 'rgba(255,255,255,0.88)',
                  padding: '14px 16px',
                  border: '1px solid rgba(229,231,235,0.95)',
                  cursor: 'pointer',
                }}
              >
                <input
                  type="checkbox"
                  checked={agreeContent}
                  onChange={(event) => setAgreeContent(event.target.checked)}
                  style={{ marginTop: '2px', width: '22px', height: '22px', accentColor: '#10b981', cursor: 'pointer' }}
                />
                <span style={{ fontSize: '15px', lineHeight: 1.6, color: '#374151', wordBreak: 'keep-all' }}>
                  위 내용을 이해했고, mebody가 웰니스 목적의 체형 분석 서비스임을 확인했습니다.
                </span>
              </label>

              <label
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '12px',
                  borderRadius: '16px',
                  background: 'rgba(255,255,255,0.88)',
                  padding: '14px 16px',
                  border: '1px solid rgba(229,231,235,0.95)',
                  cursor: 'pointer',
                }}
              >
                <input
                  type="checkbox"
                  checked={agreePrivacy}
                  onChange={(event) => setAgreePrivacy(event.target.checked)}
                  style={{ marginTop: '2px', width: '22px', height: '22px', accentColor: '#10b981', cursor: 'pointer' }}
                />
                <span style={{ fontSize: '15px', lineHeight: 1.6, color: '#374151', wordBreak: 'keep-all' }}>
                  개인정보 처리방침과 이용약관에 동의합니다.
                </span>
              </label>
            </div>
          </div>

          <button
            type="button"
            onClick={onAgree}
            disabled={!canProceed}
            style={{
              marginTop: '18px',
              display: 'inline-flex',
              width: '100%',
              height: '58px',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              borderRadius: '18px',
              border: 'none',
              background: canProceed ? 'linear-gradient(90deg, #10b981 0%, #14b8a6 100%)' : '#e5e7eb',
              color: canProceed ? '#ffffff' : '#9ca3af',
              fontSize: '16px',
              fontWeight: 800,
              boxShadow: canProceed ? '0 14px 28px rgba(20,184,166,0.25)' : 'none',
              cursor: canProceed ? 'pointer' : 'not-allowed',
            }}
          >
            내 체형 코드 분석 시작하기
            <span style={{ fontSize: '18px' }}>→</span>
          </button>
        </div>
      </div>
    </div>
  );
}
