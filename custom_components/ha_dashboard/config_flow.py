"""The config entry, and the options flow that edits the dashboard document.

The options flow is the whole editing UI. It is a menu rather than a single
long form: each branch writes its part of the document and returns to the
menu, so a change to one room does not walk the user through the whole house.

A frontend panel with drag-and-drop would replace this later. It would write
through `ha_dashboard/save`, leaving the document and the app untouched.
"""

from __future__ import annotations

from copy import deepcopy
from typing import Any

import voluptuous as vol
from homeassistant.config_entries import (
    ConfigEntry,
    ConfigFlow,
    ConfigFlowResult,
    OptionsFlow,
)
from homeassistant.core import callback
from homeassistant.helpers.selector import (
    AreaSelector,
    AreaSelectorConfig,
    BooleanSelector,
    EntitySelector,
    EntitySelectorConfig,
    SelectOptionDict,
    SelectSelector,
    SelectSelectorConfig,
    SelectSelectorMode,
    TextSelector,
    TextSelectorConfig,
    TextSelectorType,
)

from .const import DOMAIN, PAGE_IDS
from .helpers import area_entity_ids, area_name
from .store import DashboardConfig, DashboardStore, empty_room

TITLE = "Dashboard"


class DashboardConfigFlow(ConfigFlow, domain=DOMAIN):
    """One entry per instance. The entry itself carries no settings."""

    VERSION = 1
    MINOR_VERSION = 1

    async def async_step_user(
        self, user_input: dict[str, Any] | None = None
    ) -> ConfigFlowResult:
        """Add the integration. `single_config_entry` keeps it to one."""
        self._async_abort_entries_match()
        return self.async_create_entry(title=TITLE, data={})

    @staticmethod
    @callback
    def async_get_options_flow(config_entry: ConfigEntry) -> OptionsFlow:
        """The editing UI. `config_entry` is read off the flow, not stored."""
        return DashboardOptionsFlow()


class DashboardOptionsFlow(OptionsFlow):
    """The menu, and one step per part of the document."""

    def __init__(self) -> None:
        """Nothing is read until the flow opens: `self.hass` is not set yet."""
        self._store: DashboardStore | None = None
        self._config: DashboardConfig = {}
        self._area_id: str | None = None

    # -- the menu ---------------------------------------------------------

    async def async_step_init(
        self, user_input: dict[str, Any] | None = None
    ) -> ConfigFlowResult:
        """Read the document, then offer the parts of it that can be edited."""
        if self._store is None:
            self._store = self.hass.data[DOMAIN][self.config_entry.entry_id]
            self._config = deepcopy(self._store.config)
        return self.async_show_menu(
            step_id="init",
            menu_options=["rooms", "room", "favourites", "pages", "done"],
        )

    async def async_step_done(
        self, user_input: dict[str, Any] | None = None
    ) -> ConfigFlowResult:
        """Close the flow. Every branch has already written what it changed."""
        return self.async_create_entry(title="", data=dict(self.config_entry.options))

    async def _async_save(self) -> ConfigFlowResult:
        """Write the document and go back to the menu."""
        assert self._store is not None
        await self._store.async_save(self._config)
        return await self.async_step_init()

    # -- which rooms, and in what order -----------------------------------

    async def async_step_rooms(
        self, user_input: dict[str, Any] | None = None
    ) -> ConfigFlowResult:
        """Pick the areas that appear, and drag them into the grid's order.

        A room already configured keeps its entities and overrides. One
        dropped here is forgotten.
        """
        current = [room["area_id"] for room in self._config["rooms"]]

        if user_input is not None:
            existing = {room["area_id"]: room for room in self._config["rooms"]}
            self._config["rooms"] = [
                existing.get(area_id, empty_room(area_id))
                for area_id in user_input["areas"]
            ]
            return await self._async_save()

        return self.async_show_form(
            step_id="rooms",
            data_schema=vol.Schema(
                {
                    vol.Optional("areas", default=current): AreaSelector(
                        AreaSelectorConfig(multiple=True, reorder=True)
                    )
                }
            ),
        )

    # -- what is in one room ----------------------------------------------

    async def async_step_room(
        self, user_input: dict[str, Any] | None = None
    ) -> ConfigFlowResult:
        """Choose which room to edit. Rooms come from the Rooms step."""
        rooms = self._config["rooms"]
        if not rooms:
            return self.async_abort(reason="no_rooms")

        if user_input is not None:
            self._area_id = user_input["area_id"]
            return await self.async_step_room_edit()

        options = [
            SelectOptionDict(
                value=room["area_id"],
                label=room["name"] or area_name(self.hass, room["area_id"]),
            )
            for room in rooms
        ]
        return self.async_show_form(
            step_id="room",
            data_schema=vol.Schema(
                {
                    vol.Required("area_id"): SelectSelector(
                        SelectSelectorConfig(
                            options=options,
                            mode=SelectSelectorMode.DROPDOWN,
                            sort=False,
                        )
                    )
                }
            ),
        )

    async def async_step_room_edit(
        self, user_input: dict[str, Any] | None = None
    ) -> ConfigFlowResult:
        """What the room shows, in what order, and how it is labelled.

        `entities` is the area's own, which is the common case. `extras` is
        unrestricted, because an entity defined in YAML without a unique id is
        in no registry and therefore in no area.
        """
        assert self._area_id is not None
        room = self._room(self._area_id)
        candidates = area_entity_ids(self.hass, self._area_id)
        chosen = room["entities"]

        if user_input is not None:
            room["entities"] = [
                *user_input.get("entities", []),
                *user_input.get("extras", []),
            ]
            room["name"] = user_input.get("name") or None
            room["picture"] = user_input.get("picture") or None
            room["hidden"] = user_input["hidden"]
            self._area_id = None
            return await self._async_save()

        return self.async_show_form(
            step_id="room_edit",
            description_placeholders={"area": area_name(self.hass, self._area_id)},
            data_schema=vol.Schema(
                {
                    vol.Optional(
                        "entities",
                        default=[e for e in chosen if e in candidates],
                    ): EntitySelector(
                        EntitySelectorConfig(
                            multiple=True, reorder=True, include_entities=candidates
                        )
                    ),
                    vol.Optional(
                        "extras",
                        default=[e for e in chosen if e not in candidates],
                    ): EntitySelector(
                        EntitySelectorConfig(multiple=True, reorder=True)
                    ),
                    vol.Optional("name", default=room["name"] or ""): TextSelector(),
                    vol.Optional(
                        "picture", default=room["picture"] or ""
                    ): TextSelector(TextSelectorConfig(type=TextSelectorType.URL)),
                    vol.Required("hidden", default=room["hidden"]): BooleanSelector(),
                }
            ),
        )

    def _room(self, area_id: str) -> dict[str, Any]:
        """The stored room for an area, added if the document has none."""
        for room in self._config["rooms"]:
            if room["area_id"] == area_id:
                return room
        room = empty_room(area_id)
        self._config["rooms"].append(room)
        return room

    # -- the rest ---------------------------------------------------------

    async def async_step_favourites(
        self, user_input: dict[str, Any] | None = None
    ) -> ConfigFlowResult:
        """The Overview page's top section, in the order given."""
        if user_input is not None:
            self._config["favourites"] = user_input.get("favourites", [])
            return await self._async_save()

        return self.async_show_form(
            step_id="favourites",
            data_schema=vol.Schema(
                {
                    vol.Optional(
                        "favourites", default=self._config["favourites"]
                    ): EntitySelector(EntitySelectorConfig(multiple=True, reorder=True))
                }
            ),
        )

    async def async_step_pages(
        self, user_input: dict[str, Any] | None = None
    ) -> ConfigFlowResult:
        """Which pages the sidebar offers.

        Membership only: the dashboard draws them in its own order. Settings
        is always shown whatever this says, so a mistake here is recoverable.
        """
        if user_input is not None:
            self._config["pages"] = user_input.get("pages", [])
            return await self._async_save()

        return self.async_show_form(
            step_id="pages",
            data_schema=vol.Schema(
                {
                    vol.Optional(
                        "pages", default=self._config["pages"]
                    ): SelectSelector(
                        SelectSelectorConfig(
                            options=list(PAGE_IDS),
                            multiple=True,
                            mode=SelectSelectorMode.LIST,
                            translation_key="pages",
                            sort=False,
                        )
                    )
                }
            ),
        )
