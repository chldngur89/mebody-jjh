import { useState, useEffect, useCallback } from 'react';
import { Play, Share2, Download, ArrowLeft, LockKeyhole, Sparkles, ChevronRight } from 'lucide-react';
import { fetchQuestionnaireResult, fetchQuestions } from '../api/questionnaire';
import { fetchAppImages } from '../api/content';
import { SUPABASE_STORAGE_PUBLIC } from '../lib/supabase';
import { AXIS_ICON_SRC } from '../data/axisIcons';
import { getAxisLabels, getBodyCodeKeywords, getAxisScoreBreakdown, characterNames } from '../utils/bodyCodeCalculator';
import { buildAdvancedTagAnalysisFromStored } from '../utils/advancedTagEngine';
import type { QuestionnaireResponse, BodyCodeContent, Question } from '../api/questionnaire';

const BODY_CODES = ['FRRS', 'FRRF', 'FRLS', 'FRLF', 'FLRS', 'FLRF', 'FLLS', 'FLLF', 'CRRS', 'CRRF', 'CRLS', 'CRLF', 'CLRS', 'CLRF', 'CLLS', 'CLLF'] as const;
const LOCAL_FALLBACK_IMAGE = '/icon.svg';

const AXIS_BAR_COLORS = [
  { fill: 'bg-blue-500', track: 'bg-blue-100' },
  { fill: 'bg-purple-500', track: 'bg-purple-100' },
  { fill: 'bg-orange-500', track: 'bg-orange-100' },
  { fill: 'bg-green-500', track: 'bg-green-200' },
] as const;

interface ResultScreenProps {
  questionnaireId?: string;
  onRestart?: () => void;
  onBack?: () => void;
  onNextPage?: () => void;
  onResultLoad?: (bodyCode: string) => void;
  isLoggedIn?: boolean;
  onGoAuth?: () => void;
  onGoMembership?: () => void;
  onGoDeepDive?: () => void;
}

export function ResultScreen({
  questionnaireId,
  onRestart,
  onBack,
  onNextPage,
  onResultLoad,
  isLoggedIn = false,
  onGoAuth,
  onGoMembership,
  onGoDeepDive,
}: ResultScreenProps) {
  const [result, setResult] = useState<QuestionnaireResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [appImages, setAppImages] = useState<Record<string, string>>({});
  const [failedImageUrls, setFailedImageUrls] = useState<Set<string>>(new Set());
  const [scoringQuestions, setScoringQuestions] = useState<Question[]>([]);

  useEffect(() => {
    fetchAppImages().then(setAppImages);
    fetchQuestions().then(setScoringQuestions).catch(() => setScoringQuestions([]));
  }, []);

  useEffect(() => {
    if (!questionnaireId) {
      setIsLoading(false);
      return;
    }
    fetchQuestionnaireResult(questionnaireId)
      .then((data) => {
        setResult(data);
        if (data?.calculated_code) onResultLoad?.(data.calculated_code);
      })
      .catch((err) => {
        console.error('Failed to load result:', err);
        setError('결과를 찾을 수 없습니다');
      })
      .finally(() => setIsLoading(false));
  }, [questionnaireId, onResultLoad]);

  const bodyCode = result?.calculated_code || '----';
  const content = result?.body_code_content as BodyCodeContent | null;
  const axisLabels = result?.calculated_code ? getAxisLabels(result.calculated_code) : null;
  const keywords = result?.calculated_code ? getBodyCodeKeywords(result.calculated_code) : [];
  const axisPercent = result?.answers ? getAxisScoreBreakdown(result.answers, scoringQuestions) : null;
  const advancedTags = result
    ? buildAdvancedTagAnalysisFromStored(
        result.advanced_preview_tags,
        result.advanced_confirmed_tags,
        result.answers,
        scoringQuestions,
      )
    : null;
  const advancedPreviewItems = advancedTags
    ? [...advancedTags.previewTags, ...advancedTags.confirmedTags].slice(0, 4)
    : [];
  const advancedHiddenCount = advancedTags
    ? advancedTags.previewTags.length + advancedTags.confirmedTags.length - advancedPreviewItems.length
    : 0;

  const resolveImage = useCallback(
    (candidates: Array<string | undefined>) => {
      for (const raw of candidates) {
        const url = (raw || '').trim();
        if (!url) continue;
        // 샘플 SQL의 placeholder URL은 무시
        if (url.includes('your-bucket.supabase.co')) continue;
        if (!failedImageUrls.has(url)) return url;
      }
      return LOCAL_FALLBACK_IMAGE;
    },
    [failedImageUrls],
  );

  const characterImages: Record<string, string> = {};
  for (const code of BODY_CODES) {
    const fromDb = appImages[`character_${code}`];
    const defaultUrl = SUPABASE_STORAGE_PUBLIC ? `${SUPABASE_STORAGE_PUBLIC}/characters/${code}.png` : '';
    characterImages[code] = resolveImage([fromDb, defaultUrl]);
  }

  const currentCharacterImage = bodyCode !== '----' ? characterImages[bodyCode] : null;

  const bodyTypesPreferred =
    appImages.body_types_image ||
    (SUPABASE_STORAGE_PUBLIC ? `${SUPABASE_STORAGE_PUBLIC}/body-types/bodyTypesImage.png` : '');
  const bodyTypesDefault = SUPABASE_STORAGE_PUBLIC ? `${SUPABASE_STORAGE_PUBLIC}/body-types/bodyTypesImage.png` : '';
  const bodyTypesImageUrl = resolveImage([bodyTypesPreferred, bodyTypesDefault]);

  const markImageFailed = useCallback((url: string) => {
    setFailedImageUrls((s) => new Set(s).add(url));
  }, []);

  const downloadBlob = useCallback((blob: Blob, filename: string) => {
    const href = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = href;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(href);
  }, []);

  const handleShare = useCallback(async () => {
    const baseUrl = `${window.location.origin}${window.location.pathname}`;
    const shareUrl = questionnaireId ? `${baseUrl}?result=${questionnaireId}` : baseUrl;
    const shareText = `나의 mebody 코드는 ${bodyCode} 입니다.`;

    if (navigator.share) {
      try {
        await navigator.share({
          title: 'mebody 진단 결과',
          text: shareText,
          url: shareUrl,
        });
        return;
      } catch {
        // 사용자가 공유를 취소하면 아래 클립보드 폴백으로 진행
      }
    }

    try {
      await navigator.clipboard.writeText(shareUrl);
      window.alert('결과 링크를 복사했습니다.');
    } catch {
      window.prompt('아래 링크를 복사해 공유하세요.', shareUrl);
    }
  }, [bodyCode, questionnaireId]);

  const handleDownload = useCallback(async () => {
    const date = new Date().toISOString().slice(0, 10);
    const filenameBase = `mebody-${bodyCode}-${date}`;

    if (currentCharacterImage) {
      try {
        const res = await fetch(currentCharacterImage);
        if (res.ok) {
          const blob = await res.blob();
          const ext = blob.type.includes('png') ? 'png' : blob.type.includes('jpeg') ? 'jpg' : 'img';
          downloadBlob(blob, `${filenameBase}.${ext}`);
          return;
        }
      } catch {
        // 이미지 다운로드 실패 시 텍스트 요약으로 폴백
      }
    }

    const textLines = [
      'mebody 진단 결과',
      `코드: ${bodyCode}`,
      `캐릭터: ${content?.character_name || characterNames[bodyCode] || '-'}`,
      '',
      '축별 결과',
      `- 목: ${axisLabels?.neck || '-'}`,
      `- 어깨: ${axisLabels?.shoulder || '-'}`,
      `- 골반: ${axisLabels?.pelvis || '-'}`,
      `- 하체: ${axisLabels?.flexibility || '-'}`,
      '',
      `생성일: ${new Date().toLocaleString()}`,
    ].join('\n');

    downloadBlob(
      new Blob([textLines], { type: 'text/plain;charset=utf-8' }),
      `${filenameBase}.txt`
    );
  }, [axisLabels, bodyCode, content?.character_name, currentCharacterImage, downloadBlob]);

  const axisResultLetters = {
    neck: content?.neck_result ?? (bodyCode[0] || ''),
    shoulder: content?.shoulder_result ?? (bodyCode[1] || ''),
    pelvis: content?.pelvis_result ?? (bodyCode[2] || ''),
    flexibility: content?.flexibility_result ?? (bodyCode[3] || ''),
  };

  const handleDeepDive = () => {
    if (!isLoggedIn) {
      onGoAuth?.();
      return;
    }

    onGoDeepDive?.();
  };

  if (isLoading) {
    return (
      <div className="bg-white rounded-3xl shadow-xl overflow-hidden flex items-center justify-center" style={{ height: '844px' }}>
        <div className="text-gray-500">로딩 중...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white rounded-3xl shadow-xl overflow-hidden flex flex-col items-center justify-center px-6" style={{ height: '844px' }}>
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
      <div className="bg-white rounded-3xl shadow-xl overflow-hidden flex items-center justify-center" style={{ height: '844px' }}>
        <div className="text-gray-500">결과를 찾을 수 없습니다</div>
      </div>
    );
  }

  return (
    <div className="bg-gradient-to-b from-gray-50 to-white rounded-3xl shadow-xl overflow-hidden" style={{ height: '844px' }}>
      <div className="h-full overflow-y-auto">
        <div className="sticky top-0 bg-white/80 backdrop-blur-lg border-b border-gray-100 px-6 py-4 z-10">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3 min-w-0">
              {(onBack ?? onRestart) && (
                <button
                  type="button"
                  onClick={onBack ?? onRestart}
                  className="w-9 h-9 bg-gray-100 rounded-full flex items-center justify-center hover:bg-gray-200 transition-colors flex-shrink-0"
                  title="뒤로"
                >
                  <ArrowLeft className="w-4 h-4 text-gray-600" />
                </button>
              )}
              <h1 className="text-lg font-bold text-gray-900 tracking-tight">진단 결과</h1>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={handleShare}
                className="w-9 h-9 bg-gray-100 rounded-full flex items-center justify-center hover:bg-gray-200 transition-colors"
                title="공유"
              >
                <Share2 className="w-4 h-4 text-gray-600" />
              </button>
              <button
                type="button"
                onClick={handleDownload}
                className="w-9 h-9 bg-gray-100 rounded-full flex items-center justify-center hover:bg-gray-200 transition-colors"
                title="다운로드"
              >
                <Download className="w-4 h-4 text-gray-600" />
              </button>
            </div>
          </div>
        </div>

        <div className="px-6 pb-8">
          <div className="mt-4 mb-6">
            <div className="flex items-center justify-between text-xs text-gray-500 mb-1.5">
              <span>진단 완료</span>
              <span className="font-semibold text-emerald-600">100%</span>
            </div>
            <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
              <div className="h-full w-full bg-gradient-to-r from-emerald-500 to-teal-500 rounded-full transition-all duration-500" style={{ width: '100%' }} />
            </div>
          </div>

          <div className="mt-8 mb-8 text-center">
            {currentCharacterImage && (
              <div className="mb-6 flex justify-center">
                <div className="w-56 h-64 bg-white rounded-2xl shadow-lg overflow-hidden border-4 border-emerald-500 p-4 flex items-center justify-center">
                  <img
                    src={currentCharacterImage}
                    alt={`${bodyCode} Character`}
                    className="w-full h-full object-contain"
                    onError={() => markImageFailed(currentCharacterImage)}
                  />
                </div>
              </div>
            )}
            <div className="inline-block bg-gradient-to-br from-emerald-500 via-teal-500 to-cyan-500 p-1 rounded-3xl shadow-2xl shadow-emerald-500/30">
              <div className="bg-white rounded-[22px] px-12 py-10">
                <div className="text-7xl font-black tracking-wider bg-gradient-to-br from-emerald-600 via-teal-600 to-cyan-600 bg-clip-text text-transparent mb-3">
                  {bodyCode}
                </div>
                <div className="text-sm text-gray-600 font-medium">
                  나의 mebody CODE
                </div>
                {(content?.character_name || characterNames[bodyCode]) && (
                  <div className="text-xs text-gray-500 mt-2">
                    {content?.character_name || characterNames[bodyCode]}
                  </div>
                )}
              </div>
            </div>
          </div>

          {(content?.character_name || characterNames[bodyCode]) && (
            <div className="text-center mb-6">
              <div className="inline-block bg-gradient-to-r from-gray-100 to-gray-50 px-6 py-3 rounded-full border border-gray-200">
                <span className="text-gray-700 font-semibold">{content?.character_name || characterNames[bodyCode]}</span>
              </div>
            </div>
          )}

          {content?.description && (
            <div className="mb-6 bg-white border border-gray-200 rounded-2xl p-5 shadow-sm">
              <h3 className="text-sm font-semibold text-gray-800 mb-2">
                왜 &apos;{content?.character_name || characterNames[bodyCode]}&apos;인가요?
              </h3>
              <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-line">{content.description}</p>
            </div>
          )}

          {advancedTags && advancedPreviewItems.length > 0 && (
            <div className="mb-6 rounded-[28px] border border-emerald-100 bg-gradient-to-br from-emerald-50 via-white to-teal-50 p-5 shadow-[0_20px_40px_rgba(16,185,129,0.10)]">
              <div className="mb-4 flex items-start gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-500 text-white shadow-lg shadow-emerald-500/25">
                  <Sparkles className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-[11px] font-semibold tracking-[0.14em] text-emerald-600">ADVANCED PREVIEW</div>
                  <h3 className="mt-1 text-[19px] font-bold tracking-tight text-gray-900">심화 버전 태그 미리보기</h3>
                  <p className="mt-1 text-sm leading-6 text-gray-600 [word-break:keep-all]">
                    당신의 답변에서 추가로 확인할 만한 패턴이 감지되었습니다. 원인을 확정하면 루틴의 순서와 비중이 더 정교하게 바뀝니다.
                  </p>
                </div>
              </div>

              <div className="space-y-3">
                {advancedPreviewItems.map((tag) => {
                  const isPreview = tag.status === 'preview';
                  return (
                    <div
                      key={tag.key}
                      className={`rounded-2xl border p-4 ${
                        isPreview
                          ? 'border-gray-200 bg-white/90'
                          : 'border-emerald-200 bg-emerald-50/90'
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <div
                          className={`mt-0.5 flex h-9 w-9 items-center justify-center rounded-xl ${
                            isPreview ? 'bg-gray-100 text-gray-500' : 'bg-emerald-500 text-white'
                          }`}
                        >
                          {isPreview ? <LockKeyhole className="h-4 w-4" /> : <Sparkles className="h-4 w-4" />}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="mb-1 flex flex-wrap items-center gap-2">
                            <span className="text-sm font-bold text-gray-900">{tag.name}</span>
                            <span
                              className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                                isPreview
                                  ? 'border border-gray-200 bg-gray-100 text-gray-600'
                                  : 'border border-emerald-200 bg-white text-emerald-700'
                              }`}
                            >
                              {isPreview ? `추가 ${tag.followUpQuestions}문항` : '지금 감지됨'}
                            </span>
                          </div>
                          <div className="text-sm font-semibold text-gray-800">{tag.title}</div>
                          <p className="mt-1 text-sm leading-6 text-gray-600 [word-break:keep-all]">{tag.reason}</p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {advancedHiddenCount > 0 && (
                <div className="mt-3 text-xs font-medium text-gray-500">
                  이외에도 {advancedHiddenCount}개의 패턴이 더 감지되었습니다.
                </div>
              )}

              <button
                type="button"
                onClick={handleDeepDive}
                className="mt-4 flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-500 px-5 py-4 text-[15px] font-semibold text-white shadow-lg shadow-emerald-500/25 transition-all hover:shadow-xl"
              >
                <span>{isLoggedIn ? '심화 태그 분석 시작하기' : '회원가입 후 내 mebody 코드 더 알아보기'}</span>
                <ChevronRight className="h-4 w-4" />
              </button>

              <p className="mt-3 text-xs leading-5 text-gray-500 [word-break:keep-all]">
                {isLoggedIn
                  ? '로그인 상태에서는 심화 안내 화면으로 바로 넘어가고, 다음 단계에서 추가 문항과 맞춤 관리 플로우를 이어서 진행할 수 있습니다.'
                  : '비회원 상태에서는 먼저 회원가입/로그인을 진행한 뒤, 심화 태그 확인 플로우로 이어집니다.'}
              </p>
            </div>
          )}

          <div className="mb-6 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
            <div className="text-[10px] font-semibold tracking-[0.14em] text-emerald-600 mb-1">ACCOUNT & MEMBERSHIP</div>
            <p className="text-sm text-gray-700 leading-7 [word-break:keep-all]">
              {isLoggedIn
                ? '재방문 시 최근 결과를 바로 볼 수 있고, 멤버십으로 심화 리포트를 이용할 수 있습니다.'
                : '이 결과를 저장하고 재방문 시 바로 보려면 회원가입/로그인을 진행해주세요.'}
            </p>
            <div className="mt-3">
              {isLoggedIn ? (
                onGoMembership && (
                  <button
                    type="button"
                    onClick={onGoMembership}
                    className="w-full bg-emerald-50 border border-emerald-200 text-emerald-700 py-3 rounded-xl font-semibold hover:bg-emerald-100 transition-colors"
                  >
                    멤버십/결제 보기
                  </button>
                )
              ) : (
                onGoAuth && (
                  <button
                    type="button"
                    onClick={onGoAuth}
                    className="w-full bg-gray-100 border border-gray-200 text-gray-700 py-3 rounded-xl font-semibold hover:bg-gray-200 transition-colors"
                  >
                    회원가입 / 로그인
                  </button>
                )
              )}
            </div>
          </div>

          {axisPercent && (
            <div className="bg-white border-2 border-gray-200 rounded-2xl p-5 mb-6 shadow-sm">
              <h3 className="text-sm font-semibold text-gray-700 mb-4">생체 정보 분석</h3>
              <div className="space-y-5">
                {[
                  { key: 'neck', title: '목 위치 (Neck position)', ...axisPercent.neck },
                  { key: 'shoulder', title: '어깨 높이 (Shoulder height)', ...axisPercent.shoulder },
                  { key: 'pelvis', title: '골반 회전 (Pelvis rotation)', ...axisPercent.pelvis },
                  { key: 'flexibility', title: '하체 유연성 (Lower body flexibility)', ...axisPercent.flexibility },
                ].map((item, index) => {
                  const pct = item.percentLeft;
                  const { fill, track } = AXIS_BAR_COLORS[index];
                  const isFourth = index === 3;
                  const trackStyle = isFourth ? { backgroundColor: '#bbf7d0' } : undefined;
                  const fillStyle = {
                    width: `${Math.max(0, Math.min(100, pct))}%`,
                    ...(isFourth ? { backgroundColor: '#22c55e' } : {}),
                  };
                  return (
                    <div key={item.key}>
                      <div className="text-xs font-medium text-gray-600 mb-2">{item.title}</div>
                      <div className="flex items-center gap-3">
                        <span className="text-xs text-gray-500 shrink-0 w-20">{item.labelLeft}</span>
                        <div className="flex-1 min-w-0">
                          <div
                            className={`h-5 rounded-full overflow-hidden flex ${track}`}
                            style={trackStyle}
                          >
                            <div
                              className={`h-full rounded-full transition-all duration-500 ${fill}`}
                              style={fillStyle}
                            />
                          </div>
                        </div>
                        <span className="text-xs text-gray-500 shrink-0 w-20 text-right">{item.labelRight}</span>
                      </div>
                      <div className="flex items-center justify-between mt-1.5">
                        <span className="text-sm font-bold text-gray-900">{pct}%</span>
                        <span className="text-sm font-bold text-gray-900">{item.percentRight}%</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {axisLabels && (
            <div className="bg-white border-2 border-gray-200 rounded-2xl p-5 mb-6 shadow-sm">
              <h3 className="text-sm font-semibold text-gray-700 mb-4">4가지 축 분석 결과</h3>
              <div className="space-y-3">
                <div className="flex items-center gap-3 bg-blue-50/80 rounded-xl p-3">
                  <div className="w-12 h-12 rounded-lg flex items-center justify-center flex-shrink-0 overflow-hidden bg-white">
                    <img src={AXIS_ICON_SRC.neck} alt="" className="w-full h-full object-contain" />
                  </div>
                  <div className="flex-1">
                    <div className="text-xs text-blue-600 font-medium mb-0.5">1축 목 (FORWARD/CENTRAL)</div>
                    <div className="font-semibold text-gray-900">{axisLabels.neck}</div>
                  </div>
                  <div className="px-3 py-1 bg-blue-600 text-white text-xs font-bold rounded-lg min-w-[2rem] text-center">{axisResultLetters.neck}</div>
                </div>
                <div className="flex items-center gap-3 bg-purple-50/80 rounded-xl p-3">
                  <div className="w-12 h-12 rounded-lg flex items-center justify-center flex-shrink-0 overflow-hidden bg-white">
                    <img src={AXIS_ICON_SRC.shoulder} alt="" className="w-full h-full object-contain" />
                  </div>
                  <div className="flex-1">
                    <div className="text-xs text-purple-600 font-medium mb-0.5">2축 어깨 (RIGHT UP/LEFT UP)</div>
                    <div className="font-semibold text-gray-900">{axisLabels.shoulder}</div>
                  </div>
                  <div className="px-3 py-1 bg-purple-600 text-white text-xs font-bold rounded-lg min-w-[2rem] text-center">{axisResultLetters.shoulder}</div>
                </div>
                <div className="flex items-center gap-3 bg-orange-50/80 rounded-xl p-3">
                  <div className="w-12 h-12 rounded-lg flex items-center justify-center flex-shrink-0 overflow-hidden bg-white">
                    <img src={AXIS_ICON_SRC.pelvis} alt="" className="w-full h-full object-contain" />
                  </div>
                  <div className="flex-1">
                    <div className="text-xs text-orange-600 font-medium mb-0.5">3축 골반 (RIGHT/LEFT ROTATION)</div>
                    <div className="font-semibold text-gray-900">{axisLabels.pelvis}</div>
                  </div>
                  <div className="px-3 py-1 bg-orange-600 text-white text-xs font-bold rounded-lg min-w-[2rem] text-center">{axisResultLetters.pelvis}</div>
                </div>
                <div
                  className="flex items-center gap-3 bg-green-50 rounded-xl p-3 border-0"
                  style={{ backgroundColor: 'rgb(240 253 244)' }}
                >
                  <div className="w-12 h-12 rounded-lg flex items-center justify-center flex-shrink-0 overflow-hidden bg-white">
                    <img src={AXIS_ICON_SRC.flexibility} alt="" className="w-full h-full object-contain" />
                  </div>
                  <div className="flex-1">
                    <div className="text-xs text-green-600 font-medium mb-0.5">4축 하체 (STIFF/FLEXIBLE)</div>
                    <div className="font-semibold text-gray-900">{axisLabels.flexibility}</div>
                  </div>
                  <div
                    className="px-3 py-1 text-xs font-bold rounded-lg min-w-[2rem] text-center"
                    style={{ backgroundColor: '#059669', color: '#ffffff' }}
                  >
                    {axisResultLetters.flexibility}
                  </div>
                </div>
              </div>
            </div>
          )}

          {keywords.length > 0 && (
            <div className="mb-6">
              <h3 className="text-sm font-semibold text-gray-700 mb-3">체형 특징</h3>
              <div className="flex flex-wrap gap-2">
                {keywords.map((keyword, index) => {
                  const colors = [
                    ['from-blue-100 to-blue-50', 'text-blue-700', 'border-blue-200'],
                    ['from-purple-100 to-purple-50', 'text-purple-700', 'border-purple-200'],
                    ['from-orange-100 to-orange-50', 'text-orange-700', 'border-orange-200'],
                    ['from-green-100 to-green-50', 'text-green-700', 'border-green-200'],
                  ];
                  const [bg, text, border] = colors[index % 4];
                  return (
                    <span key={keyword} className={`px-4 py-2 bg-gradient-to-r ${bg} ${text} rounded-full text-sm font-medium border ${border}`}>
                      {keyword}
                    </span>
                  );
                })}
              </div>
            </div>
          )}

          <div className="mb-6 bg-gradient-to-br from-gray-50 to-gray-100 rounded-2xl p-5 border border-gray-200">
            <h3 className="text-sm font-semibold text-gray-700 mb-3">전체 16가지 체형 분류</h3>
            <div className="bg-white rounded-xl overflow-hidden mb-4 shadow-sm">
              <img
                src={bodyTypesImageUrl}
                alt="16 Body Types"
                className="w-full h-auto"
                onError={() => markImageFailed(bodyTypesImageUrl)}
              />
            </div>
            <p className="text-xs text-gray-600 mt-3 text-center">
              당신은 <span className="font-semibold text-emerald-600">{bodyCode}</span> 유형입니다
            </p>
          </div>

          <div className="mb-4">
            <h3 className="text-sm font-semibold text-gray-700 mb-3">맞춤 운동 프로그램</h3>
            {content?.exercises?.length > 0 && (
              <div className="space-y-3 mb-4">
                {content.exercises.slice(0, 3).map((exercise, index) => {
                  const gradients = [
                    'from-blue-400 to-blue-500',
                    'from-purple-400 to-purple-500',
                    'from-orange-400 to-orange-500',
                    'from-green-400 to-green-500',
                  ];
                  return (
                    <div key={index} className="bg-white border border-gray-200 rounded-xl overflow-hidden flex gap-3 hover:shadow-md transition-shadow">
                      <div className={`w-28 h-20 bg-gradient-to-br ${gradients[index]} flex items-center justify-center flex-shrink-0`}>
                        <Play className="w-8 h-8 text-white/90" fill="white" />
                      </div>
                      <div className="flex-1 py-3 pr-3">
                        <div className="font-semibold text-gray-900 text-sm mb-1">{exercise.title}</div>
                        <div className="text-xs text-gray-600">{exercise.duration} • {exercise.desc}</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
            {content?.lifestyle_tips?.length > 0 && (
              <div className="bg-emerald-50 rounded-xl p-4 mb-4 border border-emerald-100">
                <div className="text-sm font-semibold text-emerald-900 mb-2">생활 습관 팁</div>
                <ul className="space-y-1.5 text-sm text-emerald-800">
                  {content.lifestyle_tips.map((tip, index) => (
                    <li key={index} className="flex items-start gap-2">
                      <div className="w-1 h-1 bg-emerald-500 rounded-full mt-1.5 flex-shrink-0" />
                      <span>{tip}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {content?.health_products?.length > 0 && (
              <div className="bg-gray-50 rounded-xl p-4 mb-4 border border-gray-200">
                <div className="text-sm font-semibold text-gray-900 mb-2">추천 헬스 케어 용품</div>
                <div className="space-y-2">
                  {content.health_products.map((product, index) => (
                    <div key={index} className="flex items-start gap-2 text-sm text-gray-700">
                      <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full mt-1.5 flex-shrink-0" />
                      <span><strong>{product.name}</strong>: {product.desc}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {onNextPage && (
            <div className="mt-6 pb-4">
              <button
                type="button"
                onClick={onNextPage}
                className="w-full bg-gradient-to-r from-emerald-500 to-teal-500 text-white py-4 rounded-xl font-semibold shadow-lg shadow-emerald-500/30 hover:shadow-xl transition-all active:scale-[0.98] flex items-center justify-center gap-2"
              >
                프로그램 시작
                <span className="text-lg">&gt;</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
