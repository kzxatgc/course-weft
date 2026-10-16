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
  it('contains exactly 2 themes', () => {
    assert.equal(THEMES.length, 2);
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
