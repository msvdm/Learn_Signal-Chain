import { useSignalStore } from '../store/signalStore'
import { translations, fmt } from './translations'
import type { Translations } from './translations'

export interface UseTranslationResult {
  t: Translations
  fmt: (str: string, params: Record<string, string>) => string
}

export function useTranslation(): UseTranslationResult {
  const language = useSignalStore((s) => s.language)
  return { t: translations[language], fmt }
}
