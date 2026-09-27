/**
 * The Dashboard panel: the editor for what the dashboard app shows.
 *
 * A plain custom element with no framework and no build step, so the
 * integration stays a Python directory with one JavaScript file beside it.
 * Home Assistant sets `hass`, `narrow`, `route` and `panel` as properties.
 *
 * The layout and the interaction specs come from `docs/design/` in the
 * dashboard repository. In short: add entities several at a time, reorder
 * from one grip, open a room beside the list instead of inside it, undo a
 * removal rather than confirm it, and always say whether the document is
 * saved.
 *
 * Home Assistant's own elements are used where they are defined, and each
 * has a fallback here, because a panel loaded cold cannot count on the lazy
 * parts of the frontend being present. See `_probeElements`.
 */

const SUBSCRIBE = "ha_dashboard/subscribe";
const SAVE = "ha_dashboard/save";

/** How long to sit on an edit before writing it. A burst becomes one call. */
const SAVE_DEBOUNCE = 400;
/** Only call a write slow enough to mention after this long, to avoid flicker. */
const SPINNER_AFTER = 300;
/** How long an undo stays offered. */
const UNDO_MS = 10000;
/** Content width at which the list and the detail pane sit side by side. */
const WIDE_AT = 870;
/** How long to wait for a lazy Home Assistant element before drawing ours. */
const UPGRADE_TIMEOUT = 1500;
/** Rows shown in the add dialog before it asks for a narrower search. */
const RESULT_CAP = 200;

const PAGE_LABELS = {
  overview: "Overview",
  lights: "Lights",
  climate: "Climate",
  settings: "Settings",
};

/** The page the app always shows, so the panel offers no control for it. */
const ALWAYS_ON_PAGE = "settings";

/** Sort order for entities offered inside a room, most useful first. */
const DOMAIN_ORDER = [
  "light",
  "climate",
  "media_player",
  "cover",
  "fan",
  "switch",
  "lock",
  "sensor",
];

/** What a new room starts with, when first run is asked to seed rooms. */
const SEED_DOMAINS = ["light", "climate", "media_player", "cover", "fan"];
const SEED_CAP = 15;

const DOMAIN_LABELS = {
  light: "Light",
  climate: "Climate",
  media_player: "Media player",
  cover: "Cover",
  fan: "Fan",
  switch: "Switch",
  lock: "Lock",
  sensor: "Sensor",
  binary_sensor: "Sensor",
  scene: "Scene",
  script: "Script",
  vacuum: "Vacuum",
};

const DOMAIN_ICONS = {
  light: "mdi:lightbulb",
  climate: "mdi:thermostat",
  media_player: "mdi:play-circle",
  cover: "mdi:window-shutter",
  fan: "mdi:fan",
  switch: "mdi:toggle-switch",
  lock: "mdi:lock",
  sensor: "mdi:gauge",
  binary_sensor: "mdi:gauge",
  scene: "mdi:palette",
  script: "mdi:script-text",
  vacuum: "mdi:robot-vacuum",
};

/** The chips above the add dialog's list, in the order they are shown. */
const FILTER_CHIPS = [
  { id: "all", label: "All", domains: null },
  { id: "lights", label: "Lights", domains: ["light"] },
  { id: "media", label: "Media", domains: ["media_player"] },
  { id: "climate", label: "Climate", domains: ["climate"] },
  { id: "covers", label: "Covers", domains: ["cover"] },
];

/**
 * The Home Assistant elements this panel would rather use. Every one of them
 * is drawn by hand instead when it has not been defined by `UPGRADE_TIMEOUT`.
 */
const HA_TAGS = [
  "ha-menu-button",
  "ha-card",
  "ha-icon",
  "ha-switch",
  "ha-textfield",
];

/**
 * Simple glyphs for when `ha-icon` is missing. They are drawn here rather
 * than copied from Material Design Icons, so they suggest the domain without
 * pretending to be the real icon.
 */
const GLYPHS = {
  light: '<circle cx="12" cy="10" r="5"/><rect x="10" y="16" width="4" height="4" rx="1"/>',
  climate: '<circle cx="12" cy="12" r="7" fill="none" stroke-width="2"/><rect x="11" y="7" width="2" height="6" rx="1"/>',
  media_player: '<circle cx="12" cy="12" r="8" fill="none" stroke-width="2"/><path d="M10 8l7 4-7 4z"/>',
  cover: '<rect x="4" y="4" width="16" height="4" rx="1"/><rect x="4" y="10" width="16" height="3" rx="1" opacity=".6"/><rect x="4" y="15" width="16" height="3" rx="1" opacity=".3"/>',
  fan: '<circle cx="12" cy="12" r="2"/><path d="M12 10V4M12 14v6M10 12H4M14 12h6" fill="none" stroke-width="2"/>',
  switch: '<rect x="3" y="8" width="18" height="8" rx="4" fill="none" stroke-width="2"/><circle cx="16" cy="12" r="2.5"/>',
  lock: '<rect x="6" y="11" width="12" height="9" rx="2"/><path d="M9 11V8a3 3 0 016 0v3" fill="none" stroke-width="2"/>',
  sensor: '<circle cx="12" cy="12" r="7" fill="none" stroke-width="2"/><path d="M12 12l4-3" fill="none" stroke-width="2"/>',
  area: '<path d="M4 11l8-6 8 6v8a1 1 0 01-1 1H5a1 1 0 01-1-1z" fill="none" stroke-width="2"/>',
  grip: '<circle cx="9" cy="6" r="1.6"/><circle cx="15" cy="6" r="1.6"/><circle cx="9" cy="12" r="1.6"/><circle cx="15" cy="12" r="1.6"/><circle cx="9" cy="18" r="1.6"/><circle cx="15" cy="18" r="1.6"/>',
  menu: '<circle cx="12" cy="5" r="1.8"/><circle cx="12" cy="12" r="1.8"/><circle cx="12" cy="19" r="1.8"/>',
  star: '<path d="M12 4l2.4 5 5.6.7-4 3.9 1 5.4-5-2.7-5 2.7 1-5.4-4-3.9 5.6-.7z"/>',
  back: '<path d="M15 5l-7 7 7 7" fill="none" stroke-width="2"/>',
  chevron: '<path d="M9 5l7 7-7 7" fill="none" stroke-width="2"/>',
  check: '<path d="M5 12l5 5 9-10" fill="none" stroke-width="2.4"/>',
  search: '<circle cx="11" cy="11" r="6" fill="none" stroke-width="2"/><path d="M15.5 15.5L20 20" fill="none" stroke-width="2"/>',
  close: '<path d="M6 6l12 12M18 6L6 18" fill="none" stroke-width="2"/>',
  plus: '<path d="M12 5v14M5 12h14" fill="none" stroke-width="2"/>',
  bars: '<path d="M4 7h16M4 12h16M4 17h16" fill="none" stroke-width="2"/>',
  cloudCheck: '<path d="M5 12l4 4 10-10" fill="none" stroke-width="2"/>',
  cloudWait: '<circle cx="12" cy="12" r="7" fill="none" stroke-width="2" opacity=".4"/><path d="M12 5a7 7 0 017 7" fill="none" stroke-width="2"/>',
  cloudFail: '<circle cx="12" cy="12" r="8" fill="none" stroke-width="2"/><path d="M12 7v6" fill="none" stroke-width="2"/><circle cx="12" cy="16.5" r="1.2"/>',
};

const STYLES = `
  :host {
    display: block;
    position: relative;
    height: 100%;
    background: var(--primary-background-color);
    color: var(--primary-text-color);
    font-family: var(--paper-font-body1_-_font-family, var(--ha-font-family-body, inherit));
    --row-height: 56px;
  }
  * { box-sizing: border-box; }
  button { font: inherit; color: inherit; }

  .shell { display: flex; flex-direction: column; height: 100%; }
  .layer-menu { position: absolute; inset: 0; pointer-events: none; }
  .layer-menu .menu { pointer-events: auto; }

  /* -- toolbar -------------------------------------------------------- */
  .toolbar {
    display: flex;
    align-items: center;
    gap: 8px;
    height: var(--header-height, 56px);
    padding: 0 8px 0 4px;
    background: var(--app-header-background-color, var(--primary-color));
    color: var(--app-header-text-color, var(--text-primary-color, #fff));
    flex: none;
  }
  .toolbar .title {
    flex: 1 1 auto;
    font-size: 20px;
    font-weight: 400;
    padding-left: 8px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .status {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    border: none;
    background: none;
    cursor: default;
    font-size: 13px;
    padding: 6px 8px;
    border-radius: 16px;
    opacity: 0.9;
  }
  .status[data-state="error"] {
    cursor: pointer;
    background: var(--error-color, #db4437);
    color: var(--text-primary-color, #fff);
    opacity: 1;
  }
  .status .spin { animation: spin 1.1s linear infinite; transform-origin: 50% 50%; }
  @keyframes spin { to { transform: rotate(360deg); } }

  /* -- body ----------------------------------------------------------- */
  .body { flex: 1 1 auto; min-height: 0; overflow-y: auto; }
  .body.wide {
    display: grid;
    grid-template-columns: minmax(0, 1fr) minmax(360px, 460px);
    gap: 16px;
    align-items: start;
    padding: 16px;
  }
  .body:not(.wide) { padding: 12px; }
  .col-list { display: flex; flex-direction: column; gap: 16px; min-width: 0; }
  .body:not(.wide) .col-list { max-width: 840px; margin: 0 auto; width: 100%; }
  .col-detail { position: sticky; top: 16px; min-width: 0; }

  .card {
    background: var(--card-background-color, #fff);
    border-radius: var(--ha-card-border-radius, 12px);
    box-shadow: var(--ha-card-box-shadow, none);
    border: 1px solid var(--divider-color);
    overflow: hidden;
  }
  ha-card { display: block; overflow: hidden; }

  .bar {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 14px 16px 10px;
  }
  .bar .head { flex: 1 1 auto; min-width: 0; }
  .bar h2 { margin: 0; font-size: 16px; font-weight: 500; }
  .bar p { margin: 2px 0 0; color: var(--secondary-text-color); font-size: 13px; }

  /* -- rows ----------------------------------------------------------- */
  .row {
    display: flex;
    align-items: center;
    gap: 4px;
    min-height: var(--row-height);
    padding: 0 4px 0 0;
    border-top: 1px solid var(--divider-color);
    background: var(--card-background-color, #fff);
  }
  .row.first { border-top: none; }
  .row.selected { background: var(--primary-color); background: color-mix(in srgb, var(--primary-color) 12%, transparent); }
  .row.lifted { box-shadow: var(--ha-card-box-shadow, 0 4px 14px rgba(0,0,0,.28)); position: relative; z-index: 2; }
  .row.placeholder {
    border: 1px dashed var(--primary-color);
    background: transparent;
    min-height: var(--row-height);
  }
  .row.placeholder > * { visibility: hidden; }

  .grip {
    flex: none;
    width: 44px;
    height: 44px;
    display: grid;
    place-items: center;
    border: none;
    background: none;
    color: var(--secondary-text-color);
    cursor: grab;
    touch-action: none;
    border-radius: 50%;
  }
  .grip:active { cursor: grabbing; }
  .grip:focus-visible { outline: 2px solid var(--primary-color); outline-offset: -2px; }

  .body-btn {
    flex: 1 1 auto;
    min-width: 0;
    display: flex;
    align-items: center;
    gap: 12px;
    border: none;
    background: none;
    text-align: left;
    padding: 8px 4px;
    cursor: pointer;
    min-height: 44px;
  }
  .body-btn:focus-visible { outline: 2px solid var(--primary-color); outline-offset: -2px; }
  .lines { min-width: 0; flex: 1 1 auto; }
  .lines .name {
    display: block;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .lines .sub {
    display: block;
    color: var(--secondary-text-color);
    font-size: 13px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .lines .sub.warn { color: var(--warning-color, #ffa600); }

  .icon-btn {
    flex: none;
    width: 44px;
    height: 44px;
    display: grid;
    place-items: center;
    border: none;
    background: none;
    color: var(--secondary-text-color);
    cursor: pointer;
    border-radius: 50%;
  }
  .icon-btn:hover { background: var(--secondary-background-color); color: var(--primary-text-color); }
  .icon-btn:focus-visible { outline: 2px solid var(--primary-color); outline-offset: -2px; }
  .chevron { flex: none; color: var(--secondary-text-color); display: grid; place-items: center; width: 24px; }

  .glyph { flex: none; color: var(--state-icon-color, var(--secondary-text-color)); }
  .glyph.on { color: var(--state-icon-active-color, var(--primary-color)); }
  .star { color: var(--warning-color, #ffa600); flex: none; }

  .group-head {
    padding: 12px 16px 6px;
    font-size: 12px;
    letter-spacing: 0.4px;
    text-transform: uppercase;
    color: var(--secondary-text-color);
    border-top: 1px solid var(--divider-color);
  }
  .empty { padding: 16px; color: var(--secondary-text-color); font-size: 14px; }
  .foot { padding: 8px 8px 12px; display: flex; gap: 8px; flex-wrap: wrap; }

  /* -- buttons -------------------------------------------------------- */
  .text-btn {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    border: none;
    background: none;
    color: var(--primary-color);
    cursor: pointer;
    font-size: 14px;
    font-weight: 500;
    padding: 10px 12px;
    border-radius: 8px;
    min-height: 44px;
  }
  .text-btn:hover { background: var(--secondary-background-color); }
  .text-btn[disabled] { opacity: 0.4; cursor: default; background: none; }
  .filled-btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    border: none;
    border-radius: 24px;
    padding: 12px 20px;
    min-height: 44px;
    cursor: pointer;
    font-size: 15px;
    font-weight: 500;
    background: var(--primary-color);
    color: var(--text-primary-color, #fff);
  }
  .filled-btn[disabled] { opacity: 0.5; cursor: default; }
  .fab {
    position: sticky;
    bottom: 16px;
    margin: 16px 16px 0 auto;
    display: flex;
    box-shadow: 0 4px 14px rgba(0, 0, 0, 0.3);
  }

  /* -- menus ---------------------------------------------------------- */
  .menu {
    position: absolute;
    z-index: 8;
    min-width: 200px;
    padding: 6px 0;
    background: var(--card-background-color, #fff);
    border: 1px solid var(--divider-color);
    border-radius: 10px;
    box-shadow: 0 6px 20px rgba(0, 0, 0, 0.28);
  }
  .menu button {
    display: block;
    width: 100%;
    text-align: left;
    border: none;
    background: none;
    padding: 12px 16px;
    cursor: pointer;
    font-size: 14px;
  }
  .menu button:hover:not([disabled]) { background: var(--secondary-background-color); }
  .menu button[disabled] { opacity: 0.4; cursor: default; }
  .menu .sep { height: 1px; margin: 6px 0; background: var(--divider-color); }
  .menu button.destructive { color: var(--error-color, #db4437); }

  /* -- detail pane ---------------------------------------------------- */
  .detail-head { padding: 16px 16px 8px; }
  .detail-head h2 { margin: 0; font-size: 20px; font-weight: 400; }
  .detail-head p { margin: 4px 0 0; color: var(--secondary-text-color); font-size: 13px; }
  .field { padding: 8px 16px 12px; }
  .field > label { display: block; font-size: 12px; color: var(--secondary-text-color); margin-bottom: 4px; }
  .field .hint { font-size: 12px; color: var(--secondary-text-color); margin-top: 4px; }
  input[type="text"] {
    width: 100%;
    font: inherit;
    font-size: 15px;
    padding: 10px;
    border-radius: 8px;
    border: 1px solid var(--divider-color);
    background: var(--primary-background-color);
    color: var(--primary-text-color);
  }
  ha-textfield { display: block; width: 100%; }
  .toggle-row {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 8px 16px;
    min-height: 56px;
  }
  .toggle-row .lines { flex: 1 1 auto; }
  .locked { color: var(--secondary-text-color); display: grid; place-items: center; width: 44px; }
  .sub-head {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 12px 8px 4px 16px;
    border-top: 1px solid var(--divider-color);
  }
  .sub-head .head { flex: 1 1 auto; }
  .sub-head h3 { margin: 0; font-size: 14px; font-weight: 500; }
  .sub-head p { margin: 2px 0 0; font-size: 12px; color: var(--secondary-text-color); }

  .highlight { animation: flash 1.4s ease-out; }
  @keyframes flash {
    from { background: color-mix(in srgb, var(--primary-color) 26%, transparent); }
    to { background: transparent; }
  }

  /* -- subpage (phone) ------------------------------------------------ */
  .subpage { display: flex; flex-direction: column; min-height: 100%; }

  /* -- first run ------------------------------------------------------ */
  .first-run { max-width: 640px; margin: 0 auto; width: 100%; }
  .first-run .intro { padding: 20px 16px 8px; }
  .first-run .intro h2 { margin: 0 0 8px; font-size: 22px; font-weight: 400; }
  .first-run .intro p { margin: 0; color: var(--secondary-text-color); font-size: 14px; }
  .count-row {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 8px 16px;
    font-size: 13px;
    color: var(--secondary-text-color);
  }
  .count-row .text-btn { margin-left: auto; padding: 6px 10px; min-height: 36px; }
  .pick {
    display: flex;
    align-items: center;
    gap: 12px;
    width: 100%;
    border: none;
    background: none;
    text-align: left;
    padding: 6px 16px;
    min-height: 56px;
    cursor: pointer;
    border-top: 1px solid var(--divider-color);
  }
  .pick:focus-visible { outline: 2px solid var(--primary-color); outline-offset: -2px; }
  .box {
    flex: none;
    width: 22px;
    height: 22px;
    border-radius: 4px;
    border: 2px solid var(--secondary-text-color);
    display: grid;
    place-items: center;
    color: transparent;
  }
  .pick[aria-checked="true"] .box,
  .opt[aria-checked="true"] .box {
    background: var(--primary-color);
    border-color: var(--primary-color);
    color: var(--text-primary-color, #fff);
  }
  .actions { display: flex; gap: 8px; align-items: center; padding: 16px; }
  .actions .filled-btn { margin-left: auto; }

  /* -- dialog --------------------------------------------------------- */
  dialog {
    padding: 0;
    border: none;
    background: var(--card-background-color, #fff);
    color: var(--primary-text-color);
    border-radius: 12px;
    width: min(560px, 100%);
    max-width: 100%;
    max-height: 85vh;
    overflow: hidden;
  }
  dialog::backdrop { background: rgba(0, 0, 0, 0.5); }
  dialog.full {
    width: 100%;
    height: 100%;
    max-height: 100%;
    max-width: 100%;
    border-radius: 0;
    margin: 0;
  }
  .dlg { display: flex; flex-direction: column; max-height: inherit; height: 100%; }
  .dlg-head { display: flex; align-items: center; gap: 8px; padding: 8px 8px 0; }
  .dlg-head h2 { flex: 1 1 auto; margin: 0; font-size: 18px; font-weight: 500; padding-left: 8px; }
  .search {
    display: flex;
    align-items: center;
    gap: 8px;
    margin: 8px 16px;
    padding: 6px 10px;
    border: 1px solid var(--divider-color);
    border-radius: 24px;
    color: var(--secondary-text-color);
  }
  .search input {
    flex: 1 1 auto;
    border: none;
    background: none;
    outline: none;
    font: inherit;
    font-size: 15px;
    color: var(--primary-text-color);
    padding: 6px 0;
  }
  .chips { display: flex; gap: 8px; padding: 0 16px 8px; overflow-x: auto; }
  .chip {
    flex: none;
    border: 1px solid var(--divider-color);
    background: none;
    border-radius: 16px;
    padding: 6px 14px;
    font-size: 13px;
    cursor: pointer;
    min-height: 36px;
  }
  .chip[aria-pressed="true"] {
    background: color-mix(in srgb, var(--primary-color) 16%, transparent);
    border-color: var(--primary-color);
    color: var(--primary-color);
  }
  .dlg-list { flex: 1 1 auto; overflow-y: auto; border-top: 1px solid var(--divider-color); }
  .opt {
    display: flex;
    align-items: center;
    gap: 12px;
    width: 100%;
    border: none;
    background: none;
    text-align: left;
    padding: 6px 16px;
    min-height: 56px;
    cursor: pointer;
  }
  .opt[disabled] { opacity: 0.55; cursor: default; }
  .opt:focus-visible { outline: 2px solid var(--primary-color); outline-offset: -2px; }
  .opt[disabled] .box { background: var(--secondary-text-color); border-color: var(--secondary-text-color); color: var(--card-background-color, #fff); }
  .dlg-foot { display: flex; align-items: center; gap: 8px; padding: 12px 16px; border-top: 1px solid var(--divider-color); }
  .dlg-foot .count { flex: 1 1 auto; font-size: 14px; color: var(--secondary-text-color); }
  .more-note { padding: 12px 16px; font-size: 13px; color: var(--secondary-text-color); }

  /* -- toast ---------------------------------------------------------- */
  .toast {
    position: fixed;
    left: 16px;
    bottom: 16px;
    z-index: 9;
    display: flex;
    align-items: center;
    gap: 16px;
    max-width: calc(100vw - 32px);
    padding: 12px 8px 12px 16px;
    border-radius: 8px;
    background: var(--ha-toast-background-color, #323232);
    color: #fff;
    box-shadow: 0 4px 14px rgba(0, 0, 0, 0.4);
    font-size: 14px;
  }
  .toast button {
    border: none;
    background: none;
    color: var(--primary-color);
    cursor: pointer;
    font-weight: 500;
    text-transform: uppercase;
    font-size: 13px;
    padding: 8px 12px;
    min-height: 40px;
  }
  .banner { padding: 12px 16px 0; }
  .banner .inner {
    display: flex;
    gap: 12px;
    align-items: center;
    border-radius: 8px;
    padding: 12px 8px 12px 16px;
    font-size: 14px;
    border: 1px solid var(--info-color, #4285f4);
    color: var(--primary-text-color);
  }
  .banner .inner span { flex: 1 1 auto; }
  .sr-only {
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    clip: rect(0 0 0 0);
    white-space: nowrap;
  }
`;

/** Escapes text going into innerHTML. */
function esc(value) {
  return String(value ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c],
  );
}

function emptyRoom(areaId) {
  return {
    area_id: areaId,
    name: null,
    picture: null,
    hidden: false,
    entities: [],
  };
}

function domainOf(entityId) {
  return String(entityId).split(".")[0];
}

/** Moves the item at `from` to `to`, in place. */
function move(list, from, to) {
  if (from === to || from < 0 || from >= list.length) return;
  const clamped = Math.max(0, Math.min(to, list.length - 1));
  list.splice(clamped, 0, list.splice(from, 1)[0]);
}

/** An inline glyph, for when `ha-icon` is not there. */
function glyph(name, size = 22) {
  const body = GLYPHS[name] ?? GLYPHS.sensor;
  return `<svg viewBox="0 0 24 24" width="${size}" height="${size}" fill="currentColor"
    stroke="currentColor" aria-hidden="true">${body}</svg>`;
}

class HaDashboardPanel extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });

    this._config = null;
    this._hass = null;
    this._narrow = false;
    this._wide = false;
    this._error = null;

    /** The area id shown in the detail pane, or opened as a subpage. */
    this._selected = null;
    /** True when the phone is showing a room rather than the list. */
    this._subpage = false;

    /** "saved" | "saving" | "dirty" | "error". */
    this._saveState = "saved";
    this._savedAt = null;
    this._saveError = null;
    this._saveTimer = null;
    this._spinnerTimer = null;
    this._lastSent = null;
    this._inFlight = false;

    this._undo = null;
    this._undoTimer = null;
    this._dialog = null;
    this._menu = null;
    /** The room whose picture field is open, if any. */
    this._editingPicture = null;
    this._banner = null;
    this._firstRun = null;
    this._skippedFirstRun = false;
    this._available = {};
    /** The list's scroll position, kept while a subpage is open. */
    this._scrollBefore = null;
    this._flash = [];
  }

  // -- properties Home Assistant sets ------------------------------------

  set hass(hass) {
    const first = !this._hass;
    this._hass = hass;
    if (first) {
      this._subscribe();
      this._render();
    }
    // State changes arrive constantly. Only the rows that show a state care,
    // and redrawing on every one would fight typing and dragging.
  }

  get hass() {
    return this._hass;
  }

  set narrow(narrow) {
    if (this._narrow === !!narrow) return;
    this._narrow = !!narrow;
    this._measure();
    this._render();
  }

  set panel(panel) {
    this._pageIds = panel?.config?.page_ids ?? Object.keys(PAGE_LABELS);
  }

  // -- lifecycle ---------------------------------------------------------

  connectedCallback() {
    this.shadowRoot.innerHTML = `
      <style>${STYLES}</style>
      <div class="shell">
        <div class="toolbar"></div>
        <div class="body"></div>
      </div>
      <div class="layer-menu"></div>
      <div class="layer-dialog"></div>
      <div class="layer-toast"></div>
      <div class="sr-only" aria-live="polite"></div>`;

    this._toolbar = this.shadowRoot.querySelector(".toolbar");
    this._body = this.shadowRoot.querySelector(".body");
    this._menuLayer = this.shadowRoot.querySelector(".layer-menu");
    this._dialogLayer = this.shadowRoot.querySelector(".layer-dialog");
    this._toastLayer = this.shadowRoot.querySelector(".layer-toast");
    this._live = this.shadowRoot.querySelector(".sr-only");

    this.shadowRoot.addEventListener("click", (event) => this._onClick(event));
    this.shadowRoot.addEventListener("change", (event) => this._onChange(event));
    this.shadowRoot.addEventListener("input", (event) => this._onInput(event));
    this.shadowRoot.addEventListener("keydown", (event) => this._onKeyDown(event));
    this.shadowRoot.addEventListener("pointerdown", (event) => this._onPointerDown(event));

    this._onPopState = () => this._readLocation({ fromHistory: true });
    window.addEventListener("popstate", this._onPopState);
    this._onBeforeUnload = (event) => {
      if (this._saveState === "saved") return undefined;
      event.preventDefault();
      return (event.returnValue = "");
    };
    window.addEventListener("beforeunload", this._onBeforeUnload);

    this._body.addEventListener("scroll", () => this._closeMenu(), { passive: true });

    this._observer = new ResizeObserver(() => this._measure());
    this._observer.observe(this);
    this._measure();

    this._probeElements();
    this._readLocation();
    this._render();
  }

  disconnectedCallback() {
    this._unsub?.then((stop) => stop());
    this._unsub = null;
    this._observer?.disconnect();
    window.removeEventListener("popstate", this._onPopState);
    window.removeEventListener("beforeunload", this._onBeforeUnload);
    clearTimeout(this._saveTimer);
    clearTimeout(this._spinnerTimer);
    clearTimeout(this._undoTimer);
    // A pending edit would otherwise be lost with the element.
    if (this._saveState === "dirty") this._saveNow();
  }

  /**
   * Finds out which Home Assistant elements this page can use.
   *
   * None of this has been checked against a running instance, so nothing here
   * assumes an answer: the panel draws its own controls after
   * `UPGRADE_TIMEOUT` and redraws if the real element turns up later.
   */
  _probeElements() {
    for (const tag of HA_TAGS) {
      const ready = Promise.race([
        customElements.whenDefined(tag).then(() => true),
        new Promise((resolve) => setTimeout(() => resolve(false), UPGRADE_TIMEOUT)),
      ]);
      ready.then((ok) => {
        if (!ok) {
          // It may still arrive. Redraw in place when it does.
          customElements.whenDefined(tag).then(() => {
            this._available[tag] = true;
            this._render();
          });
          return;
        }
        this._available[tag] = true;
        this._render();
      });
    }
  }

  _has(tag) {
    return this._available[tag] === true;
  }

  _measure() {
    const wide = !this._narrow && this.clientWidth >= WIDE_AT;
    if (wide === this._wide) return;
    this._wide = wide;
    if (wide) this._subpage = false;
    this._render();
  }

  // -- talking to Home Assistant -----------------------------------------

  _subscribe() {
    this._unsub = this._hass.connection
      .subscribeMessage(
        (config) => this._onDocument(config),
        { type: SUBSCRIBE },
      )
      .catch((error) => {
        this._error = error?.message ?? String(error);
        this._render();
        return () => {};
      });
  }

  /**
   * A document arrived. It is either the echo of our own write, or somebody
   * else's change, and the two are told apart by comparing it with the last
   * payload this tab sent.
   */
  _onDocument(config) {
    const incoming = JSON.stringify(config);
    const ours = this._lastSent !== null && incoming === this._lastSent;
    const first = this._config === null;
    this._config = config;

    if (!first && !ours && !this._inFlight) {
      this._noteRemoteChange();
    }
    // Selection is keyed by area id, so it survives a document replaced
    // underneath us. A room that has gone says so in the pane.
    this._render();
    // An open dialog keeps its selection and re-checks "Already shown".
    if (this._dialog) this._renderDialogList();
  }

  /** Mutates the document, draws the result, and writes after a pause. */
  _edit(mutate, { redraw = true } = {}) {
    if (!this._config) return;
    mutate(this._config);
    this._saveState = "dirty";
    clearTimeout(this._saveTimer);
    this._saveTimer = setTimeout(() => this._saveNow(), SAVE_DEBOUNCE);
    if (redraw) this._render();
    else this._renderToolbar();
  }

  _saveNow() {
    if (!this._config || !this._hass) return;
    clearTimeout(this._saveTimer);
    const payload = JSON.stringify(this._config);
    this._lastSent = payload;
    this._inFlight = true;

    clearTimeout(this._spinnerTimer);
    this._spinnerTimer = setTimeout(() => {
      if (!this._inFlight) return;
      this._saveState = "saving";
      this._renderToolbar();
    }, SPINNER_AFTER);

    this._hass.connection
      .sendMessagePromise({ type: SAVE, config: JSON.parse(payload) })
      .then((saved) => {
        this._inFlight = false;
        clearTimeout(this._spinnerTimer);
        // What the store made of it, so the echo comparison matches.
        this._lastSent = JSON.stringify(saved ?? this._config);
        // An edit made while the write was in flight leaves us dirty, and
        // its own timer is already running.
        if (this._saveState !== "dirty" || payload === JSON.stringify(this._config)) {
          this._saveState = "saved";
          this._savedAt = new Date();
          this._saveError = null;
        }
        this._renderToolbar();
      })
      .catch((error) => {
        this._inFlight = false;
        clearTimeout(this._spinnerTimer);
        // The local document is kept. Retry, or the next edit, resends it.
        this._saveState = "error";
        this._saveError = error?.message ?? String(error);
        this._renderToolbar();
      });
  }

  // -- reading the registries --------------------------------------------

  _areaName(areaId) {
    return this._hass.areas?.[areaId]?.name ?? areaId;
  }

  _areaOf(entityId) {
    const entry = this._hass.entities?.[entityId];
    if (!entry) return null;
    return entry.area_id ?? this._hass.devices?.[entry.device_id]?.area_id ?? null;
  }

  _entityName(entityId) {
    return this._hass.states?.[entityId]?.attributes?.friendly_name ?? entityId;
  }

  /**
   * How the dashboard names an entity. Inside its own area the area name adds
   * nothing, so it is dropped; anywhere else it is the thing that tells two
   * "Sconces" apart.
   */
  _entityLabel(entityId, inAreaId = null) {
    const name = this._entityName(entityId);
    const areaId = this._areaOf(entityId);
    if (!areaId || areaId === inAreaId) return name;
    const area = this._areaName(areaId);
    return name.startsWith(area) ? name : `${area} ${name}`;
  }

  /** The line under an entity's name: what it is, and what it is doing. */
  _stateLine(entityId) {
    const domain = domainOf(entityId);
    const label = DOMAIN_LABELS[domain] ?? domain.replace(/_/g, " ");
    const state = this._hass.states?.[entityId];
    if (!state) return `${label} · Unavailable`;
    const bits = [label, this._stateText(state)];
    const attrs = state.attributes ?? {};
    if (domain === "light" && state.state === "on" && attrs.brightness != null) {
      bits.push(`${Math.round((attrs.brightness / 255) * 100)}%`);
    }
    if (domain === "climate" && attrs.temperature != null) {
      bits.push(`${attrs.temperature} ${this._hass.config?.unit_system?.temperature ?? ""}`.trim());
    }
    if (domain === "sensor" && state.state !== "unavailable") {
      return `${label} · ${state.state}${attrs.unit_of_measurement ? ` ${attrs.unit_of_measurement}` : ""}`;
    }
    return bits.filter(Boolean).join(" · ");
  }

  _stateText(state) {
    const raw = String(state.state ?? "");
    if (!raw) return "";
    return raw.charAt(0).toUpperCase() + raw.slice(1).replace(/_/g, " ");
  }

  _isOn(entityId) {
    const state = this._hass.states?.[entityId]?.state;
    return state !== undefined && !["off", "unavailable", "unknown", "idle", "closed", "locked"].includes(state);
  }

  /** Every entity Home Assistant puts in an area, in a useful order. */
  _areaEntities(areaId) {
    const out = [];
    for (const entry of Object.values(this._hass.entities ?? {})) {
      if (entry.hidden_by || entry.disabled_by || entry.entity_category) continue;
      if (this._areaOf(entry.entity_id) !== areaId) continue;
      out.push(entry.entity_id);
    }
    return this._sortEntities(out);
  }

  _sortEntities(ids) {
    return ids.slice().sort((a, b) => {
      const rankA = DOMAIN_ORDER.indexOf(domainOf(a));
      const rankB = DOMAIN_ORDER.indexOf(domainOf(b));
      const orderA = rankA === -1 ? DOMAIN_ORDER.length : rankA;
      const orderB = rankB === -1 ? DOMAIN_ORDER.length : rankB;
      if (orderA !== orderB) return orderA - orderB;
      return this._entityName(a).localeCompare(this._entityName(b));
    });
  }

  /** Every entity, minus the ones Home Assistant keeps out of the way. */
  _allEntityIds({ includeHidden = false } = {}) {
    const entries = this._hass.entities ?? {};
    return Object.keys(this._hass.states ?? {}).filter((id) => {
      const entry = entries[id];
      if (!entry) return true; // Defined in YAML, so in no registry.
      if (includeHidden) return true;
      return !entry.hidden_by && !entry.disabled_by && !entry.entity_category;
    });
  }

  _room(areaId) {
    return this._config?.rooms.find((room) => room.area_id === areaId) ?? null;
  }

  _roomIndex(areaId) {
    return this._config.rooms.findIndex((room) => room.area_id === areaId);
  }

  _areaIds() {
    return Object.keys(this._hass.areas ?? {}).sort((a, b) =>
      this._areaName(a).localeCompare(this._areaName(b)),
    );
  }

  /** What first run says under an area's name: what it would get you. */
  _areaSummary(areaId) {
    const counts = new Map();
    for (const id of this._areaEntities(areaId)) {
      const domain = domainOf(id);
      counts.set(domain, (counts.get(domain) ?? 0) + 1);
    }
    if (!counts.size) return { text: "No entities yet", useful: false };
    const useful = SEED_DOMAINS.some((domain) => counts.has(domain)) || counts.has("switch");
    if (!useful) return { text: "Only sensors and diagnostics", useful: false };
    const parts = [];
    for (const [domain, count] of counts) {
      if (!DOMAIN_ORDER.includes(domain)) continue;
      const label = (DOMAIN_LABELS[domain] ?? domain).toLowerCase();
      parts.push(`${count} ${count === 1 ? label : `${label}s`}`);
    }
    return { text: parts.slice(0, 3).join(" · "), useful: true };
  }

  /** The entities a seeded room starts with. */
  _seedFor(areaId) {
    return this._areaEntities(areaId)
      .filter((id) => SEED_DOMAINS.includes(domainOf(id)))
      .slice(0, SEED_CAP);
  }

  // -- rendering ---------------------------------------------------------

  _render() {
    if (!this._body) return;
    this._renderToolbar();
    this._renderBody();
    this._renderMenu();
    this._renderToast();
  }

  _icon(name, { on = false, size = 22, cls = "" } = {}) {
    const classes = `glyph${on ? " on" : ""}${cls ? ` ${cls}` : ""}`;
    if (this._has("ha-icon") && DOMAIN_ICONS[name]) {
      return `<ha-icon class="${classes}" icon="${esc(DOMAIN_ICONS[name])}"></ha-icon>`;
    }
    return `<span class="${classes}">${glyph(name, size)}</span>`;
  }

  _card(inner, cls = "") {
    const tag = this._has("ha-card") ? "ha-card" : "div";
    const classes = this._has("ha-card") ? cls : `card ${cls}`.trim();
    return `<${tag} class="${classes}">${inner}</${tag}>`;
  }

  _switch(attrs, checked) {
    if (this._has("ha-switch")) {
      return `<ha-switch ${attrs} ${checked ? "checked" : ""}></ha-switch>`;
    }
    return `<input type="checkbox" role="switch" ${attrs} ${checked ? "checked" : ""}>`;
  }

  // -- toolbar -----------------------------------------------------------

  _renderToolbar() {
    if (!this._toolbar) return;
    const backOrMenu =
      this._narrow && this._subpage
        ? `<button class="icon-btn" data-back title="Back" aria-label="Back">${glyph("back", 24)}</button>`
        : this._menuButton();
    const title = this._narrow && this._subpage && this._selected
      ? this._roomTitle(this._room(this._selected)) ?? "Room"
      : "Dashboard";
    const extra =
      this._narrow && this._subpage && this._selected
        ? `<button class="icon-btn" data-menu="room-page" data-area="${esc(this._selected)}"
             title="More" aria-label="More">${glyph("menu", 24)}</button>`
        : "";

    this._toolbar.innerHTML = `${backOrMenu}<div class="title">${esc(title)}</div>${this._saveStatus()}${extra}`;
    this._fillMenuButton();
  }

  /**
   * Without this there is no way to reach Home Assistant's own sidebar on a
   * phone, so it is drawn by hand when the element is missing. It is the one
   * element with no optional fallback.
   *
   * `ha-menu-button` reads `hass` and `narrow` as properties, so the markup
   * leaves a slot and `_fillMenuButton` puts the element in it.
   */
  _menuButton() {
    if (this._has("ha-menu-button")) return `<span data-menu-slot></span>`;
    return `<button class="icon-btn" data-toggle-menu title="Sidebar" aria-label="Sidebar">${glyph("bars", 24)}</button>`;
  }

  _fillMenuButton() {
    const slot = this._toolbar.querySelector("[data-menu-slot]");
    if (!slot) return;
    const button = document.createElement("ha-menu-button");
    button.hass = this._hass;
    button.narrow = this._narrow;
    slot.replaceWith(button);
  }

  _saveStatus() {
    const state = this._saveState;
    if (state === "error") {
      return `<button class="status" data-state="error" data-retry
        title="${esc(this._saveError ?? "The last write failed.")}">
        ${glyph("cloudFail", 20)}<span${this._narrow ? ' class="sr-only"' : ""}>Not saved · Retry</span></button>`;
    }
    if (state === "saving") {
      return `<span class="status" data-state="saving">
        <span class="spin">${glyph("cloudWait", 20)}</span>
        <span${this._narrow ? ' class="sr-only"' : ""}>Saving…</span></span>`;
    }
    const at = this._savedAt
      ? `Saved at ${this._savedAt.toTimeString().slice(0, 5)}`
      : "Saved";
    return `<span class="status" data-state="saved" title="${esc(at)}">
      ${glyph("cloudCheck", 20)}<span${this._narrow ? ' class="sr-only"' : ""}>Saved</span></span>`;
  }

  // -- body --------------------------------------------------------------

  _renderBody() {
    if (this._error) {
      this._body.className = "body";
      this._body.innerHTML = this._card(`<div class="empty">${esc(this._error)}</div>`);
      return;
    }
    if (!this._config || !this._hass) {
      this._body.className = "body";
      this._body.innerHTML = this._card(`<div class="empty">Loading…</div>`);
      return;
    }

    // First run replaces the three cards while there are no rooms. Starting
    // empty is a choice, so it is remembered for as long as the panel is open.
    if (!this._config.rooms.length && !this._firstRun && !this._skippedFirstRun) {
      this._firstRun = this._newFirstRun({ replaceAll: true });
    }

    // The pane fills on first load rather than sitting empty.
    if (this._wide && !this._selected && this._config.rooms.length) {
      this._selected = this._config.rooms[0].area_id;
    }

    // The checklist takes the whole page, whether it is first run or the
    // Add rooms button, so the areas are one list rather than a dialog over
    // another list.
    if (this._firstRun) {
      this._body.className = "body";
      this._body.innerHTML = `<div class="first-run">${this._renderFirstRun()}</div>`;
      return;
    }

    if (this._narrow && this._subpage && this._selected) {
      this._body.className = "body";
      this._body.innerHTML = `<div class="subpage">${this._renderDetail()}</div>`;
      return;
    }

    this._body.className = `body${this._wide ? " wide" : ""}`;
    const left = `<div class="col-list">
      ${this._renderBanner()}
      ${this._card(this._renderRooms())}
      ${this._card(this._renderFavourites())}
      ${this._card(this._renderPages())}
    </div>`;
    const right = this._wide ? `<div class="col-detail">${this._renderDetail()}</div>` : "";
    this._body.innerHTML = left + right;
    this._flashRows();
  }

  /**
   * The one-off note after first run. `ha-alert` would say this natively, but
   * it is one of the uncertain elements, and a bordered row costs less than
   * two code paths for one sentence.
   */
  _renderBanner() {
    if (!this._banner) return "";
    return `<div class="banner"><div class="inner">
      <span>${esc(this._banner)}</span>
      <button class="icon-btn" data-dismiss-banner aria-label="Dismiss">${glyph("close", 20)}</button>
    </div></div>`;
  }

  // -- rooms -------------------------------------------------------------

  _roomTitle(room) {
    if (!room) return null;
    return room.name || this._areaName(room.area_id);
  }

  /** The names a room shows, in order, truncated. Empty rooms say so. */
  _previewLine(room) {
    if (!room.entities.length) {
      return { text: "Nothing shown yet. Open to add.", warn: true };
    }
    const limit = this._wide ? 4 : 3;
    const names = room.entities
      .slice(0, limit)
      .map((id) => this._entityLabel(id, room.area_id));
    const rest = room.entities.length - names.length;
    return { text: names.join(", ") + (rest > 0 ? ` +${rest}` : ""), warn: false };
  }

  _renderRooms() {
    const rooms = this._config.rooms;
    const shown = rooms.filter((room) => !room.hidden);
    const hidden = rooms.filter((room) => room.hidden);
    const spare = this._areaIds().filter((areaId) => !this._room(areaId));

    let body = "";
    if (!rooms.length) {
      body = `<div class="empty">No rooms yet.</div>`;
    } else {
      body = shown.map((room, i) => this._renderRoomRow(room, i === 0)).join("");
      if (hidden.length) {
        body += `<div class="group-head">Behind the More button · ${hidden.length}</div>`;
        body += hidden.map((room) => this._renderRoomRow(room, true)).join("");
      }
    }

    const foot = spare.length
      ? `<div class="foot">
           <button class="text-btn" data-add-rooms>${glyph("plus", 20)}Add rooms</button>
           <span class="empty" style="padding:10px 0">${spare.length} area${spare.length === 1 ? "" : "s"} ${spare.length === 1 ? "isn't" : "aren't"} on the dashboard.</span>
         </div>`
      : "";

    return `
      <div class="bar">
        <div class="head"><h2>Rooms</h2><p>Shown in this order on the dashboard.</p></div>
      </div>
      ${body}
      ${foot}`;
  }

  _renderRoomRow(room, first) {
    const index = this._roomIndex(room.area_id);
    const title = this._roomTitle(room);
    const preview = this._previewLine(room);
    const selected = this._selected === room.area_id && (this._wide || this._subpage);
    return `
      <div class="row${first ? " first" : ""}${selected ? " selected" : ""}"
        data-list="rooms" data-index="${index}" data-group="${room.hidden ? "hidden" : "shown"}">
        <button class="grip" data-grip aria-label="Reorder ${esc(title)}"
          title="Drag to reorder">${glyph("grip", 20)}</button>
        <button class="body-btn" data-open-room="${esc(room.area_id)}">
          ${this._icon("area", { size: 22 })}
          <span class="lines">
            <span class="name">${esc(title)}</span>
            <span class="sub${preview.warn ? " warn" : ""}">${esc(preview.text)}</span>
          </span>
        </button>
        <span class="chevron">${glyph("chevron", 18)}</span>
        <button class="icon-btn" data-menu="room" data-area="${esc(room.area_id)}"
          aria-label="More for ${esc(title)}">${glyph("menu", 20)}</button>
      </div>`;
  }

  // -- favourites and pages ----------------------------------------------

  _renderFavourites() {
    const favourites = this._config.favourites;
    const body = favourites.length
      ? favourites
          .map((entityId, index) => this._renderEntityRow(entityId, index, "favourites", null))
          .join("")
      : `<div class="empty">No favourites yet. Star an entity in any room, or add one here.</div>`;
    return `
      <div class="bar">
        <div class="head"><h2>Favourites</h2><p>Above the room grid on Overview.</p></div>
        <button class="text-btn" data-add-favourites>${glyph("plus", 20)}Add</button>
      </div>
      ${body}`;
  }

  _renderEntityRow(entityId, index, list, areaId) {
    const label = this._entityLabel(entityId, areaId);
    const starred = list !== "favourites" && this._config.favourites.includes(entityId);
    return `
      <div class="row${index === 0 ? " first" : ""}" data-list="${list}"
        data-entity="${esc(entityId)}" data-index="${index}"${areaId ? ` data-area="${esc(areaId)}"` : ""} data-group="one">
        <button class="grip" data-grip aria-label="Reorder ${esc(label)}"
          title="Drag to reorder">${glyph("grip", 20)}</button>
        <span class="body-btn" style="cursor:default">
          ${this._icon(domainOf(entityId), { on: this._isOn(entityId) })}
          <span class="lines">
            <span class="name">${esc(label)}</span>
            <span class="sub">${esc(this._stateLine(entityId))}</span>
          </span>
          ${starred ? `<span class="star" title="Also a favourite">${glyph("star", 18)}</span>` : ""}
        </span>
        <button class="icon-btn" data-menu="entity" data-list="${list}" data-index="${index}"
          ${areaId ? `data-area="${esc(areaId)}"` : ""} aria-label="More for ${esc(label)}"
          >${glyph("menu", 20)}</button>
      </div>`;
  }

  _renderPages() {
    const chosen = new Set(this._config.pages);
    const rows = this._pageIds
      .map((id) => {
        const label = PAGE_LABELS[id] ?? id;
        if (id === ALWAYS_ON_PAGE) {
          return `<div class="toggle-row">
            <span class="lines"><span class="name">${esc(label)}</span>
            <span class="sub">Always shown</span></span>
            <span class="locked" title="The app always shows this page">${glyph("lock", 20)}</span>
          </div>`;
        }
        return `<div class="toggle-row">
          <span class="lines"><span class="name">${esc(label)}</span></span>
          ${this._switch(`data-page="${esc(id)}" aria-label="${esc(label)}"`, chosen.has(id))}
        </div>`;
      })
      .join("");
    return `
      <div class="bar">
        <div class="head"><h2>Pages</h2><p>Which pages the dashboard's sidebar offers.</p></div>
      </div>
      ${rows}`;
  }

  // -- the detail pane ---------------------------------------------------

  _renderDetail() {
    if (!this._selected) {
      return this._card(`<div class="empty">Select a room to see what it shows.</div>`);
    }
    const room = this._room(this._selected);
    if (!room) {
      return this._card(`
        <div class="empty">This room was removed in another window.</div>
        <div class="foot"><button class="text-btn" data-back>Back</button></div>`);
    }

    const title = this._roomTitle(room);
    const areaCount = this._areaEntities(room.area_id).length;
    const nameField = this._has("ha-textfield")
      ? `<ha-textfield data-field="name" data-area="${esc(room.area_id)}"
           label="Name on dashboard" placeholder="${esc(this._areaName(room.area_id))}"
           value="${esc(room.name ?? "")}"></ha-textfield>`
      : `<label for="name-${esc(room.area_id)}">Name on dashboard</label>
         <input type="text" id="name-${esc(room.area_id)}" data-field="name"
           data-area="${esc(room.area_id)}" value="${esc(room.name ?? "")}"
           placeholder="${esc(this._areaName(room.area_id))}">`;

    const entities = room.entities.length
      ? room.entities
          .map((id, index) => this._renderEntityRow(id, index, "entities", room.area_id))
          .join("")
      : `<div class="empty">Nothing shown yet.</div>`;

    const addButton = this._narrow
      ? `<button class="filled-btn fab" data-add-entities="${esc(room.area_id)}">
           ${glyph("plus", 20)}Add entities</button>`
      : `<div class="foot"><button class="text-btn" data-add-entities="${esc(room.area_id)}"
           >${glyph("plus", 20)}Add entities</button></div>`;

    const head = this._narrow
      ? ""
      : `<div class="detail-head">
           <h2>${esc(title)}</h2>
           <p>Home Assistant area “${esc(this._areaName(room.area_id))}” · ${areaCount} entities there</p>
         </div>`;

    const picture = this._renderPicture(room);

    return this._card(`
      ${head}
      <div class="field">${nameField}
        <div class="hint">Leave blank to use the area's name.</div>
      </div>
      <div class="toggle-row">
        <span class="lines"><span class="name">Keep behind More</span>
        <span class="sub">Out of the grid. Its lights still reach the Lights page.</span></span>
        ${this._switch(`data-field="hidden" data-area="${esc(room.area_id)}" aria-label="Keep behind More"`, room.hidden)}
      </div>
      ${picture}
      <div class="sub-head">
        <div class="head"><h3>Shows · ${room.entities.length}</h3>
        <p>In this order on the room's card.</p></div>
      </div>
      ${entities}
      ${addButton}`);
  }

  /**
   * Picture takes a `/local/` path or a URL. Real uploads belong to the
   * area's own settings, which this does not try to replace. The field only
   * appears once Change is pressed, so the pane stays quiet.
   */
  _renderPicture(room) {
    if (this._editingPicture === room.area_id) {
      return `<div class="field">
        <label for="pic-${esc(room.area_id)}">Picture</label>
        <input type="text" id="pic-${esc(room.area_id)}" data-field="picture"
          data-area="${esc(room.area_id)}" value="${esc(room.picture ?? "")}"
          placeholder="/local/lounge-room.jpg">
        <div class="hint">A /local/ path or a URL. Blank uses the area's picture.
          For an upload, use the area's own settings in Home Assistant.</div>
      </div>`;
    }
    if (this._narrow) return "";
    return `<div class="toggle-row">
      <span class="lines"><span class="name">Picture</span>
      <span class="sub">${esc(room.picture || "Uses the area's picture")}</span></span>
      <button class="text-btn" data-picture="${esc(room.area_id)}">Change</button>
    </div>`;
  }

  // -- first run ---------------------------------------------------------

  _newFirstRun({ replaceAll }) {
    const spare = this._areaIds().filter((areaId) => !this._room(areaId));
    const picked = new Set(
      spare.filter((areaId) => this._areaSummary(areaId).useful),
    );
    return { replaceAll, picked, seed: true, expanded: false };
  }

  _renderFirstRun() {
    const state = this._firstRun;
    const spare = this._areaIds().filter((areaId) => !this._room(areaId));
    const limit = state.expanded ? spare.length : 6;
    const visible = spare.slice(0, limit);
    const rest = spare.length - visible.length;

    const intro = state.replaceAll
      ? `<h2>Set up the dashboard</h2>
         <p>Home Assistant has ${spare.length} area${spare.length === 1 ? "" : "s"}. Tick the ones the wall
         dashboard should show as rooms. You can change all of this later.</p>`
      : `<h2>Add rooms</h2>
         <p>These areas are not on the dashboard yet. Tick the ones to add.</p>`;

    const rows = visible
      .map((areaId) => {
        const summary = this._areaSummary(areaId);
        const on = state.picked.has(areaId);
        return `<button class="pick" role="checkbox" aria-checked="${on}" data-pick="${esc(areaId)}">
          <span class="box">${glyph("check", 16)}</span>
          <span class="lines"><span class="name">${esc(this._areaName(areaId))}</span>
          <span class="sub">${esc(summary.text)}</span></span>
        </button>`;
      })
      .join("");

    const more = rest > 0
      ? `<div class="foot"><button class="text-btn" data-expand-areas>+ ${rest} more area${rest === 1 ? "" : "s"}</button></div>`
      : "";

    const count = state.picked.size;
    return this._card(`
      <div class="intro">${intro}</div>
      <div class="count-row">
        <span>${count} of ${spare.length} selected</span>
        <button class="text-btn" data-select-all>${count === spare.length ? "Select none" : "Select all"}</button>
      </div>
      ${rows}
      ${more}
      <div class="toggle-row">
        <span class="lines"><span class="name">Start each room with its lights, climate and media</span>
        <span class="sub">Up to ${SEED_CAP} per room. Sensors and switches are left for you to add.</span></span>
        ${this._switch('data-seed aria-label="Start each room with its lights, climate and media"', state.seed)}
      </div>
      <div class="actions">
        <button class="text-btn" data-first-run-cancel>${state.replaceAll ? "Start empty" : "Cancel"}</button>
        <button class="filled-btn" data-first-run-add ${count ? "" : "disabled"}>
          Add ${count} room${count === 1 ? "" : "s"}</button>
      </div>`, "first-run-card");
  }

  _commitFirstRun() {
    const state = this._firstRun;
    const picked = this._areaIds().filter((areaId) => state.picked.has(areaId));
    if (!picked.length) return;
    let entityCount = 0;
    this._edit((config) => {
      for (const areaId of picked) {
        const room = emptyRoom(areaId);
        if (state.seed) room.entities = this._seedFor(areaId);
        entityCount += room.entities.length;
        config.rooms.push(room);
      }
    }, { redraw: false });
    this._skippedFirstRun = false;
    this._banner = state.replaceAll
      ? `${picked.length} room${picked.length === 1 ? "" : "s"} added with ${entityCount} entities. ` +
        `Open any room to change what it shows, or drag to match the house.`
      : null;
    this._firstRun = null;
    this._select(picked[0], { push: false });
    this._render();
  }

  // -- the add dialog ----------------------------------------------------

  /**
   * One dialog for both "Add entities" in a room and "Add" in Favourites.
   * It only adds: removing happens on the row, where undo lives.
   */
  _openAddDialog(target, areaId) {
    this._dialog = {
      target, // "entities" | "favourites"
      areaId,
      query: "",
      chip: "all",
      picked: [],
      showHidden: false,
    };
    this._renderDialog();
  }

  _dialogRows() {
    const state = this._dialog;
    const query = state.query.trim().toLowerCase();
    const chip = FILTER_CHIPS.find((c) => c.id === state.chip);
    const already = new Set(
      state.target === "favourites"
        ? this._config.favourites
        : (this._room(state.areaId)?.entities ?? []),
    );

    const matches = (id) => {
      if (chip?.domains && !chip.domains.includes(domainOf(id))) return false;
      if (!query) return true;
      const areaId = this._areaOf(id);
      return (
        this._entityName(id).toLowerCase().includes(query) ||
        id.toLowerCase().includes(query) ||
        (areaId ? this._areaName(areaId).toLowerCase().includes(query) : false)
      );
    };

    const all = this._allEntityIds({ includeHidden: state.showHidden }).filter(matches);

    // From a room, that area comes first and the rest waits for a search.
    // From Favourites, everything is grouped by area from the start.
    const groups = [];
    if (state.target === "entities") {
      const inArea = this._sortEntities(all.filter((id) => this._areaOf(id) === state.areaId));
      groups.push({
        label: `In ${this._areaName(state.areaId)} · ${inArea.length}`,
        ids: inArea,
      });
      const others = all.filter((id) => this._areaOf(id) !== state.areaId);
      if (!query) {
        groups.push({ label: "Other areas · search to show", ids: [] });
      } else {
        groups.push(...this._byArea(others));
      }
    } else {
      groups.push(...this._byArea(all));
    }
    return { groups, already };
  }

  _byArea(ids) {
    const buckets = new Map();
    for (const id of ids) {
      const areaId = this._areaOf(id);
      const label = areaId ? this._areaName(areaId) : "No area";
      if (!buckets.has(label)) buckets.set(label, []);
      buckets.get(label).push(id);
    }
    return [...buckets.entries()]
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([label, group]) => ({ label: `${label} · ${group.length}`, ids: this._sortEntities(group) }));
  }

  /**
   * The dialog's list: every match, grouped, capped, with the ones already
   * in the target ticked and disabled.
   */
  _dialogListHtml() {
    const state = this._dialog;
    const { groups, already } = this._dialogRows();
    const picked = new Set(state.picked);
    let shown = 0;
    let capped = false;
    const blocks = [];

    for (const group of groups) {
      const rows = [];
      for (const id of group.ids) {
        if (shown >= RESULT_CAP) {
          capped = true;
          break;
        }
        shown += 1;
        const isAlready = already.has(id);
        const label =
          state.target === "favourites"
            ? this._entityLabel(id)
            : this._entityLabel(id, state.areaId);
        rows.push(`
          <button class="opt" role="checkbox" aria-checked="${picked.has(id)}" data-opt="${esc(id)}"
            ${isAlready ? "disabled" : ""}>
            <span class="box">${glyph("check", 16)}</span>
            ${this._icon(domainOf(id), { on: this._isOn(id) })}
            <span class="lines"><span class="name">${esc(label)}</span>
            <span class="sub">${esc(isAlready ? "Already shown" : this._stateLine(id))}</span></span>
          </button>`);
      }
      blocks.push(
        `<div class="group-head">${esc(group.label)}</div>` +
          (rows.length ? rows.join("") : `<div class="empty">Nothing here.</div>`),
      );
    }
    if (capped) blocks.push(`<div class="more-note">Refine search to see more.</div>`);
    return blocks.join("");
  }

  _renderDialog() {
    if (!this._dialog) {
      this._dialogLayer.innerHTML = "";
      return;
    }
    const state = this._dialog;

    const title =
      state.target === "favourites"
        ? "Add to Favourites"
        : `Add to ${esc(this._roomTitle(this._room(state.areaId)) ?? "room")}`;

    this._dialogLayer.innerHTML = `
      <dialog class="${this._narrow ? "full" : ""}">
        <div class="dlg">
          <div class="dlg-head">
            <button class="icon-btn" data-dialog-close aria-label="Close">${glyph("close", 22)}</button>
            <h2>${title}</h2>
            <button class="icon-btn" data-dialog-menu aria-label="Options">${glyph("menu", 22)}</button>
          </div>
          <div class="search">${glyph("search", 20)}
            <input type="text" data-dialog-search placeholder="Search name, area or entity id"
              value="${esc(state.query)}" autocomplete="off">
          </div>
          <div class="chips">
            ${FILTER_CHIPS.map(
              (chip) => `<button class="chip" data-chip="${chip.id}"
                aria-pressed="${state.chip === chip.id}">${esc(chip.label)}</button>`,
            ).join("")}
          </div>
          <div class="dlg-list">${this._dialogListHtml()}</div>
          <div class="dlg-foot">
            <span class="count">${state.picked.length} selected</span>
            <button class="filled-btn" data-dialog-add ${state.picked.length ? "" : "disabled"}>
              Add ${state.picked.length || ""}</button>
          </div>
        </div>
      </dialog>`;

    const dialog = this._dialogLayer.querySelector("dialog");
    dialog.addEventListener("close", () => {
      // Closing with a selection discards it: nothing was saved yet.
      this._dialog = null;
      this._renderDialog();
    });
    dialog.showModal();
    // On a phone the keyboard would cover the list, so the search box only
    // takes focus on a desktop.
    if (!this._narrow) {
      const input = dialog.querySelector("[data-dialog-search]");
      input.focus();
      input.setSelectionRange(input.value.length, input.value.length);
    }
  }

  _commitDialog() {
    const state = this._dialog;
    if (!state?.picked.length) return;
    const added = state.picked.slice();
    this._edit((config) => {
      if (state.target === "favourites") {
        config.favourites.push(...added);
      } else {
        const room = config.rooms.find((r) => r.area_id === state.areaId);
        if (room) room.entities.push(...added);
      }
    }, { redraw: false });
    this._flash = added;
    this._dialog = null;
    this._dialogLayer.querySelector("dialog")?.close();
    this._renderDialog();
    this._render();
  }

  /** Briefly marks rows that have just arrived, and scrolls to them. */
  _flashRows() {
    if (!this._flash.length) return;
    for (const entityId of this._flash) {
      this.shadowRoot
        .querySelector(`.row[data-entity="${CSS.escape(entityId)}"]`)
        ?.classList.add("highlight");
    }
    this.shadowRoot
      .querySelector(".highlight")
      ?.scrollIntoView({ block: "nearest", behavior: "smooth" });
    this._flash = [];
  }

  // -- the row menu ------------------------------------------------------

  _openMenu(button, items) {
    const rect = button.getBoundingClientRect();
    const host = this.getBoundingClientRect();
    this._menu = {
      items,
      top: rect.bottom - host.top + 4,
      right: host.right - rect.right,
    };
    this._renderMenu();
  }

  _renderMenu() {
    if (!this._menu) {
      this._menuLayer.innerHTML = "";
      return;
    }
    const { items, top, right } = this._menu;
    this._menuLayer.innerHTML = `
      <div class="menu" style="top:${top}px;right:${right}px" role="menu">
        ${items
          .map((item) =>
            item.separator
              ? `<div class="sep"></div>`
              : `<button role="menuitem" data-menu-item="${esc(item.id)}"
                   ${item.disabled ? "disabled" : ""}
                   class="${item.destructive ? "destructive" : ""}">${esc(item.label)}</button>`,
          )
          .join("")}
      </div>`;
  }

  _closeMenu() {
    if (!this._menu) return;
    this._menu = null;
    this._renderMenu();
  }

  _menuItemsForRoom(areaId) {
    const room = this._room(areaId);
    const index = this._roomIndex(areaId);
    const group = this._groupIndexes(room.hidden ? "hidden" : "shown");
    const at = group.indexOf(index);
    return [
      { id: `move:rooms:${areaId}:top`, label: "Move to top", disabled: at === 0 },
      { id: `move:rooms:${areaId}:up`, label: "Move up", disabled: at === 0 },
      { id: `move:rooms:${areaId}:down`, label: "Move down", disabled: at === group.length - 1 },
      { id: `move:rooms:${areaId}:bottom`, label: "Move to bottom", disabled: at === group.length - 1 },
      { separator: true },
      { id: `hide:${areaId}`, label: room.hidden ? "Show in the grid" : "Keep behind More" },
      { id: `remove-room:${areaId}`, label: "Remove from dashboard", destructive: true },
    ];
  }

  _menuItemsForEntity(list, index, areaId) {
    return [
      { id: `move:${list}:${areaId ?? ""}:${index}:top`, label: "Move to top" },
      { id: `move:${list}:${areaId ?? ""}:${index}:up`, label: "Move up" },
      { id: `move:${list}:${areaId ?? ""}:${index}:down`, label: "Move down" },
      { id: `move:${list}:${areaId ?? ""}:${index}:bottom`, label: "Move to bottom" },
      { separator: true },
      { id: `remove-entity:${list}:${areaId ?? ""}:${index}`, label: "Remove", destructive: true },
    ];
  }

  /** The indexes in `rooms` that belong to one group, in array order. */
  _groupIndexes(group) {
    const out = [];
    this._config.rooms.forEach((room, index) => {
      if ((room.hidden ? "hidden" : "shown") === group) out.push(index);
    });
    return out;
  }

  // -- removing, and undoing it ------------------------------------------

  _removeRoom(areaId) {
    const index = this._roomIndex(areaId);
    if (index === -1) return;
    const room = this._config.rooms[index];
    const title = this._roomTitle(room);
    const count = room.entities.length;
    const copy = JSON.parse(JSON.stringify(room));

    this._edit((config) => {
      config.rooms.splice(index, 1);
    }, { redraw: false });
    if (this._selected === areaId) {
      this._selected = null;
      this._subpage = false;
      this._writeLocation({ push: false });
    }
    this._render();

    this._offerUndo(
      `Removed ${title}${count ? ` and its ${count} entit${count === 1 ? "y" : "ies"}` : ""}`,
      () => {
        if (this._room(areaId)) return "Already restored";
        this._edit((config) => {
          config.rooms.splice(Math.min(index, config.rooms.length), 0, copy);
        });
        return null;
      },
    );
  }

  _removeEntity(list, areaId, index) {
    const target =
      list === "favourites" ? this._config.favourites : this._room(areaId)?.entities;
    if (!target || index < 0 || index >= target.length) return;
    const entityId = target[index];
    const label = this._entityLabel(entityId, areaId);

    this._edit((config) => {
      const live =
        list === "favourites"
          ? config.favourites
          : config.rooms.find((room) => room.area_id === areaId)?.entities;
      live?.splice(index, 1);
    });

    this._offerUndo(`Removed ${label}`, () => {
      const live =
        list === "favourites"
          ? this._config.favourites
          : this._room(areaId)?.entities;
      if (!live) return "Already restored";
      if (live.includes(entityId)) return "Already restored";
      this._edit(() => live.splice(Math.min(index, live.length), 0, entityId));
      return null;
    });
  }

  /**
   * One level of undo: a new removal replaces whatever was pending. Drawn
   * here rather than fired at Home Assistant as a `hass-notification`,
   * because a toast in the shadow root is the one this panel can be sure of.
   */
  _offerUndo(message, undo) {
    clearTimeout(this._undoTimer);
    this._undo = { message, undo };
    this._renderToast();
    this._undoTimer = setTimeout(() => {
      this._undo = null;
      this._renderToast();
    }, UNDO_MS);
  }

  _noteRemoteChange() {
    clearTimeout(this._undoTimer);
    this._undo = { message: "Updated from another window", undo: null, ok: true };
    this._renderToast();
    this._undoTimer = setTimeout(() => {
      this._undo = null;
      this._renderToast();
    }, UNDO_MS);
  }

  _renderToast() {
    if (!this._undo) {
      this._toastLayer.innerHTML = "";
      return;
    }
    const { message, ok } = this._undo;
    this._toastLayer.innerHTML = `
      <div class="toast" role="status">
        <span>${esc(message)}</span>
        <button data-undo>${ok ? "OK" : "Undo"}</button>
      </div>`;
  }

  // -- where we are ------------------------------------------------------

  _select(areaId, { push = false } = {}) {
    this._selected = areaId;
    if (this._narrow && areaId) this._subpage = true;
    this._writeLocation({ push });
    this._render();
  }

  _writeLocation({ push }) {
    const hash = this._selected ? `#room=${encodeURIComponent(this._selected)}` : "";
    const url = `${location.pathname}${location.search}${hash}`;
    const state = { haDashboardRoom: this._selected ?? null };
    if (push) history.pushState(state, "", url);
    else history.replaceState(state, "", url);
  }

  _readLocation({ fromHistory = false } = {}) {
    const match = /#room=([^&]+)/.exec(location.hash);
    const areaId = match ? decodeURIComponent(match[1]) : null;
    this._selected = areaId;
    this._subpage = this._narrow && !!areaId;
    if (fromHistory) {
      this._render();
      // Going back restores the list where it was left.
      if (!this._subpage && this._scrollBefore != null) {
        this._body.scrollTop = this._scrollBefore;
        this._scrollBefore = null;
      }
    }
  }

  // -- events ------------------------------------------------------------

  _onClick(event) {
    const path = event.composedPath();
    const hit = (selector) => path.find((el) => el?.matches?.(selector));

    // A click anywhere else closes an open menu.
    if (this._menu && !hit("[data-menu-item]") && !hit("[data-menu]")) this._closeMenu();

    const menuItem = hit("[data-menu-item]");
    if (menuItem) {
      this._runMenuItem(menuItem.dataset.menuItem);
      this._closeMenu();
      return;
    }

    const menu = hit("[data-menu]");
    if (menu) {
      const kind = menu.dataset.menu;
      if (kind === "room") {
        this._openMenu(menu, this._menuItemsForRoom(menu.dataset.area));
      } else if (kind === "room-page") {
        this._openMenu(menu, [
          { id: `picture:${menu.dataset.area}`, label: "Picture" },
          { separator: true },
          { id: `remove-room:${menu.dataset.area}`, label: "Remove room", destructive: true },
        ]);
      } else {
        this._openMenu(
          menu,
          this._menuItemsForEntity(
            menu.dataset.list,
            Number(menu.dataset.index),
            menu.dataset.area ?? null,
          ),
        );
      }
      return;
    }

    if (hit("[data-toggle-menu]")) {
      this.dispatchEvent(new CustomEvent("hass-toggle-menu", { bubbles: true, composed: true }));
      return;
    }

    if (hit("[data-retry]")) {
      this._saveNow();
      return;
    }

    if (hit("[data-back]")) {
      history.back();
      return;
    }

    const open = hit("[data-open-room]");
    if (open) {
      if (this._narrow) this._scrollBefore = this._body.scrollTop;
      this._select(open.dataset.openRoom, { push: this._narrow });
      return;
    }

    if (hit("[data-add-rooms]")) {
      this._firstRun = this._newFirstRun({ replaceAll: false });
      this._render();
      return;
    }

    const addEntities = hit("[data-add-entities]");
    if (addEntities) {
      this._openAddDialog("entities", addEntities.dataset.addEntities);
      return;
    }

    if (hit("[data-add-favourites]")) {
      this._openAddDialog("favourites", null);
      return;
    }

    const picture = hit("[data-picture]");
    if (picture) {
      this._editingPicture = picture.dataset.picture;
      this._render();
      return;
    }

    const pick = hit("[data-pick]");
    if (pick) {
      const areaId = pick.dataset.pick;
      if (this._firstRun.picked.has(areaId)) this._firstRun.picked.delete(areaId);
      else this._firstRun.picked.add(areaId);
      this._render();
      return;
    }

    if (hit("[data-select-all]")) {
      const spare = this._areaIds().filter((areaId) => !this._room(areaId));
      const all = this._firstRun.picked.size === spare.length;
      this._firstRun.picked = new Set(all ? [] : spare);
      this._render();
      return;
    }

    if (hit("[data-expand-areas]")) {
      this._firstRun.expanded = true;
      this._render();
      return;
    }

    if (hit("[data-first-run-add]")) {
      this._commitFirstRun();
      return;
    }

    if (hit("[data-first-run-cancel]")) {
      this._skippedFirstRun = this._firstRun.replaceAll;
      this._firstRun = null;
      this._render();
      return;
    }

    if (hit("[data-dismiss-banner]")) {
      this._banner = null;
      this._render();
      return;
    }

    const undo = hit("[data-undo]");
    if (undo) {
      const pending = this._undo;
      clearTimeout(this._undoTimer);
      this._undo = null;
      this._renderToast();
      const message = pending?.undo?.();
      if (message) this._say(message);
      return;
    }

    // -- inside the dialog --
    const opt = hit("[data-opt]");
    if (opt && !opt.disabled) {
      const id = opt.dataset.opt;
      const at = this._dialog.picked.indexOf(id);
      if (at === -1) this._dialog.picked.push(id);
      else this._dialog.picked.splice(at, 1);
      this._updateDialogSelection();
      return;
    }

    const chip = hit("[data-chip]");
    if (chip) {
      this._dialog.chip = chip.dataset.chip;
      this._renderDialogList();
      return;
    }

    if (hit("[data-dialog-close]")) {
      this._dialogLayer.querySelector("dialog")?.close();
      return;
    }

    if (hit("[data-dialog-add]")) {
      this._commitDialog();
      return;
    }

    if (hit("[data-dialog-menu]")) {
      this._dialog.showHidden = !this._dialog.showHidden;
      this._say(
        this._dialog.showHidden
          ? "Showing hidden and diagnostic entities"
          : "Hiding hidden and diagnostic entities",
      );
      this._renderDialogList();
    }
  }

  _runMenuItem(id) {
    const [action, ...rest] = id.split(":");

    if (action === "move") {
      const [list, areaId, ...tail] = rest;
      if (list === "rooms") {
        this._moveRoom(areaId, tail[0]);
      } else {
        this._moveEntity(list, areaId || null, Number(tail[0]), tail[1]);
      }
      return;
    }
    if (action === "hide") {
      this._toggleHidden(rest[0]);
      return;
    }
    if (action === "remove-room") {
      this._removeRoom(rest[0]);
      return;
    }
    if (action === "remove-entity") {
      const [list, areaId, index] = rest;
      this._removeEntity(list, areaId || null, Number(index));
      return;
    }
    if (action === "picture") {
      this._editingPicture = rest[0];
      this._render();
    }
  }

  _onChange(event) {
    const el = event.target;

    if (el.dataset?.page !== undefined && el.dataset.page !== "") {
      const on = el.checked;
      this._edit((config) => {
        const pages = new Set(config.pages);
        if (on) pages.add(el.dataset.page);
        else pages.delete(el.dataset.page);
        config.pages = this._pageIds.filter((id) => pages.has(id) || id === ALWAYS_ON_PAGE);
      }, { redraw: false });
      return;
    }

    if (el.dataset?.field === "hidden") {
      this._toggleHidden(el.dataset.area, el.checked);
      return;
    }

    if (el.dataset?.seed !== undefined) {
      this._firstRun.seed = el.checked;
    }
  }

  _onInput(event) {
    const el = event.target;
    const field = el.dataset?.field;
    if (field !== "name" && field !== "picture") {
      if (el.dataset?.dialogSearch !== undefined) {
        this._dialog.query = el.value;
        this._renderDialogList();
      }
      return;
    }
    const areaId = el.dataset.area;
    const value = el.value.trim();
    // Blank means "use the area's own", which the document stores as null.
    this._edit((config) => {
      const room = config.rooms.find((r) => r.area_id === areaId);
      if (room) room[field] = value || null;
    }, { redraw: false });
    // No redraw: it would take the cursor out of the box mid-word.
  }

  _onKeyDown(event) {
    if (event.key === "Escape") {
      if (this._menu) {
        this._closeMenu();
        event.stopPropagation();
        return;
      }
      if (!this._dialog && this._selected && !this._narrow) {
        // Back to the row the pane was opened from.
        const row = this.shadowRoot.querySelector(`[data-open-room="${CSS.escape(this._selected)}"]`);
        row?.focus();
      }
      return;
    }

    const grip = event.composedPath().find((el) => el?.matches?.("[data-grip]"));
    if (grip) this._onGripKey(event, grip);
  }

  // -- reordering --------------------------------------------------------

  /**
   * Drag from the grip only, with Pointer Events rather than HTML5
   * drag-and-drop, which never fires on touch. Everything else on the row
   * keeps scrolling the page.
   */
  _onPointerDown(event) {
    const grip = event.composedPath().find((el) => el?.matches?.("[data-grip]"));
    if (!grip || event.button > 0) return;
    const row = grip.closest(".row");
    if (!row) return;

    event.preventDefault();
    // Capture keeps the pointer with the grip once the finger leaves it. Not
    // every webview has it, and it is not worth failing the drag over.
    try {
      grip.setPointerCapture(event.pointerId);
    } catch {
      // The drag still works; it just ends early if the pointer escapes.
    }

    const siblings = this._siblingRows(row);
    if (siblings.length < 2) return;

    const drag = {
      row,
      siblings,
      startY: event.clientY,
      from: siblings.indexOf(row),
      to: siblings.indexOf(row),
      height: row.getBoundingClientRect().height,
    };
    // Where the row goes back to if the drag returns to where it started.
    const origin = row.nextElementSibling;
    row.classList.add("lifted");

    const onMove = (moveEvent) => {
      const delta = moveEvent.clientY - drag.startY;
      const steps = Math.round(delta / drag.height);
      const next = Math.max(0, Math.min(drag.from + steps, siblings.length - 1));
      if (next === drag.to) return;
      drag.to = next;
      // Move the row itself, so the gap follows the pointer.
      if (next === drag.from) row.parentNode.insertBefore(row, origin);
      else if (next > drag.from) siblings[next].after(row);
      else siblings[next].before(row);
      this._autoScroll(moveEvent.clientY);
    };

    const onUp = () => {
      grip.removeEventListener("pointermove", onMove);
      grip.removeEventListener("pointerup", onUp);
      grip.removeEventListener("pointercancel", onUp);
      row.classList.remove("lifted");
      if (drag.to !== drag.from) {
        this._applyReorder(row, siblings[drag.to]);
      } else {
        this._render();
      }
    };

    grip.addEventListener("pointermove", onMove);
    grip.addEventListener("pointerup", onUp);
    grip.addEventListener("pointercancel", onUp);
  }

  /** The rows a row may be dropped among: its own list, its own group. */
  _siblingRows(row) {
    const list = row.dataset.list;
    const area = row.dataset.area ?? "";
    const group = row.dataset.group;
    return [...this.shadowRoot.querySelectorAll(".row")].filter(
      (other) =>
        other.dataset.list === list &&
        (other.dataset.area ?? "") === area &&
        other.dataset.group === group,
    );
  }

  _autoScroll(clientY) {
    const rect = this._body.getBoundingClientRect();
    if (clientY < rect.top + 48) this._body.scrollTop -= 12;
    else if (clientY > rect.bottom - 48) this._body.scrollTop += 12;
  }

  /** Writes a finished drag back into the document, as one edit. */
  _applyReorder(row, target) {
    const list = row.dataset.list;
    const from = Number(row.dataset.index);
    const to = Number(target.dataset.index);
    if (list === "rooms") this._moveRoomTo(from, to);
    else this._moveEntityTo(list, row.dataset.area ?? null, from, to);
  }

  _moveRoomTo(from, to) {
    this._edit((config) => move(config.rooms, from, to));
  }

  _moveEntityTo(list, areaId, from, to) {
    this._edit((config) => {
      const target =
        list === "favourites"
          ? config.favourites
          : config.rooms.find((room) => room.area_id === areaId)?.entities;
      if (target) move(target, from, to);
    });
  }

  /** Move by name, from the ⋮ menu or the keyboard. Stays within the group. */
  _moveRoom(areaId, where) {
    const index = this._roomIndex(areaId);
    const room = this._config.rooms[index];
    const group = this._groupIndexes(room.hidden ? "hidden" : "shown");
    const at = group.indexOf(index);
    const targets = { top: group[0], bottom: group[group.length - 1], up: group[at - 1], down: group[at + 1] };
    const to = targets[where];
    if (to === undefined) return;
    this._moveRoomTo(index, to);
    this._say(`${this._roomTitle(room)}, position ${group.indexOf(to) + 1} of ${group.length}`);
  }

  _moveEntity(list, areaId, index, where) {
    const target =
      list === "favourites" ? this._config.favourites : this._room(areaId)?.entities;
    if (!target) return;
    const to = { top: 0, bottom: target.length - 1, up: index - 1, down: index + 1 }[where];
    if (to === undefined || to < 0 || to >= target.length) return;
    const label = this._entityLabel(target[index], areaId);
    this._moveEntityTo(list, areaId, index, to);
    this._say(`${label}, position ${to + 1} of ${target.length}`);
  }

  /**
   * Keyboard reordering: Space picks up, arrows move, Space drops, Esc
   * cancels. Every move is announced, because the list is below the focus.
   */
  _onGripKey(event, grip) {
    const row = grip.closest(".row");
    const list = row.dataset.list;
    const areaId = row.dataset.area ?? null;
    const index = Number(row.dataset.index);

    if (event.key === " " || event.key === "Enter") {
      event.preventDefault();
      this._picked = this._picked === grip ? null : grip;
      this._say(this._picked ? "Picked up. Use the arrow keys, then Space to drop." : "Dropped.");
      return;
    }
    if (!this._picked) return;
    if (event.key !== "ArrowUp" && event.key !== "ArrowDown") {
      if (event.key === "Escape") this._picked = null;
      return;
    }
    event.preventDefault();
    const where = event.key === "ArrowUp" ? "up" : "down";
    if (list === "rooms") this._moveRoom(this._config.rooms[index].area_id, where);
    else this._moveEntity(list, areaId, index, where);
    // The list has been redrawn, so focus the grip in its new place.
    const rows = this.shadowRoot.querySelectorAll(
      `.row[data-list="${list}"]${areaId ? `[data-area="${CSS.escape(areaId)}"]` : ""}`,
    );
    const moved = [...rows].find((el) => Number(el.dataset.index) === (where === "up" ? index - 1 : index + 1));
    const next = moved?.querySelector("[data-grip]");
    if (next) {
      next.focus();
      this._picked = next;
    }
  }

  // -- small edits -------------------------------------------------------

  _toggleHidden(areaId, value) {
    this._edit((config) => {
      const room = config.rooms.find((r) => r.area_id === areaId);
      if (room) room.hidden = value === undefined ? !room.hidden : value;
    });
  }

  // -- dialog redraws that keep the box focused --------------------------

  _renderDialogList() {
    const dialog = this._dialogLayer.querySelector("dialog");
    if (!dialog) return;
    const input = dialog.querySelector("[data-dialog-search]");
    const caret = input?.selectionStart ?? null;
    const focused = this.shadowRoot.activeElement === input;
    const scroll = dialog.querySelector(".dlg-list")?.scrollTop ?? 0;

    // Rebuilding the whole dialog would close it, so only its parts change.
    dialog.querySelector(".dlg-list").innerHTML = this._dialogListHtml();
    dialog.querySelector(".dlg-list").scrollTop = scroll;
    for (const chip of dialog.querySelectorAll("[data-chip]")) {
      chip.setAttribute("aria-pressed", String(chip.dataset.chip === this._dialog.chip));
    }
    this._updateDialogCount();
    if (focused && input && caret !== null) {
      input.focus();
      input.setSelectionRange(caret, caret);
    }
  }

  /** Ticking a row must not rebuild the list under the finger. */
  _updateDialogSelection() {
    const dialog = this._dialogLayer.querySelector("dialog");
    if (!dialog) return;
    const picked = new Set(this._dialog.picked);
    for (const opt of dialog.querySelectorAll("[data-opt]")) {
      opt.setAttribute("aria-checked", String(picked.has(opt.dataset.opt)));
    }
    this._updateDialogCount();
  }

  _updateDialogCount() {
    const dialog = this._dialogLayer.querySelector("dialog");
    if (!dialog) return;
    const count = this._dialog.picked.length;
    dialog.querySelector(".count").textContent = `${count} selected`;
    const add = dialog.querySelector("[data-dialog-add]");
    add.disabled = count === 0;
    add.textContent = count ? `Add ${count}` : "Add";
  }

  // -- announcements -----------------------------------------------------

  _say(message) {
    if (!this._live) return;
    this._live.textContent = "";
    // A repeated string is not announced again unless the node changes.
    setTimeout(() => {
      this._live.textContent = message;
    }, 30);
  }
}

customElements.define("ha-dashboard-panel", HaDashboardPanel);
