/**
 * 공유 링크 수신용 공개 카드 + (내 코드가 있으면) 축 비교.
 */
import { useEffect, useMemo, useState } from 'react'
import { fetchBodyCodeContentWithFallback, type BodyCodeContent } from '../api/questionnaire'
import { BRAND, SURFACE } from '../theme/brand'
import { PRODUCT } from '../theme/copy'
import { getCharacterStorageUrl } from '../utils/characterImages'
import { compareBodyCodes } from '../utils/bodyCodeCompare'
import { Chip, CTA } from './ui'

function asKeywords(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value.map((item) => String(item ?? '').trim()).filter(Boolean)
}

export function SharePreviewCard({
  bodyCode,
  myBodyCode,
  onStartDiagnosis,
}: {
  bodyCode: string
  /** 로그인한 사용자의 코드 — 있으면 친구 코드와 비교합니다 */
  myBodyCode?: string
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
        borderRadius: '22px',
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

      <p style={{ margin: '14px 0 0', fontSize: '0.8125rem', lineHeight: 1.5, color: BRAND.muted, wordBreak: 'keep-all' }}>
        친구의 공개 유형만 보여요. 개인 측정·4축 점수는 공유되지 않습니다.
      </p>
      <CTA onClick={onStartDiagnosis} style={{ marginTop: '14px' }}>
        나도 {PRODUCT.codeName} 찾아보기
      </CTA>
    </section>
  )
}
