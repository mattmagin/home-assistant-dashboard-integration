/**
 * The Dashboard panel: the editor for what the dashboard app shows.
 *
 * A plain custom element with no framework and no build step, so the
 * integration stays a Python directory with one JavaScript file beside it.
 * Home Assistant sets `hass`, `narrow`, `route` and `panel` as properties.
 *
 * Every change saves straight away through `ha_dashboard/save`, and the
 * subscription brings the saved document back, so two open tabs agree.
 */

const SUBSCRIBE = "ha_dashboard/subscribe";
const SAVE = "ha_dashboard/save";

/** How long to sit on a text edit before writing it. */
const SAVE_DELAY = 600;

const PAGE_LABELS = {
  overview: "Overview",
  lights: "Lights",
  climate: "Climate",
  settings: "Settings",
};

const STYLES = `
  :host {
    display: block;
    height: 100%;
    overflow-y: auto;
    background: var(--primary-background-color);
    color: var(--primary-text-color);
    font-family: var(--paper-font-body1_-_font-family, inherit);
  }
  .wrap {
    max-width: 840px;
    margin: 0 auto;
    padding: 16px;
    display: flex;
    flex-direction: column;
    gap: 24px;
  }
  section {
    background: var(--card-background-color);
    border-radius: var(--ha-card-border-radius, 12px);
    box-shadow: var(--ha-card-box-shadow, none);
    border: 1px solid var(--divider-color);
    overflow: hidden;
  }
  header.bar {
    display: flex;
    align-items: baseline;
    gap: 12px;
    padding: 16px;
    border-bottom: 1px solid var(--divider-color);
  }
  header.bar h2 {
    margin: 0;
    font-size: 18px;
    font-weight: 500;
  }
  header.bar p {
    margin: 0;
    flex: 1 1 auto;
    color: var(--secondary-text-color);
    font-size: 13px;
  }
  .row {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 10px 16px;
    border-bottom: 1px solid var(--divider-color);
  }
  .row:last-child {
    border-bottom: none;
  }
  .row.dragging {
    opacity: 0.4;
  }
  .row.over {
    border-top: 2px solid var(--primary-color);
  }
  .grip {
    cursor: grab;
    color: var(--secondary-text-color);
    user-select: none;
    padding: 0 4px;
  }
  .label {
    flex: 1 1 auto;
    min-width: 0;
  }
  .label .name {
    display: block;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .label .sub {
    display: block;
    color: var(--secondary-text-color);
    font-size: 12px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  button.icon {
    border: none;
    background: none;
    color: var(--secondary-text-color);
    cursor: pointer;
    font-size: 16px;
    line-height: 1;
    padding: 6px 8px;
    border-radius: 50%;
  }
  button.icon:hover:not(:disabled) {
    background: var(--secondary-background-color);
    color: var(--primary-text-color);
  }
  button.icon:disabled {
    opacity: 0.3;
    cursor: default;
  }
  button.text {
    border: none;
    background: none;
    color: var(--primary-color);
    cursor: pointer;
    font: inherit;
    font-size: 14px;
    padding: 6px 8px;
  }
  button.text:hover {
    text-decoration: underline;
  }
  .add {
    display: flex;
    gap: 8px;
    padding: 12px 16px;
    align-items: center;
    flex-wrap: wrap;
  }
  select,
  input[type="text"] {
    font: inherit;
    font-size: 14px;
    padding: 8px;
    border-radius: 6px;
    border: 1px solid var(--divider-color);
    background: var(--primary-background-color);
    color: var(--primary-text-color);
    min-width: 0;
  }
  select {
    flex: 1 1 260px;
  }
  .detail {
    padding: 8px 16px 16px 40px;
    border-bottom: 1px solid var(--divider-color);
    background: var(--primary-background-color);
  }
  .detail h3 {
    margin: 16px 0 8px;
    font-size: 13px;
    font-weight: 500;
    text-transform: uppercase;
    letter-spacing: 0.4px;
    color: var(--secondary-text-color);
  }
  .fields {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
    gap: 12px;
    margin-top: 8px;
  }
  .field {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }
  .field span {
    font-size: 12px;
    color: var(--secondary-text-color);
  }
  .check {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 16px;
  }
  .empty {
    padding: 16px;
    color: var(--secondary-text-color);
    font-size: 14px;
  }
  .notice {
    padding: 24px 16px;
    color: var(--secondary-text-color);
  }
  .nested .row {
    padding-left: 0;
    padding-right: 0;
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

/** Moves the item at `from` to `to`, in place. */
function move(list, from, to) {
  if (to < 0 || to >= list.length) return;
  list.splice(to, 0, list.splice(from, 1)[0]);
}

class HaDashboardPanel extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this._config = null;
    this._open = null; // The area id whose entities are showing.
    this._unsub = null;
    this._saveTimer = null;
    this._ready = false;
  }

  set hass(hass) {
    this._hass = hass;
    // Registry data arrives with the first hass. State changes arrive
    // constantly after that, and none of them change this page.
    if (!this._ready) {
      this._ready = true;
      this._subscribe();
    }
  }

  set panel(panel) {
    this._pageIds = panel?.config?.page_ids ?? Object.keys(PAGE_LABELS);
  }

  connectedCallback() {
    this.shadowRoot.innerHTML = `<style>${STYLES}</style><div class="wrap"></div>`;
    this._root = this.shadowRoot.querySelector(".wrap");
    this._root.addEventListener("click", (event) => this._onClick(event));
    this._root.addEventListener("change", (event) => this._onChange(event));
    this._root.addEventListener("input", (event) => this._onInput(event));
    this._bindDragging();
    this._render();
  }

  disconnectedCallback() {
    this._unsub?.then((stop) => stop());
    this._unsub = null;
    this._ready = false;
    if (this._saveTimer) clearTimeout(this._saveTimer);
  }

  // -- talking to Home Assistant ----------------------------------------

  _subscribe() {
    this._unsub = this._hass.connection
      .subscribeMessage(
        (config) => {
          // A save of our own comes back here too, which is what keeps a
          // second open tab in step.
          this._config = config;
          this._render();
        },
        { type: SUBSCRIBE },
      )
      .catch((error) => {
        this._error = error?.message ?? String(error);
        this._render();
        return () => {};
      });
  }

  /** Writes the document. Called after every edit. */
  _save() {
    if (!this._config) return;
    this._hass.connection
      .sendMessagePromise({ type: SAVE, config: this._config })
      .catch((error) => {
        this._error = error?.message ?? String(error);
        this._render();
      });
  }

  /** Writes after a pause, so typing a name is not one save per keystroke. */
  _saveSoon() {
    if (this._saveTimer) clearTimeout(this._saveTimer);
    this._saveTimer = setTimeout(() => this._save(), SAVE_DELAY);
  }

  // -- reading the registries -------------------------------------------

  _areaName(areaId) {
    return this._hass.areas?.[areaId]?.name ?? areaId;
  }

  /**
   * Every entity in an area, the way Home Assistant resolves one: an entity
   * carries its own area when it has one, and inherits its device's
   * otherwise.
   */
  _areaEntities(areaId) {
    const entities = this._hass.entities ?? {};
    const devices = this._hass.devices ?? {};
    const out = [];
    for (const entry of Object.values(entities)) {
      if (entry.hidden || entry.entity_category) continue;
      const area = entry.area_id ?? devices[entry.device_id]?.area_id ?? null;
      if (area === areaId) out.push(entry.entity_id);
    }
    return out.sort((a, b) => this._entityName(a).localeCompare(this._entityName(b)));
  }

  _entityName(entityId) {
    return (
      this._hass.states?.[entityId]?.attributes?.friendly_name ?? entityId
    );
  }

  _allEntityIds() {
    return Object.keys(this._hass.states ?? {}).sort((a, b) =>
      this._entityName(a).localeCompare(this._entityName(b)),
    );
  }

  _room(areaId) {
    return this._config.rooms.find((room) => room.area_id === areaId);
  }

  // -- rendering ---------------------------------------------------------

  _render() {
    if (!this._root) return;
    if (this._error) {
      this._root.innerHTML = `<section><div class="notice">${esc(this._error)}</div></section>`;
      return;
    }
    if (!this._config || !this._hass) {
      this._root.innerHTML = `<section><div class="notice">Loading…</div></section>`;
      return;
    }
    this._root.innerHTML = [
      this._renderRooms(),
      this._renderFavourites(),
      this._renderPages(),
    ].join("");
  }

  _renderRooms() {
    const rooms = this._config.rooms;
    const chosen = new Set(rooms.map((room) => room.area_id));
    const available = Object.keys(this._hass.areas ?? {})
      .filter((areaId) => !chosen.has(areaId))
      .sort((a, b) => this._areaName(a).localeCompare(this._areaName(b)));

    const body = rooms.length
      ? rooms.map((room, index) => this._renderRoom(room, index, rooms.length)).join("")
      : `<div class="empty">No rooms yet. Add one below.</div>`;

    return `
      <section>
        <header class="bar">
          <h2>Rooms</h2>
          <p>Drag to reorder. Open a room to choose what it shows.</p>
        </header>
        ${body}
        <div class="add">
          <select data-add="room">
            <option value="">Add a room…</option>
            ${available
              .map((id) => `<option value="${esc(id)}">${esc(this._areaName(id))}</option>`)
              .join("")}
          </select>
        </div>
      </section>`;
  }

  _renderRoom(room, index, total) {
    const open = this._open === room.area_id;
    const title = room.name || this._areaName(room.area_id);
    const bits = [`${room.entities.length} shown`];
    if (room.hidden) bits.push("hidden from the grid");

    const row = `
      <div class="row" draggable="true" data-list="rooms" data-index="${index}">
        <span class="grip" title="Drag to reorder">⠿</span>
        <button class="icon" data-move="rooms" data-index="${index}" data-delta="-1"
          ${index === 0 ? "disabled" : ""} title="Move up">▲</button>
        <button class="icon" data-move="rooms" data-index="${index}" data-delta="1"
          ${index === total - 1 ? "disabled" : ""} title="Move down">▼</button>
        <button class="text label" data-open="${esc(room.area_id)}" style="text-align:left">
          <span class="name">${esc(title)}</span>
          <span class="sub">${esc(bits.join(" · "))}</span>
        </button>
        <button class="icon" data-remove-room="${esc(room.area_id)}" title="Remove this room">✕</button>
      </div>`;

    return open ? row + this._renderRoomDetail(room) : row;
  }

  _renderRoomDetail(room) {
    const inArea = this._areaEntities(room.area_id);
    const chosen = new Set(room.entities);
    const candidates = inArea.filter((id) => !chosen.has(id));
    const others = this._allEntityIds().filter(
      (id) => !chosen.has(id) && !inArea.includes(id),
    );

    const rows = room.entities.length
      ? room.entities
          .map(
            (entityId, index) => `
        <div class="row" draggable="true" data-list="entities" data-area="${esc(room.area_id)}" data-index="${index}">
          <span class="grip" title="Drag to reorder">⠿</span>
          <button class="icon" data-move="entities" data-area="${esc(room.area_id)}"
            data-index="${index}" data-delta="-1" ${index === 0 ? "disabled" : ""} title="Move up">▲</button>
          <button class="icon" data-move="entities" data-area="${esc(room.area_id)}"
            data-index="${index}" data-delta="1"
            ${index === room.entities.length - 1 ? "disabled" : ""} title="Move down">▼</button>
          <span class="label">
            <span class="name">${esc(this._entityName(entityId))}</span>
            <span class="sub">${esc(entityId)}</span>
          </span>
          <button class="icon" data-remove-entity="${esc(entityId)}" data-area="${esc(room.area_id)}"
            title="Remove">✕</button>
        </div>`,
          )
          .join("")
      : `<div class="empty">Nothing in this room yet.</div>`;

    return `
      <div class="detail">
        <h3>What this room shows</h3>
        <div class="nested">${rows}</div>
        <div class="add">
          <select data-add="entity" data-area="${esc(room.area_id)}">
            <option value="">Add an entity…</option>
            ${
              candidates.length
                ? `<optgroup label="In this area">${candidates
                    .map(
                      (id) =>
                        `<option value="${esc(id)}">${esc(this._entityName(id))}</option>`,
                    )
                    .join("")}</optgroup>`
                : ""
            }
            <optgroup label="Anywhere else">${others
              .map(
                (id) =>
                  `<option value="${esc(id)}">${esc(this._entityName(id))} — ${esc(id)}</option>`,
              )
              .join("")}</optgroup>
          </select>
        </div>

        <h3>How it looks</h3>
        <div class="fields">
          <label class="field">
            <span>Name, instead of the area's</span>
            <input type="text" data-field="name" data-area="${esc(room.area_id)}"
              value="${esc(room.name ?? "")}" placeholder="${esc(this._areaName(room.area_id))}">
          </label>
          <label class="field">
            <span>Picture, instead of the area's</span>
            <input type="text" data-field="picture" data-area="${esc(room.area_id)}"
              value="${esc(room.picture ?? "")}" placeholder="/local/living-room.jpg">
          </label>
        </div>
        <div class="check">
          <input type="checkbox" id="hidden-${esc(room.area_id)}" data-field="hidden"
            data-area="${esc(room.area_id)}" ${room.hidden ? "checked" : ""}>
          <label for="hidden-${esc(room.area_id)}">Keep out of the grid, behind the More button</label>
        </div>
      </div>`;
  }

  _renderFavourites() {
    const chosen = new Set(this._config.favourites);
    const rows = this._config.favourites.length
      ? this._config.favourites
          .map(
            (entityId, index) => `
        <div class="row" draggable="true" data-list="favourites" data-index="${index}">
          <span class="grip" title="Drag to reorder">⠿</span>
          <button class="icon" data-move="favourites" data-index="${index}" data-delta="-1"
            ${index === 0 ? "disabled" : ""} title="Move up">▲</button>
          <button class="icon" data-move="favourites" data-index="${index}" data-delta="1"
            ${index === this._config.favourites.length - 1 ? "disabled" : ""} title="Move down">▼</button>
          <span class="label">
            <span class="name">${esc(this._entityName(entityId))}</span>
            <span class="sub">${esc(entityId)}</span>
          </span>
          <button class="icon" data-remove-favourite="${esc(entityId)}" title="Remove">✕</button>
        </div>`,
          )
          .join("")
      : `<div class="empty">Nothing yet. The section stays off the page until something is here.</div>`;

    return `
      <section>
        <header class="bar">
          <h2>Favourites</h2>
          <p>Shown above the room grid, in this order.</p>
        </header>
        ${rows}
        <div class="add">
          <select data-add="favourite">
            <option value="">Add an entity…</option>
            ${this._allEntityIds()
              .filter((id) => !chosen.has(id))
              .map(
                (id) =>
                  `<option value="${esc(id)}">${esc(this._entityName(id))} — ${esc(id)}</option>`,
              )
              .join("")}
          </select>
        </div>
      </section>`;
  }

  _renderPages() {
    const chosen = new Set(this._config.pages);
    return `
      <section>
        <header class="bar">
          <h2>Pages</h2>
          <p>Which pages the dashboard's sidebar offers. Settings always shows.</p>
        </header>
        ${this._pageIds
          .map(
            (id) => `
          <div class="check">
            <input type="checkbox" id="page-${esc(id)}" data-page="${esc(id)}"
              ${chosen.has(id) ? "checked" : ""}>
            <label for="page-${esc(id)}">${esc(PAGE_LABELS[id] ?? id)}</label>
          </div>`,
          )
          .join("")}
      </section>`;
  }

  // -- events ------------------------------------------------------------

  _onClick(event) {
    const target = event.target.closest("[data-open],[data-move],[data-remove-room],[data-remove-entity],[data-remove-favourite]");
    if (!target) return;

    if (target.dataset.open !== undefined) {
      const areaId = target.dataset.open;
      this._open = this._open === areaId ? null : areaId;
      this._render();
      return;
    }

    if (target.dataset.move) {
      const index = Number(target.dataset.index);
      const delta = Number(target.dataset.delta);
      this._reorder(target.dataset.move, target.dataset.area, index, index + delta);
      return;
    }

    if (target.dataset.removeRoom) {
      this._config.rooms = this._config.rooms.filter(
        (room) => room.area_id !== target.dataset.removeRoom,
      );
      if (this._open === target.dataset.removeRoom) this._open = null;
      this._commit();
      return;
    }

    if (target.dataset.removeEntity) {
      const room = this._room(target.dataset.area);
      room.entities = room.entities.filter((id) => id !== target.dataset.removeEntity);
      this._commit();
      return;
    }

    if (target.dataset.removeFavourite) {
      this._config.favourites = this._config.favourites.filter(
        (id) => id !== target.dataset.removeFavourite,
      );
      this._commit();
    }
  }

  _onChange(event) {
    const el = event.target;

    if (el.dataset.add) {
      const value = el.value;
      if (!value) return;
      if (el.dataset.add === "room") {
        this._config.rooms.push(emptyRoom(value));
        this._open = value;
      } else if (el.dataset.add === "entity") {
        this._room(el.dataset.area).entities.push(value);
      } else {
        this._config.favourites.push(value);
      }
      this._commit();
      return;
    }

    if (el.dataset.field === "hidden") {
      this._room(el.dataset.area).hidden = el.checked;
      this._commit();
      return;
    }

    if (el.dataset.page !== undefined) {
      const pages = new Set(this._config.pages);
      if (el.checked) pages.add(el.dataset.page);
      else pages.delete(el.dataset.page);
      // Keep the list in the order the panel lists them.
      this._config.pages = this._pageIds.filter((id) => pages.has(id));
      this._commit();
    }
  }

  _onInput(event) {
    const el = event.target;
    if (el.dataset.field !== "name" && el.dataset.field !== "picture") return;
    const room = this._room(el.dataset.area);
    // An empty box means "use the area's own", which the document stores as
    // null rather than an empty string.
    room[el.dataset.field] = el.value.trim() || null;
    // No re-render: that would take the cursor out of the box mid-word.
    this._saveSoon();
  }

  _reorder(list, areaId, from, to) {
    const target =
      list === "rooms"
        ? this._config.rooms
        : list === "favourites"
          ? this._config.favourites
          : this._room(areaId).entities;
    if (from === to || to < 0 || to >= target.length) return;
    move(target, from, to);
    this._commit();
  }

  /** Draw the change now, and write it. */
  _commit() {
    this._render();
    this._save();
  }

  _bindDragging() {
    let dragged = null;

    this._root.addEventListener("dragstart", (event) => {
      const row = event.target.closest(".row[draggable]");
      if (!row) return;
      dragged = row;
      row.classList.add("dragging");
      event.dataTransfer.effectAllowed = "move";
      // Firefox will not start a drag without this.
      event.dataTransfer.setData("text/plain", "");
    });

    this._root.addEventListener("dragover", (event) => {
      const row = event.target.closest(".row[draggable]");
      if (!row || !dragged || row === dragged) return;
      // Only within the same list, and the same room for an entity list.
      if (row.dataset.list !== dragged.dataset.list) return;
      if (row.dataset.area !== dragged.dataset.area) return;
      event.preventDefault();
      row.classList.add("over");
    });

    this._root.addEventListener("dragleave", (event) => {
      event.target.closest(".row")?.classList.remove("over");
    });

    this._root.addEventListener("drop", (event) => {
      const row = event.target.closest(".row[draggable]");
      if (!row || !dragged) return;
      event.preventDefault();
      row.classList.remove("over");
      this._reorder(
        dragged.dataset.list,
        dragged.dataset.area,
        Number(dragged.dataset.index),
        Number(row.dataset.index),
      );
      dragged = null;
    });

    this._root.addEventListener("dragend", () => {
      this._root.querySelectorAll(".dragging, .over").forEach((el) => {
        el.classList.remove("dragging", "over");
      });
      dragged = null;
    });
  }
}

customElements.define("ha-dashboard-panel", HaDashboardPanel);
