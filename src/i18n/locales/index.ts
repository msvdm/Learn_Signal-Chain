import type { Translations } from '../translations'
import enJson from './en.json'
import bgJson from './bg.json'

// To add a new language:
// 1. Copy en.json to {lang-code}.json and translate all values
// 2. Import it below and add an entry to LOCALES
// Language codes follow BCP 47 (e.g. 'fr', 'de', 'es', 'zh-TW')

export interface LocaleMeta {
  nativeName: string
  translations: Translations
}

export const LOCALES: Record<string, LocaleMeta> = {
  en: { nativeName: 'English',    translations: enJson as unknown as Translations },
  bg: { nativeName: 'Български',  translations: bgJson as unknown as Translations },
}

export const DEFAULT_LANG = 'en'
