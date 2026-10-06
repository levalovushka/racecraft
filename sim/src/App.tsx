import { useState } from 'react'
import { DEFAULT_SETTINGS, type Race, type Settings } from '@/engine/race'
import { Setup } from '@/components/Setup'
import { RaceScreen } from '@/components/RaceScreen'
import { Debrief } from '@/components/Debrief'

type Phase = { kind: 'setup' } | { kind: 'race'; run: number } | { kind: 'debrief'; race: Race }

export default function App() {
  const [settings, setSettings] = useState<Settings>(() => ({
    ...DEFAULT_SETTINGS,
    seed: Math.floor(Math.random() * 1e6),
    ourName: loadName() ?? DEFAULT_SETTINGS.ourName,
  }))
  const [phase, setPhase] = useState<Phase>({ kind: 'setup' })
  const [run, setRun] = useState(0)

  const start = (s: Settings) => {
    saveName(s.ourName)
    setSettings(s)
    setRun((x) => x + 1)
    setPhase({ kind: 'race', run: run + 1 })
  }

  if (phase.kind === 'setup') return <Setup initial={settings} onStart={start} />
  if (phase.kind === 'race') {
    return (
      <RaceScreen
        key={phase.run}
        settings={settings}
        onFinish={(race) => setPhase({ kind: 'debrief', race })}
        onRestart={() => start(settings)}
        onExit={() => setPhase({ kind: 'setup' })}
      />
    )
  }
  return (
    <Debrief
      race={phase.race}
      onAgain={() => start(settings)}
      onNew={() => {
        setSettings((s) => ({ ...s, seed: Math.floor(Math.random() * 1e6) }))
        setPhase({ kind: 'setup' })
      }}
    />
  )
}

// the name is a per-viewer convenience: storage may be unavailable, the app works without it
function loadName(): string | null {
  try {
    return localStorage.getItem('racecraft.name')
  } catch {
    return null
  }
}

function saveName(name: string) {
  try {
    localStorage.setItem('racecraft.name', name)
  } catch {
    // ignore
  }
}
