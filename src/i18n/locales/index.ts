import type { Translations, LocaleStrings } from '../translations'
import en from './en.json'
import bg from './bg.json'

// To add a new language:
// 1. Copy en.json to {lang-code}.json and translate all values
// 2. Import it below and add an entry to LOCALES (`satisfies LocaleStrings`: a missing key fails the build)
// Language codes follow BCP 47 (e.g. 'fr', 'de', 'es', 'zh-TW')

export interface LocaleMeta {
  nativeName: string
  translations: Translations
}

export const LOCALES: Record<string, LocaleMeta> = {
  en: { nativeName: 'English',    translations: en },
  bg: { nativeName: 'Български',  translations: bg satisfies LocaleStrings },
}

export const DEFAULT_LANG = 'en'
