import { useSignalStore } from '../store/signalStore'
import { fmt, withLevelNames } from './translations'
import type { Translations } from './translations'
import { LOCALES, DEFAULT_LANG } from './locales/index'

export interface UseTranslationResult {
  t: Translations
  fmt: (str: string, params: Record<string, string>) => string
}

// One `t` per language and level, so it stays the same object between renders
const cache = new Map<string, Translations>()

export function useTranslation(): UseTranslationResult {
  const language = useSignalStore((s) => s.language)
  const level    = useSignalStore((s) => s.complexityLevel)
  const key = `${language}:${level}`
  let t = cache.get(key)
  if (!t) {
    t = withLevelNames((LOCALES[language] ?? LOCALES[DEFAULT_LANG]).translations, level)
    cache.set(key, t)
  }
  return { t, fmt }
}
