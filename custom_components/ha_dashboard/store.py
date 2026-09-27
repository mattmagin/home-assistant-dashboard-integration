"""The dashboard document, and where it is kept."""

from __future__ import annotations

from typing import Any

from homeassistant.core import HomeAssistant
from homeassistant.helpers.dispatcher import async_dispatcher_send
from homeassistant.helpers.storage import Store

from .const import (
    CONFIG_VERSION,
    PAGE_IDS,
    SIGNAL_CONFIG_UPDATED,
    STORAGE_KEY,
    STORAGE_VERSION,
)

type DashboardConfig = dict[str, Any]


def empty_config() -> DashboardConfig:
    """A document with nothing chosen yet. Every page starts visible."""
    return {
        "version": CONFIG_VERSION,
        "rooms": [],
        "favourites": [],
        "pages": list(PAGE_IDS),
    }


def empty_room(area_id: str) -> dict[str, Any]:
    """A room that shows the area as Home Assistant has it, and nothing in it."""
    return {
        "area_id": area_id,
        "name": None,
        "picture": None,
        "hidden": False,
        "entities": [],
    }


class DashboardStore:
    """Reads and writes the one document, and announces every change.

    Array order is display order throughout: the rooms in the grid, the
    entities in a room, the favourites, and the pages in the sidebar.
    """

    def __init__(self, hass: HomeAssistant) -> None:
        """Set up the store. Nothing is read until `async_load`."""
        self._hass = hass
        self._store: Store[DashboardConfig] = Store(hass, STORAGE_VERSION, STORAGE_KEY)
        self._config: DashboardConfig = empty_config()

    @property
    def config(self) -> DashboardConfig:
        """The document as it stands."""
        return self._config

    async def async_load(self) -> DashboardConfig:
        """Read the document from disk, or start a new one."""
        stored = await self._store.async_load()
        self._config = _migrate(stored) if stored else empty_config()
        return self._config

    async def async_remove(self) -> None:
        """Delete the document from disk."""
        await self._store.async_remove()
        self._config = empty_config()

    async def async_save(self, config: DashboardConfig) -> None:
        """Replace the document, write it, and tell every subscriber."""
        self._config = _migrate(config)
        await self._store.async_save(self._config)
        async_dispatcher_send(self._hass, SIGNAL_CONFIG_UPDATED, self._config)


def _migrate(config: DashboardConfig) -> DashboardConfig:
    """Bring a document up to the current schema, filling in what is missing.

    An older document keeps whatever it already holds. A newer one, written by
    a later version of this integration, is left alone rather than truncated.
    """
    merged = empty_config() | config
    merged["version"] = max(CONFIG_VERSION, int(config.get("version", CONFIG_VERSION)))
    merged["rooms"] = [empty_room(room["area_id"]) | room for room in merged["rooms"]]
    return merged
