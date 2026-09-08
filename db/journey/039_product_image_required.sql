-- ===========================================================================
-- MEBODY — 상품 등록 시 사진 필수
--
-- 확인한 현재 상태(2026-09-04, 운영 DB 조회):
--   · products 15행, 전부 status='ACTIVE', **image_url 이 있는 행은 0개**
--   · 제약은 products_pkey / products_seller_id_fkey / products_status_check 뿐
--   · storage 버킷 'images' 는 public = true (앱에서 공개 URL 로 바로 읽는다)
--
-- 이 파일이 하는 일:
--   판매 중(ACTIVE)인 상품은 image_url 이 반드시 있어야 한다는 CHECK 제약을 건다.
--   서버 API(ProductAdminService)도 같은 규칙을 강제하지만, **API 를 우회해
--   SQL Editor 나 앱에서 직접 INSERT 해도 막히도록** DB 에도 둔다.
--
-- 왜 NOT VALID 인가:
--   위의 기존 15행이 전부 사진이 없다. 즉시 VALIDATE 하면 이 문장 자체가 실패한다.
--   NOT VALID 는 **앞으로의 INSERT / UPDATE 는 전부 검사**하고 기존 행만 건드리지
--   않는다. 기존 상품은 관리자 콘솔에서 사진을 채우면 되고, 사진을 채우는 UPDATE 는
--   제약을 통과한다. (사진 없는 기존 행을 다른 이유로 UPDATE 하려 하면 거절된다 —
--   "무조건 사진" 규칙을 그대로 적용한 결과다.)
--
--   15행에 사진을 다 채운 뒤에는 아래를 실행해 완전 검증 상태로 올릴 수 있다:
--     ALTER TABLE public.products VALIDATE CONSTRAINT products_image_required;
--
-- 선행: 020~038 적용 완료
-- ===========================================================================

ALTER TABLE public.products DROP CONSTRAINT IF EXISTS products_image_required;

ALTER TABLE public.products
  ADD CONSTRAINT products_image_required
  CHECK (
    status <> 'ACTIVE'
    OR (image_url IS NOT NULL AND btrim(image_url) <> '')
  ) NOT VALID;

COMMENT ON CONSTRAINT products_image_required ON public.products IS
  '판매 중(ACTIVE) 상품은 사진(image_url)이 반드시 있어야 한다. 서버 API 와 같은 규칙을 DB 에서도 강제한다.';

COMMENT ON COLUMN public.products.image_url IS
  'Supabase Storage images 버킷의 공개 URL. 서버 상품 등록 API 가 사진을 먼저 올리고 그 URL 을 넣는다.';

-- ---------------------------------------------------------------------------
-- 확인
-- ---------------------------------------------------------------------------

-- 1) 제약이 걸렸는지 (convalidated=false 는 위에서 설명한 NOT VALID 상태)
SELECT conname, convalidated, pg_get_constraintdef(oid) AS 정의
  FROM pg_constraint
 WHERE conrelid = 'public.products'::regclass
   AND conname = 'products_image_required';

-- 2) 사진을 채워야 하는 기존 상품 목록
SELECT id, name, category, status
  FROM public.products
 WHERE status = 'ACTIVE'
   AND (image_url IS NULL OR btrim(image_url) = '')
 ORDER BY created_at;
