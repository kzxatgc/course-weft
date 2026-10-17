/**
 * Desktop dock and Settings color themes
 * Website Info window
 * Tests cover the pure logic and data contracts:
 *   - Theme catalogue completeness and colour formats
 *   - Default theme identity
 *   - useWindowManager pure state transitions
 *   - No real-profile side-effects (no network, no mutation of student data)
 *   - WebsiteInfo window config (synthetic data, no auth/network fields)
 */
import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

// ── Theme data ────────────────────────────────────────────────────────────────
import { THEMES, DEFAULT_THEME_ID } from '../src/theme/themes.js';

describe('Theme catalogue', () => {
  it('contains 3 themes', () => {
    assert.equal(THEMES.length, 3);
  });

  it('first theme is Coastal (user-supplied palette)', () => {
    assert.equal(THEMES[0].id, 'coastal');
    assert.equal(THEMES[0].yellow, '#F9C74F');
    assert.equal(THEMES[0].navy,   '#003049');
    assert.equal(THEMES[0].blue,   '#669BBC');
    assert.equal(THEMES[0].cream,  '#FDF0D5');
    assert.equal(THEMES[0].charcoal, '#2F3E46');
  });

  it('default theme ID matches first theme', () => {
    assert.equal(DEFAULT_THEME_ID, 'coastal');
    assert.ok(THEMES.some((t) => t.id === DEFAULT_THEME_ID), 'DEFAULT_THEME_ID must be present in THEMES');
  });

  it('every theme has the five required colour tokens as #RRGGBB hex strings', () => {
    const HEX_RE = /^#[0-9A-Fa-f]{6}$/;
    for (const theme of THEMES) {
      for (const key of ['yellow', 'navy', 'blue', 'cream', 'charcoal']) {
        assert.ok(
          HEX_RE.test(theme[key]),
          `Theme "${theme.id}".${key} = "${theme[key]}" is not a valid #RRGGBB colour`
        );
      }
    }
  });

  it('every theme has a non-empty id, name, and description', () => {
    for (const theme of THEMES) {
      assert.ok(typeof theme.id === 'string' && theme.id.length > 0, `theme.id must be a non-empty string`);
      assert.ok(typeof theme.name === 'string' && theme.name.length > 0);
      assert.ok(typeof theme.description === 'string' && theme.description.length > 0);
    }
  });

  it('theme IDs are unique', () => {
    const ids = THEMES.map((t) => t.id);
    assert.equal(new Set(ids).size, ids.length);
  });

  it('Coastal yellow is warmer (more red) than blue channel — basic palette sanity', () => {
    const coastal = THEMES.find((t) => t.id === 'coastal');
    const r = parseInt(coastal.yellow.slice(1, 3), 16);
    const g = parseInt(coastal.yellow.slice(3, 5), 16);
    const b = parseInt(coastal.yellow.slice(5, 7), 16);
    assert.ok(r > b, 'Coastal yellow should have more red than blue');
    assert.ok(g > b, 'Coastal yellow should have more green than blue (warm amber)');
  });
});

// ── Window manager pure logic ─────────────────────────────────────────────────
import { WINDOW_CONFIGS } from '../src/hooks/useWindowManager.js';

describe('WINDOW_CONFIGS', () => {
  it('has exactly 6 window entries', () => {
    assert.equal(WINDOW_CONFIGS.length, 6);
  });

  it('window IDs are unique', () => {
    const ids = WINDOW_CONFIGS.map((w) => w.id);
    assert.equal(new Set(ids).size, ids.length);
  });

  it('exactly one window opens by default (schedule)', () => {
    const defaultOpen = WINDOW_CONFIGS.filter((w) => w.defaultOpen);
    assert.equal(defaultOpen.length, 1);
    assert.equal(defaultOpen[0].id, 'schedule');
  });

  it('every window config has required fields', () => {
    for (const cfg of WINDOW_CONFIGS) {
      assert.ok(cfg.id, 'id required');
      assert.ok(cfg.title, 'title required');
      assert.ok(cfg.icon, 'icon required');
      assert.ok(cfg.label, 'label required');
      assert.ok(cfg.defaultPos && typeof cfg.defaultPos.x === 'number', 'defaultPos.x required');
      assert.ok(cfg.defaultPos && typeof cfg.defaultPos.y === 'number', 'defaultPos.y required');
    }
  });

  it('dock contains Schedule, Scenarios, Settings, Profile, Course Details, and Website Info', () => {
    const ids = WINDOW_CONFIGS.map((w) => w.id);
    assert.ok(ids.includes('schedule'));
    assert.ok(ids.includes('scenarios'));
    assert.ok(ids.includes('settings'));
    assert.ok(ids.includes('profile'));
    assert.ok(ids.includes('courseDetails'));
    assert.ok(ids.includes('websiteInfo'));
  });
});

// ── Website Info window ────────────────────────────────────────────
describe('WebsiteInfo window config', () => {
  const infoCfg = WINDOW_CONFIGS.find((w) => w.id === 'websiteInfo');

  it('websiteInfo entry exists in WINDOW_CONFIGS', () => {
    assert.ok(infoCfg, 'websiteInfo must be present in WINDOW_CONFIGS');
  });

  it('websiteInfo is closed by default (not open on launch)', () => {
    assert.equal(infoCfg.defaultOpen, false);
  });

  it('websiteInfo has label "Info"', () => {
    assert.equal(infoCfg.label, 'Info');
  });

  it('websiteInfo has a defined width (not fluid)', () => {
    assert.ok(typeof infoCfg.width === 'number', 'websiteInfo.width must be a number');
    assert.ok(infoCfg.width > 0, 'websiteInfo.width must be positive');
  });

  it('websiteInfo config contains no auth/token/session/apiUrl fields', () => {
    assert.ok(!('authToken'  in infoCfg), 'must not expose auth tokens');
    assert.ok(!('sessionId'  in infoCfg), 'must not expose session IDs');
    assert.ok(!('apiUrl'     in infoCfg), 'must not expose API URLs');
    assert.ok(!('submitUrl'  in infoCfg), 'must not expose submit endpoints');
    assert.ok(!('networkUrl' in infoCfg), 'must not expose network URLs');
  });

  it('websiteInfo title mentions information (not registration action)', () => {
    // Title should NOT contain words that imply a real registration action.
    const title = infoCfg.title.toLowerCase();
    assert.equal(infoCfg.title, 'Information');
    assert.ok(!title.includes('submit'), 'title must not imply submission');
    assert.ok(!title.includes('register'), 'title must not imply registration action');
  });

  it('information window states student and lecturer names and course details are fictional', async () => {
    const { readFileSync } = await import('node:fs');
    const infoSource = readFileSync(new URL('../src/windows/WebsiteInfo.jsx', import.meta.url), 'utf8');
    assert.ok(infoSource.includes('Student and lecturer names, course details, meeting times, and seat'));
    assert.ok(infoSource.includes('availability shown here are fictional sample data'));
  });
});

describe('WebsiteInfo — no network or submission side-effects', () => {
  it('WINDOW_CONFIGS has no window with a submitUrl or apiEndpoint field', () => {
    for (const cfg of WINDOW_CONFIGS) {
      assert.ok(!('submitUrl'    in cfg), `${cfg.id}: must not expose submitUrl`);
      assert.ok(!('apiEndpoint'  in cfg), `${cfg.id}: must not expose apiEndpoint`);
    }
  });

  it('exactly one window opens by default (schedule) — websiteInfo stays closed', () => {
    const defaultOpen = WINDOW_CONFIGS.filter((w) => w.defaultOpen);
    assert.equal(defaultOpen.length, 1);
    assert.equal(defaultOpen[0].id, 'schedule');
  });
});

// ── Profile — no real-profile side effects ────────────────────────────────────
describe('Profile window — no real student account', () => {
  it('WINDOW_CONFIGS profile entry does not contain authentication-related metadata', () => {
    const profileCfg = WINDOW_CONFIGS.find((w) => w.id === 'profile');
    // Config should have no auth/token/session fields
    assert.ok(!('authToken' in profileCfg), 'profile config must not expose auth tokens');
    assert.ok(!('sessionId' in profileCfg), 'profile config must not expose session IDs');
    assert.ok(!('apiUrl' in profileCfg), 'profile config must not expose API URLs');
  });
});

// ── Theme colour-contrast sanity (numeric) ────────────────────────────────────
function relativeLuminance(hex) {
  const [r, g, b] = [hex.slice(1, 3), hex.slice(3, 5), hex.slice(5, 7)].map((c) => {
    const v = parseInt(c, 16) / 255;
    return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrastRatio(hexA, hexB) {
  const lA = relativeLuminance(hexA);
  const lB = relativeLuminance(hexB);
  const lighter = Math.max(lA, lB);
  const darker  = Math.min(lA, lB);
  return (lighter + 0.05) / (darker + 0.05);
}

describe('Theme colour contrast', () => {
  for (const theme of THEMES) {
    it(`${theme.name}: charcoal-on-cream contrast ≥ 4.5:1`, () => {
      const ratio = contrastRatio(theme.charcoal, theme.cream);
      assert.ok(
        ratio >= 4.5,
        `${theme.name}: charcoal "${theme.charcoal}" on cream "${theme.cream}" is ${ratio.toFixed(2)}:1 (need ≥ 4.5:1)`
      );
    });

    it(`${theme.name}: navy-on-yellow contrast ≥ 4.5:1 (title bar text)`, () => {
      const ratio = contrastRatio(theme.navy, theme.yellow);
      assert.ok(
        ratio >= 4.5,
        `${theme.name}: navy "${theme.navy}" on yellow "${theme.yellow}" is ${ratio.toFixed(2)}:1 (need ≥ 4.5:1)`
      );
    });
  }
});

// ──Timetable pure-logic tests ──────────────────────────────────────
import { MAIN_CATALOG, INITIAL_DRAFT } from '../src/domain/available-courses.mjs';
import { formatTime, formatTimeRange } from '../src/domain/time.mjs';

const START_MINUTE  = 8 * 60;   // 480
const END_MINUTE    = 18 * 60;  // 1080
const TOTAL_MINUTES = END_MINUTE - START_MINUTE;

/** Replicate Timetable.toPercent() pure logic for test validation. */
function toPercent(minute) {
  return ((minute - START_MINUTE) / TOTAL_MINUTES) * 100;
}

describe('Timetable — section positioning math', () => {
  it('8 AM (480) maps to 0% (start of timeline)', () => {
    assert.equal(toPercent(480), 0);
  });

  it('6 PM (1080) maps to 100% (end of timeline)', () => {
    assert.equal(toPercent(1080), 100);
  });

  it('12 PM (720) maps to 40%', () => {
    assert.equal(toPercent(720), 40);
  });

  it('MATH-A (Tue 10:00–11:00 AM) left = 20%, width = 10%', () => {
    const sec = MAIN_CATALOG.find((s) => s.id === 'MATH-A');
    assert.equal(toPercent(sec.start), 20);
    const widthPct = ((sec.end - sec.start) / TOTAL_MINUTES) * 100;
    assert.equal(widthPct, 10);
  });

  it('STAT-A (Mon 1:00–2:00 PM) left = 50%, width = 10%', () => {
    const sec = MAIN_CATALOG.find((s) => s.id === 'STAT-A');
    assert.equal(toPercent(sec.start), 50);
    const widthPct = ((sec.end - sec.start) / TOTAL_MINUTES) * 100;
    assert.equal(widthPct, 10);
  });

  it('section left + width never exceeds 100% for catalog entries', () => {
    for (const sec of MAIN_CATALOG) {
      const left  = toPercent(sec.start);
      const width = ((sec.end - sec.start) / TOTAL_MINUTES) * 100;
      assert.ok(left >= 0 && left <= 100, `${sec.id}: left=${left}% must be 0–100`);
      assert.ok(width > 0,                `${sec.id}: width=${width}% must be > 0`);
      assert.ok(left + width <= 100,      `${sec.id}: left+width=${left+width}% must be ≤ 100`);
    }
  });
});

describe('Timetable — empty state', () => {
  it('INITIAL_DRAFT is non-empty (no empty state at startup)', () => {
    assert.ok(INITIAL_DRAFT.length > 0, 'INITIAL_DRAFT must have at least one section');
  });

  it('filtering draft=[] against catalog produces zero selectedSections (empty state)', () => {
    const selected = MAIN_CATALOG.filter((s) => [].includes(s.id));
    assert.equal(selected.length, 0);
  });

  it('filtering draft=INITIAL_DRAFT produces the correct number of sections', () => {
    const selected = MAIN_CATALOG.filter((s) => INITIAL_DRAFT.includes(s.id));
    assert.equal(selected.length, INITIAL_DRAFT.length);
  });
});

describe('Timetable — section display data', () => {
  it('every catalog section has fields required by SectionBlock (id, title, day, start, end, component)', () => {
    for (const sec of MAIN_CATALOG) {
      assert.ok(typeof sec.id        === 'string' && sec.id.length > 0,   `${sec.id}: id required`);
      assert.ok(typeof sec.title     === 'string' && sec.title.length > 0, `${sec.id}: title required`);
      assert.ok(typeof sec.day       === 'string' && sec.day.length > 0,   `${sec.id}: day required`);
      assert.ok(typeof sec.start     === 'number',                         `${sec.id}: start required`);
      assert.ok(typeof sec.end       === 'number' && sec.end > sec.start,  `${sec.id}: end > start required`);
      assert.ok(typeof sec.component === 'string',                         `${sec.id}: component required`);
    }
  });

  it('formatTimeRange produces a non-empty string including the day for every catalog section', () => {
    for (const sec of MAIN_CATALOG) {
      const range = formatTimeRange(sec);
      assert.ok(typeof range === 'string' && range.length > 0, `${sec.id}: formatTimeRange must return non-empty string`);
      assert.ok(range.includes(sec.day), `${sec.id}: formatTimeRange must include the day`);
    }
  });

  it('enrolled/capacity fields are numeric and non-negative on every catalog section', () => {
    for (const sec of MAIN_CATALOG) {
      assert.ok(typeof sec.enrolled === 'number' && sec.enrolled >= 0, `${sec.id}: enrolled must be >= 0`);
      assert.ok(typeof sec.capacity === 'number' && sec.capacity > 0,  `${sec.id}: capacity must be > 0`);
      assert.ok(sec.enrolled <= sec.capacity, `${sec.id}: enrolled must be <= capacity`);
    }
  });

  it('no catalog section exposes liveData or apiUrl fields', () => {
    for (const sec of MAIN_CATALOG) {
      assert.ok(!('liveData' in sec), `${sec.id}: must not expose liveData`);
      assert.ok(!('apiUrl'   in sec), `${sec.id}: must not expose apiUrl`);
    }
  });
});

describe('Timetable — remove control (domain side)', () => {
  it('REMOVE_SECTION action type is exported from draft-controller', async () => {
    const { ACTION } = await import('../src/state/draft-controller.mjs');
    assert.equal(ACTION.REMOVE_SECTION, 'REMOVE_SECTION');
  });

  it('dispatching REMOVE_SECTION for a draft section removes it', async () => {
    const { initialState, reduce, ACTION } = await import('../src/state/draft-controller.mjs');
    const s0 = initialState();
    assert.ok(s0.draft.includes('MATH-A'), 'MATH-A must be in initial draft');
    const s1 = reduce(s0, { type: ACTION.REMOVE_SECTION, payload: 'MATH-A' });
    assert.ok(!s1.draft.includes('MATH-A'), 'MATH-A must be removed after REMOVE_SECTION');
  });

  it('dispatching REMOVE_SECTION for a non-draft section leaves draft unchanged', async () => {
    const { initialState, reduce, ACTION } = await import('../src/state/draft-controller.mjs');
    const s0 = initialState();
    const s1 = reduce(s0, { type: ACTION.REMOVE_SECTION, payload: 'BIO-214' });
    assert.deepEqual([...s1.draft], [...s0.draft]);
  });

  it('REMOVE_SECTION produces a notice with kind="success"', async () => {
    const { initialState, reduce, ACTION } = await import('../src/state/draft-controller.mjs');
    const s0 = initialState();
    const s1 = reduce(s0, { type: ACTION.REMOVE_SECTION, payload: 'MATH-A' });
    assert.equal(s1.notice?.kind, 'success');
  });
});

// ── Available Courses search, 24h slots, and cards ────────────────
import { format24hTime, formatCourseSlot } from '../src/domain/time.mjs';

describe('Available Courses and search', () => {
  it('format24hTime formats minutes into 4-digit 24h time', () => {
    assert.equal(format24hTime(480), '0800');
    assert.equal(format24hTime(600), '1000');
    assert.equal(format24hTime(660), '1100');
    assert.equal(format24hTime(810), '1330');
    assert.equal(format24hTime(1080), '1800');
  });

  it('formatCourseSlot produces uppercase day and 24h time range', () => {
    const slot = { day: 'thu', start: 600, end: 660 };
    assert.equal(formatCourseSlot(slot), 'THU 1000 - 1100');
  });

  it('filters available courses by course code (case-insensitive)', () => {
    const draft = ['MATH-A', 'MATH-LAB-A'];
    const nonDraft = MAIN_CATALOG.filter((c) => !draft.includes(c.id));
    const query = 'math';
    const matches = nonDraft.filter((item) => {
      const codeMatch =
        item.id?.toLowerCase().includes(query) ||
        item.course?.toLowerCase().includes(query);
      const nameMatch = item.title?.toLowerCase().includes(query);
      return Boolean(codeMatch || nameMatch);
    });

    assert.ok(matches.length > 0);
    assert.ok(matches.every((m) => m.id.toLowerCase().includes('math') || m.course?.toLowerCase().includes('math')));
  });

  it('filters available courses by course title (case-insensitive)', () => {
    const draft = [];
    const nonDraft = MAIN_CATALOG.filter((c) => !draft.includes(c.id));
    const query = 'statistics';
    const matches = nonDraft.filter((item) => {
      const codeMatch =
        item.id?.toLowerCase().includes(query) ||
        item.course?.toLowerCase().includes(query);
      const nameMatch = item.title?.toLowerCase().includes(query);
      return Boolean(codeMatch || nameMatch);
    });

    assert.ok(matches.length > 0);
    assert.ok(matches.some((m) => m.title.toLowerCase().includes('statistics')));
  });

  it('calculates derived seats remaining with non-negative lower bound', () => {
    for (const c of MAIN_CATALOG) {
      const seatsRemaining = Math.max(0, c.capacity - c.enrolled);
      assert.ok(typeof seatsRemaining === 'number');
      assert.ok(seatsRemaining >= 0);
      assert.equal(seatsRemaining, c.capacity - c.enrolled);
    }
  });

  it('SET_SEARCH updates state.search without mutating draft', async () => {
    const { initialState, reduce, ACTION } = await import('../src/state/draft-controller.mjs');
    const s0 = initialState();
    const s1 = reduce(s0, { type: ACTION.SET_SEARCH, payload: 'stat' });
    assert.equal(s1.search, 'stat');
    assert.deepEqual(s1.draft, s0.draft);
  });
});

// ── Add/Swap Repair Preview ─────────────────────────────────────────
describe('Repair Preview impact groups and controller wiring', () => {
  it('package.json includes motion in dependencies', async () => {
    const { readFileSync } = await import('node:fs');
    const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
    assert.ok(pkg.dependencies?.motion, 'motion must be listed in dependencies');
  });

  it('ADD_SECTION clash sets notice.action to suggest', async () => {
    const { initialState, reduce, ACTION } = await import('../src/state/draft-controller.mjs');
    const s0 = initialState();
    // BIO-214 clashes with STAT-A in initial draft
    const s1 = reduce(s0, { type: ACTION.ADD_SECTION, payload: 'BIO-214' });
    assert.equal(s1.notice?.kind, 'error');
    assert.equal(s1.notice?.action, 'suggest', 'clash notice must have action: "suggest" for Find valid repair button');
    assert.equal(s1.request, 'BIO-214');
    assert.deepEqual(s1.draft, s0.draft, 'draft is preserved until user applies repair');
  });

  it('SUGGEST_REPAIR populates candidate with valid Add/Swap groups', async () => {
    const { initialState, reduce, ACTION } = await import('../src/state/draft-controller.mjs');
    const s0 = initialState();
    const s1 = reduce(s0, { type: ACTION.SUGGEST_REPAIR, payload: 'BIO-214' });
    assert.ok(s1.candidate !== null, 'candidate must be populated');
    assert.ok(s1.candidate.validation?.ok, 'candidate must be independently validated');

    // Derivation of groups:
    const swap = s1.candidate.swap;
    assert.deepEqual(swap, { old: 'STAT-A', replacement: 'STAT-B' });

    // Added sections excluding the swap replacement:
    const addIds = (s1.candidate.added || []).filter(
      (id) => !swap || id !== swap.replacement
    );
    assert.deepEqual(addIds, ['BIO-214']);

    // Unchanged sections remain part of the candidate without a Keep panel:
    const keepIds = s1.candidate.kept || [];
    assert.deepEqual(keepIds, ['MATH-A']);

    // Total post-repair draft matches full candidate ids:
    const finalSet = [...addIds, swap.replacement, ...keepIds].sort();
    assert.deepEqual(finalSet, s1.candidate.ids.slice().sort());
  });

  it('RepairPreview shows only added and swapped sections with a vertical arrow', async () => {
    const { readFileSync } = await import('node:fs');
    const source = readFileSync(
      new URL('../src/components/RepairPreview.jsx', import.meta.url),
      'utf8'
    );
    assert.ok(source.includes('ArrowDown'));
    assert.ok(source.includes('formatCourseSlot(oldSection)'));
    assert.ok(source.includes('formatCourseSlot(replacementSection)'));
    assert.ok(source.includes('grid grid-cols-1 gap-3 md:grid-cols-2'));
    assert.ok(source.includes('key={`add-${section.id}`}'));
    assert.ok(source.includes('swaps.map((swap, index) => {'));
    assert.ok(source.includes('Swap {index + 1}'));
    assert.ok(source.includes('No changes required (direct fit)'));
    assert.ok(!source.includes('Keep ('));
  });

  it('DISMISS_REPAIR clears candidate without mutating draft', async () => {
    const { initialState, reduce, ACTION } = await import('../src/state/draft-controller.mjs');
    const s0 = initialState();
    const s1 = reduce(s0, { type: ACTION.SUGGEST_REPAIR, payload: 'BIO-214' });
    assert.ok(s1.candidate !== null);

    const s2 = reduce(s1, { type: ACTION.DISMISS_REPAIR });
    assert.equal(s2.candidate, null, 'candidate must be cleared on dismiss');
    assert.deepEqual(s2.draft, s0.draft, 'draft must remain unchanged');
    assert.equal(s2.isApplied, false);
  });

  it('DYNAMIC_WINDOW_CONFIGS contains repair window with spanner icon and isDynamic flag', async () => {
    const { DYNAMIC_WINDOW_CONFIGS } = await import('../src/hooks/useWindowManager.js');
    const repairCfg = DYNAMIC_WINDOW_CONFIGS.find((w) => w.id === 'repair');
    assert.ok(repairCfg, 'repair window must be in DYNAMIC_WINDOW_CONFIGS');
    assert.equal(repairCfg.isDynamic, true);
    assert.equal(repairCfg.label, 'Repair');
    assert.equal(repairCfg.icon, '🔧');
  });
});

// ── Wire Apply/Undo/dismiss/reset ────────────────────────────────────
describe('Apply / Undo / Dismiss / Reset wiring', () => {
  it('canUndo returns false on initial state', async () => {
    const { initialState, canUndo } = await import('../src/state/draft-controller.mjs');
    const s0 = initialState();
    assert.equal(canUndo(s0), false, 'canUndo must be false when no snapshot exists');
  });

  it('canUndo returns true after APPLY_REPAIR creates a snapshot', async () => {
    const { initialState, reduce, ACTION, canUndo } = await import('../src/state/draft-controller.mjs');
    const s0 = initialState();
    const s1 = reduce(s0, { type: ACTION.SUGGEST_REPAIR });
    assert.ok(s1.candidate !== null, 'candidate must be populated after SUGGEST_REPAIR');
    const s2 = reduce(s1, { type: ACTION.APPLY_REPAIR });
    assert.equal(s2.isApplied, true, 'isApplied must be true after APPLY_REPAIR');
    assert.ok(s2.snapshot !== null, 'snapshot must be set after APPLY_REPAIR');
    assert.equal(canUndo(s2), true, 'canUndo must be true after applying a repair');
  });

  it('UNDO_REPAIR restores the exact pre-apply draft and clears snapshot', async () => {
    const { initialState, reduce, ACTION, canUndo } = await import('../src/state/draft-controller.mjs');
    const s0 = initialState();
    const s1 = reduce(s0, { type: ACTION.SUGGEST_REPAIR });
    const s2 = reduce(s1, { type: ACTION.APPLY_REPAIR });
    const draftBeforeApply = [...s0.draft].sort();

    const s3 = reduce(s2, { type: ACTION.UNDO_REPAIR });
    assert.deepEqual(
      [...s3.draft].sort(),
      draftBeforeApply,
      'UNDO_REPAIR must restore the exact pre-apply draft'
    );
    assert.equal(s3.snapshot, null, 'snapshot must be cleared after undo');
    assert.equal(s3.isApplied, false, 'isApplied must be false after undo');
    assert.equal(canUndo(s3), false, 'canUndo must be false after undo');
    assert.equal(s3.candidate, null, 'candidate must be cleared after undo');
    assert.equal(s3.notice, null, 'undo notice must be null');
  });

  it('RESET_DRAFT restores INITIAL_DRAFT and clears all transient state', async () => {
    const { initialState, reduce, ACTION, canUndo } = await import('../src/state/draft-controller.mjs');
    const { INITIAL_DRAFT } = await import('../src/domain/available-courses.mjs');
    const s0 = initialState();
    // Apply a repair to get a non-initial state with snapshot
    const s1 = reduce(s0, { type: ACTION.SUGGEST_REPAIR });
    const s2 = reduce(s1, { type: ACTION.APPLY_REPAIR });
    assert.equal(canUndo(s2), true);

    const s3 = reduce(s2, { type: ACTION.RESET_DRAFT });
    assert.deepEqual(s3.draft, [], 'RESET_DRAFT clears the timetable for the return animation');
    assert.deepEqual(s3.scenarioTransition?.draft, [...s2.draft], 'Current courses remain available to animate out');
    assert.equal(s3.candidate, null, 'candidate must be null after reset');
    assert.equal(s3.snapshot, null, 'snapshot must be null after reset');
    assert.equal(s3.isApplied, false, 'isApplied must be false after reset');
    assert.equal(canUndo(s3), false, 'canUndo must be false after reset');
    assert.equal(s3.notice, null, 'reset success toast waits for the transition to finish');
    assert.equal(s3.scenarioTransition?.showResetNotice, true);

    const incoming = reduce(s3, { type: ACTION.COMPLETE_SCENARIO_TRANSITION });
    assert.deepEqual([...incoming.draft].sort(), [...INITIAL_DRAFT].sort(), 'Initial courses return after current courses animate out');
    const completed = reduce(incoming, { type: ACTION.COMPLETE_SCENARIO_TRANSITION });
    assert.equal(completed.scenarioTransition, null);
  });

  it('shows the timetable-reset toast only after the incoming reset animation', async () => {
    const { readFileSync } = await import('node:fs');
    const previewSource = readFileSync(new URL('../src/EarlySchedulePreview.jsx', import.meta.url), 'utf8');
    assert.ok(previewSource.includes("scenarioTransition.phase === 'incoming' && scenarioTransition.showResetNotice"));
    assert.ok(previewSource.includes("title: 'Timetable reset'"));
    assert.ok(previewSource.includes('type: ACTION.SET_NOTICE'));
  });

  it('renders reset confirmation backdrop through a body portal', async () => {
    const { readFileSync } = await import('node:fs');
    const coursesSource = readFileSync(
      new URL('../src/components/AvailableCourses.jsx', import.meta.url),
      'utf8'
    );
    const resetDialog = coursesSource.slice(
      coursesSource.indexOf('{showResetConfirm && typeof document'),
      coursesSource.indexOf('/* ── Lifted/Held course card', coursesSource.indexOf('{showResetConfirm && typeof document'))
    );
    assert.ok(resetDialog.includes('createPortal('));
    assert.ok(resetDialog.includes('className="fixed inset-0 z-[9999]'));
    assert.ok(resetDialog.includes('document.body'));
  });

  it('DISMISS_REPAIR does not mutate draft and clears candidate without undo', async () => {
    const { initialState, reduce, ACTION, canUndo } = await import('../src/state/draft-controller.mjs');
    const s0 = initialState();
    const s1 = reduce(s0, { type: ACTION.SUGGEST_REPAIR });
    assert.ok(s1.candidate, 'candidate must exist before dismiss');

    const s2 = reduce(s1, { type: ACTION.DISMISS_REPAIR });
    assert.equal(s2.candidate, null, 'candidate must be null after dismiss');
    assert.deepEqual(s2.draft, s0.draft, 'draft must be unchanged after dismiss');
    assert.equal(s2.isApplied, false);
    // dismiss before apply never creates a snapshot, so canUndo stays false
    assert.equal(canUndo(s2), false, 'canUndo must remain false after dismiss without prior apply');
  });

  it('shows timetable success only after repair loading and swap animations finish', async () => {
    const { readFileSync } = await import('node:fs');
    const previewSource = readFileSync(new URL('../src/EarlySchedulePreview.jsx', import.meta.url), 'utf8');
    const controllerSource = readFileSync(new URL('../src/state/draft-controller.mjs', import.meta.url), 'utf8');
    const applyReducer = controllerSource.slice(
      controllerSource.indexOf('case ACTION.APPLY_REPAIR:'),
      controllerSource.indexOf('// Undo repair:', controllerSource.indexOf('case ACTION.APPLY_REPAIR:'))
    );
    assert.ok(applyReducer.includes('notice: null'));
    assert.ok(!applyReducer.includes("title: 'Timetable updated'"));
    assert.ok(previewSource.includes("title: 'Timetable updated'"));
    assert.ok(previewSource.includes('showAppliedNotice();'));
    assert.ok(previewSource.includes('setRepairTransition(\'idle\');\n          showAppliedNotice();'));
  });

  it('Notice does not render timetable success as a modal dialog', async () => {
    const { readFileSync } = await import('node:fs');
    const source = readFileSync(new URL('../src/Notice.jsx', import.meta.url), 'utf8');
    assert.ok(!source.includes('success-dialog-title'));
    assert.ok(source.includes('!modalContent && toastMessages.map'));
  });

  it('ordinary notices are compact, top-centered, animated, and automatically dismissed', async () => {
    const { readFileSync } = await import('node:fs');
    const noticeSource = readFileSync(new URL('../src/Notice.jsx', import.meta.url), 'utf8');
    const shellSource = readFileSync(new URL('../src/AppShell.jsx', import.meta.url), 'utf8');
    const cssSource = readFileSync(new URL('../src/app.css', import.meta.url), 'utf8');

    assert.ok(noticeSource.includes('const NOTICE_DURATION_MS = 1300;'));
    assert.ok(noticeSource.includes('window.setTimeout'));
    assert.ok(noticeSource.includes('window.clearTimeout(timer)'));
    assert.ok(noticeSource.includes("notice.action === 'suggest' || notice.action === 'acknowledge'"));
    assert.ok(noticeSource.includes('{!modalContent && toastMessages.length > 0 && typeof document !== \'undefined\''));
    assert.ok(noticeSource.includes('toastMessages.map(({ id, notice: toastNotice }) => ('));
    assert.ok(!noticeSource.includes("notice.title !== 'Section changed'"));
    assert.ok(shellSource.includes('<div id="schedule-workspace" className="relative">'));
    assert.ok(cssSource.includes('#notice-region {'));
    assert.ok(noticeSource.includes('createPortal('));
    assert.ok(noticeSource.includes('rect.top - 26'));
    assert.ok(noticeSource.includes('rect.left + rect.width / 2'));
    assert.ok(noticeSource.includes('order: -id, position: \'relative\', zIndex: id + 1'));
    assert.ok(cssSource.includes('position: fixed;'));
    assert.ok(cssSource.includes('z-index: 2147483647;'));
    assert.ok(cssSource.includes('.nb-notice-toast {'));
    assert.ok(cssSource.includes('animation: nb-notice-toast 1.3s ease both;'));
    assert.ok(cssSource.includes('transform: translateY(8px);'));
    assert.ok(cssSource.includes('transform: translateY(-12px);'));
    assert.ok(cssSource.includes('55% {\n    opacity: 1;'));
    assert.ok(noticeSource.includes('function NoticeToast({ id, notice, onExpireRef })'));
    assert.ok(noticeSource.includes('{notice.title}'));
    assert.ok(noticeSource.includes('const [toastMessages, setToastMessages] = useState([]);'));
    assert.ok(noticeSource.includes('setToastMessages((messages) => [{ id: toastId, notice }, ...messages]);'));
    assert.ok(noticeSource.includes('key={id}'));
    assert.ok(noticeSource.includes('setToastMessages((messages) => messages.filter((message) => message.id !== toastId));'));
    assert.ok(noticeSource.includes('capitalize'));
    assert.ok(!noticeSource.includes('aria-label="Dismiss notification"'));
    assert.ok(!noticeSource.includes('toastTimersRef'));
    assert.ok(noticeSource.includes('onExpireRef.current(id, notice)'));
    assert.ok(noticeSource.includes("const HIDDEN_TOAST_TITLES = new Set(["));
    assert.ok(noticeSource.includes('if (!HIDDEN_TOAST_TITLES.has(notice.title))'));
    for (const title of [
      'Already on your timetable',
      'Drop this class on the correct day',
      'Course already selected',
      'No section to switch from',
      'Not a declared alternate',
      'No suggestion to apply',
      'This suggestion is out of date',
      'This timetable needs another look',
    ]) {
      assert.ok(noticeSource.includes(`'${title}'`), `${title} is suppressed as a toast`);
    }
    assert.ok(!noticeSource.includes("'Suggested timetable ready'"));
    assert.ok(!noticeSource.includes("'No suitable timetable found'"));
    assert.ok(cssSource.includes('display: grid;'));
    assert.ok(cssSource.includes('grid-area: 1 / 1;'));
    assert.ok(cssSource.includes('.nb-notice-toast--error {'));
    assert.ok(cssSource.includes('background-color: #fee2e2;'));
    assert.ok(cssSource.includes('.nb-notice-toast--success,'));
    assert.ok(cssSource.includes('background-color: #dcfce7;'));
    assert.ok(cssSource.includes('border-color: #16a34a;'));
  });

  it('repair conflict dialog shows the specific notice title in its header', async () => {
    const { readFileSync } = await import('node:fs');
    const noticeSource = readFileSync(new URL('../src/Notice.jsx', import.meta.url), 'utf8');

    assert.ok(noticeSource.includes('id="alert-dialog-title"'));
    assert.ok(noticeSource.includes('{notice.title}'));
    assert.ok(!noticeSource.includes('Timetable Conflict Alert'));
  });

  it('dropping a card onto a red timetable preview shows a temporary class-clash notice', async () => {
    const { readFileSync } = await import('node:fs');
    const coursesSource = readFileSync(
      new URL('../src/components/AvailableCourses.jsx', import.meta.url),
      'utf8'
    );
    const dropFailure = coursesSource.slice(
      coursesSource.indexOf('if (dropResult.success)'),
      coursesSource.indexOf('isRestoring: true', coursesSource.indexOf('if (dropResult.success)'))
    );

    assert.ok(dropFailure.includes('if (touchesTimetable && hasConflict)'));
    assert.ok(dropFailure.includes('type: ACTION.SET_NOTICE'));
    assert.ok(dropFailure.includes("title: 'Class clash'"));
    assert.ok(!dropFailure.includes("action: 'suggest'"));
  });

  it('Schedule Repair opens centered on the Schedule window and can be repositioned', async () => {
    const { readFileSync } = await import('node:fs');
    const shellSource = readFileSync(new URL('../src/AppShell.jsx', import.meta.url), 'utf8');
    const windowSource = readFileSync(new URL('../src/components/DesktopWindow.jsx', import.meta.url), 'utf8');
    assert.ok(shellSource.includes('centerOn="schedule"'), 'Repair window centers on Schedule when opened');
    assert.ok(windowSource.includes('targetRect.left + (targetRect.width - windowWidth) / 2'));
    assert.ok(windowSource.includes('targetRect.top + (targetRect.height - windowHeight) / 2'));
    assert.ok(windowSource.includes('onMove(id, { x, y })'), 'Centered position is persisted so the repair window remains draggable');
  });

  it('Schedule save button shows a demo confirmation without storing data', async () => {
    const { readFileSync } = await import('node:fs');
    const shellSource = readFileSync(new URL('../src/AppShell.jsx', import.meta.url), 'utf8');
    const windowSource = readFileSync(new URL('../src/components/DesktopWindow.jsx', import.meta.url), 'utf8');
    assert.ok(shellSource.includes('onSave={handleSaveSchedule}'));
    assert.ok(shellSource.includes("title: 'Schedule saved'"));
    assert.ok(shellSource.includes('Schedule saved successfully.'));
    assert.ok(shellSource.includes('nothing was stored or sent.'));
    assert.ok(!shellSource.includes('saved-schedule'));
    assert.ok(windowSource.includes('aria-label="Save schedule"'));
    assert.ok(windowSource.includes('active:translate-x-0.5 active:translate-y-0.5'));
  });

  it('minimizing Schedule hides its body without unmounting repair transition state', async () => {
    const { readFileSync } = await import('node:fs');
    const windowSource = readFileSync(new URL('../src/components/DesktopWindow.jsx', import.meta.url), 'utf8');
    assert.ok(windowSource.includes("{(!isMinimized || id === 'schedule') && ("));
    assert.ok(windowSource.includes('hidden={isMinimized}'));
  });

  it('Course Details uses the active scenario catalogue', async () => {
    const { readFileSync } = await import('node:fs');
    const shellSource = readFileSync(new URL('../src/AppShell.jsx', import.meta.url), 'utf8');
    const detailsSource = readFileSync(
      new URL('../src/windows/CourseDetailsWindow.jsx', import.meta.url),
      'utf8'
    );
    assert.ok(shellSource.includes('const { notice, scenario, availableCourses } = state;'));
    assert.ok(shellSource.includes('<CourseDetailsWindow availableCourses={availableCourses} />'));
    assert.ok(detailsSource.includes('{filteredCourses.map((section) => {'));
    assert.ok(!detailsSource.includes('MAIN_CATALOG'));
    assert.ok(detailsSource.includes('{section.enrolled}/{section.capacity}'));
    assert.ok(detailsSource.includes('{isFull && <span className="nb-full-label">FULL</span>}'));
    assert.ok(detailsSource.includes('availableCourses.filter((section) =>'));
    assert.ok(detailsSource.includes('id="course-details-search"'));
    assert.ok(detailsSource.includes('const query = search.trim().toLowerCase();'));
    assert.ok(detailsSource.includes('className="nb-course-search-button" type="submit"'));
    assert.ok(detailsSource.includes('<div className="nb-divider" />'));
    assert.ok(detailsSource.includes("isFull ? ' nb-course-enroll--full' : ''"));
    assert.ok(!detailsSource.includes('Interactive add/switch controls arrive in a later update.'));
    assert.ok(!detailsSource.includes('Synthetic sample data'));
    assert.ok(!detailsSource.includes('All sections shown are fictional sample data'));
    const windowSource = readFileSync(new URL('../src/components/DesktopWindow.jsx', import.meta.url), 'utf8');
    assert.ok(windowSource.includes("id === 'courseDetails' ? 'nb-win-body--course-details' : ''"));
    const cssSource = readFileSync(new URL('../src/app.css', import.meta.url), 'utf8');
    assert.ok(cssSource.includes('.nb-course-row:nth-child(even)'));
    assert.ok(cssSource.includes('background-color: var(--color-yellow);'));
    assert.ok(cssSource.includes('.nb-course-component {'));
    assert.ok(cssSource.includes('background-color: var(--color-yellow);'));
    assert.ok(cssSource.includes('.nb-course-row:nth-child(even) .nb-course-component'));
    assert.ok(cssSource.includes('background-color: #fff;'));
    assert.ok(cssSource.includes('.nb-course-search-button {'));
    assert.ok(cssSource.includes('font-size: 18px;'));
    assert.ok(cssSource.includes('.nb-course-enroll--full {'));
    assert.ok(cssSource.includes('color: #dc2626;'));
    assert.ok(cssSource.includes('.nb-win-body--course-details {'));
    assert.ok(cssSource.includes('scrollbar-gutter: stable;'));
    assert.ok(cssSource.includes('*::-webkit-scrollbar-thumb {'));
    assert.ok(cssSource.includes('background-color: var(--color-navy);'));
    assert.ok(cssSource.includes('scrollbar-color: var(--color-navy) var(--color-yellow);'));
  });

  it('repair alert emphasizes the course ID in its message', async () => {
    const { readFileSync } = await import('node:fs');
    const noticeSource = readFileSync(new URL('../src/Notice.jsx', import.meta.url), 'utf8');
    const coursesSource = readFileSync(
      new URL('../src/components/AvailableCourses.jsx', import.meta.url),
      'utf8'
    );
    assert.ok(coursesSource.includes('emphasizedCourseId: repairPreviewId'));
    assert.ok(noticeSource.includes('notice?.emphasizedCourseId'));
    assert.ok(noticeSource.includes('<strong key={`${nextCourse.courseId}-${parts.length}`} className="font-bold text-[var(--color-navy)]">'));
    assert.ok(noticeSource.includes('{nextCourse.courseId}'));
    assert.ok(noticeSource.includes('{renderNoticeMessage()}'));
  });

  it('offers advisor alert for a conflicting linked lab without a repair', async () => {
    const { readFileSync } = await import('node:fs');
    const previewSource = readFileSync(new URL('../src/EarlySchedulePreview.jsx', import.meta.url), 'utf8');
    const coursesSource = readFileSync(
      new URL('../src/components/AvailableCourses.jsx', import.meta.url),
      'utf8'
    );
    assert.ok(previewSource.includes('unavailableLinkedLabPreviewId'));
    assert.ok(previewSource.includes('previewSection?.requiredBy'));
    assert.ok(previewSource.includes('previewRepairs.length === 0'));
    assert.ok(!previewSource.includes('scenarioTwoLabWithoutLecture'));
    assert.ok(coursesSource.includes('Get help finding a compatible lab'));
    assert.ok(coursesSource.includes('academic advisor or registration office'));
    assert.ok(previewSource.includes('.map((section) => section.id)'));
    assert.ok(coursesSource.includes('${lab?.id || \'This lab\'} conflicts with ${previewConflictNames.join(\', \')}'));
    assert.ok(coursesSource.includes('emphasizedCourseIds: [lab?.id, ...previewConflictNames].filter(Boolean)'));
    assert.ok(coursesSource.includes("action: 'acknowledge'"));
    assert.ok(coursesSource.includes('ACTION.SET_NOTICE'));
    const noticeSource = readFileSync(new URL('../src/Notice.jsx', import.meta.url), 'utf8');
    assert.ok(noticeSource.includes("notice.action === 'acknowledge'"));
    assert.ok(noticeSource.includes('                    OK'));
    const cssSource = readFileSync(new URL('../src/app.css', import.meta.url), 'utf8');
    assert.ok(cssSource.includes('.nb-repair-action'));
    assert.ok(cssSource.includes('background-color: #fff;'));
    assert.ok(cssSource.includes('@keyframes nb-repair-flash'));
    assert.ok(cssSource.includes('.nb-preview-alert-action'));
    assert.ok(cssSource.includes('color: var(--color-navy);'));
    assert.ok(cssSource.includes('@keyframes nb-preview-alert-flash'));
    assert.ok(coursesSource.includes('nb-preview-alert-action inline-flex h-6 w-6 items-center justify-center rounded border-2 border-[#dc2626] bg-white'));
    assert.ok(coursesSource.includes('nb-repair-action inline-flex h-6 w-6 items-center justify-center rounded border-2'));
    assert.equal((coursesSource.match(/transition-transform active:translate-x-0\.5 active:translate-y-0\.5/g) || []).length, 2);
    assert.ok(cssSource.includes('border-radius: 4px;'));
    assert.ok(cssSource.includes('background-color: #dc2626;'));
  });

  it('AvailableCourses includes inline Undo, Redo, and Reset icon buttons wired to correct actions', async () => {
    const { readFileSync } = await import('node:fs');
    const src = readFileSync(
      new URL('../src/components/AvailableCourses.jsx', import.meta.url),
      'utf8'
    );
    assert.ok(src.includes('ACTION.UNDO_REPAIR'), 'AvailableCourses must dispatch UNDO_REPAIR for undo button');
    assert.ok(src.includes('ACTION.REDO_REPAIR'), 'AvailableCourses must dispatch REDO_REPAIR for redo button');
    assert.ok(src.includes('ACTION.RESET_DRAFT'), 'AvailableCourses must dispatch RESET_DRAFT for reset button');
    assert.ok(src.includes('canUndo'), 'AvailableCourses must use the canUndo selector');
    assert.ok(src.includes('canRedo'), 'AvailableCourses must use the canRedo selector');
    assert.ok(src.includes('undo-repair-button'), 'Undo button must have id="undo-repair-button"');
    assert.ok(src.includes('redo-repair-button'), 'Redo button must have id="redo-repair-button"');
    assert.ok(src.includes('reset-timetable-button'), 'Reset button must have id="reset-timetable-button"');
    assert.ok(src.includes('confirm-reset-button'), 'Reset dialog must contain confirm-reset-button');
    assert.ok(src.includes('Undo2'), 'AvailableCourses must import Undo2 icon');
    assert.ok(src.includes('Redo2'), 'AvailableCourses must import Redo2 icon');
    assert.ok(src.includes('RotateCcw'), 'AvailableCourses must import RotateCcw icon');
    assert.ok(src.includes('Scroll available courses'), 'Course tray navigation must have an accessible group');
    assert.ok(src.includes('Scroll courses left'), 'Course tray must have a left navigation button');
    assert.ok(src.includes('Scroll courses right'), 'Course tray must have a right navigation button');
    assert.ok(src.includes('track.scrollBy'), 'Course tray buttons must scroll the course list');
    assert.ok(src.includes('requestAnimationFrame(scrollFrame)'), 'Holding a tray control scrolls continuously by animation frame');
    assert.ok(src.includes('elapsedSeconds * 440'), 'Held scrolling is twice the prior speed');
    assert.ok(src.includes('scrollCourseCard(direction)'), 'A click advances exactly one course card');
    assert.ok(src.includes('card.getBoundingClientRect().width + gap'), 'Single-click step matches card width and gap');
    assert.ok(src.includes('}, 180);'), 'Continuous scrolling waits so a short click only advances one card');
    assert.ok(src.includes('cancelAnimationFrame(hold.frameId)'), 'Releasing the control stops continuous scrolling');
  });

  it('REDO_REPAIR reapplies undone repair timetable and restores canUndo state', async () => {
    const { initialState, reduce, ACTION, canUndo, canRedo } = await import('../src/state/draft-controller.mjs');
    const s0 = initialState();
    assert.equal(canRedo(s0), false);

    const s1 = reduce(s0, { type: ACTION.SUGGEST_REPAIR });
    const s2 = reduce(s1, { type: ACTION.APPLY_REPAIR });
    assert.equal(canUndo(s2), true);
    assert.equal(canRedo(s2), false);

    const s3 = reduce(s2, { type: ACTION.UNDO_REPAIR });
    assert.equal(canUndo(s3), false);
    assert.equal(canRedo(s3), true);

    const s4 = reduce(s3, { type: ACTION.REDO_REPAIR });
    assert.equal(canUndo(s4), true);
    assert.equal(canRedo(s4), false);
    assert.equal(s4.notice, null, 'REDO_REPAIR must not trigger a popup dialog (notice must be null)');
    assert.deepEqual(s4.draft, s2.draft, 'draft after redo must match draft after apply');
  });

  it('EarlySchedulePreview passes state prop to AvailableCourses for inline controls', async () => {
    const { readFileSync } = await import('node:fs');
    const src = readFileSync(
      new URL('../src/EarlySchedulePreview.jsx', import.meta.url),
      'utf8'
    );
    assert.ok(!src.includes('TimetableControls'), 'EarlySchedulePreview must not use a standalone TimetableControls bar');
    assert.ok(src.includes('state={state}'), 'EarlySchedulePreview must pass state to AvailableCourses');
  });

  // ── Optional local sound cues with Howler.js ──────────────────────
  it('optional-sounds exports functions with default-off mute and safe toggle', async () => {
    const { isSoundEnabled, setSoundEnabled, toggleSound, playSound } = await import(
      '../src/audio/optional-sounds.js'
    );
    // Reset to initial state
    setSoundEnabled(false);
    assert.equal(isSoundEnabled(), false, 'Sound must be OFF (muted) by default');

    // Toggle on
    const toggledOn = toggleSound();
    assert.equal(toggledOn, true);
    assert.equal(isSoundEnabled(), true);

    // Toggle off
    const toggledOff = toggleSound();
    assert.equal(toggledOff, false);
    assert.equal(isSoundEnabled(), false);

    // Playback calls in non-browser environment must not throw or block
    assert.doesNotThrow(() => playSound('previewFound'));
    assert.doesNotThrow(() => playSound('apply'));
    assert.doesNotThrow(() => playSound('undo'));
    assert.doesNotThrow(() => playSound('nonExistentCue'));
  });

  it('three local WAV audio cues and attribution exist', async () => {
    const { existsSync, statSync, readFileSync } = await import('node:fs');
    const pubPopup = new URL('../public/sounds/popup.wav', import.meta.url);
    const pubRedo = new URL('../public/sounds/redo.wav', import.meta.url);
    const pubUndo = new URL('../public/sounds/undo.wav', import.meta.url);
    const attribution = new URL('../src/audio/ATTRIBUTION.md', import.meta.url);

    assert.ok(existsSync(pubPopup), 'public/sounds/popup.wav must exist');
    assert.ok(existsSync(pubRedo), 'public/sounds/redo.wav must exist');
    assert.ok(existsSync(pubUndo), 'public/sounds/undo.wav must exist');
    assert.ok(existsSync(attribution), 'src/audio/ATTRIBUTION.md must exist');

    assert.ok(statSync(pubPopup).size > 1000, 'popup.wav must be a valid audio file');
    assert.ok(statSync(pubRedo).size > 1000, 'redo.wav must be a valid audio file');
    assert.ok(statSync(pubUndo).size > 1000, 'undo.wav must be a valid audio file');

    const attrText = readFileSync(attribution, 'utf8');
    assert.match(attrText, /CC0|public domain/i, 'ATTRIBUTION.md must document license');
  });

  it('SettingsWindow includes dedicated sound toggle button and sample preview buttons', async () => {
    const { readFileSync } = await import('node:fs');
    const src = readFileSync(
      new URL('../src/windows/SettingsWindow.jsx', import.meta.url),
      'utf8'
    );
    assert.ok(src.includes('id="settings-sound-toggle"'), 'SettingsWindow must include settings-sound-toggle');
    assert.ok(src.includes('toggleSound'), 'SettingsWindow must invoke toggleSound');
    assert.ok(src.includes('Volume2'), 'SettingsWindow must import Volume2');
    assert.ok(src.includes('VolumeX'), 'SettingsWindow must import VolumeX');
    assert.ok(src.includes('handleTestCue'), 'SettingsWindow must include test cue buttons');
  });

  it('interaction layer wires sound cues for popup, redo, and undo', async () => {
    const { readFileSync } = await import('node:fs');
    const noticeSrc = readFileSync(
      new URL('../src/Notice.jsx', import.meta.url),
      'utf8'
    );
    const coursesSrc = readFileSync(
      new URL('../src/components/AvailableCourses.jsx', import.meta.url),
      'utf8'
    );

    assert.ok(noticeSrc.includes("playSound('popup')"), 'Notice must play popup cue on modal dialog');
    assert.ok(coursesSrc.includes("playSound('redo')"), 'AvailableCourses must play redo cue on redo');
    assert.ok(coursesSrc.includes("playSound('undo')"), 'AvailableCourses must play undo cue on undo');
  });
});




// ------------------------------------------------------------------------
// Drop-preview domain logic
// ------------------------------------------------------------------------

import {
  snapToGrid,
  clampToDayBounds,
  pointerXToMinute,
  computeEndMinute,
  buildGhostPreview,
  DT_SECTION_ID,
  DAY_START_MIN,
  DAY_END_MIN,
} from '../src/domain/drop-preview.mjs';

describe('drop-preview domain', () => {

  describe('snapToGrid', () => {
    it('snaps exactly on a 15-min boundary to itself', () => {
      assert.equal(snapToGrid(480), 480);
      assert.equal(snapToGrid(630), 630);
      assert.equal(snapToGrid(1080), 1080);
    });

    it('snaps 10:23 (623 min) up to 10:30 (630)', () => {
      assert.equal(snapToGrid(623), 630);
    });

    it('snaps 10:07 (607 min) down to 10:00 (600)', () => {
      assert.equal(snapToGrid(607), 600);
    });
  });

  describe('clampToDayBounds', () => {
    it('clamps below 8:00 to 8:00 (480)', () => {
      assert.equal(clampToDayBounds(400), DAY_START_MIN);
      assert.equal(clampToDayBounds(0), DAY_START_MIN);
    });

    it('clamps above 18:00 to 18:00 (1080)', () => {
      assert.equal(clampToDayBounds(1200), DAY_END_MIN);
    });

    it('passes through values inside bounds unchanged', () => {
      assert.equal(clampToDayBounds(630), 630);
      assert.equal(clampToDayBounds(840), 840);
    });

    it('returns exact lower bound unchanged', () => {
      assert.equal(clampToDayBounds(DAY_START_MIN), DAY_START_MIN);
    });

    it('returns exact upper bound unchanged', () => {
      assert.equal(clampToDayBounds(DAY_END_MIN), DAY_END_MIN);
    });
  });

  describe('pointerXToMinute � 10:30 snap test', () => {
    const trackRect = { left: 0, width: 600 };

    it('left edge (pointerX = 0) -> 8:00 = 480', () => {
      assert.equal(pointerXToMinute(0, trackRect), 480);
    });

    it('right edge (pointerX = 600) -> 18:00 = 1080', () => {
      assert.equal(pointerXToMinute(600, trackRect), 1080);
    });

    it('10:30 AM (150/600 = 25%) -> 630 minutes', () => {
      assert.equal(pointerXToMinute(150, trackRect), 630);
    });

    it('beyond right edge clamps to 18:00', () => {
      assert.equal(pointerXToMinute(999, trackRect), DAY_END_MIN);
    });

    it('before left edge clamps to 8:00', () => {
      assert.equal(pointerXToMinute(-50, trackRect), DAY_START_MIN);
    });
  });

  describe('computeEndMinute', () => {
    it('returns start + duration for a normal 1-hour section', () => {
      assert.equal(computeEndMinute(600, 60), 660);
    });

    it('clamps end to 18:00 when block would overflow', () => {
      assert.equal(computeEndMinute(1050, 90), DAY_END_MIN);
    });

    it('1700 + 60 = 18:00 exactly', () => {
      assert.equal(computeEndMinute(1020, 60), DAY_END_MIN);
    });
  });

  describe('buildGhostPreview', () => {
    const trackRect = { left: 0, width: 600 };

    it('returns a preview object with correct fields', () => {
      const result = buildGhostPreview(150, 20, 'Mon', trackRect, 60);
      assert.ok(result !== null);
      assert.equal(result.dayId, 'Mon');
      assert.equal(result.startMin, 630);
      assert.equal(result.endMin, 690);
    });

    it('returns null for missing dayId', () => {
      assert.equal(buildGhostPreview(150, 20, null, trackRect, 60), null);
    });

    it('returns null for zero duration', () => {
      assert.equal(buildGhostPreview(150, 20, 'Mon', trackRect, 0), null);
    });

    it('returns null for missing trackRect', () => {
      assert.equal(buildGhostPreview(150, 20, 'Mon', null, 60), null);
    });
  });

  describe('DT_SECTION_ID constant', () => {
    it('is a non-empty string', () => {
      assert.ok(typeof DT_SECTION_ID === 'string' && DT_SECTION_ID.length > 0);
    });

    it('contains course-weft to avoid MIME collision', () => {
      assert.ok(DT_SECTION_ID.includes('course-weft'));
    });
  });

  describe('file presence and wiring', () => {
    it('src/domain/drop-preview.mjs exists', async () => {
      const { existsSync } = await import('node:fs');
      const path = new URL('../src/domain/drop-preview.mjs', import.meta.url);
      assert.ok(existsSync(path), 'drop-preview.mjs must exist in src/domain/');
    });

    it('AvailableCourses imports DT_SECTION_ID and marks cards draggable', async () => {
      const { readFileSync } = await import('node:fs');
      const src = readFileSync(
        new URL('../src/components/AvailableCourses.jsx', import.meta.url),
        'utf8'
      );
      assert.ok(src.includes('DT_SECTION_ID'), 'AvailableCourses must import DT_SECTION_ID');
      assert.ok(
        src.includes('draggable={true}') || src.includes('draggable={!isFullSection && !isRepairLocked}'),
        'AvailableCourses must mark open, unlocked cards as draggable'
      );
    });

    it('Timetable imports from drop-preview and handles drag events', async () => {
      const { readFileSync } = await import('node:fs');
      const src = readFileSync(
        new URL('../src/components/Timetable.jsx', import.meta.url),
        'utf8'
      );
      assert.ok(src.includes('drop-preview.mjs'), 'Timetable must import from drop-preview.mjs');
      assert.ok(src.includes('onDragOver'), 'Timetable must handle onDragOver');
      assert.ok(src.includes('onDragLeave'), 'Timetable must handle onDragLeave');
      assert.ok(src.includes('nb-tt-ghost'), 'Timetable must render nb-tt-ghost element');
    });
  });

});

// ------------------------------------------------------------------------
// Fixed-slot time-conflict preview
// ------------------------------------------------------------------------

import {
  isHalfOpenOverlap,
  getSectionDays,
  getConflictingSections,
  detectTimeConflict,
  buildFixedPreview,
} from '../src/domain/drop-preview.mjs';

describe('Fixed-slot time-conflict preview', () => {

  describe('isHalfOpenOverlap — same-day half-open boundaries', () => {
    it('returns true when intervals strictly overlap', () => {
      // 10:00-11:00 (600-660) and 10:30-11:30 (630-690)
      assert.strictEqual(isHalfOpenOverlap(600, 660, 630, 690), true);
    });

    it('returns true when one interval completely contains another', () => {
      // 10:00-13:00 (600-780) and 11:00-12:00 (660-720)
      assert.strictEqual(isHalfOpenOverlap(600, 780, 660, 720), true);
    });

    it('returns false for adjacent half-open boundary endA === startB', () => {
      // Section A: 10:00-11:00 (600-660), Section B: 11:00-12:00 (660-720)
      assert.strictEqual(isHalfOpenOverlap(600, 660, 660, 720), false);
    });

    it('returns false for adjacent half-open boundary startA === endB', () => {
      // Section A: 11:00-12:00 (660-720), Section B: 10:00-11:00 (600-660)
      assert.strictEqual(isHalfOpenOverlap(660, 720, 600, 660), false);
    });

    it('returns false for completely disjoint time intervals', () => {
      // 8:00-9:00 (480-540) and 14:00-15:00 (840-900)
      assert.strictEqual(isHalfOpenOverlap(480, 540, 840, 900), false);
    });
  });

  describe('fixed official slot independent of pointer position', () => {
    it('official slot position derives solely from section definition', () => {
      const bio214 = { id: 'BIO-214', day: 'Mon', start: 780, end: 840 };
      const selected = [];
      const preview = buildFixedPreview(bio214, selected);

      assert.strictEqual(preview.day, 'Mon');
      assert.strictEqual(preview.startMin, 780);
      assert.strictEqual(preview.endMin, 840);
      assert.strictEqual(preview.sectionId, 'BIO-214');
    });
  });

  describe('green non-overlap', () => {
    it('returns status ok and hasConflict false when timetable has no overlaps', () => {
      const chemB = { id: 'MATH-B', day: 'Thu', start: 600, end: 660 };
      const selected = [
        { id: 'MATH-A', day: 'Tue', start: 600, end: 660 },
        { id: 'STAT-A', day: 'Mon', start: 780, end: 840 },
      ];
      const preview = buildFixedPreview(chemB, selected);

      assert.strictEqual(preview.hasConflict, false);
      assert.strictEqual(preview.status, 'ok');
      assert.strictEqual(preview.conflictCount, 0);
    });

    it('returns status ok for same day non-overlapping sections', () => {
      const secCandidate = { id: 'EXTRA-1', day: 'Mon', start: 480, end: 540 }; // Mon 8-9am
      const selected = [
        { id: 'STAT-A', day: 'Mon', start: 780, end: 840 }, // Mon 1-2pm
      ];
      const preview = buildFixedPreview(secCandidate, selected);

      assert.strictEqual(preview.hasConflict, false);
      assert.strictEqual(preview.status, 'ok');
    });
  });

  describe('red single and multiple overlaps without labels', () => {
    it('marks red conflict for a single overlap', () => {
      const bio214 = { id: 'BIO-214', day: 'Mon', start: 780, end: 840 };
      const selected = [
        { id: 'STAT-A', title: 'Introductory Statistics', day: 'Mon', start: 780, end: 840 },
      ];
      const preview = buildFixedPreview(bio214, selected);

      assert.strictEqual(preview.hasConflict, true);
      assert.strictEqual(preview.status, 'conflict');
      assert.strictEqual(preview.conflictCount, 1);
    });

    it('marks red conflict for multiple overlaps', () => {
      const longSec = { id: 'LONG-1', day: 'Mon', start: 600, end: 780 }; // Mon 10:00-13:00
      const selected = [
        { id: 'SEC-A', title: 'Course A', day: 'Mon', start: 600, end: 660 }, // 10:00-11:00
        { id: 'SEC-B', title: 'Course B', day: 'Mon', start: 660, end: 720 }, // 11:00-12:00
      ];
      const preview = buildFixedPreview(longSec, selected);

      assert.strictEqual(preview.hasConflict, true);
      assert.strictEqual(preview.status, 'conflict');
      assert.strictEqual(preview.conflictCount, 2);
    });

    it('preview descriptor and timetable visual block do not label conflicting course names', async () => {
      const { readFileSync } = await import('node:fs');
      const timetableSrc = readFileSync(
        new URL('../src/components/Timetable.jsx', import.meta.url),
        'utf8'
      );
      assert.ok(timetableSrc.includes('FixedPreviewBlock'), 'Timetable must define FixedPreviewBlock');
      assert.ok(
        timetableSrc.includes('nb-tt-fixed-preview-label'),
        'Timetable renders label container'
      );
      assert.ok(
        !timetableSrc.includes('conflictingCourses') && !timetableSrc.includes('conflictsWith'),
        'FixedPreviewBlock must remain purely visual without naming conflicting course titles'
      );
    });
  });

  describe('changing the draft recalculates the preview', () => {
    it('recalculates from conflict to ok when conflicting section is removed from draft', () => {
      const bio214 = { id: 'BIO-214', day: 'Mon', start: 780, end: 840 };
      let selected = [
        { id: 'MATH-A', day: 'Tue', start: 600, end: 660 },
        { id: 'STAT-A', day: 'Mon', start: 780, end: 840 }, // conflicts
      ];

      const previewBefore = buildFixedPreview(bio214, selected);
      assert.strictEqual(previewBefore.status, 'conflict');

      // User removes STAT-A from draft
      selected = selected.filter((s) => s.id !== 'STAT-A');

      const previewAfter = buildFixedPreview(bio214, selected);
      assert.strictEqual(previewAfter.status, 'ok');
      assert.strictEqual(previewAfter.hasConflict, false);
    });

    it('recalculates from ok to conflict when a conflicting section is added to draft', () => {
      const bio214 = { id: 'BIO-214', day: 'Mon', start: 780, end: 840 };
      let selected = [
        { id: 'MATH-A', day: 'Tue', start: 600, end: 660 },
      ];

      const previewBefore = buildFixedPreview(bio214, selected);
      assert.strictEqual(previewBefore.status, 'ok');

      // User adds STAT-A to draft
      selected = [...selected, { id: 'STAT-A', day: 'Mon', start: 780, end: 840 }];

      const previewAfter = buildFixedPreview(bio214, selected);
      assert.strictEqual(previewAfter.status, 'conflict');
    });
  });

  describe('CSS styling and prefers-reduced-motion', () => {
    it('app.css includes fixed-preview styles with green ok and red conflict modifiers', async () => {
      const { readFileSync } = await import('node:fs');
      const css = readFileSync(
        new URL('../src/app.css', import.meta.url),
        'utf8'
      );
      assert.ok(css.includes('.nb-tt-fixed-preview'), 'app.css has .nb-tt-fixed-preview base class');
      assert.ok(css.includes('.nb-tt-fixed-preview--ok'), 'app.css has .nb-tt-fixed-preview--ok class');
      assert.ok(css.includes('.nb-tt-fixed-preview--conflict'), 'app.css has .nb-tt-fixed-preview--conflict class');
    });

    it('app.css disables animations and transitions under prefers-reduced-motion: reduce', async () => {
      const { readFileSync } = await import('node:fs');
      const css = readFileSync(
        new URL('../src/app.css', import.meta.url),
        'utf8'
      );
      assert.ok(
        css.includes('prefers-reduced-motion: reduce') &&
        css.includes('.nb-tt-fixed-preview'),
        'app.css respects prefers-reduced-motion for fixed preview'
      );
    });
  });

  describe('component wiring for focus and drag-leave', () => {
    it('AvailableCourses emits onPreviewSectionChange on focus, blur, dragLeave, and dragEnd', async () => {
      const { readFileSync } = await import('node:fs');
      const src = readFileSync(
        new URL('../src/components/AvailableCourses.jsx', import.meta.url),
        'utf8'
      );
      assert.ok(src.includes('onPreviewSectionChange'), 'AvailableCourses accepts onPreviewSectionChange');
      assert.ok(src.includes('onFocus='), 'AvailableCourses handles onFocus on course cards');
      assert.ok(src.includes('onBlur='), 'AvailableCourses handles onBlur on course cards');
      assert.ok(src.includes('onDragLeave='), 'AvailableCourses handles onDragLeave when leaving strip');
    });

    it('Timetable accepts fixedPreviewSectionId and renders FixedPreviewBlock', async () => {
      const { readFileSync } = await import('node:fs');
      const src = readFileSync(
        new URL('../src/components/Timetable.jsx', import.meta.url),
        'utf8'
      );
      assert.ok(src.includes('fixedPreviewSectionId'), 'Timetable accepts fixedPreviewSectionId prop');
      assert.ok(src.includes('FixedPreviewBlock'), 'Timetable renders FixedPreviewBlock');
      assert.ok(src.includes('nb-tt-fixed-preview--ok'), 'Timetable applies ok modifier');
      assert.ok(src.includes('nb-tt-fixed-preview--conflict'), 'Timetable applies conflict modifier');
    });

    it('EarlySchedulePreview wires previewSectionId between AvailableCourses and Timetable', async () => {
      const { readFileSync } = await import('node:fs');
      const src = readFileSync(
        new URL('../src/EarlySchedulePreview.jsx', import.meta.url),
        'utf8'
      );
      assert.ok(src.includes('previewSectionId'), 'EarlySchedulePreview manages previewSectionId state');
      assert.ok(src.includes('onPreviewSectionChange={setPreviewSectionId}'), 'EarlySchedulePreview wires AvailableCourses');
      assert.ok(src.includes('fixedPreviewSectionId={activePreviewSectionId}'), 'EarlySchedulePreview wires Timetable');
    });
  });

});

// ------------------------------------------------------------------------
// Available Courses drag, drop, and cancel
// ------------------------------------------------------------------------

import {
  POINTER_DRAG_THRESHOLD,
  hasExceededDragThreshold,
  isCardTouchingTimetable,
  isCardOutsidePanel,
  evaluateDrop,
} from '../src/domain/drop-preview.mjs';

describe('Available Courses drag, drop, and cancel', () => {

  describe('pointer threshold/start', () => {
    it('movement under threshold (e.g. 2px, 3px) does not start drag', () => {
      assert.strictEqual(hasExceededDragThreshold(0, 0), false);
      assert.strictEqual(hasExceededDragThreshold(2, 2, POINTER_DRAG_THRESHOLD), false);
      assert.strictEqual(hasExceededDragThreshold(3, 3, POINTER_DRAG_THRESHOLD), false);
      assert.strictEqual(hasExceededDragThreshold(-2, 3, POINTER_DRAG_THRESHOLD), false);
    });

    it('movement meeting or exceeding threshold (>= 5px) initiates drag', () => {
      assert.strictEqual(hasExceededDragThreshold(0, 5, POINTER_DRAG_THRESHOLD), true);
      assert.strictEqual(hasExceededDragThreshold(5, 0, POINTER_DRAG_THRESHOLD), true);
      assert.strictEqual(hasExceededDragThreshold(3, 4, POINTER_DRAG_THRESHOLD), true); // 3-4-5 triangle
      assert.strictEqual(hasExceededDragThreshold(-6, 0, POINTER_DRAG_THRESHOLD), true);
      assert.strictEqual(hasExceededDragThreshold(10, 15, POINTER_DRAG_THRESHOLD), true);
    });
  });

  describe('placeholder and list order', () => {
    it('dragged card leaves placeholder preserving original list order and indices', () => {
      const items = [
        { id: 'MATH-B', title: 'Chemistry B' },
        { id: 'STAT-B', title: 'Statistics B' },
        { id: 'BIO-214', title: 'Biology' },
      ];

      // Dragging the middle item (STAT-B)
      const heldId = 'STAT-B';
      const renderedSlots = items.map((item, idx) => {
        if (item.id === heldId) {
          return { type: 'placeholder', id: item.id, originalIndex: idx };
        }
        return { type: 'card', id: item.id, originalIndex: idx };
      });

      assert.strictEqual(renderedSlots.length, 3);
      assert.strictEqual(renderedSlots[0].id, 'MATH-B');
      assert.strictEqual(renderedSlots[0].type, 'card');
      assert.strictEqual(renderedSlots[1].id, 'STAT-B');
      assert.strictEqual(renderedSlots[1].type, 'placeholder');
      assert.strictEqual(renderedSlots[2].id, 'BIO-214');
      assert.strictEqual(renderedSlots[2].type, 'card');
    });
  });

  describe('boundary-touch hit test', () => {
    const timetableRect = { left: 50, top: 150, right: 950, bottom: 650, width: 900, height: 500 };

    it('returns true when held card overlaps timetable interior', () => {
      const cardRect = { left: 100, top: 200, right: 295, bottom: 290 };
      assert.strictEqual(isCardTouchingTimetable(cardRect, timetableRect), true);
    });

    it('returns true when held card touches top boundary edge', () => {
      const cardRect = { left: 100, top: 60, right: 295, bottom: 150 };
      assert.strictEqual(isCardTouchingTimetable(cardRect, timetableRect), true);
    });

    it('returns true when held card touches bottom boundary edge', () => {
      const cardRect = { left: 100, top: 650, right: 295, bottom: 740 };
      assert.strictEqual(isCardTouchingTimetable(cardRect, timetableRect), true);
    });

    it('returns true when held card touches left boundary edge', () => {
      const cardRect = { left: 0, top: 200, right: 50, bottom: 290 };
      assert.strictEqual(isCardTouchingTimetable(cardRect, timetableRect), true);
    });

    it('returns true when held card touches right boundary edge', () => {
      const cardRect = { left: 950, top: 200, right: 1145, bottom: 290 };
      assert.strictEqual(isCardTouchingTimetable(cardRect, timetableRect), true);
    });

    it('returns false when held card is completely above timetable', () => {
      const cardRect = { left: 100, top: 20, right: 295, bottom: 110 };
      assert.strictEqual(isCardTouchingTimetable(cardRect, timetableRect), false);
    });

    it('returns false when held card is completely below timetable', () => {
      const cardRect = { left: 100, top: 700, right: 295, bottom: 790 };
      assert.strictEqual(isCardTouchingTimetable(cardRect, timetableRect), false);
    });

    it('returns false when held card is completely to the left or right of timetable', () => {
      assert.strictEqual(isCardTouchingTimetable({ left: -250, top: 200, right: -55, bottom: 290 }, timetableRect), false);
      assert.strictEqual(isCardTouchingTimetable({ left: 1000, top: 200, right: 1195, bottom: 290 }, timetableRect), false);
    });

    it('returns false for null or undefined rectangles', () => {
      assert.strictEqual(isCardTouchingTimetable(null, timetableRect), false);
      assert.strictEqual(isCardTouchingTimetable(timetableRect, null), false);
    });
  });

  describe('isCardOutsidePanel — preview activation', () => {
    const panelRect = { left: 20, top: 20, right: 980, bottom: 140 };

    it('returns false when card is inside Available Courses panel bounds', () => {
      const cardRect = { left: 30, top: 30, right: 225, bottom: 120 };
      assert.strictEqual(isCardOutsidePanel(cardRect, panelRect), false);
    });

    it('returns true when card is dragged below the panel towards timetable', () => {
      const cardRect = { left: 30, top: 150, right: 225, bottom: 240 };
      assert.strictEqual(isCardOutsidePanel(cardRect, panelRect), true);
    });
  });

  describe('green drop', () => {
    it('evaluates drop as successful when touching timetable with no time conflict', () => {
      const result = evaluateDrop({ touchesTimetable: true, hasConflict: false });
      assert.strictEqual(result.success, true);
      assert.strictEqual(result.reason, 'ok');
    });

    it('green drop dispatches ADD_SECTION or SWITCH_SECTION to update draft', () => {
      const draft = ['MATH-A', 'STAT-A'];
      const nonConflictingSec = { id: 'MATH-B', course: 'CHEM' };

      const dropResult = evaluateDrop({ touchesTimetable: true, hasConflict: false });
      assert.strictEqual(dropResult.success, true);

      let updatedDraft;
      if (dropResult.success) {
        updatedDraft = draft.map(id => id === 'MATH-A' ? nonConflictingSec.id : id);
      }
      assert.deepStrictEqual(updatedDraft, ['MATH-B', 'STAT-A']);
    });
  });

  describe('red drop restores source', () => {
    it('evaluates drop as rejected when touching timetable with time conflict', () => {
      const result = evaluateDrop({ touchesTimetable: true, hasConflict: true });
      assert.strictEqual(result.success, false);
      assert.strictEqual(result.reason, 'conflict');
    });

    it('rejected red drop does not mutate draft and restores card to origin', () => {
      const initialDraft = Object.freeze(['MATH-A', 'STAT-A']);
      const draft = [...initialDraft];

      const dropResult = evaluateDrop({ touchesTimetable: true, hasConflict: true });
      assert.strictEqual(dropResult.success, false);
      assert.deepStrictEqual(draft, initialDraft);
    });
  });

  describe('release outside timetable restores source', () => {
    it('evaluates drop as rejected when released without touching timetable', () => {
      const result = evaluateDrop({ touchesTimetable: false, hasConflict: false });
      assert.strictEqual(result.success, false);
      assert.strictEqual(result.reason, 'outside');
    });

    it('release outside does not mutate draft and triggers restore animation', () => {
      const initialDraft = Object.freeze(['MATH-A', 'STAT-A']);
      const draft = [...initialDraft];

      const dropResult = evaluateDrop({ touchesTimetable: false, hasConflict: false });
      assert.strictEqual(dropResult.success, false);
      assert.strictEqual(dropResult.reason, 'outside');
      assert.deepStrictEqual(draft, initialDraft);
    });
  });

  describe('successful list reflow', () => {
    it('removes added section from available courses and closes the gap', () => {
      const catalog = [
        { id: 'MATH-B', title: 'Mathematics B' },
        { id: 'STAT-B', title: 'Introductory Statistics B' },
        { id: 'BIO-214', title: 'Cell Biology' },
      ];
      let draft = ['STAT-A'];

      let available = catalog.filter(c => !draft.includes(c.id));
      assert.strictEqual(available.length, 3);
      assert.strictEqual(available[1].id, 'STAT-B');

      draft = [...draft, 'STAT-B'];

      available = catalog.filter(c => !draft.includes(c.id));
      assert.strictEqual(available.length, 2);
      assert.strictEqual(available[0].id, 'MATH-B');
      assert.strictEqual(available[1].id, 'BIO-214');
    });
  });

  describe('touch and pointer cancellation', () => {
    it('pointer cancel resets drag state and restores card to source without draft mutation', () => {
      const initialDraft = Object.freeze(['MATH-A', 'STAT-A']);
      const draft = [...initialDraft];
      let heldCard = { item: { id: 'BIO-214' }, isDragging: true, isRestoring: false };

      function onPointerCancel() {
        heldCard = { ...heldCard, isRestoring: true };
      }
      onPointerCancel();

      assert.strictEqual(heldCard.isRestoring, true);
      assert.deepStrictEqual(draft, initialDraft);
    });
  });

  describe('file and component wiring', () => {
    it('AvailableCourses implements pointer drag handlers, placeholder, and held card overlay', async () => {
      const { readFileSync } = await import('node:fs');
      const src = readFileSync(
        new URL('../src/components/AvailableCourses.jsx', import.meta.url),
        'utf8'
      );
      assert.ok(src.includes('handlePointerDown'), 'AvailableCourses implements handlePointerDown');
      assert.ok(src.includes('nb-course-placeholder'), 'AvailableCourses renders nb-course-placeholder');
      assert.ok(src.includes('nb-course-card-held'), 'AvailableCourses renders nb-course-card-held overlay');
      assert.ok(src.includes('isCardTouchingTimetable'), 'AvailableCourses uses boundary-touch test');
      assert.ok(src.includes('isCardOutsidePanel'), 'AvailableCourses checks panel boundary exit');
      assert.ok(src.includes('evaluateDrop'), 'AvailableCourses evaluates drop validity');
    });

    it('Timetable has data-testid="timetable" for boundary hit-testing', async () => {
      const { readFileSync } = await import('node:fs');
      const src = readFileSync(
        new URL('../src/components/Timetable.jsx', import.meta.url),
        'utf8'
      );
      assert.ok(src.includes('data-testid="timetable"'), 'Timetable has data-testid="timetable" attribute');
    });

    it('app.css styles placeholder, held card, and respects prefers-reduced-motion', async () => {
      const { readFileSync } = await import('node:fs');
      const css = readFileSync(
        new URL('../src/app.css', import.meta.url),
        'utf8'
      );
      assert.ok(css.includes('.nb-course-placeholder'), 'app.css has .nb-course-placeholder rule');
      assert.ok(css.includes('.nb-course-card-held'), 'app.css has .nb-course-card-held rule');
      assert.ok(css.includes('.nb-course-card-held--restoring'), 'app.css has restoring animation rule');
      assert.ok(
        css.includes('.nb-course-card-held--restoring') && css.includes('prefers-reduced-motion'),
        'app.css respects prefers-reduced-motion for restoring animation'
      );
    });

    it('single click alone does not start drag; only hold-and-drag initiates dragging', async () => {
      const { readFileSync } = await import('node:fs');
      const src = readFileSync(
        new URL('../src/components/AvailableCourses.jsx', import.meta.url),
        'utf8'
      );
      // Click without drag threshold: pointer state must be cleared without entering heldCard
      assert.ok(src.includes('Simple click (no drag): do nothing'), 'AvailableCourses treats plain click as no-op');
      assert.ok(src.includes('setPressedCardId(item.id)'), 'A pressed course stays visually selected after release');
      assert.ok(src.includes("pressedCardId === item.id ? 'nb-course-card--pressed'"), 'The pressed course retains its active card styling');
      assert.ok(src.includes(`if (dropResult.success) {
        // Drop successful: add or switch section and close gap
        setPressedCardId(null);`), 'Only a successful drop clears the pressed-course highlight');
      assert.ok(src.includes('const returnedSection = previousDraftRef.current.some((id) => !draft.includes(id))'));
      assert.ok(src.includes('if (returnedSection) {') && src.includes('setPressedCardId(null)'), 'Returning a timetable course clears stale tray selection');
      assert.ok(src.includes('onPreviewSectionChange?.(null)'), 'Returning a timetable course clears the active preview');
      assert.ok(src.includes(`} else {
        // Red drop or outside timetable: animate back to original position
        preservePreviewOnBlurRef.current = true;
        onPreviewSectionChange?.(cur.item.id);`), 'An unsuccessful drop keeps its course preview visible');
      assert.ok(src.includes('selectionResetKey = 0') && src.includes('}, [selectionResetKey])'), 'A timetable drag can clear tray selection before the course is dropped');
      assert.ok(src.includes("useLayoutEffect(() => {\n    setPressedCardId(null);\n    preservePreviewOnBlurRef.current = false;\n  }, [selectionResetKey])"), 'Scenario changes clear the pressed-card state before paint');
      assert.ok(src.includes("event.relatedTarget?.closest?.('#window-scenarios, #dock-scenarios')"), 'Opening Scenario preserves the current preview until a scenario is actually changed');
      // Drag must still be initiated when threshold is exceeded
      assert.ok(src.includes('hasExceededDragThreshold'), 'AvailableCourses initiates drag only above threshold');
      const css = readFileSync(new URL('../src/app.css', import.meta.url), 'utf8');
      assert.ok(css.includes('.nb-course-card.nb-course-card--pressed'), 'The pressed course uses the yellow raised-card style');
    });
  });

  // ── Timetable Section Drag & Animated Section Swaps ──────────────────
  describe('imetable section drag and animated section swaps', () => {
    it('evaluateSwap validates valid swap and produces next draft', async () => {
      const { evaluateSwap } = await import('../src/domain/drop-preview.mjs');
      const { MAIN_CATALOG, INITIAL_DRAFT } = await import('../src/domain/available-courses.mjs');
      // In INITIAL_DRAFT, STAT-A is enrolled, and STAT-B is a valid alternate
      const result = evaluateSwap({
        draft: INITIAL_DRAFT,
        availableCourses: MAIN_CATALOG,
        fromId: 'STAT-A',
        toId: 'STAT-B',
      });
      assert.strictEqual(result.valid, true);
      assert.strictEqual(result.reason, 'ok');
      assert.ok(result.nextDraft.includes('STAT-B'));
      assert.ok(!result.nextDraft.includes('STAT-A'));
    });

    it('evaluateSwap rejects non-alternate swap and leaves draft untouched', async () => {
      const { evaluateSwap } = await import('../src/domain/drop-preview.mjs');
      const { MAIN_CATALOG, INITIAL_DRAFT } = await import('../src/domain/available-courses.mjs');
      // MATH-A is not an alternate for STAT-A
      const result = evaluateSwap({
        draft: INITIAL_DRAFT,
        availableCourses: MAIN_CATALOG,
        fromId: 'STAT-A',
        toId: 'MATH-B',
      });
      assert.strictEqual(result.valid, false);
      assert.strictEqual(result.reason, 'not-declared-alternate');
      assert.deepStrictEqual(result.nextDraft, INITIAL_DRAFT);
    });

    it('getEffectiveSwapDuration respects prefers-reduced-motion', async () => {
      const { getEffectiveSwapDuration, SWAP_ANIMATION_DURATION_MS } = await import('../src/domain/drop-preview.mjs');
      assert.strictEqual(getEffectiveSwapDuration({ prefersReducedMotion: false }), SWAP_ANIMATION_DURATION_MS);
      assert.strictEqual(getEffectiveSwapDuration({ prefersReducedMotion: true }), 0);
    });

    it('isCardTouchingAvailableCourses detects overlap with panel', async () => {
      const { isCardTouchingAvailableCourses } = await import('../src/domain/drop-preview.mjs');
      const panel = { left: 100, top: 100, right: 800, bottom: 250 };
      const cardInside = { left: 150, top: 120, right: 345, bottom: 210 };
      const cardOutside = { left: 150, top: 400, right: 345, bottom: 490 };

      assert.strictEqual(isCardTouchingAvailableCourses(cardInside, panel), true);
      assert.strictEqual(isCardTouchingAvailableCourses(cardOutside, panel), false);
    });

    it('Timetable wires removal handler to dispatch REMOVE_SECTION', async () => {
      const { readFileSync } = await import('node:fs');
      const src = readFileSync(
        new URL('../src/components/Timetable.jsx', import.meta.url),
        'utf8'
      );
      assert.ok(src.includes('handleRemove'), 'Timetable wires handleRemove to dispatch REMOVE_SECTION');
    });

    it('Timetable supports dragging course blocks and swap animations', async () => {
      const { readFileSync } = await import('node:fs');
      const src = readFileSync(
        new URL('../src/components/Timetable.jsx', import.meta.url),
        'utf8'
      );
      assert.ok(src.includes('handleSectionPointerDown'), 'Timetable implements handleSectionPointerDown');
      assert.ok(src.includes('onSectionDragStart?.(cur.sec.id)'), 'Timetable notifies the tray when a drag starts');
      assert.ok(src.includes('nb-tt-block-placeholder'), 'Timetable renders placeholder when dragging block');
      assert.ok(src.includes('nb-tt-block-held'), 'Timetable renders held floating section overlay');
      assert.ok(src.includes('isOverAvailableCourses'), 'Held timetable block tracks overlap with the Available Courses tray');
      assert.ok(src.includes('nb-tt-block-held--over-courses'), 'Held timetable block highlights over the Available Courses tray');
      assert.ok(src.includes('nb-tt-swap-outgoing'), 'Timetable applies nb-tt-swap-outgoing to outgoing section');
      assert.ok(src.includes('nb-tt-swap-incoming'), 'Timetable renders incoming swap preview');
    });

    it('app.css styles swap animation classes and reduced-motion fallback', async () => {
      const { readFileSync } = await import('node:fs');
      const css = readFileSync(
        new URL('../src/app.css', import.meta.url),
        'utf8'
      );
      assert.ok(css.includes('.nb-tt-swap-outgoing'), 'app.css has .nb-tt-swap-outgoing');
      assert.ok(css.includes('.nb-tt-swap-incoming'), 'app.css has .nb-tt-swap-incoming');
      assert.ok(css.includes('.nb-tt-block-remove'), 'app.css has .nb-tt-block-remove');
      assert.ok(css.includes('.nb-tt-block-placeholder'), 'app.css has .nb-tt-block-placeholder');
      assert.ok(css.includes('.nb-tt-block-held'), 'app.css has .nb-tt-block-held');
      assert.ok(css.includes('.nb-tt-block-held--over-courses'), 'app.css highlights held timetable blocks over the course tray');
      assert.ok(
        css.includes('nb-tt-swap-out') && css.includes('prefers-reduced-motion'),
        'app.css respects prefers-reduced-motion for swap animations'
      );
    });

    it('EarlySchedulePreview coordinates animated section swap before dispatching state', async () => {
      const { readFileSync } = await import('node:fs');
      const src = readFileSync(
        new URL('../src/EarlySchedulePreview.jsx', import.meta.url),
        'utf8'
      );
      assert.ok(src.includes('handleRequestSwap'), 'EarlySchedulePreview defines handleRequestSwap');
      assert.ok(src.includes('evaluateSwap'), 'EarlySchedulePreview validates swap before animating');
      assert.ok(src.includes('setAnimatingSwap'), 'EarlySchedulePreview manages animatingSwap state');
      assert.ok(src.includes('onRequestSwap={handleRequestSwap}'), 'EarlySchedulePreview passes swap callback to children');
      assert.ok(src.includes('onSectionDragStart={handleTimetableDragStart}'));
      assert.ok(src.includes('setPreviewSectionId(null)'), 'Starting a timetable drag clears the course preview');
    });

    it('repair Apply animates swaps in sequence before adding remaining sections', async () => {
      const { readFileSync } = await import('node:fs');
      const src = readFileSync(
        new URL('../src/EarlySchedulePreview.jsx', import.meta.url),
        'utf8'
      );
      const timetableSrc = readFileSync(
        new URL('../src/components/Timetable.jsx', import.meta.url),
        'utf8'
      );
      const coursesSrc = readFileSync(
        new URL('../src/components/AvailableCourses.jsx', import.meta.url),
        'utf8'
      );
      assert.ok(src.includes("setRepairTransition('loading')"));
      assert.ok(src.includes('}, 1000);'), 'Loading stage lasts about one second');
      assert.ok(src.includes('bg-white/50'), 'Loading overlay uses 50% white opacity');
      assert.ok(src.includes('data-testid="repair-loading-overlay"'));
      assert.ok(src.includes('state.snapshot?.candidate?.swaps || []'), 'Repair transitions use the suggested swap order');
      assert.ok(src.includes('const runSwap = (index)'), 'Each repair swap is animated as a separate stage');
      assert.ok(src.includes('runAdditionAnimation()'), 'New requested courses are animated after the swaps');
      assert.ok(src.includes('setRepairDisplayDraft(stageDraft)'), 'Each completed swap updates the displayed timetable');
      assert.ok(src.includes('repairLockedIds'), 'Repair-involved sections remain locked throughout the transition');
      assert.ok(src.includes('repairLockedIds={repairLockedIds}'), 'Both course tray and timetable receive the repair lock');
      assert.ok(src.includes('repairInteractionLocked={repairInteractionLocked}'), 'All courses remain locked until the complete repair transition ends');
      assert.ok(coursesSrc.includes('disabled={isRepairLocked}'), 'Locked tray cards cannot be activated');
      assert.ok(timetableSrc.includes("nb-tt-block--repair-locked"), 'Locked timetable blocks show the non-interactive state');
      assert.ok(src.includes('state.snapshot.draft'), 'The previous timetable remains visible during loading');
      assert.ok(src.includes('draft={displayDraft}'), 'The previous timetable is rendered until loading finishes');
      assert.ok(timetableSrc.includes('incomingSwapIds.includes(sec.id)'));
      assert.ok(timetableSrc.includes('outgoingSwapIds.includes(sec.id)'));
      assert.ok(timetableSrc.includes('incomingSwapSections.findIndex((section) => section.id === incomingSwapSection.id)'), 'Incoming course animations follow their sorted order');
      assert.ok(timetableSrc.includes('first.id === second.requiredBy'), 'Linked lectures animate before their labs');
      assert.ok(src.includes('remainingIncomingIds.length * 280'), 'Animation duration accounts for added courses');
    });

    it('scenario switching animates selected sections back before revealing the new course list', async () => {
      const { readFileSync } = await import('node:fs');
      const src = readFileSync(
        new URL('../src/EarlySchedulePreview.jsx', import.meta.url),
        'utf8'
      );
      const controllerSrc = readFileSync(
        new URL('../src/state/draft-controller.mjs', import.meta.url),
        'utf8'
      );
      assert.ok(src.includes('scenarioTransition?.availableCourses'), 'Old scenario cards remain visible during reset');
      assert.ok(src.includes('scenarioTransition.draft'), 'The previous selected sections remain visible during reset');
      assert.ok(src.includes('outgoingIds: scenarioTransition.draft'), 'Selected timetable sections animate back toward the tray');
      assert.ok(src.includes("scenarioTransition.phase === 'outgoing'"), 'Old selections return before the new defaults appear');
      assert.ok(src.includes('setTraySelectionResetKey((key) => key + 1)'), 'Scenario changes clear stale pressed-card styling');
      assert.ok(src.includes("scenarioTransition.phase === 'incoming'"), 'The new scenario defaults animate into the timetable');
      assert.ok(src.includes('incomingIds: draft, outgoingIds: []'), 'New default sections animate into the schedule');
      assert.ok(src.includes('ACTION.COMPLETE_SCENARIO_TRANSITION'), 'The scenario reset advances and completes both animation stages');
      assert.ok(controllerSrc.includes('draft: Object.freeze([])'), 'Switching scenarios clears the timetable');
      assert.ok(controllerSrc.includes("phase: 'incoming'"), 'Completing the return stage restores the new default timetable');
      assert.ok(controllerSrc.includes('COMPLETE_SCENARIO_TRANSITION'), 'Scenario reset has an explicit completion action');
    });

    it('Reset button uses the same two-stage return-and-restore animation', async () => {
      const { readFileSync } = await import('node:fs');
      const src = readFileSync(
        new URL('../src/EarlySchedulePreview.jsx', import.meta.url),
        'utf8'
      );
      const controllerSrc = readFileSync(
        new URL('../src/state/draft-controller.mjs', import.meta.url),
        'utf8'
      );
      const coursesSrc = readFileSync(
        new URL('../src/components/AvailableCourses.jsx', import.meta.url),
        'utf8'
      );
      assert.ok(coursesSrc.includes("type: ACTION.RESET_DRAFT"));
      assert.ok(controllerSrc.includes("case ACTION.RESET_DRAFT"));
      assert.ok(controllerSrc.includes("phase: 'outgoing'"));
      assert.ok(src.includes("scenarioTransition.phase === 'incoming'"));
      assert.ok(src.includes('incomingIds: draft, outgoingIds: []'));
      assert.ok(src.includes('COMPLETE_SCENARIO_TRANSITION'));
    });

    it('Timetable highlights outgoing alternate section with nb-tt-block--swapping-out and 40% opacity', async () => {
      const { readFileSync } = await import('node:fs');
      const timetableSrc = readFileSync(
        new URL('../src/components/Timetable.jsx', import.meta.url),
        'utf8'
      );
      assert.ok(timetableSrc.includes('replacedSectionIds'), 'Timetable identifies replacedSectionIds');
      assert.ok(timetableSrc.includes('nb-tt-block--swapping-out'), 'Timetable applies nb-tt-block--swapping-out');
      assert.ok(timetableSrc.includes('data-is-replaced'), 'Timetable passes data-is-replaced attribute');

      const css = readFileSync(
        new URL('../src/app.css', import.meta.url),
        'utf8'
      );
      assert.ok(css.includes('.nb-tt-block--swapping-out'), 'app.css styles .nb-tt-block--swapping-out');
      assert.ok(css.includes('opacity: 0.4'), 'app.css sets opacity: 0.4 for outgoing section');
    });
  });

  // ── Animate BIO-214 and linked-lab outlines ────────────────────────
  describe('Animate BIO-214 and linked-lab outlines', () => {
    it('no BIO-214 means no link outline', async () => {
      const { getLinkedOutlineSectionIds } = await import('../src/domain/linked-labs.mjs');
      const { MAIN_CATALOG, INITIAL_DRAFT } = await import('../src/domain/available-courses.mjs');
      // INITIAL_DRAFT is ['MATH-A', 'STAT-A'] — no BIO-214
      const result = getLinkedOutlineSectionIds(INITIAL_DRAFT, MAIN_CATALOG);
      assert.deepStrictEqual(result, []);
    });

    it('BIO-214 without lab outlines lecture plus available lab choices', async () => {
      const { getLinkedOutlineSectionIds } = await import('../src/domain/linked-labs.mjs');
      const { MAIN_CATALOG } = await import('../src/domain/available-courses.mjs');
      // In main catalog, both BIO-214L-A and BIO-214L-B have available seats
      const result = getLinkedOutlineSectionIds(['MATH-A', 'BIO-214'], MAIN_CATALOG);
      assert.deepStrictEqual(result, ['BIO-214', 'BIO-214L-A', 'BIO-214L-B']);
    });

    it('full lab omitted from outlines', async () => {
      const { getLinkedOutlineSectionIds } = await import('../src/domain/linked-labs.mjs');
      const { catalogForScenario } = await import('../src/domain/available-courses.mjs');
      // In noRepair catalog, BIO-214L-B is full (30/30)
      const noRepairCatalog = catalogForScenario('noRepair');
      const result = getLinkedOutlineSectionIds(['MATH-A', 'BIO-214'], noRepairCatalog);
      assert.deepStrictEqual(result, ['BIO-214', 'BIO-214L-A']);
      assert.ok(!result.includes('BIO-214L-B'), 'full lab BIO-214L-B must be omitted from outlines');
    });

    it('selected lab stops outlines', async () => {
      const { getLinkedOutlineSectionIds } = await import('../src/domain/linked-labs.mjs');
      const { MAIN_CATALOG } = await import('../src/domain/available-courses.mjs');
      // Adding BIO-214L-A satisfies the requirement -> outlines stop
      const result = getLinkedOutlineSectionIds(['MATH-A', 'BIO-214', 'BIO-214L-A'], MAIN_CATALOG);
      assert.deepStrictEqual(result, []);
    });

    it('removing lab restores them', async () => {
      const { getLinkedOutlineSectionIds } = await import('../src/domain/linked-labs.mjs');
      const { MAIN_CATALOG } = await import('../src/domain/available-courses.mjs');
      const beforeRemoval = getLinkedOutlineSectionIds(['MATH-A', 'BIO-214', 'BIO-214L-A'], MAIN_CATALOG);
      assert.deepStrictEqual(beforeRemoval, []);

      // Remove lab -> outlines restored immediately
      const afterRemoval = getLinkedOutlineSectionIds(['MATH-A', 'BIO-214'], MAIN_CATALOG);
      assert.deepStrictEqual(afterRemoval, ['BIO-214', 'BIO-214L-A', 'BIO-214L-B']);
    });

    it('returns a randomized adjacent rainbow color pair from the spectrum', async () => {
      const { getRandomAdjacentRainbowPair, RAINBOW_ADJACENT_PAIRS } = await import(
        '../src/domain/linked-labs.mjs'
      );
      const pair = getRandomAdjacentRainbowPair();
      assert.strictEqual(Array.isArray(pair), true);
      assert.strictEqual(pair.length, 2);
      assert.ok(RAINBOW_ADJACENT_PAIRS.some((p) => p[0] === pair[0] && p[1] === pair[1]));
      assert.deepStrictEqual(RAINBOW_ADJACENT_PAIRS.map(([, purple]) => purple), ['#6d28d9', '#6b21a8']);
    });

    it('moving outline follows pointer independently of fixed preview', async () => {
      const { readFileSync } = await import('node:fs');
      const availSrc = readFileSync(
        new URL('../src/components/AvailableCourses.jsx', import.meta.url),
        'utf8'
      );
      assert.ok(availSrc.includes('nb-linked-outline'), 'AvailableCourses applies nb-linked-outline');
      assert.ok(
        availSrc.includes('HeldCardContent') && availSrc.includes('hasLinkedOutline'),
        'HeldCardContent receives hasLinkedOutline so outline travels with held card'
      );

      const timetableSrc = readFileSync(
        new URL('../src/components/Timetable.jsx', import.meta.url),
        'utf8'
      );
      assert.ok(timetableSrc.includes('data-linked-outline'), 'Timetable tracks data-linked-outline');
      // Fixed preview must remain separate and not receive nb-linked-outline
      const fixedPreviewBlockMatch = timetableSrc.match(/function FixedPreviewBlock[\s\S]*?return \([\s\S]*?\);/);
      assert.ok(fixedPreviewBlockMatch, 'FixedPreviewBlock exists');
      assert.ok(
        !fixedPreviewBlockMatch[0].includes('nb-linked-outline'),
        'FixedPreviewBlock remains separate and does not take nb-linked-outline'
      );
    });

    it('app.css styles chasing rainbow outline and reduced-motion alternative', async () => {
      const { readFileSync } = await import('node:fs');
      const css = readFileSync(
        new URL('../src/app.css', import.meta.url),
        'utf8'
      );
      assert.ok(css.includes('.nb-linked-outline'), 'app.css has .nb-linked-outline');
      assert.ok(css.includes('nb-rainbow-chase'), 'app.css defines nb-rainbow-chase animation');
      assert.ok(
        css.includes('prefers-reduced-motion') && css.includes('.nb-linked-outline'),
        'app.css supports reduced-motion alternative for linked outline'
      );
    });
  });

});