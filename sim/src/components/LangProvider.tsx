import { useEffect, useState, type ReactNode } from 'react'
import { DICTS, initialLang, LangContext, type Lang } from '@/i18n'

export function LangProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(initialLang)
  useEffect(() => {
    document.documentElement.lang = lang
  }, [lang])
  const setLang = (l: Lang) => {
    setLangState(l)
    try {
      localStorage.setItem('racecraft.lang', l)
    } catch {
      // ignore
    }
  }
  return <LangContext.Provider value={{ t: DICTS[lang], setLang }}>{children}</LangContext.Provider>
}
