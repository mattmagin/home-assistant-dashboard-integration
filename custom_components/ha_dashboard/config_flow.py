"""The config entry.

The entry carries no settings: everything the dashboard shows is in the
document, edited through the sidebar panel. See `panel.py`.
"""

from __future__ import annotations

from typing import Any

from homeassistant.config_entries import ConfigFlow, ConfigFlowResult

from .const import DOMAIN

TITLE = "Dashboard"


class DashboardConfigFlow(ConfigFlow, domain=DOMAIN):
    """One entry per instance, added with nothing to fill in."""

    VERSION = 1
    MINOR_VERSION = 1

    async def async_step_user(
        self, user_input: dict[str, Any] | None = None
    ) -> ConfigFlowResult:
        """Add the integration. `single_config_entry` keeps it to one."""
        self._async_abort_entries_match()
        return self.async_create_entry(title=TITLE, data={})
