import { useCallback, useEffect, useState } from 'react'
import { useAuth } from '../auth/AuthProvider'

const PREFIX = 'simpletask.future.v1'

type FutureNotes = {
  text: string
  collapsed: boolean
}

function storageKey(userId: string) {
  return `${PREFIX}.${userId}`
}

function read(userId: string): FutureNotes {
  try {
    const raw = localStorage.getItem(storageKey(userId))
    if (!raw) return { text: '', collapsed: false }
    const parsed = JSON.parse(raw) as Partial<FutureNotes>
    return {
      text: typeof parsed.text === 'string' ? parsed.text : '',
      collapsed: Boolean(parsed.collapsed),
    }
  } catch {
    return { text: '', collapsed: false }
  }
}

function write(userId: string, value: FutureNotes) {
  try {
    localStorage.setItem(storageKey(userId), JSON.stringify(value))
  } catch {
    // Private mode or a full store should not take the pane down.
  }
}

export function useFutureNotes() {
  const { user } = useAuth()
  const userId = user?.id ?? 'anon'
  const [value, setValue] = useState<FutureNotes>(() => read(userId))

  useEffect(() => {
    setValue(read(userId))
  }, [userId])

  const update = useCallback(
    (patch: Partial<FutureNotes>) => {
      setValue((current) => {
        const next = { ...current, ...patch }
        write(userId, next)
        return next
      })
    },
    [userId],
  )

  return {
    text: value.text,
    collapsed: value.collapsed,
    setText: (text: string) => update({ text }),
    setCollapsed: (collapsed: boolean) => update({ collapsed }),
  }
}
