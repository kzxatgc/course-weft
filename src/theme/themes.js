/**
 * Neo-brutalist five-token color themes for EnrollFix.
 *
 * Each theme supplies exactly five semantic tokens:
 *   yellow   — title bars, active badges, highlights
 *   navy     — borders, hard shadows, menu bar background
 *   blue     — accent buttons, secondary highlights
 *   cream    — desktop/window body background
 *   charcoal — primary text
 *
 * Coastal (first) is the default warm custard palette.
 * Paper White is a crisp, bright alabaster gallery off-white palette.
 */
export const THEMES = [
  {
    id: 'coastal',
    name: 'Coastal',
    description: 'Warm custard cream with ocean blue — classic',
    yellow: '#F9C74F',
    navy: '#003049',
    blue: '#669BBC',
    cream: '#FDF0D5',
    charcoal: '#2F3E46',
  },
  {
    id: 'paper',
    name: 'Paper White',
    description: 'Crisp gallery alabaster off-white with deep ink borders — modern',
    yellow: '#F9C74F',
    navy: '#003049',
    blue: '#4361EE',
    cream: '#F8F9FA',
    charcoal: '#1E293B',
  },
];

export const DEFAULT_THEME_ID = 'coastal';
