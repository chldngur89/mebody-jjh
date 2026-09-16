/**
 * 공유 링크 OG 미리보기 엔드포인트 (Vercel Serverless).
 *
 * 카톡/슬랙 등에 링크를 붙여넣으면 크롤러가 이 HTML 의 og:* 를 읽습니다.
 * 사람은 meta refresh + JS 로 SPA 공유 랜딩(?ref=share&code=XXXX)으로 이동합니다.
 *
 * UA 분기(봇/사람)를 쓰지 않습니다. CDN 이 봇 HTML 을 사람에게 캐시하면
 * 리다이렉트가 깨지기 때문입니다.
 *
 * 로컬 Vite 에는 /api 가 없으므로 프로덕션 배포 후에만 동작합니다.
 * buildShareUrl 이 DEV 에서는 SPA 쿼리로 폴백합니다.
 */

const SITE = String(process.env.VITE_PUBLIC_SITE_URL || 'https://mebody-jjh.vercel.app').replace(
  /\/+$/,
  '',
)
const OG_IMAGE = `${SITE}/og-image.png?v=20260909`

const CHARACTER_NAMES = {
  FRRS: '꽈악 잠금 로봇',
  FRRF: '기대면 흐르는 젤리인간',
  FRLS: '꽈배기 금속 스프링',
  FRLF: '회전 많은 풍선인형',
  FLRS: '으쓱 고정 목각병정',
  FLRF: '리듬 타는 갈대',
  FLLS: '한쪽에 박힌 말뚝',
  FLLF: '녹아내리는 소프트콘',
  CRRS: '닻',
  CRRF: '오뚝이',
  CRLS: '큐브 탑',
  CRLF: '중심 귀찮은 문어',
  CLRS: '엇갈려 잠긴 나무인형',
  CLRF: '아슬아슬 젠가 탑',
  CLLS: '한쪽 뿌리 소나무',
  CLLF: '출렁이는 물침대',
}

const CODE_RE = /^[FC][RL][RL][SF]$/

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

module.exports = function handler(req, res) {
  const raw = String(req.query.code ?? '')
    .trim()
    .toUpperCase()
  const code = CODE_RE.test(raw) ? raw : ''
  const name = code ? CHARACTER_NAMES[code] ?? code : ''
  const spaUrl = code ? `${SITE}/?ref=share&code=${code}` : `${SITE}/`
  const title = code ? `내 mebody Code는 ${code} · ${name}` : 'mebody | mebody Code · 자세·체형 셀프 체크'
  const description = code
    ? `친구의 mebody Code는 ${code} (${name}) 였어요. 나는 어떤 유형일까요?`
    : 'mebody Code(자세·체형 셀프 체크)를 찾고, 나에게 맞는 개인화 웰니스 가이드를 받아보세요.'

  const safeTitle = escapeHtml(title)
  const safeDesc = escapeHtml(description)
  const safeUrl = escapeHtml(spaUrl)
  const safeImage = escapeHtml(OG_IMAGE)
  // JSON.stringify 로 JS 문자열 이스케이프 (따옴표·개행)
  const jsUrl = JSON.stringify(spaUrl)

  res.setHeader('Content-Type', 'text/html; charset=utf-8')
  res.setHeader('Cache-Control', 'public, s-maxage=3600, stale-while-revalidate=86400')
  res.status(200).send(`<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8" />
  <title>${safeTitle}</title>
  <meta name="description" content="${safeDesc}" />
  <link rel="canonical" href="${safeUrl}" />
  <meta property="og:type" content="website" />
  <meta property="og:site_name" content="mebody" />
  <meta property="og:locale" content="ko_KR" />
  <meta property="og:url" content="${safeUrl}" />
  <meta property="og:title" content="${safeTitle}" />
  <meta property="og:description" content="${safeDesc}" />
  <meta property="og:image" content="${safeImage}" />
  <meta property="og:image:secure_url" content="${safeImage}" />
  <meta property="og:image:type" content="image/png" />
  <meta property="og:image:width" content="1200" />
  <meta property="og:image:height" content="630" />
  <meta property="og:image:alt" content="${safeTitle}" />
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="${safeTitle}" />
  <meta name="twitter:description" content="${safeDesc}" />
  <meta name="twitter:image" content="${safeImage}" />
  <meta http-equiv="refresh" content="0;url=${safeUrl}" />
  <script>location.replace(${jsUrl})</script>
</head>
<body>
  <p>${safeTitle}</p>
  <p>${safeDesc}</p>
  <p><a href="${safeUrl}">mebody에서 보기</a></p>
</body>
</html>`)
}
