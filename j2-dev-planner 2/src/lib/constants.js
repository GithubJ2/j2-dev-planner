// Stage categories. Keep keys in sync with the check constraint on plan_nodes.category.
export const CATEGORIES = {
  source: { label: 'Input or source', color: '#1f5fd6' },
  strategy: { label: 'Strategy', color: '#7a4fd1' },
  integration: { label: 'Integration', color: '#0e7c86' },
  compliance: { label: 'Compliance', color: '#b4233a' },
  channel: { label: 'Channel', color: '#c2410c' },
  process: { label: 'Process', color: '#475569' },
  handoff: { label: 'Handoff', color: '#15803d' },
  analytics: { label: 'Measurement', color: '#0369a1' },
  admin: { label: 'Admin', color: '#64748b' },
}

export const FIELD_STATUSES = {
  open: { label: 'Open' },
  to_confirm: { label: 'To confirm' },
  decided: { label: 'Decided' },
}

export const PLAN_STATUSES = {
  planning: 'Planning',
  in_review: 'In review',
  approved: 'Approved',
  in_build: 'In build',
  live: 'Live',
  on_hold: 'On hold',
}

export const FIELD_TYPES = {
  text: 'Short answer',
  textarea: 'Long answer',
  select: 'Pick one',
  multiselect: 'Pick several',
  number: 'Number',
  checkbox: 'Yes or no',
  date: 'Date',
}

export const PLAN_ICONS = ['🗺️', '📞', '📈', '💻', '🛡️', '⚙️', '💼', '🧭', '🚀', '🧩', '📦', '🎯']
