"""The websocket commands the dashboard app reads its configuration through.

The app already holds an authenticated websocket to Home Assistant, so these
need nothing added for auth or CORS. An instance without this integration
answers an unknown command type with `unknown_command`, which is how the app
tells "not installed" from "installed but empty".
"""

from __future__ import annotations

from typing import Any

import voluptuous as vol
from homeassistant.components import websocket_api
from homeassistant.core import HomeAssistant, callback
from homeassistant.helpers.dispatcher import async_dispatcher_connect

from .const import DOMAIN, SIGNAL_CONFIG_UPDATED
from .store import DashboardConfig, DashboardStore

ERR_NOT_CONFIGURED = "not_configured"
NOT_CONFIGURED_MESSAGE = "The Dashboard integration has no configuration entry."


@callback
def async_register_commands(hass: HomeAssistant) -> None:
    """Register the three commands. Safe to call more than once."""
    websocket_api.async_register_command(hass, websocket_get_config)
    websocket_api.async_register_command(hass, websocket_subscribe)
    websocket_api.async_register_command(hass, websocket_save)


@callback
def _async_store(hass: HomeAssistant) -> DashboardStore | None:
    """The one store, or None while no config entry is loaded."""
    entries: dict[str, DashboardStore] = hass.data.get(DOMAIN, {})
    return next(iter(entries.values()), None)


@websocket_api.websocket_command({vol.Required("type"): f"{DOMAIN}/config"})
@callback
def websocket_get_config(
    hass: HomeAssistant,
    connection: websocket_api.ActiveConnection,
    msg: dict[str, Any],
) -> None:
    """Send the whole document once."""
    store = _async_store(hass)
    if store is None:
        connection.send_error(msg["id"], ERR_NOT_CONFIGURED, NOT_CONFIGURED_MESSAGE)
        return
    connection.send_result(msg["id"], store.config)


@websocket_api.websocket_command({vol.Required("type"): f"{DOMAIN}/subscribe"})
@callback
def websocket_subscribe(
    hass: HomeAssistant,
    connection: websocket_api.ActiveConnection,
    msg: dict[str, Any],
) -> None:
    """Send the document now, and again on every change.

    The dashboard therefore follows an edit made in Home Assistant without a
    reload. Closing the socket unhooks the dispatcher.
    """
    store = _async_store(hass)
    if store is None:
        connection.send_error(msg["id"], ERR_NOT_CONFIGURED, NOT_CONFIGURED_MESSAGE)
        return

    @callback
    def forward(config: DashboardConfig) -> None:
        connection.send_message(websocket_api.event_message(msg["id"], config))

    connection.subscriptions[msg["id"]] = async_dispatcher_connect(
        hass, SIGNAL_CONFIG_UPDATED, forward
    )
    connection.send_result(msg["id"])
    forward(store.config)


@websocket_api.require_admin
@websocket_api.websocket_command(
    {
        vol.Required("type"): f"{DOMAIN}/save",
        vol.Required("config"): dict,
    }
)
@websocket_api.async_response
async def websocket_save(
    hass: HomeAssistant,
    connection: websocket_api.ActiveConnection,
    msg: dict[str, Any],
) -> None:
    """Replace the document.

    The options flow is the editing UI today. This command is what a frontend
    panel would write through later, without the dashboard app changing.
    """
    store = _async_store(hass)
    if store is None:
        connection.send_error(msg["id"], ERR_NOT_CONFIGURED, NOT_CONFIGURED_MESSAGE)
        return
    await store.async_save(msg["config"])
    connection.send_result(msg["id"], store.config)
