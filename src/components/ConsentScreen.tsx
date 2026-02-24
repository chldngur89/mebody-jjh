import { useState } from 'react';
import { ChevronDown, ChevronUp, ArrowLeft } from 'lucide-react';

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
    <div className="bg-white rounded-3xl shadow-xl overflow-hidden" style={{ height: '844px' }}>
      <div className="h-full flex flex-col">
        {/* Header */}
        <div className="px-6 pt-8 pb-4 flex-shrink-0 flex items-center justify-center relative">
          {onBack && (
            <button
              type="button"
              onClick={onBack}
              className="absolute left-6 top-8 w-9 h-9 bg-gray-100 rounded-full flex items-center justify-center hover:bg-gray-200 transition-colors"
            >
              <ArrowLeft className="w-4 h-4 text-gray-600" />
            </button>
          )}
          <h1 className="text-xl font-bold text-gray-900 text-center">
            mebody 체형 분석 안내 및 동의
          </h1>
        </div>

        {/* Content - scrollable */}
        <div className="flex-1 overflow-y-auto px-6 pb-6">
          <ul className="space-y-2 text-sm text-gray-700 mb-6">
            <li className="flex gap-2">
              <span className="text-emerald-500 mt-0.5">•</span>
              <span>본 서비스는 웰니스/헬스케어 목적의 체형(자세) 유형 분석입니다.</span>
            </li>
            <li className="flex gap-2">
              <span className="text-emerald-500 mt-0.5">•</span>
              <span>의료행위(진단·치료·교정·재활)가 아니며, 결과는 의학적 판단을 대체하지 않습니다.</span>
            </li>
          </ul>

          {/* 자세히 (expandable) */}
          <div className="border border-gray-200 rounded-xl overflow-hidden mb-6">
            <button
              type="button"
              onClick={() => setDetailsOpen((o) => !o)}
              className="w-full flex items-center justify-between px-4 py-3 text-left text-sm font-medium text-gray-700 bg-gray-50 hover:bg-gray-100 transition-colors"
            >
              <span>자세히</span>
              {detailsOpen ? (
                <ChevronUp className="w-5 h-5 text-gray-500 flex-shrink-0" />
              ) : (
                <ChevronDown className="w-5 h-5 text-gray-500 flex-shrink-0" />
              )}
            </button>
            {detailsOpen && (
              <div className="px-4 pb-4 pt-1 bg-white border-t border-gray-100 space-y-4 text-sm text-gray-600">
                <div>
                  <div className="font-semibold text-gray-800 mb-1">제공</div>
                  <p>설문 기반 체형/자세 특징 분류, 건강관리 참고 가이드, 코드/유형 결과</p>
                </div>
                <div>
                  <div className="font-semibold text-gray-800 mb-1">비제공</div>
                  <p>질병/증상 진단, 치료·교정·재활 목적 제안, 처방/판독 안내</p>
                </div>
                <div>
                  <div className="font-semibold text-gray-800 mb-1">데이터</div>
                  <p>설문 응답 수집, 결과 제공·품질 개선 목적, 보관 기간/정책은 처리방침에서 확인</p>
                </div>
              </div>
            )}
          </div>

          {/* Checkboxes */}
          <div className="space-y-4 mb-8">
            <label className="flex items-start gap-3 cursor-pointer group">
              <input
                type="checkbox"
                checked={agreeContent}
                onChange={(e) => setAgreeContent(e.target.checked)}
                className="mt-1 w-5 h-5 rounded border-gray-300 text-emerald-600 focus:ring-emerald-500"
              />
              <span className="text-sm text-gray-700 group-hover:text-gray-900">
                위 내용을 이해하고 동의합니다
              </span>
            </label>
            <label className="flex items-start gap-3 cursor-pointer group">
              <input
                type="checkbox"
                checked={agreePrivacy}
                onChange={(e) => setAgreePrivacy(e.target.checked)}
                className="mt-1 w-5 h-5 rounded border-gray-300 text-emerald-600 focus:ring-emerald-500"
              />
              <span className="text-sm text-gray-700 group-hover:text-gray-900">
                개인정보 처리방침/이용약관 동의
              </span>
            </label>
          </div>
        </div>

        {/* CTA Button */}
        <div className="flex-shrink-0 p-6 pt-4">
          <button
            type="button"
            onClick={onAgree}
            disabled={!canProceed}
            className={`w-full py-4 rounded-2xl font-semibold text-lg flex items-center justify-center gap-2 transition-all ${
              canProceed
                ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/30 hover:bg-emerald-600 active:scale-[0.98]'
                : 'bg-gray-200 text-gray-500 cursor-not-allowed'
            }`}
          >
            질문 시작하기
            <span className="text-xl">→</span>
          </button>
        </div>
      </div>
    </div>
  );
}
