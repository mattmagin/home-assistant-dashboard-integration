# Dashboard

A Home Assistant integration that holds the configuration for an external
dashboard app: which rooms it shows, what is in each one, and in what order.

The dashboard is the presentational layer and nothing more. Every choice about
what appears lives here, in Home Assistant, edited through this integration's
sidebar panel. The app reads it and renders it, and decides nothing on its own.

It talks to no device and creates no entity.

## Installing

Add this repository to HACS as a custom repository of type **Integration**,
install **Dashboard**, and restart Home Assistant. Then add the integration
under Settings, Devices and services. **Dashboard** appears in the sidebar.

To install by hand instead, copy `custom_components/ha_dashboard` into your
Home Assistant config directory and restart.

Home Assistant **2026.4** or later.

## Configuring

Open **Dashboard** in the sidebar. The integration's **Configure** button goes
to the same page. Every change saves as it is made.

- **Rooms** — every room the dashboard shows. Drag a row, or use the arrows,
  to set the order of the grid. Open a room for what it holds.
- Inside a room — its entities, in the order the room shows them, plus a name
  and a picture to use instead of the area's, and whether to keep it out of
  the grid. The entity list offers that area's entities first, then everything
  else, so an entity defined in YAML that belongs to no area is still
  reachable.
- **Favourites** — what the dashboard puts above the room grid.
- **Pages** — which pages the dashboard's sidebar offers.

A room kept out of the grid is still a room: its lights still reach the
dashboard's Lights page. Hiding tidies the grid, it does not take things off
the dashboard.

The panel is admin only, since saving is.

## The document

One JSON document, in Home Assistant's own storage under
`ha_dashboard.config`. Array order is display order throughout.

```json
{
  "version": 1,
  "rooms": [
    {
      "area_id": "living_room",
      "name": null,
      "picture": null,
      "hidden": false,
      "entities": ["light.living_room", "media_player.tv"]
    }
  ],
  "favourites": ["light.kitchen_bench"],
  "pages": ["overview", "lights", "climate", "settings"]
}
```

`name` and `picture` override the area's own; null uses the area's. `pages`
names the pages the sidebar offers; an id the app does not have is ignored.

The document lives in its own store rather than in the config entry's options,
so there is one save path and one schema version to migrate, and a frontend
panel saving on every drag would not rewrite `core.config_entries`.
Removing the integration deletes it.

## The websocket API

| Command | What it does |
| --- | --- |
| `ha_dashboard/config` | Returns the document once. |
| `ha_dashboard/subscribe` | Returns it, then again on every change. |
| `ha_dashboard/save` | Replaces it. Admin only; the panel writes through it. |

A dashboard app already holds an authenticated websocket, so these need
nothing added for auth or CORS. Subscribe, and an edit made here reaches every
open dashboard with no reload.

An instance without this integration answers `unknown_command`, and one with
no config entry answers `not_configured`. An app can tell "not installed" from
"installed but empty" on those two codes.

To read it from a browser console on the Home Assistant frontend:

```js
document.querySelector('home-assistant').hass.connection
  .sendMessagePromise({ type: 'ha_dashboard/config' })
```

## Pages

`PAGE_IDS` in `custom_components/ha_dashboard/const.py` lists the pages the
panel offers. It mirrors the page list in the dashboard app, and is passed to
the panel as its config. Adding a page to the app means adding its id here
too, and a label in `PAGE_LABELS` in `panel.js`.

## Development

```sh
uvx ruff check .
uvx ruff format .
```

Link the directory into a Home Assistant config directory and restart:

```sh
ln -s $PWD/custom_components/ha_dashboard <ha-config>/custom_components/ha_dashboard
```

## Layout

```
custom_components/ha_dashboard/
  __init__.py      Setup and teardown
  const.py         Domain, storage keys, the page ids, the panel's version
  store.py         The document, and the signal fired when it is saved
  websocket.py     The three commands above
  config_flow.py   The config entry, which carries no settings
  panel.py         Serving the panel and putting it in the sidebar
  panel/panel.js   The editor
  strings.json     The config flow's text
```

The editor is one hand-written custom element: no framework, no build step, no
committed bundle. It reads the registries from `hass.areas`, `hass.devices`
and `hass.entities`, and writes through `ha_dashboard/save`.

`PANEL_VERSION` in `const.py` is the cache buster in the module's URL. Bump it
whenever `panel.js` changes, or browsers keep the old copy.
