# Dashboard

A Home Assistant integration that holds the configuration for an external
dashboard app: which rooms it shows, what is in each one, and in what order.

The dashboard is the presentational layer and nothing more. Every choice about
what appears lives here, in Home Assistant, edited through this integration's
options. The app reads it and renders it, and decides nothing on its own.

It talks to no device and creates no entity.

## Installing

Add this repository to HACS as a custom repository of type **Integration**,
install **Dashboard**, and restart Home Assistant. Then add the integration
under Settings, Devices and services.

To install by hand instead, copy `custom_components/ha_dashboard` into your
Home Assistant config directory and restart.

Home Assistant **2026.4** or later. The options flow uses the area selector's
drag-to-reorder, which arrived in that release.

## Configuring

Press **Configure** on the integration. The options are a menu, so changing
one room does not walk you through the whole house:

- **Rooms in the grid** — which areas appear, dragged into the order the
  dashboard draws them.
- **What a room shows** — one room at a time: its entities, dragged into
  order, plus a name, a picture and whether to hide it. The entity picker is
  limited to that area; a second picker takes anything else, for an entity
  defined in YAML that belongs to no area.
- **Favourites** — the things the dashboard puts above the room grid.
- **Pages** — which pages the dashboard's sidebar offers.

A room marked hidden stays out of the grid, behind the dashboard's **More**
button. It is still a room, so its lights still reach the Lights page.

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
| `ha_dashboard/save` | Replaces it. Admin only. |

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
options flow offers. It mirrors the page list in the dashboard app. Adding a
page to the app means adding its id here too.

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
  const.py         Domain, storage keys, the page ids
  store.py         The document, and the signal fired when it is saved
  websocket.py     The three commands above
  config_flow.py   The config entry, and the options flow that edits it
  helpers.py       Resolving an area's entities
  strings.json     Step titles and field labels
```
