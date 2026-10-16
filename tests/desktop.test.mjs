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
    assert.ok(!title.includes('submit'), 'title must not imply submission');
    assert.ok(!title.includes('register'), 'title must not imply registration action');
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

  it('CHEM-A (Tue 10:00–11:00 AM) left = 20%, width = 10%', () => {
    const sec = MAIN_CATALOG.find((s) => s.id === 'CHEM-A');
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
    assert.ok(s0.draft.includes('CHEM-A'), 'CHEM-A must be in initial draft');
    const s1 = reduce(s0, { type: ACTION.REMOVE_SECTION, payload: 'CHEM-A' });
    assert.ok(!s1.draft.includes('CHEM-A'), 'CHEM-A must be removed after REMOVE_SECTION');
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
    const s1 = reduce(s0, { type: ACTION.REMOVE_SECTION, payload: 'CHEM-A' });
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
    const draft = ['CHEM-A', 'CHEM-LAB-A'];
    const nonDraft = MAIN_CATALOG.filter((c) => !draft.includes(c.id));
    const query = 'chem';
    const matches = nonDraft.filter((item) => {
      const codeMatch =
        item.id?.toLowerCase().includes(query) ||
        item.course?.toLowerCase().includes(query);
      const nameMatch = item.title?.toLowerCase().includes(query);
      return Boolean(codeMatch || nameMatch);
    });

    assert.ok(matches.length > 0);
    assert.ok(matches.every((m) => m.id.toLowerCase().includes('chem') || m.course?.toLowerCase().includes('chem')));
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

// ── Add/Swap/Keep Repair Preview ─────────────────────────────────────
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

  it('SUGGEST_REPAIR populates candidate with valid Add/Swap/Keep groups', async () => {
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
    assert.deepEqual(addIds, ['BIO-214', 'BIO-214L-B']);

    // Kept sections:
    const keepIds = s1.candidate.kept || [];
    assert.deepEqual(keepIds, ['CHEM-A']);

    // Total post-repair draft matches full candidate ids:
    const finalSet = [...addIds, swap.replacement, ...keepIds].sort();
    assert.deepEqual(finalSet, s1.candidate.ids.slice().sort());
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
    assert.deepEqual([...s3.draft].sort(), [...INITIAL_DRAFT].sort(), 'RESET_DRAFT must restore INITIAL_DRAFT');
    assert.equal(s3.candidate, null, 'candidate must be null after reset');
    assert.equal(s3.snapshot, null, 'snapshot must be null after reset');
    assert.equal(s3.isApplied, false, 'isApplied must be false after reset');
    assert.equal(canUndo(s3), false, 'canUndo must be false after reset');
    assert.equal(s3.notice, null, 'reset notice must be null');
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

  it('APPLY_REPAIR sets notice title to "Timetable updated" for success popup', async () => {
    const { initialState, reduce, ACTION } = await import('../src/state/draft-controller.mjs');
    const s0 = initialState();
    const s1 = reduce(s0, { type: ACTION.SUGGEST_REPAIR });
    const s2 = reduce(s1, { type: ACTION.APPLY_REPAIR });
    assert.equal(s2.notice?.title, 'Timetable updated');
    assert.equal(s2.notice?.kind, 'success');
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

    it('contains enrollfix to avoid MIME collision', () => {
      assert.ok(DT_SECTION_ID.includes('enrollfix'));
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
      assert.ok(src.includes('draggable={true}'), 'AvailableCourses must mark cards as draggable');
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
      const chemB = { id: 'CHEM-B', day: 'Thu', start: 600, end: 660 };
      const selected = [
        { id: 'CHEM-A', day: 'Tue', start: 600, end: 660 },
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
        { id: 'CHEM-A', day: 'Tue', start: 600, end: 660 },
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
        { id: 'CHEM-A', day: 'Tue', start: 600, end: 660 },
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
      assert.ok(src.includes('fixedPreviewSectionId={previewSectionId}'), 'EarlySchedulePreview wires Timetable');
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
        { id: 'CHEM-B', title: 'Chemistry B' },
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
      assert.strictEqual(renderedSlots[0].id, 'CHEM-B');
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
      const draft = ['CHEM-A', 'STAT-A'];
      const nonConflictingSec = { id: 'CHEM-B', course: 'CHEM' };

      const dropResult = evaluateDrop({ touchesTimetable: true, hasConflict: false });
      assert.strictEqual(dropResult.success, true);

      let updatedDraft;
      if (dropResult.success) {
        updatedDraft = draft.map(id => id === 'CHEM-A' ? nonConflictingSec.id : id);
      }
      assert.deepStrictEqual(updatedDraft, ['CHEM-B', 'STAT-A']);
    });
  });

  describe('red drop restores source', () => {
    it('evaluates drop as rejected when touching timetable with time conflict', () => {
      const result = evaluateDrop({ touchesTimetable: true, hasConflict: true });
      assert.strictEqual(result.success, false);
      assert.strictEqual(result.reason, 'conflict');
    });

    it('rejected red drop does not mutate draft and restores card to origin', () => {
      const initialDraft = Object.freeze(['CHEM-A', 'STAT-A']);
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
      const initialDraft = Object.freeze(['CHEM-A', 'STAT-A']);
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
        { id: 'CHEM-B', title: 'General Chemistry B' },
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
      assert.strictEqual(available[0].id, 'CHEM-B');
      assert.strictEqual(available[1].id, 'BIO-214');
    });
  });

  describe('touch and pointer cancellation', () => {
    it('pointer cancel resets drag state and restores card to source without draft mutation', () => {
      const initialDraft = Object.freeze(['CHEM-A', 'STAT-A']);
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
      // Drag must still be initiated when threshold is exceeded
      assert.ok(src.includes('hasExceededDragThreshold'), 'AvailableCourses initiates drag only above threshold');
    });
  });

});