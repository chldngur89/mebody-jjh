-- ===========================================================================
-- MEBODY — 판매자 역할로 상품 관리 + 마켓 샘플 상품
--
-- 확인한 현재 상태:
--   · user_profiles.role 에 MEMBER/SELLER/ADMIN 값은 정의돼 있으나 **SELLER 계정이 0명**
--   · products RLS 에 **읽기 정책만 있고 쓰기 정책이 하나도 없다**
--     (anon/authenticated 모두 SELECT 권한만) → 판매자도 관리자도 상품을 못 올린다
--   · Spring 쪽 ProductController 는 GET 만 있고, SellerController 는 /dashboard 뿐
--   · products.seller_id → user_profiles(id) FK, 현재 3행 모두 seller_id NULL
--
-- 이 파일이 하는 일:
--   1) 판매자 프로필 생성 (auth 계정 없이 프로필만 — 서버/관리자가 대행 등록하는 형태)
--   2) 판매자·관리자가 상품을 관리할 수 있는 RLS 정책과 권한
--   3) 마켓 시안에 맞춘 샘플 상품 시드 (기존 3개 포함해 카테고리 5종을 채운다)
--
-- 선행: 020~037 적용 완료
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- 1) 판매자 계정
--
--    user_profiles.id 는 auth.users(id) 를 참조하므로 **프로필만 새로 만들 수는 없다.**
--    이미 있는 샘플 계정 sample.member@mebody.test 를 판매자로 지정한다.
--    (진단 0건 · 적립 0건인 순수 샘플 계정이라 전환해도 잃는 데이터가 없다)
--
--    나중에 진짜 판매자를 추가할 때는:
--      1. Supabase Auth 에서 계정을 만들고
--      2. UPDATE public.user_profiles SET role='SELLER' WHERE email='<그 계정>';
--    아래 정책이 그대로 적용된다.
-- ---------------------------------------------------------------------------
UPDATE public.user_profiles
   SET role = 'SELLER',
       display_name = 'mebody 스토어',
       name = 'mebody 스토어',
       status = 'ACTIVE',
       updated_at = now()
 WHERE email = 'sample.member@mebody.test';

-- ---------------------------------------------------------------------------
-- 2) 역할 판정 + 상품 관리 정책
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.current_user_role()
RETURNS text
LANGUAGE plpgsql STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role text;
BEGIN
  IF auth.uid() IS NULL THEN RETURN 'ANON'; END IF;
  SELECT p.role INTO v_role
    FROM public.user_profiles p
   WHERE p.auth_user_id = auth.uid() OR p.id = auth.uid()
   LIMIT 1;
  RETURN COALESCE(v_role, 'MEMBER');
EXCEPTION
  WHEN undefined_table THEN RETURN 'MEMBER';
END $$;

COMMENT ON FUNCTION public.current_user_role() IS
  '로그인 사용자의 역할(ANON/MEMBER/SELLER/ADMIN). 상품 관리 정책이 쓴다.';

/** 내 판매자 프로필 id (SELLER 만) */
CREATE OR REPLACE FUNCTION public.current_seller_id()
RETURNS uuid
LANGUAGE plpgsql STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN RETURN NULL; END IF;
  SELECT p.id INTO v_id
    FROM public.user_profiles p
   WHERE (p.auth_user_id = auth.uid() OR p.id = auth.uid())
     AND p.role = 'SELLER'
   LIMIT 1;
  RETURN v_id;
EXCEPTION
  WHEN undefined_table THEN RETURN NULL;
END $$;

-- 읽기: 기존 정책 유지(ACTIVE 공개). 여기에 "판매자는 자기 상품을 상태와 무관하게 본다" 추가.
DROP POLICY IF EXISTS products_owner_read ON public.products;
CREATE POLICY products_owner_read ON public.products
  FOR SELECT TO authenticated
  USING (
    status = 'ACTIVE'
    OR public.current_user_role() = 'ADMIN'
    OR seller_id = public.current_seller_id()
  );

-- 쓰기: 관리자는 전부, 판매자는 자기 것만.
DROP POLICY IF EXISTS products_manage_insert ON public.products;
CREATE POLICY products_manage_insert ON public.products
  FOR INSERT TO authenticated
  WITH CHECK (
    public.current_user_role() = 'ADMIN'
    OR (public.current_seller_id() IS NOT NULL AND seller_id = public.current_seller_id())
  );

DROP POLICY IF EXISTS products_manage_update ON public.products;
CREATE POLICY products_manage_update ON public.products
  FOR UPDATE TO authenticated
  USING (
    public.current_user_role() = 'ADMIN'
    OR seller_id = public.current_seller_id()
  )
  WITH CHECK (
    public.current_user_role() = 'ADMIN'
    OR seller_id = public.current_seller_id()
  );

DROP POLICY IF EXISTS products_manage_delete ON public.products;
CREATE POLICY products_manage_delete ON public.products
  FOR DELETE TO authenticated
  USING (
    public.current_user_role() = 'ADMIN'
    OR seller_id = public.current_seller_id()
  );

-- 권한. 지금까지 authenticated 는 SELECT 만 갖고 있었다.
GRANT INSERT, UPDATE, DELETE ON public.products TO authenticated;
-- anon 은 그대로 읽기만.
REVOKE INSERT, UPDATE, DELETE ON public.products FROM anon;

REVOKE ALL ON FUNCTION public.current_user_role() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.current_seller_id() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.current_user_role() TO authenticated;
GRANT EXECUTE ON FUNCTION public.current_seller_id() TO authenticated;

-- ---------------------------------------------------------------------------
-- 3) 기존 3개 상품을 판매자에게 귀속
-- ---------------------------------------------------------------------------
UPDATE public.products
   SET seller_id = (SELECT id FROM public.user_profiles WHERE role = 'SELLER' LIMIT 1)
 WHERE seller_id IS NULL;

-- ---------------------------------------------------------------------------
-- 4) 샘플 상품 — 마켓 시안의 카테고리 5종을 채운다.
--    가격은 시안에 적힌 값을 그대로 썼다. 이미지는 아직 없어 image_url 은 NULL 이고
--    화면은 "제품 이미지" 자리표시자를 보여준다.
--    이름이 같으면 다시 넣지 않는다(여러 번 실행해도 안전).
-- ---------------------------------------------------------------------------
INSERT INTO public.products (seller_id, name, description, price, category, status)
SELECT (SELECT id FROM public.user_profiles WHERE role = 'SELLER' LIMIT 1),
       v.name, v.description, v.price, v.category, 'ACTIVE'
  FROM (VALUES
    -- 셀프 이완
    ('듀얼 마사지볼',      '목·어깨 주변을 편하게 눌러 이완하는 도구입니다. 15분 루틴 1단계에 함께 쓰기 좋습니다.', 18900, 'release'),
    ('소프트 폼롤러',      '하체와 등 부위를 넓게 풀어주는 도구입니다. 폼롤러가 필요한 이완 동작에 씁니다.',       29000, 'release'),
    ('넥 마사지 롤러',     '목 뒤쪽을 짧게 눌러 풀 때 쓰는 소형 롤러입니다.',                                    14500, 'release'),
    -- 근력 운동
    ('미니밴드 3단계',     '부위와 강도에 맞춰 사용하는 밴드 세트입니다. 지지 근력 채우기 단계에 씁니다.',        16500, 'strength'),
    ('코어 슬라이더',      '몸통 지지 근력을 가볍게 쓰는 동작에 활용합니다.',                                    12000, 'strength'),
    -- 스트레칭
    ('스트레칭 스트랩',    '손이 닿기 어려운 범위까지 움직임을 돕는 스트랩입니다.',                              12900, 'stretch'),
    ('요가 블록 2개입',    '유연성이 부족한 구간에서 바닥을 받쳐주는 블록입니다.',                               15900, 'stretch'),
    -- 보조 용품
    ('밸런스 쿠션',        '앉기 자세와 균형 운동에 활용하는 보조 용품입니다.',                                  34000, 'support'),
    ('자세 교정 방석',     '오래 앉을 때 골반 각도를 잡아주는 방석입니다.',                                      27000, 'support'),
    ('온열 찜질팩',        '이완 전에 목·어깨를 데워 두면 움직임이 편해집니다.',                                 21000, 'support'),
    -- 보조 식품
    ('데일리 프로틴',      '일상 속 단백질 섭취를 돕는 간편 제품입니다.',                                        32000, 'food'),
    ('관절 케어 츄어블',   '꾸준한 관리와 함께 챙기기 좋은 보조 식품입니다.',                                    28000, 'food')
  ) AS v(name, description, price, category)
 WHERE NOT EXISTS (SELECT 1 FROM public.products p WHERE p.name = v.name);

-- ---------------------------------------------------------------------------
-- 5) 확인
-- ---------------------------------------------------------------------------
SELECT category, count(*)::int AS 상품수
  FROM public.products WHERE status = 'ACTIVE'
 GROUP BY category ORDER BY category;
