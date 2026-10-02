// Stage categories. Keep keys in sync with the check constraint on plan_nodes.category.
export const CATEGORIES = {
  source: { label: 'Input or source', color: '#5b6b8c' },
  strategy: { label: 'Strategy', color: '#7a6a99' },
  integration: { label: 'Integration', color: '#4f7f88' },
  compliance: { label: 'Compliance', color: '#9a5c66' },
  channel: { label: 'Channel', color: '#a3744d' },
  process: { label: 'Process', color: '#6b7280' },
  handoff: { label: 'Handoff', color: '#5f8a6a' },
  analytics: { label: 'Measurement', color: '#4d7a99' },
  admin: { label: 'Admin', color: '#8a8f99' },
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
