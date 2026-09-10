import type { User } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { isMissingRpc } from './rpcSupport';

export interface MembershipPlan {
  code: string;
  name: string;
  description: string;
  billing_cycle: 'monthly' | 'yearly' | 'one_time';
  price_krw: number;
  is_active: boolean;
  sort_order: number;
}

export interface UserSubscription {
  id: string;
  user_id: string;
  plan_code: string;
  status: 'trialing' | 'active' | 'past_due' | 'canceled';
  started_at: string;
  current_period_end: string | null;
  cancel_at_period_end: boolean;
}

export interface LatestCompletedResultSummary {
  id: string;
  calculated_code: string;
  completed_at: string | null;
  updated_at: string | null;
  created_at: string | null;
}

export interface UserBodyCodeSummary {
  body_bti_code: string;
  body_bti_title: string | null;
  body_bti_description: string | null;
  updated_at: string | null;
}

function resolveBodyCodeFromProfileRow(row: Record<string, unknown> | null | undefined): string | null {
  if (!row) return null;
  const candidates = [
    row.body_bti_code,
    row.body_code,
    row.mebody_code,
    row.calculated_code,
    row.code,
  ];
  for (const value of candidates) {
    const normalized = String(value ?? '').trim();
    if (normalized) return normalized;
  }
  return null;
}

const FALLBACK_PLANS: MembershipPlan[] = [
  {
    code: 'basic_monthly',
    name: 'mebody 멤버십',
    description: '14일 관리 무제한 · 광고 없이 이용 · 적립 2배 · 상품 구매 5% 적립',
    billing_cycle: 'monthly',
    price_krw: 5900,
    is_active: true,
    sort_order: 1,
  },
];

function isMissingTableOrColumn(error: unknown): boolean {
  const text = String((error as { message?: string } | null)?.message ?? error ?? '').toLowerCase();
  return (
    text.includes('does not exist') ||
    text.includes('undefined column') ||
    text.includes('column') && text.includes('does not exist')
  );
}

export async function signInWithEmail(email: string, password: string) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return data;
}

export async function signUpWithEmail(email: string, password: string, displayName?: string) {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        display_name: displayName ?? '',
      },
    },
  });
  if (error) throw error;
  return data;
}

export async function signOutAccount() {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

export async function requestPasswordReset(email: string) {
  const redirectTo = typeof window !== 'undefined' ? window.location.origin : undefined;
  const { error } = await supabase.auth.resetPasswordForEmail(
    email,
    redirectTo ? { redirectTo } : undefined,
  );

  if (error) throw error;
}

export async function upsertProfileFromUser(user: User, displayName?: string) {
  const resolvedDisplayName =
    displayName ?? (typeof user.user_metadata?.display_name === 'string' ? user.user_metadata.display_name : null);

  const payload = {
    id: user.id,
    auth_user_id: user.id,
    email: user.email ?? null,
    display_name: resolvedDisplayName,
    name: resolvedDisplayName,
  };

  const { error } = await supabase
    .from('user_profiles')
    .upsert(payload, { onConflict: 'id' });

  if (error && isMissingTableOrColumn(error)) {
    const legacyPayload = {
      id: user.id,
      email: user.email ?? null,
      display_name: resolvedDisplayName,
    };
    const { error: legacyError } = await supabase
      .from('user_profiles')
      .upsert(legacyPayload, { onConflict: 'id' });
    if (legacyError && !isMissingTableOrColumn(legacyError)) {
      throw legacyError;
    }
    return;
  }

  if (error) {
    throw error;
  }
}

export async function fetchLatestCompletedResultForUser(userId: string): Promise<LatestCompletedResultSummary | null> {
  const { data, error } = await supabase
    .from('questionnaire_responses')
    .select('id, completed_at, updated_at, created_at, calculated_code')
    .eq('user_id', userId)
    .eq('status', 'completed')
    .not('calculated_code', 'is', null)
    .order('completed_at', { ascending: false, nullsFirst: false })
    .order('updated_at', { ascending: false, nullsFirst: false })
    .order('created_at', { ascending: false, nullsFirst: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    if (!isMissingTableOrColumn(error)) {
      console.warn('fetchLatestCompletedResultIdForUser failed:', error);
    }
    return null;
  }

  if (!data?.id || !data.calculated_code) return null;
  return {
    id: String(data.id),
    calculated_code: String(data.calculated_code),
    completed_at: data.completed_at ?? null,
    updated_at: data.updated_at ?? null,
    created_at: data.created_at ?? null,
  };
}

export async function fetchLatestCompletedResultIdForUser(userId: string): Promise<string | null> {
  const latestResult = await fetchLatestCompletedResultForUser(userId);
  return latestResult?.id ?? null;
}

export async function fetchUserBodyCodeForUser(userId: string, email?: string | null): Promise<UserBodyCodeSummary | null> {
  const filters = [`id.eq.${userId}`, `auth_user_id.eq.${userId}`, `user_id.eq.${userId}`];
  if (email) filters.push(`email.eq.${email}`);

  const { data, error } = await supabase
    .from('user_profiles')
    .select('*')
    .or(filters.join(','))
    .order('updated_at', { ascending: false, nullsFirst: false })
    .limit(1)
    .maybeSingle();

  if (error && !isMissingTableOrColumn(error)) {
    console.warn('fetchUserBodyCodeForUser primary lookup failed:', error);
  }

  const resolvedPrimaryCode = resolveBodyCodeFromProfileRow(data as Record<string, unknown> | null);
  if (resolvedPrimaryCode) {
    return {
      body_bti_code: resolvedPrimaryCode,
      body_bti_title: data?.body_bti_title ? String(data.body_bti_title) : null,
      body_bti_description: data?.body_bti_description ? String(data.body_bti_description) : null,
      updated_at: data?.updated_at ?? null,
    };
  }

  // Legacy fallback: some rows are keyed by email only.
  if (!email) return null;

  const normalizedEmail = email.trim().toLowerCase();
  if (!normalizedEmail) return null;

  const { data: emailData, error: emailError } = await supabase
    .from('user_profiles')
    .select('*')
    .ilike('email', normalizedEmail)
    .order('updated_at', { ascending: false, nullsFirst: false })
    .limit(1)
    .maybeSingle();

  if (emailError) {
    if (!isMissingTableOrColumn(emailError)) {
      console.warn('fetchUserBodyCodeForUser email fallback failed:', emailError);
    }
    return null;
  }

  const resolvedEmailCode = resolveBodyCodeFromProfileRow(emailData as Record<string, unknown> | null);
  if (!resolvedEmailCode) return null;
  return {
    body_bti_code: resolvedEmailCode,
    body_bti_title: emailData.body_bti_title ? String(emailData.body_bti_title) : null,
    body_bti_description: emailData.body_bti_description ? String(emailData.body_bti_description) : null,
    updated_at: emailData.updated_at ?? null,
  };
}

/**
 * 결과 한 건의 코드를 읽습니다.
 *
 * 044 이후 테이블 직접 조회는 자기 행만 보이므로, 아직 귀속 전인 비회원 행은
 * get_questionnaire_response RPC 로 읽습니다(id 를 알아야만 한 행이 나옵니다).
 */
async function readCalculatedCode(questionnaireId: string): Promise<string | null> {
  const { data: rpcData, error: rpcError } = await supabase
    .rpc('get_questionnaire_response', { p_id: questionnaireId });

  if (!rpcError) {
    const rows = rpcData as Array<{ calculated_code?: string | null }> | null;
    const code = Array.isArray(rows) ? rows[0]?.calculated_code : null;
    if (code) return String(code);
  } else if (!isMissingRpc(rpcError)) {
    console.warn('readCalculatedCode rpc failed:', rpcError);
  }

  const { data, error } = await supabase
    .from('questionnaire_responses')
    .select('calculated_code')
    .eq('id', questionnaireId)
    .maybeSingle();

  if (error && !isMissingTableOrColumn(error)) {
    console.warn('readCalculatedCode fallback failed:', error);
  }
  return data?.calculated_code ? String(data.calculated_code) : null;
}

async function syncProfileFromQuestionnaireResult(questionnaireId: string, userId: string): Promise<void> {
  const bodyCode = await readCalculatedCode(questionnaireId);
  if (!bodyCode) return;
  const { data: contentData, error: contentError } = await supabase
    .from('body_code_content')
    .select('character_name, description')
    .eq('body_code', bodyCode)
    .maybeSingle();

  if (contentError && !isMissingTableOrColumn(contentError)) {
    console.warn('syncProfileFromQuestionnaireResult content lookup failed:', contentError);
  }

  const { data: authData } = await supabase.auth.getUser();
  const currentUser = authData.user?.id === userId ? authData.user : null;
  const displayName = typeof currentUser?.user_metadata?.display_name === 'string' ? currentUser.user_metadata.display_name : null;

  if (currentUser?.email) {
    const { error: upsertError } = await supabase
      .from('user_profiles')
      .upsert({
        id: userId,
        auth_user_id: userId,
        email: currentUser.email,
        display_name: displayName,
        name: displayName,
        body_bti_code: bodyCode,
        body_bti_title: String(contentData?.character_name ?? bodyCode),
        body_bti_description: String(contentData?.description ?? ''),
        updated_at: new Date().toISOString(),
      }, { onConflict: 'id' });

    if (!upsertError) return;
    if (!isMissingTableOrColumn(upsertError)) {
      console.warn('syncProfileFromQuestionnaireResult profile upsert failed:', upsertError);
    }
  }

  const { error } = await supabase
    .from('user_profiles')
    .update({
      body_bti_code: bodyCode,
      body_bti_title: String(contentData?.character_name ?? bodyCode),
      body_bti_description: String(contentData?.description ?? ''),
      updated_at: new Date().toISOString(),
    })
    .or(`id.eq.${userId},auth_user_id.eq.${userId}`);

  if (error && !isMissingTableOrColumn(error)) {
    console.warn('syncProfileFromQuestionnaireResult profile update failed:', error);
  }
}

export async function attachQuestionnaireResultToUser(questionnaireId: string | undefined, userId: string): Promise<void> {
  if (!questionnaireId || !userId) return;
  // local-result-* 등 비영속 id 는 FK 를 걸 수 없으므로 스킵합니다.
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(questionnaireId)) {
    return;
  }

  // 044 이후 비회원 행은 테이블 UPDATE 로 보이지 않습니다(자기 행만 보임).
  // claim RPC 가 주인 없는 행에만 내 id 를 붙입니다.
  const { error: claimError } = await supabase
    .rpc('claim_questionnaire_response', { p_id: questionnaireId });

  let failed = false;
  if (claimError) {
    if (isMissingRpc(claimError)) {
      const { error } = await supabase
        .from('questionnaire_responses')
        .update({ user_id: userId, updated_at: new Date().toISOString() })
        .eq('id', questionnaireId);
      failed = Boolean(error);
      if (error && !isMissingTableOrColumn(error)) {
        console.warn('attachQuestionnaireResultToUser failed:', error);
      }
    } else {
      failed = true;
      console.warn('attachQuestionnaireResultToUser claim failed:', claimError);
    }
  }

  // claim 이 false 를 돌려줘도(이미 주인이 있는 행) 프로필 동기화는 그대로 진행합니다.
  if (!failed) {
    await syncProfileFromQuestionnaireResult(questionnaireId, userId);
  }
}

export async function fetchMembershipPlans(): Promise<MembershipPlan[]> {
  const { data, error } = await supabase
    .from('membership_plans')
    .select('code, name, description, billing_cycle, price_krw, is_active, sort_order')
    .eq('is_active', true)
    .order('sort_order', { ascending: true });

  if (error) {
    if (!isMissingTableOrColumn(error)) {
      console.warn('fetchMembershipPlans failed:', error);
    }
    return FALLBACK_PLANS;
  }

  const mapped = (data || []).map((row) => ({
    code: String(row.code ?? ''),
    name: String(row.name ?? ''),
    description: String(row.description ?? ''),
    billing_cycle:
      row.billing_cycle === 'monthly' || row.billing_cycle === 'yearly' || row.billing_cycle === 'one_time'
        ? row.billing_cycle
        : 'monthly',
    price_krw: Number(row.price_krw ?? 0),
    is_active: Boolean(row.is_active ?? true),
    sort_order: Number(row.sort_order ?? 0),
  }));

  return mapped.length ? mapped : FALLBACK_PLANS;
}

export async function fetchMySubscription(userId: string): Promise<UserSubscription | null> {
  const { data, error } = await supabase
    .from('user_subscriptions')
    .select('id, user_id, plan_code, status, started_at, current_period_end, cancel_at_period_end')
    .eq('user_id', userId)
    .in('status', ['trialing', 'active'])
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    if (!isMissingTableOrColumn(error)) {
      console.warn('fetchMySubscription failed:', error);
    }
    return null;
  }

  if (!data) return null;
  return {
    id: String(data.id),
    user_id: String(data.user_id),
    plan_code: String(data.plan_code),
    status: data.status === 'trialing' || data.status === 'active' || data.status === 'past_due' || data.status === 'canceled'
      ? data.status
      : 'active',
    started_at: String(data.started_at),
    current_period_end: data.current_period_end ? String(data.current_period_end) : null,
    cancel_at_period_end: Boolean(data.cancel_at_period_end),
  };
}

/**
 * 구독 활성화는 **여기 없습니다.**
 *
 * user_subscriptions 는 authenticated 에 SELECT 권한만 있고, 040 의
 * activate_subscription_admin 도 앱에서 EXECUTE 를 회수했습니다.
 * 앱이 직접 켤 수 있으면 누구나 공짜로 멤버십을 갖게 되기 때문입니다.
 *
 * 결제 승인을 확인한 서버만 켤 수 있습니다 → src/api/billing.ts 의 verifySubscription()
 */
