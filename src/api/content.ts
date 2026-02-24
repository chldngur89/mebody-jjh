import { supabase } from '../lib/supabase';

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

function parseSections(raw: unknown): ResultGuideSection[] {
  const arr = Array.isArray(raw) ? raw : [];
  return arr
    .map((s) =>
      typeof s === 'object' && s !== null && 'title' in s && 'content' in s
        ? { title: String(s.title), content: String(s.content) }
        : { title: '', content: '' }
    )
    .filter((s) => s.title || s.content);
}

/** 공통 가이드만 조회 (body_code IS NULL) */
export async function fetchResultGuideCommon(): Promise<ResultGuide | null> {
  const { data, error } = await supabase
    .from('result_guide')
    .select('title, sections')
    .is('body_code', null)
    .order('sort_order', { ascending: true })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.warn('fetchResultGuideCommon failed:', error);
    return null;
  }
  if (!data) return null;
  return { title: data.title ?? '', sections: parseSections(data.sections) };
}

/** 체형별 가이드만 조회 (공통 아님) */
export async function fetchResultGuideByCode(bodyCode: string): Promise<ResultGuide | null> {
  if (!bodyCode || bodyCode.length !== 4) return null;
  const { data, error } = await supabase
    .from('result_guide')
    .select('title, sections')
    .eq('body_code', bodyCode)
    .maybeSingle();

  if (error) {
    console.warn('fetchResultGuideByCode failed:', error);
    return null;
  }
  if (!data) return null;
  return { title: data.title ?? '', sections: parseSections(data.sections) };
}

/** 공통 먼저, 체형별은 그 다음 (자세 사용 설명서용) */
export async function fetchResultGuide(bodyCode?: string | null): Promise<ResultGuide | null> {
  const common = await fetchResultGuideCommon();
  if (!common) return null;
  if (!bodyCode || bodyCode.length !== 4) return common;

  const byCode = await fetchResultGuideByCode(bodyCode);
  const sections = byCode?.sections?.length
    ? [...common.sections, ...byCode.sections]
    : common.sections;
  return { title: common.title, sections };
}

export interface BodyCodeNextPage {
  title: string;
  sections: ResultGuideSection[];
}

export async function fetchBodyCodeNextPage(bodyCode: string | null | undefined): Promise<BodyCodeNextPage | null> {
  if (!bodyCode || bodyCode.length !== 4) return null;
  const { data, error } = await supabase
    .from('body_code_next_page')
    .select('title, sections')
    .eq('body_code', bodyCode)
    .maybeSingle();

  if (error) {
    console.warn('fetchBodyCodeNextPage failed:', error);
    return null;
  }
  if (!data) return null;

  const sections = Array.isArray(data.sections)
    ? (data.sections as ResultGuideSection[]).map((s) =>
        typeof s === 'object' && s !== null && 'title' in s && 'content' in s
          ? { title: String(s.title), content: String(s.content) }
          : { title: '', content: '' }
      ).filter((s) => s.title || s.content)
    : [];
  return { title: data.title ?? '', sections };
}

/** 결과 페이지 0)~5) 아코디언용 섹션 (스펙 07) */
export interface ResultSectionItem {
  section_key: string;
  title: string;
  content: string;
}

export async function fetchResultSectionsByBodyCode(bodyCode: string | null | undefined): Promise<ResultSectionItem[]> {
  if (!bodyCode || bodyCode.length !== 4) return [];
  const { data, error } = await supabase
    .from('body_code_result_sections')
    .select('section_key, title, content')
    .eq('body_code', bodyCode)
    .order('sort_order', { ascending: true });

  if (error) {
    console.warn('fetchResultSectionsByBodyCode failed:', error);
    return [];
  }
  return (data || []).map((row) => ({
    section_key: String(row.section_key ?? ''),
    title: String(row.title ?? ''),
    content: String(row.content ?? ''),
  }));
}
