import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL ?? ''
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY ?? ''

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

/** Storage 공개 URL (버킷 images, 이미지_업로드_안내.md 구조 기준) */
export const SUPABASE_STORAGE_PUBLIC =
  supabaseUrl && supabaseUrl.includes('supabase.co')
    ? `${supabaseUrl.replace(/\/$/, '')}/storage/v1/object/public/images`
    : ''
