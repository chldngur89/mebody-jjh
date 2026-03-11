import { useEffect, useState } from 'react';
import { ArrowLeft, ChevronRight, LockKeyhole, Sparkles } from 'lucide-react';
import { fetchQuestionnaireResult, fetchQuestions } from '../api/questionnaire';
import { buildAdvancedTagAnalysisFromStored } from '../utils/advancedTagEngine';
import type { QuestionnaireResponse, Question } from '../api/questionnaire';

interface AdvancedPreviewScreenProps {
  questionnaireId?: string;
  isLoggedIn?: boolean;
  onBack?: () => void;
  onGoMembership?: () => void;
  onGoAuth?: () => void;
}

export function AdvancedPreviewScreen({
  questionnaireId,
  isLoggedIn = false,
  onBack,
  onGoMembership,
  onGoAuth,
}: AdvancedPreviewScreenProps) {
  const [result, setResult] = useState<QuestionnaireResponse | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!questionnaireId) {
      setLoading(false);
      setError('심화 분석에 사용할 결과를 찾을 수 없습니다.');
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    Promise.all([fetchQuestionnaireResult(questionnaireId), fetchQuestions()])
      .then(([nextResult, nextQuestions]) => {
        if (cancelled) return;
        setResult(nextResult);
        setQuestions(nextQuestions);
      })
      .catch((nextError) => {
        if (cancelled) return;
        console.error('Failed to prepare advanced preview:', nextError);
        setError('심화 분석 정보를 불러오는 중 문제가 발생했습니다.');
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [questionnaireId]);

  const analysis = result
    ? buildAdvancedTagAnalysisFromStored(
        result.advanced_preview_tags,
        result.advanced_confirmed_tags,
        result.answers,
        questions,
      )
    : null;

  const handleContinue = () => {
    if (isLoggedIn) {
      onGoMembership?.();
      return;
    }

    onGoAuth?.();
  };

  return (
    <div
      style={{
        position: 'relative',
        overflow: 'hidden',
        height: '844px',
        borderRadius: '32px',
        background: 'linear-gradient(135deg, #ecfdf5 0%, #f0fdfa 50%, #ecfeff 100%)',
        boxShadow: '0 24px 60px rgba(15, 23, 42, 0.13)',
      }}
    >
      <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none' }}>
        <div
          style={{
            position: 'absolute',
            top: '80px',
            left: '-80px',
            width: '384px',
            height: '384px',
            borderRadius: '999px',
            background: 'rgba(52, 211, 153, 0.18)',
            filter: 'blur(64px)',
          }}
        />
        <div
          style={{
            position: 'absolute',
            bottom: '80px',
            right: '-80px',
            width: '384px',
            height: '384px',
            borderRadius: '999px',
            background: 'rgba(45, 212, 191, 0.18)',
            filter: 'blur(64px)',
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
          padding: '22px 24px 18px',
          fontFamily: '"SUIT Variable","Pretendard Variable","Noto Sans KR",sans-serif',
        }}
      >
        <div style={{ marginBottom: '20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              borderRadius: '999px',
              border: '1px solid rgba(255,255,255,0.28)',
              background: 'rgba(255,255,255,0.62)',
              padding: '8px 16px',
              boxShadow: '0 10px 20px rgba(15, 23, 42, 0.10)',
              backdropFilter: 'blur(12px)',
            }}
          >
            <Sparkles size={18} color="#059669" />
            <span style={{ fontSize: '13px', fontWeight: 600, color: '#1f2937' }}>MEBODY</span>
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
                border: '1px solid rgba(255,255,255,0.28)',
                background: 'rgba(255,255,255,0.62)',
                padding: '8px 14px',
                color: '#374151',
                fontSize: '12px',
                fontWeight: 600,
                boxShadow: '0 10px 20px rgba(15, 23, 42, 0.10)',
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
            borderRadius: '24px',
            background: 'rgba(255,255,255,0.74)',
            boxShadow: '0 20px 46px rgba(15, 23, 42, 0.12)',
            backdropFilter: 'blur(20px)',
            padding: '24px',
          }}
        >
          <div style={{ marginBottom: '18px', textAlign: 'center' }}>
            <div style={{ fontSize: '12px', fontWeight: 700, letterSpacing: '0.12em', color: '#059669', marginBottom: '6px' }}>
              ADVANCED TAG FLOW
            </div>
            <h1 style={{ fontSize: '28px', fontWeight: 800, lineHeight: 1.2, color: '#1f2937' }}>
              심화 태그 분석 준비
            </h1>
            <p style={{ marginTop: '8px', fontSize: '14px', lineHeight: 1.65, color: '#4b5563', wordBreak: 'keep-all' }}>
              기본 코드는 큰 줄기입니다. 다음 단계에서는 추가 질문으로 숨은 생활 패턴을 확정하고, 루틴 우선순위까지 더 세밀하게 조정합니다.
            </p>
          </div>

          {loading ? (
            <div style={{ color: '#6b7280', fontSize: '14px', textAlign: 'center', paddingTop: '40px' }}>로딩 중...</div>
          ) : error ? (
            <div
              style={{
                borderRadius: '16px',
                border: '1px solid rgba(254, 205, 211, 1)',
                background: 'rgba(254, 242, 242, 0.95)',
                color: '#b91c1c',
                fontSize: '13px',
                padding: '12px 14px',
              }}
            >
              {error}
            </div>
          ) : (
            <>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
                  gap: '10px',
                  marginBottom: '16px',
                }}
              >
                {[
                  { step: '1', title: '기본 결과', body: '40문항 코드와 즉시 태그 확인' },
                  { step: '2', title: '추가 질문', body: '태그별 3문항으로 원인 확정' },
                  { step: '3', title: '심화 결과', body: '루틴 순서와 우선순위 강화' },
                ].map((item) => (
                  <div
                    key={item.step}
                    style={{
                      borderRadius: '16px',
                      border: '1px solid rgba(229,231,235,0.9)',
                      background: 'rgba(255,255,255,0.84)',
                      padding: '14px 12px',
                    }}
                  >
                    <div style={{ fontSize: '11px', fontWeight: 700, color: '#10b981', marginBottom: '4px' }}>STEP {item.step}</div>
                    <div style={{ fontSize: '14px', fontWeight: 700, color: '#111827', marginBottom: '6px' }}>{item.title}</div>
                    <div style={{ fontSize: '12px', lineHeight: 1.45, color: '#6b7280', wordBreak: 'keep-all' }}>{item.body}</div>
                  </div>
                ))}
              </div>

              {analysis?.confirmedTags.length ? (
                <div
                  style={{
                    borderRadius: '18px',
                    border: '1px solid rgba(167, 243, 208, 0.9)',
                    background: 'rgba(236, 253, 245, 0.9)',
                    padding: '16px',
                    marginBottom: '12px',
                  }}
                >
                  <div style={{ fontSize: '12px', fontWeight: 700, letterSpacing: '0.08em', color: '#059669', marginBottom: '10px' }}>
                    지금 감지된 패턴
                  </div>
                  <div style={{ display: 'grid', gap: '10px' }}>
                    {analysis.confirmedTags.slice(0, 4).map((tag) => (
                      <div key={tag.key} style={{ borderRadius: '14px', background: '#ffffff', padding: '12px 14px' }}>
                        <div style={{ fontSize: '14px', fontWeight: 700, color: '#111827' }}>{tag.name}</div>
                        <div style={{ marginTop: '2px', fontSize: '13px', fontWeight: 600, color: '#374151' }}>{tag.title}</div>
                        <div style={{ marginTop: '4px', fontSize: '12px', lineHeight: 1.5, color: '#6b7280', wordBreak: 'keep-all' }}>{tag.reason}</div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}

              {analysis?.previewTags.length ? (
                <div
                  style={{
                    borderRadius: '18px',
                    border: '1px solid rgba(229,231,235,0.9)',
                    background: 'linear-gradient(135deg, rgba(249,250,251,0.88) 0%, rgba(243,244,246,0.88) 100%)',
                    padding: '16px',
                  }}
                >
                  <div style={{ fontSize: '12px', fontWeight: 700, letterSpacing: '0.08em', color: '#059669', marginBottom: '10px' }}>
                    추가 3문항으로 확정할 패턴
                  </div>
                  <div style={{ display: 'grid', gap: '10px' }}>
                    {analysis.previewTags.slice(0, 5).map((tag) => (
                      <div
                        key={tag.key}
                        style={{
                          display: 'flex',
                          gap: '12px',
                          borderRadius: '14px',
                          background: '#ffffff',
                          padding: '12px 14px',
                        }}
                      >
                        <div
                          style={{
                            display: 'flex',
                            width: '36px',
                            height: '36px',
                            alignItems: 'center',
                            justifyContent: 'center',
                            borderRadius: '12px',
                            background: 'rgba(243,244,246,0.95)',
                            color: '#6b7280',
                            flexShrink: 0,
                          }}
                        >
                          <LockKeyhole size={16} />
                        </div>
                        <div style={{ minWidth: 0 }}>
                          <div style={{ fontSize: '14px', fontWeight: 700, color: '#111827' }}>{tag.name}</div>
                          <div style={{ marginTop: '2px', fontSize: '13px', fontWeight: 600, color: '#374151' }}>{tag.title}</div>
                          <div style={{ marginTop: '4px', fontSize: '12px', lineHeight: 1.5, color: '#6b7280', wordBreak: 'keep-all' }}>{tag.reason}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div
                  style={{
                    borderRadius: '18px',
                    border: '1px solid rgba(229,231,235,0.9)',
                    background: 'rgba(255,255,255,0.84)',
                    padding: '16px',
                    fontSize: '13px',
                    lineHeight: 1.6,
                    color: '#6b7280',
                    wordBreak: 'keep-all',
                  }}
                >
                  현재는 코드 중심 결과가 더 명확합니다. 이후 재측정 또는 마이페이지 기록이 쌓이면 심화 태그를 더 정확하게 확정할 수 있습니다.
                </div>
              )}

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
                  borderRadius: '14px',
                  border: 'none',
                  background: 'linear-gradient(90deg, #10b981 0%, #14b8a6 100%)',
                  color: '#ffffff',
                  fontSize: '16px',
                  fontWeight: 700,
                  cursor: 'pointer',
                  marginTop: '16px',
                  boxShadow: '0 12px 26px rgba(20,184,166,0.30)',
                }}
              >
                <span>{isLoggedIn ? '심화 맞춤 관리 진행하기' : '회원가입 후 심화 분석 이어가기'}</span>
                <ChevronRight size={18} />
              </button>

              <div style={{ marginTop: '10px', fontSize: '12px', lineHeight: 1.55, color: '#6b7280', wordBreak: 'keep-all' }}>
                현재 단계에서는 감지된 태그를 먼저 보여주고, 다음 단계에서 태그별 추가 문항과 맞춤 관리 플로우를 이어서 연결합니다.
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
