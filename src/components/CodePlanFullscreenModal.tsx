import { useRef } from 'react';
import { X } from 'lucide-react';
import { CodePlanDetailContent, useCodePlanData } from './codePlanShared';
import { ScrollIndicator } from './ScrollIndicator';

interface CodePlanFullscreenModalProps {
  questionnaireId?: string;
  onClose: () => void;
}

export function CodePlanFullscreenModal({ questionnaireId, onClose }: CodePlanFullscreenModalProps) {
  const data = useCodePlanData(questionnaireId);
  const scrollRef = useRef<HTMLDivElement>(null);

  return (
    <div
      onClick={onClose}
      style={{
        position: 'absolute',
        inset: 0,
        zIndex: 40,
        background: 'rgba(15,23,42,0.34)',
        backdropFilter: 'blur(16px)',
        display: 'flex',
      }}
    >
      <div
        onClick={(event) => event.stopPropagation()}
        style={{
          position: 'relative',
          width: '100%',
          height: '100%',
          borderRadius: '32px',
          overflow: 'hidden',
          background: 'linear-gradient(145deg, #ecfdf5 0%, #f3fdfb 42%, #f0fdfa 100%)',
          boxShadow: '0 24px 60px rgba(15, 23, 42, 0.24)',
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
              justifyContent: 'space-between',
              gap: '12px',
              padding: '22px 24px 18px',
              background: 'rgba(255,255,255,0.52)',
              backdropFilter: 'blur(18px)',
            }}
          >
            <div style={{ minWidth: 0 }}>
                <h1 style={{ fontSize: '22px', fontWeight: 800, color: '#111827', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                Code Plan
              </h1>
            </div>
            <button
              type="button"
              onClick={onClose}
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
                flexShrink: 0,
              }}
              title="닫기"
            >
              <X size={18} />
            </button>
          </div>

          <div ref={scrollRef} style={{ flex: 1, overflowY: 'auto', padding: '18px 24px 24px' }}>
            {data.isLoading ? (
              <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#6b7280' }}>로딩 중...</div>
            ) : data.error ? (
              <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#ef4444' }}>{data.error}</div>
            ) : !data.result ? (
              <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#6b7280' }}>연결된 결과가 없습니다.</div>
            ) : (
              <CodePlanDetailContent data={data} />
            )}
          </div>
          <ScrollIndicator containerRef={scrollRef} bottomOffset="30px" />
        </div>
      </div>
    </div>
  );
}
