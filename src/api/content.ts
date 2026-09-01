import { supabase, SUPABASE_STORAGE_PUBLIC } from '../lib/supabase';

let appImagesCache: Record<string, string> | null = null;
let immediateActionDataCache: ImmediateActionData | null = null;

export async function fetchAppImages(): Promise<Record<string, string>> {
  if (appImagesCache) return appImagesCache;

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
  appImagesCache = map;
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
    .order('sort_order', { ascending: true })
    .limit(1)
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

export interface ImmediateActionDiscomfortMapping {
  mapping_id: string;
  discomfort_part_key: string;
  discomfort_part_label: string;
  side_input: 'right' | 'left' | 'both' | 'unknown' | string;
  side_label: string;
  release_content_key: string;
  stretch_content_key: string;
  display_name: string;
  priority_source: string;
  dev_note: string;
  is_active: boolean;
}

export interface ImmediateActionAxisMapping {
  axis_mapping_id: string;
  axis_no: number;
  axis_key: 'neck' | 'shoulder' | 'pelvis' | 'lower' | string;
  direction_key: string;
  direction_label: string;
  percentage_source: string;
  release_content_key: string;
  stretch_content_key: string;
  display_name: string;
  priority_source: string;
  dev_note: string;
  is_active: boolean;
}

export interface ImmediateActionContent {
  id: string;
  content_key: string;
  category_type: string;
  display_name: string;
  target_muscle: string;
  direction: string;
  release_title: string;
  release_content: string;
  release_tool: string;
  release_duration_sec: number | null;
  stretch_title: string;
  stretch_content: string;
  stretch_duration_sec: number | null;
  sets: number | null;
  caution: string;
  sort_order: number;
  /** 동작 이미지. 비어 있으면 화면은 텍스트만 보여줍니다. */
  release_image_url: string;
  stretch_image_url: string;
}

export interface ImmediateActionData {
  discomfortMappings: ImmediateActionDiscomfortMapping[];
  axisMappings: ImmediateActionAxisMapping[];
  contents: ImmediateActionContent[];
}

/** Storage 상대경로면 공개 URL 로, 전체 URL 이면 그대로. 비었으면 빈 문자열. */
function resolveStorageUrl(value: unknown): string {
  const raw = String(value ?? '').trim();
  if (!raw) return '';
  if (/^https?:\/\//i.test(raw)) return raw;
  if (!SUPABASE_STORAGE_PUBLIC) return '';
  return `${SUPABASE_STORAGE_PUBLIC}/${raw.replace(/^\/+/, '').replace(/^images\/+/, '')}`;
}

function toBool(value: unknown): boolean {
  return value === true || String(value).toLowerCase() === 'true';
}

function toNullableNumber(value: unknown): number | null {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export async function fetchImmediateActionData(): Promise<ImmediateActionData> {
  if (immediateActionDataCache) return immediateActionDataCache;

  const [discomfortResult, axisResult, contentResult] = await Promise.all([
    supabase
      .from('immediate_action_discomfort_mapping')
      .select('*')
      .eq('is_active', true)
      .order('mapping_id', { ascending: true }),
    supabase
      .from('immediate_action_axis_mapping')
      .select('*')
      .eq('is_active', true)
      .order('axis_no', { ascending: true }),
    supabase
      .from('immediate_action_content')
      .select('*')
      .order('sort_order', { ascending: true }),
  ]);

  if (discomfortResult.error || axisResult.error || contentResult.error) {
    console.warn('fetchImmediateActionData failed:', {
      discomfort: discomfortResult.error,
      axis: axisResult.error,
      content: contentResult.error,
    });
    return { discomfortMappings: [], axisMappings: [], contents: [] };
  }

  immediateActionDataCache = {
    discomfortMappings: (discomfortResult.data || []).map((row) => ({
      mapping_id: String(row.mapping_id ?? ''),
      discomfort_part_key: String(row.discomfort_part_key ?? ''),
      discomfort_part_label: String(row.discomfort_part_label ?? ''),
      side_input: String(row.side_input ?? ''),
      side_label: String(row.side_label ?? ''),
      release_content_key: String(row.release_content_key ?? ''),
      stretch_content_key: String(row.stretch_content_key ?? ''),
      display_name: String(row.display_name ?? ''),
      priority_source: String(row.priority_source ?? ''),
      dev_note: String(row.dev_note ?? ''),
      is_active: toBool(row.is_active),
    })),
    axisMappings: (axisResult.data || []).map((row) => ({
      axis_mapping_id: String(row.axis_mapping_id ?? ''),
      axis_no: Number(row.axis_no ?? 0),
      axis_key: String(row.axis_key ?? ''),
      direction_key: String(row.direction_key ?? ''),
      direction_label: String(row.direction_label ?? ''),
      percentage_source: String(row.percentage_source ?? ''),
      release_content_key: String(row.release_content_key ?? ''),
      stretch_content_key: String(row.stretch_content_key ?? ''),
      display_name: String(row.display_name ?? ''),
      priority_source: String(row.priority_source ?? ''),
      dev_note: String(row.dev_note ?? ''),
      is_active: toBool(row.is_active),
    })),
    contents: (contentResult.data || []).map((row) => ({
      id: String(row.id ?? ''),
      content_key: String(row.content_key ?? ''),
      category_type: String(row.category_type ?? ''),
      display_name: String(row.display_name ?? ''),
      target_muscle: String(row.target_muscle ?? ''),
      direction: String(row.direction ?? ''),
      release_title: String(row.release_title ?? ''),
      release_content: String(row.release_content ?? ''),
      release_tool: String(row.release_tool ?? ''),
      release_duration_sec: toNullableNumber(row.release_duration_sec),
      stretch_title: String(row.stretch_title ?? ''),
      stretch_content: String(row.stretch_content ?? ''),
      stretch_duration_sec: toNullableNumber(row.stretch_duration_sec),
      sets: toNullableNumber(row.sets),
      caution: String(row.caution ?? ''),
      sort_order: Number(row.sort_order ?? 999),
      release_image_url: resolveStorageUrl(row.release_image_url),
      stretch_image_url: resolveStorageUrl(row.stretch_image_url),
    })),
  };
  return immediateActionDataCache;
}

export interface StoreProduct {
  id: string;
  name: string;
  description: string;
  price: number | null;
  imageUrl: string;
  status: string;
}

/**
 * 결과 페이지 스토어용 상품.
 * products 테이블(status=ACTIVE)을 조회하므로 서버에 올리면 앱에 바로 반영됩니다.
 * 조회 실패하거나 비어 있으면 빈 배열을 돌려주고 화면은 기존 안내로 폴백합니다.
 */
export async function fetchStoreProducts(): Promise<StoreProduct[]> {
  const { data, error } = await supabase
    .from('products')
    .select('id, name, description, price, image_url, status, created_at')
    .eq('status', 'ACTIVE')
    .order('created_at', { ascending: true });

  if (error) {
    console.warn('fetchStoreProducts failed:', error);
    return [];
  }

  return (data || []).map((row) => ({
    id: String(row.id),
    name: String(row.name ?? ''),
    description: String(row.description ?? ''),
    price: row.price === null || row.price === undefined ? null : Number(row.price),
    imageUrl: resolveStorageUrl(row.image_url),
    status: String(row.status ?? ''),
  }));
}
