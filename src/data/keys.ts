export const qk = {
  categories: ['categories'] as const,
  tasks: ['tasks'] as const,
  tags: ['tags'] as const,
  taskTags: ['task_tags'] as const,
  deadlines: ['deadlines'] as const,
  habits: ['habits'] as const,
  settings: ['user_settings'] as const,
  interest: ['guest_interest'] as const,
  feedback: ['guest_feedback'] as const,
}

export function newId(): string {
  // Supplying the id client-side keeps an optimistic row identical to the
  // persisted one, so there is no id swap to reconcile.
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID()
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`
}
