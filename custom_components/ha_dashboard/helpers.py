"""Shared lookups the config flow needs."""

from __future__ import annotations

from homeassistant.core import HomeAssistant
from homeassistant.helpers import area_registry as ar
from homeassistant.helpers import device_registry as dr
from homeassistant.helpers import entity_registry as er


def area_entity_ids(hass: HomeAssistant, area_id: str) -> list[str]:
    """Every entity in an area, the way Home Assistant resolves one.

    An entity carries its own area when it has one, and inherits its device's
    otherwise. `async_entries_for_area` returns only the first kind, so the
    devices in the area are walked for the second. An entity moved out of its
    device's area carries an `area_id` of its own and is left where it is.
    """
    entities = er.async_get(hass)
    devices = dr.async_get(hass)

    ids = {
        entry.entity_id
        for entry in er.async_entries_for_area(entities, area_id)
        if not entry.disabled_by and not entry.hidden_by
    }
    for device in dr.async_entries_for_area(devices, area_id):
        for entry in er.async_entries_for_device(entities, device.id):
            if entry.area_id is None and not entry.disabled_by and not entry.hidden_by:
                ids.add(entry.entity_id)
    return sorted(ids)


def area_name(hass: HomeAssistant, area_id: str) -> str:
    """An area's name, falling back to its id if it has been deleted."""
    area = ar.async_get(hass).async_get_area(area_id)
    return area.name if area else area_id
