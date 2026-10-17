/**
 * Neo-brutalist five-token color themes for Course Weft.
 *
 * Each theme supplies exactly five semantic tokens:
 *   yellow   — title bars, active badges, highlights
 *   navy     — borders, hard shadows, menu bar background
 *   blue     — accent buttons, secondary highlights
 *   cream    — desktop/window body background
 *   charcoal — primary text
 *
 * Custard Cream (first) is the default warm palette with deep navy borders.
 */
export const THEMES = [
  {
    id: 'custard',
    name: 'Custard Cream',
    description: 'Soft custard cream headers with clean gallery white body and deep navy borders',
    yellow: '#FDF0D5',
    navy: '#003049',
    blue: '#4361EE',
    cream: '#F8F9FA',
    charcoal: '#1E293B',
    linkedOutline: ['#F97316', '#EAB308'],
  },
  {
    id: 'lavender',
    name: 'Soft Lavender',
    description: 'Soft lilac with aubergine borders and slate-blue course cards',
    yellow: '#ECE5F2',
    navy: '#483C50',
    blue: '#536B8C',
    cream: '#FAF8FC',
    charcoal: '#302A35',
    linkedOutline: ['#4F46E5', '#8B5CF6'],
  },
  {
    id: 'mint',
    name: 'Soft Mint',
    description: 'Quiet sage with evergreen borders and deep teal course cards',
    yellow: '#E8F2E8',
    navy: '#354A3D',
    blue: '#36727C',
    cream: '#F7FAF6',
    charcoal: '#29362D',
    linkedOutline: ['#EAB308', '#22C55E'],
  },
  {
    id: 'rose',
    name: 'Soft Rose',
    description: 'Muted rose with berry borders and cool slate-blue course cards',
    yellow: '#F4E4E8',
    navy: '#583D49',
    blue: '#536F8C',
    cream: '#FCF7F8',
    charcoal: '#352D33',
    linkedOutline: ['#3B82F6', '#4F46E5'],
  },
  {
    id: 'peach',
    name: 'Soft Peach',
    description: 'Soft apricot with terracotta borders and deep teal course cards',
    yellow: '#F6E6D9',
    navy: '#604539',
    blue: '#3B6F78',
    cream: '#FCF8F3',
    charcoal: '#382E29',
    linkedOutline: ['#EF4444', '#F97316'],
  },
  {
    id: 'sky',
    name: 'Pale Sky',
    description: 'Misty blue with fjord borders and muted indigo course cards',
    yellow: '#E5EEF4',
    navy: '#344957',
    blue: '#53668E',
    cream: '#F7FAFC',
    charcoal: '#29343D',
    linkedOutline: ['#22C55E', '#3B82F6'],
  },
];

export const DEFAULT_THEME_ID = 'custard';
