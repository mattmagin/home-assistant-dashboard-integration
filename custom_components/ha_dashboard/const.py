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

#: The pages the dashboard app has, from `apps/web/src/pages/index.ts`. The app
#: intersects this list with its own, so an id it does not know is ignored and
#: a page it has that the document omits is hidden. Add a page in both places.
PAGE_IDS: Final = ["overview", "lights", "climate", "settings"]
