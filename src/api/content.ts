import { supabase } from '../lib/supabase';

/** app_images 테이블: key -> url */
export async function fetchAppImages(): Promise<Record<string, string>> {
  const { data, error } = await supabase
    .from('app_images')
    .select('key, url');

  if (error) {
    console.warn('fetchAppImages failed:', error);
    return {};
  }

  const map: Record<string, string> = {};
  for (const row of data || []) {
    map[row.key] = row.url;
  }
  return map;
}

/** app_content 테이블: key -> value_text 또는 value_json */
export async function fetchAppContent(keys?: string[]): Promise<Record<string, string | unknown>> {
  let query = supabase.from('app_content').select('key, value_text, value_json');
  if (keys?.length) {
    query = query.in('key', keys);
  }
  const { data, error } = await query;

  if (error) {
    console.warn('fetchAppContent failed:', error);
    return {};
  }

  const map: Record<string, string | unknown> = {};
  for (const row of data || []) {
    map[row.key] = row.value_json ?? row.value_text ?? '';
  }
  return map;
}

export interface ResultGuideSection {
  title: string;
  content: string;
}

export interface ResultGuide {
  title: string;
  sections: ResultGuideSection[];
}

/**
 * result_guide 테이블에서 가이드 조회.
 * bodyCode 있으면: 해당 체형 가이드 1건 + 공통 가이드 1건 조회 후, 체형 가이드가 있으면 그걸 쓰고 없으면 공통만.
 * bodyCode 없으면: 공통 가이드만.
 */
export async function fetchResultGuide(bodyCode?: string | null): Promise<ResultGuide | null> {
  const filter = bodyCode
    ? `body_code.eq.${bodyCode},body_code.is.null`
    : 'body_code.is.null';
  const { data, error } = await supabase
    .from('result_guide')
    .select('body_code, title, sections')
    .or(filter)
    .order('sort_order', { ascending: true });

  if (error) {
    console.warn('fetchResultGuide failed:', error);
    return null;
  }

  const rows = data || [];
  const forCode = bodyCode ? rows.find((r) => r.body_code === bodyCode) : null;
  const common = rows.find((r) => r.body_code == null);

  const guide = forCode ?? common ?? null;
  if (!guide) return null;

  const sections = Array.isArray(guide.sections)
    ? (guide.sections as ResultGuideSection[])
    : [];

  return {
    title: guide.title,
    sections: sections.map((s) =>
      typeof s === 'object' && s !== null && 'title' in s && 'content' in s
        ? { title: String(s.title), content: String(s.content) }
        : { title: '', content: '' }
    ).filter((s) => s.title || s.content),
  };
}
