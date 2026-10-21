-- ===========================================================================
-- MEBODY — 공유 문구의 제품명을 현재 표기로 통일 (body_code_content 16행)
--
-- WHY
--   src/theme/copy.ts 는 사용자 노출명을 **mebody Code** 하나로 못 박고
--   "MEBODY / 몸Bti / 체형코드 혼용 금지" 라고 적어 두었습니다.
--   그런데 16개 코드의 share_title · share_description 이 **전부 구표기**였습니다.
--
--     share_title        내 몸BTI는 FRRS · 꽈악 잠금 로봇
--     share_description  … 내 MEBODY 코드는 FRRS였어요.
--
--   이 두 값은 설명용이 아니라 **실제로 밖으로 나가는 문장**입니다.
--   src/lib/share.ts 의 buildShareTitle / buildShareText 가 DB 값을 먼저 쓰고,
--   없을 때만 `내 ${PRODUCT.codeName}는 …` 조합으로 넘어갑니다. 즉 지금은
--   카카오 공유·OS 공유 시트로 나가는 문장이 구 브랜드명을 달고 나갔습니다.
--
--     "내 몸BTI는 FRRS · 꽈악 잠금 로봇.
--      나는 몸을 단단하게 잡고 버티는 타입! 내 MEBODY 코드는 FRRS였어요.
--      너는 어떤 유형인지 궁금해요."
--
--   링크 복사 버튼은 URL 만 복사하므로 이 문장을 쓰지 않습니다. 그래서 눈에
--   잘 띄지 않았습니다 — 카카오/공유 시트를 쓴 사람에게만 나갔습니다.
--
-- 무엇을 바꾸는가
--   제품명 토큰 **두 개만** 바꿉니다. 나머지 문장은 그대로 둡니다.
--
--     내 몸BTI는 …       →  내 mebody Code는 …
--     내 MEBODY 코드는 … →  내 mebody Code는 …
--
--   둘 다 같은 문구로 모입니다. share.ts 의 폴백(`내 mebody Code는 …`)과
--   같은 모양이 되어, DB 값이 있든 없든 사용자가 보는 말이 같아집니다.
--
-- 무엇을 바꾸지 않는가
--   character_name · identity_* · strategy_* 는 건드리지 않습니다.
--   코드 문자열(FRRS 등)도 그대로입니다 — 공유 링크·정적 페이지·캐릭터 그림이
--   전부 거기 묶여 있습니다.
--
-- 재실행 안전
--   WHERE 가 구표기가 남은 행만 고릅니다. 두 번째 실행은 0행입니다.
--   값 자체도 replace() 라 이미 바뀐 문장에는 아무 일도 일어나지 않습니다.
--
-- 적용: Supabase SQL Editor 에 이 파일 내용을 붙여넣고 실행합니다.
-- 되돌리기: 파일 맨 아래 주석의 SQL 을 쓰면 046 당시 값으로 돌아갑니다.
-- ===========================================================================

BEGIN;

UPDATE public.body_code_content
SET
  share_title = replace(
                  replace(share_title, '내 몸BTI는 ', '내 mebody Code는 '),
                  '내 MEBODY 코드는 ', '내 mebody Code는 '),
  share_description = replace(
                        replace(share_description, '내 몸BTI는 ', '내 mebody Code는 '),
                        '내 MEBODY 코드는 ', '내 mebody Code는 '),
  updated_at = now()
WHERE share_title       LIKE '%몸BTI%'
   OR share_title       LIKE '%MEBODY 코드%'
   OR share_description LIKE '%몸BTI%'
   OR share_description LIKE '%MEBODY 코드%';

-- ---------------------------------------------------------------------------
-- 확인 — 구표기가 한 글자도 남으면 커밋하지 않습니다.
--
-- 통과 못 하면 ROLLBACK 되므로, 반쯤 바뀐 상태로 끝나지 않습니다.
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  bad int;
  total int;
BEGIN
  SELECT count(*) INTO bad
  FROM public.body_code_content
  WHERE share_title       LIKE '%몸BTI%' OR share_title       LIKE '%MEBODY 코드%'
     OR share_description LIKE '%몸BTI%' OR share_description LIKE '%MEBODY 코드%';

  IF bad > 0 THEN
    RAISE EXCEPTION '구표기가 % 행에 남아 있습니다', bad;
  END IF;

  SELECT count(*) INTO total
  FROM public.body_code_content
  WHERE share_title LIKE '내 mebody Code는 %'
    AND share_description LIKE '%내 mebody Code는 %';

  IF total <> 16 THEN
    RAISE EXCEPTION '16행이 모두 새 표기여야 하는데 % 행입니다', total;
  END IF;

  RAISE NOTICE '공유 문구 16행 확인 완료 — 전부 mebody Code 표기';
END $$;

COMMIT;

-- ===========================================================================
-- 되돌리기 (046 당시 값으로)
--
--   UPDATE public.body_code_content
--   SET share_title = replace(share_title, '내 mebody Code는 ', '내 몸BTI는 '),
--       share_description = replace(share_description, '내 mebody Code는 ', '내 MEBODY 코드는 '),
--       updated_at = now()
--   WHERE share_title LIKE '내 mebody Code는 %';
--
--   ※ 046 · bootstrap/130 · bootstrap/000 의 원문도 함께 바꿔 두었으므로,
--     그 파일들을 다시 실행해도 구표기로 돌아가지 않습니다. 되돌릴 때는
--     위 SQL 과 함께 세 파일도 같이 되돌려야 합니다.
-- ===========================================================================
