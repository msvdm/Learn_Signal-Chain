import { useSignalStore } from '../store/signalStore'
import { fmt } from './translations'
import type { Translations } from './translations'
import { LOCALES, DEFAULT_LANG } from './locales/index'

export interface UseTranslationResult {
  t: Translations
  fmt: (str: string, params: Record<string, string>) => string
}

export function useTranslation(): UseTranslationResult {
  const language = useSignalStore((s) => s.language)
  const t = (LOCALES[language] ?? LOCALES[DEFAULT_LANG]).translations
  return { t, fmt }
}
