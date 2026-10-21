/**
 * 공유 링크 수신용 공개 카드 + (내 코드가 있으면) 축 비교.
 */
import { useEffect, useMemo, useState } from 'react'
import { fetchBodyCodeContentWithFallback, type BodyCodeContent } from '../api/questionnaire'
import { BRAND, SURFACE } from '../theme/brand'
import { DIAGNOSIS_SCALE, PRODUCT } from '../theme/copy'
import { getCharacterStorageUrl } from '../utils/characterImages'
import { compareBodyCodes } from '../utils/bodyCodeCompare'
import { AXIS_LABELS, AXIS_ORDER, knobFromPercentLeft } from '../theme/axisLabels'
import { AxisTrack, Chip, CTA } from './ui'

function asKeywords(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value.map((item) => String(item ?? '').trim()).filter(Boolean)
}

export function SharePreviewCard({
  bodyCode,
  myBodyCode,
  axes,
  onStartDiagnosis,
}: {
  bodyCode: string
  /** 로그인한 사용자의 코드 — 있으면 친구 코드와 비교합니다 */
  myBodyCode?: string
  /**
   * 친구의 4축 치우침(0~100, 왼쪽 기준) 네 개. 공유 링크의 ax 에서 옵니다.
   * 없으면(옛 링크·값이 깨진 링크) 막대 없이 코드만 보여줍니다.
   */
  axes?: number[]
  onStartDiagnosis: () => void
}) {
  const [content, setContent] = useState<BodyCodeContent | null>(null)
  const [imageFailed, setImageFailed] = useState(false)

  useEffect(() => {
    let cancelled = false
    setContent(null)
    setImageFailed(false)
    void fetchBodyCodeContentWithFallback(bodyCode).then((row) => {
      if (!cancelled) setContent(row)
    })
    return () => {
      cancelled = true
    }
  }, [bodyCode])

  /** ax 네 개를 축 키와 짝지어 둡니다. 순서는 코드 글자 순서와 같습니다. */
  const friendAxes = useMemo(() => {
    if (!axes || axes.length !== AXIS_ORDER.length) return null
    return AXIS_ORDER.map((key, i) => ({ key, percentLeft: axes[i] }))
  }, [axes])

  const compare = useMemo(() => {
    if (!myBodyCode || myBodyCode.toUpperCase() === bodyCode.toUpperCase()) return null
    return compareBodyCodes(myBodyCode, bodyCode)
  }, [myBodyCode, bodyCode])

  const characterName = content?.character_name?.trim() || bodyCode
  const identityTitle = content?.identity_title?.trim() || null
  const summary =
    content?.identity_summary?.trim() ||
    content?.share_description?.trim() ||
    content?.description?.trim() ||
    `${PRODUCT.codeName} 유형을 확인해 보세요.`
  const keywords = asKeywords(content?.identity_keywords)
  const imageUrl = !imageFailed ? getCharacterStorageUrl(bodyCode) : ''

  return (
    <section
      style={{
        width: '100%',
        textAlign: 'center',
        background: BRAND.card,
        border: `1px solid ${SURFACE.hairline}`,
        borderRadius: '20px',
        boxShadow: '0 10px 28px var(--mebody-d-k06, rgba(0,70,40,0.06))',
        padding: '22px 18px 20px',
      }}
    >
      <div style={{ fontSize: '0.75rem', fontWeight: 900, letterSpacing: '0.12em', color: BRAND.green, marginBottom: '10px' }}>
        FRIEND&apos;S CODE
      </div>
      {imageUrl ? (
        <img
          src={imageUrl}
          alt={characterName}
          onError={() => setImageFailed(true)}
          style={{ width: '96px', height: '140px', objectFit: 'contain', margin: '0 auto 12px', display: 'block' }}
        />
      ) : null}
      <div style={{ fontSize: '2.125rem', lineHeight: 1, letterSpacing: '-1px', fontWeight: 800, color: BRAND.green, marginBottom: '10px' }}>
        {bodyCode}
      </div>
      <Chip tone="solid">{characterName}</Chip>
      {identityTitle && (
        <p style={{ margin: '10px 0 0', color: BRAND.green, fontSize: '0.875rem', fontWeight: 800, wordBreak: 'keep-all' }}>
          {identityTitle}
        </p>
      )}
      <p style={{ margin: '10px 0 0', color: BRAND.muted, fontSize: '0.84375rem', lineHeight: 1.6, wordBreak: 'keep-all' }}>
        {summary}
      </p>
      {keywords.length > 0 && (
        <div style={{ marginTop: '12px', display: 'flex', flexWrap: 'wrap', gap: '6px', justifyContent: 'center' }}>
          {keywords.map((keyword) => (
            <span
              key={keyword}
              style={{
                fontSize: '0.75rem',
                fontWeight: 700,
                color: BRAND.muted,
                background: SURFACE.subtle,
                borderRadius: '999px',
                padding: '5px 10px',
              }}
            >
              {keyword}
            </span>
          ))}
        </div>
      )}

      {compare && (
        <div
          style={{
            marginTop: '16px',
            borderRadius: '16px',
            border: `1px solid ${SURFACE.hairline}`,
            background: SURFACE.subtle,
            padding: '14px 12px',
            textAlign: 'left',
          }}
        >
          <div style={{ fontSize: '0.75rem', fontWeight: 800, color: BRAND.green, marginBottom: '8px' }}>
            나와 비교 · 같음 {compare.sameCount} · 다름 {compare.differentCount}
          </div>
          <div style={{ display: 'grid', gap: '8px' }}>
            {compare.rows.map((row) => (
              <div
                key={row.axis}
                style={{
                  display: 'grid',
                  gridTemplateColumns: '48px 1fr 1fr',
                  gap: '8px',
                  alignItems: 'center',
                  fontSize: '0.8125rem',
                  fontWeight: 700,
                }}
              >
                <span style={{ color: BRAND.muted }}>{row.axis}</span>
                <span style={{ color: BRAND.text }}>나 {row.mine}</span>
                <span style={{ color: row.same ? BRAND.green : 'var(--mebody-t-b45309, #b45309)' }}>
                  친구 {row.friend}
                  {row.same ? ' · 같음' : ' · 다름'}
                </span>
              </div>
            ))}
          </div>
          <p style={{ margin: '10px 0 0', fontSize: '0.75rem', color: BRAND.muted, wordBreak: 'keep-all', lineHeight: 1.45 }}>
            내 코드 {myBodyCode?.toUpperCase()} · 친구 {bodyCode.toUpperCase()}
          </p>
        </div>
      )}

      {/*
        4축 막대 — 공유 링크에 ax 가 실려 왔을 때만 그립니다.

        예전에는 코드 네 글자만 보여줬습니다. 그런데 **카드 이미지로 받은 사람은
        이미 막대까지 보고 있었습니다.** 같은 결과를 보내는데 경로에 따라 보이는
        것이 달랐습니다. 여기가 비어 있으면 「친구가 FRRS 래」 에서 끝나고,
        막대가 있으면 「나랑 어디가 다르지」 로 넘어갑니다.
      */}
      {friendAxes && (
        <div
          style={{
            marginTop: '16px',
            borderRadius: '16px',
            border: `1px solid ${SURFACE.hairline}`,
            background: SURFACE.subtle,
            padding: '14px 12px',
            textAlign: 'left',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: '8px', marginBottom: '10px' }}>
            <strong style={{ fontSize: '0.8125rem', fontWeight: 800, color: BRAND.green }}>친구의 4축</strong>
            <span style={{ fontSize: '0.6875rem', color: BRAND.muted, fontWeight: 700, flexShrink: 0 }}>
              중앙에 가까울수록 균형
            </span>
          </div>
          <div style={{ display: 'grid', gap: '12px' }}>
            {friendAxes.map((row) => (
              <AxisTrack
                key={row.key}
                label={AXIS_LABELS[row.key].short}
                leftLabel={AXIS_LABELS[row.key].left}
                rightLabel={AXIS_LABELS[row.key].right}
                value={knobFromPercentLeft(row.percentLeft)}
              />
            ))}
          </div>
        </div>
      )}

      <p style={{ margin: '14px 0 0', fontSize: '0.8125rem', lineHeight: 1.5, color: BRAND.muted, wordBreak: 'keep-all' }}>
        {friendAxes
          ? '친구의 공개 유형과 4축 결과예요. 문항별 답변은 공유되지 않습니다.'
          : '친구의 공개 유형이에요. 문항별 답변은 공유되지 않습니다.'}
      </p>
      <CTA onClick={onStartDiagnosis} style={{ marginTop: '14px' }}>
        나도 {PRODUCT.codeName} 찾아보기
      </CTA>
      {/*
        몇 문항인지, 얼마나 걸리는지 **누르기 전에** 알려줍니다.
        공유 진입에서는 랜딩의 안내 블록을 숨기므로(중복) 그 한 줄이 여기로 옵니다.
        숫자는 문항 세트와 같이 움직이니 theme/copy.ts 의 DIAGNOSIS_SCALE 한 곳만 봅니다.
      */}
      <p style={{ margin: '8px 0 0', fontSize: '0.75rem', fontWeight: 800, color: BRAND.muted }}>
        {DIAGNOSIS_SCALE}
      </p>
    </section>
  )
}
