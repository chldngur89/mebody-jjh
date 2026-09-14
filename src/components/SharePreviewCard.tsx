/**
 * 공유 링크 수신용 공개 카드.
 *
 * body_code_content 카탈로그만 보여줍니다(캐릭터·유형·요약·키워드).
 * 문항 응답·4축 게이지·result id 는 절대 넣지 않습니다.
 * 비회원도 anon SELECT 로 조회할 수 있어야 합니다.
 */
import { useEffect, useState } from 'react'
import { fetchBodyCodeContentWithFallback, type BodyCodeContent } from '../api/questionnaire'
import { BRAND, SURFACE } from '../theme/brand'
import { PRODUCT } from '../theme/copy'
import { getCharacterStorageUrl } from '../utils/characterImages'
import { Chip, CTA } from './ui'

function asKeywords(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value.map((item) => String(item ?? '').trim()).filter(Boolean)
}

export function SharePreviewCard({
  bodyCode,
  onStartDiagnosis,
}: {
  bodyCode: string
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
        boxShadow: '0 10px 28px rgba(0,70,40,0.06)',
        padding: '22px 18px 20px',
      }}
    >
      <div style={{ fontSize: '11px', fontWeight: 900, letterSpacing: '0.12em', color: BRAND.green, marginBottom: '10px' }}>
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
      <div style={{ fontSize: '34px', lineHeight: 1, letterSpacing: '-1px', fontWeight: 800, color: BRAND.green, marginBottom: '10px' }}>
        {bodyCode}
      </div>
      <Chip tone="solid">{characterName}</Chip>
      {identityTitle && (
        <p style={{ margin: '10px 0 0', color: BRAND.green, fontSize: '14px', fontWeight: 800, wordBreak: 'keep-all' }}>
          {identityTitle}
        </p>
      )}
      <p style={{ margin: '10px 0 0', color: BRAND.muted, fontSize: '13.5px', lineHeight: 1.6, wordBreak: 'keep-all' }}>
        {summary}
      </p>
      {keywords.length > 0 && (
        <div style={{ marginTop: '12px', display: 'flex', flexWrap: 'wrap', gap: '6px', justifyContent: 'center' }}>
          {keywords.map((keyword) => (
            <span
              key={keyword}
              style={{
                fontSize: '11px',
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
      <p style={{ margin: '14px 0 0', fontSize: '12px', lineHeight: 1.5, color: BRAND.muted, wordBreak: 'keep-all' }}>
        친구의 공개 유형만 보여요. 개인 측정·4축 점수는 공유되지 않습니다.
      </p>
      <CTA onClick={onStartDiagnosis} style={{ marginTop: '14px' }}>
        나도 {PRODUCT.codeName} 찾아보기
      </CTA>
    </section>
  )
}
