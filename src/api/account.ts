import type { User } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';

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

const FALLBACK_PLANS: MembershipPlan[] = [
  {
    code: 'basic_monthly',
    name: 'Basic Monthly',
    description: '결과 저장, 히스토리 조회, 재방문 빠른 결과',
    billing_cycle: 'monthly',
    price_krw: 5900,
    is_active: true,
    sort_order: 1,
  },
  {
    code: 'pro_monthly',
    name: 'Pro Monthly',
    description: 'Basic + 심화 리포트 + 루틴 우선순위',
    billing_cycle: 'monthly',
    price_krw: 12900,
    is_active: true,
    sort_order: 2,
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

export async function upsertProfileFromUser(user: User, displayName?: string) {
  const payload = {
    id: user.id,
    email: user.email ?? null,
    display_name: displayName ?? (typeof user.user_metadata?.display_name === 'string' ? user.user_metadata.display_name : null),
  };

  const { error } = await supabase
    .from('user_profiles')
    .upsert(payload, { onConflict: 'id' });

  if (error && !isMissingTableOrColumn(error)) {
    throw error;
  }
}

export async function fetchLatestCompletedResultIdForUser(userId: string): Promise<string | null> {
  const { data, error } = await supabase
    .from('questionnaire_responses')
    .select('id, completed_at')
    .eq('user_id', userId)
    .eq('status', 'completed')
    .order('completed_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    if (!isMissingTableOrColumn(error)) {
      console.warn('fetchLatestCompletedResultIdForUser failed:', error);
    }
    return null;
  }
  return data?.id ?? null;
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

export async function activateSubscription(userId: string, planCode: string): Promise<UserSubscription | null> {
  const now = new Date();
  const periodEnd = new Date(now);
  periodEnd.setDate(periodEnd.getDate() + 30);

  const payload = {
    user_id: userId,
    plan_code: planCode,
    status: 'active',
    started_at: now.toISOString(),
    current_period_end: periodEnd.toISOString(),
    cancel_at_period_end: false,
    updated_at: now.toISOString(),
  };

  const { data, error } = await supabase
    .from('user_subscriptions')
    .upsert(payload, { onConflict: 'user_id' })
    .select('id, user_id, plan_code, status, started_at, current_period_end, cancel_at_period_end')
    .maybeSingle();

  if (error) {
    throw error;
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

