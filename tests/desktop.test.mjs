/**
 * Task 23 — Desktop dock and Settings color themes
 * Task 24 — Website Info window
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

// ── Task 24 — Website Info window ────────────────────────────────────────────
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

// ── Task 25 — Timetable pure-logic tests ──────────────────────────────────────
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

// ── Task 26 — Available Courses search, 24h slots, and cards ────────────────
import { format24hTime, formatCourseSlot } from '../src/domain/time.mjs';

describe('Task 26 — Available Courses and search', () => {
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

// ── Task 27: Add/Swap/Keep Repair Preview ─────────────────────────────────────
describe('Task 27 — Repair Preview impact groups and controller wiring', () => {
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

// ── Task 28: Wire Apply/Undo/dismiss/reset ────────────────────────────────────
describe('Task 28 — Apply / Undo / Dismiss / Reset wiring', () => {
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
});



