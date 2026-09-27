"""Constants for the Dashboard integration."""

from __future__ import annotations

from typing import Final

DOMAIN: Final = "ha_dashboard"

#: The `homeassistant.helpers.storage.Store` holding the dashboard document.
STORAGE_KEY: Final = f"{DOMAIN}.config"
STORAGE_VERSION: Final = 1

#: The schema version of the document itself, sent to the dashboard app.
CONFIG_VERSION: Final = 1

#: Fired with the whole document whenever it is saved.
SIGNAL_CONFIG_UPDATED: Final = f"{DOMAIN}_config_updated"

#: Where the panel's module is served from, and the sidebar entry it backs.
PANEL_URL_BASE: Final = "/ha_dashboard_panel"
PANEL_URL_PATH: Final = "ha-dashboard"
PANEL_ELEMENT: Final = "ha-dashboard-panel"
#: Marks the static path as registered; see `panel.py`.
DATA_PANEL_PATH: Final = f"{DOMAIN}_panel_path"

#: Bumped whenever panel.js changes, so a browser does not serve a stale copy.
PANEL_VERSION: Final = "1"

#: The pages the dashboard app has, from `apps/web/src/pages/index.ts`. The app
#: intersects this list with its own, so an id it does not know is ignored and
#: a page it has that the document omits is hidden. Add a page in both places.
PAGE_IDS: Final = ["overview", "lights", "climate", "settings"]
