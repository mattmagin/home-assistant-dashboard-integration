"""The sidebar panel that edits the dashboard document.

The panel is a single hand-written ES module, served from this directory.
It uses no framework and needs no build step, so the repository stays Python
with one JavaScript file beside it.
"""

from __future__ import annotations

from pathlib import Path

from homeassistant.components import panel_custom
from homeassistant.components.frontend import async_remove_panel
from homeassistant.components.http import StaticPathConfig
from homeassistant.core import HomeAssistant

from .const import (
    DATA_PANEL_PATH,
    DOMAIN,
    PAGE_IDS,
    PANEL_ELEMENT,
    PANEL_URL_BASE,
    PANEL_URL_PATH,
    PANEL_VERSION,
)


async def async_register_panel(hass: HomeAssistant) -> None:
    """Serve the module and put the panel in the sidebar.

    `config_panel_domain` also points the integration's own Configure button
    here, so the sidebar and the integration page reach the same editor.
    """
    # A static path cannot be unregistered, so registering it twice — on a
    # reload of the entry — would collide with the route already there.
    if not hass.data.get(DATA_PANEL_PATH):
        await hass.http.async_register_static_paths(
            [
                StaticPathConfig(
                    PANEL_URL_BASE,
                    str(Path(__file__).parent / "panel"),
                    # The module carries a version in its query string instead.
                    cache_headers=False,
                )
            ]
        )
        hass.data[DATA_PANEL_PATH] = True
    await panel_custom.async_register_panel(
        hass,
        frontend_url_path=PANEL_URL_PATH,
        webcomponent_name=PANEL_ELEMENT,
        module_url=f"{PANEL_URL_BASE}/panel.js?v={PANEL_VERSION}",
        sidebar_title="Dashboard",
        sidebar_icon="mdi:view-dashboard",
        # Saving is admin only, so there is nothing here for anyone else.
        require_admin=True,
        config_panel_domain=DOMAIN,
        # The panel reads the page list from here rather than over the
        # websocket, so the two stay in step with no extra command.
        config={"page_ids": list(PAGE_IDS)},
    )


def async_unregister_panel(hass: HomeAssistant) -> None:
    """Take the sidebar entry away. The static path stays; it is harmless."""
    async_remove_panel(hass, PANEL_URL_PATH)
