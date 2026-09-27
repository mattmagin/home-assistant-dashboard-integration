"""The Dashboard integration.

It holds what the external dashboard app shows — which rooms, which entities,
in what order — and serves it over the websocket API. It talks to no device
and creates no entity.

The editor is a sidebar panel. See `panel.py` and `panel/panel.js`.
"""

from __future__ import annotations

from homeassistant.config_entries import ConfigEntry
from homeassistant.core import HomeAssistant

from .const import DOMAIN
from .panel import async_register_panel, async_unregister_panel
from .store import DashboardStore
from .websocket import async_register_commands


async def async_setup_entry(hass: HomeAssistant, entry: ConfigEntry) -> bool:
    """Load the document, open the websocket API, and add the panel."""
    store = DashboardStore(hass)
    await store.async_load()
    hass.data.setdefault(DOMAIN, {})[entry.entry_id] = store
    async_register_commands(hass)
    await async_register_panel(hass)
    return True


async def async_unload_entry(hass: HomeAssistant, entry: ConfigEntry) -> bool:
    """Drop the document and the panel.

    The websocket commands stay registered: Home Assistant has no way to
    unregister one. They answer `not_configured` with no entry loaded.
    """
    hass.data.get(DOMAIN, {}).pop(entry.entry_id, None)
    async_unregister_panel(hass)
    return True


async def async_remove_entry(hass: HomeAssistant, entry: ConfigEntry) -> None:
    """Delete the document when the integration is removed.

    It lives in its own store rather than in the entry's options, so removing
    the entry would otherwise leave it behind.
    """
    await DashboardStore(hass).async_remove()
