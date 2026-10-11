from datetime import date
from decimal import Decimal

import pytest

from modules.leave.domain import LeaveRuleError, chargeable_days, conversion_vl_to_el, overlaps


def test_continuous_categories_include_weekends_and_holidays():
    assert chargeable_days(
        "EL", date(2026, 1, 2), date(2026, 1, 5), closed_holidays=(date(2026, 1, 5),)
    ) == Decimal("4")


def test_non_continuous_categories_exclude_weekends_and_closed_holidays():
    assert chargeable_days(
        "CL", date(2026, 1, 2), date(2026, 1, 5), closed_holidays=(date(2026, 1, 5),)
    ) == Decimal("1")


def test_half_day_cl_and_same_day_different_halves():
    assert chargeable_days("CL", date(2026, 1, 5), date(2026, 1, 5), half="first") == Decimal("0.5")
    assert not overlaps(
        date(2026, 1, 5),
        date(2026, 1, 5),
        "CL",
        "first",
        date(2026, 1, 5),
        date(2026, 1, 5),
        "CL",
        "second",
    )


def test_vl_conversion_preserves_fraction():
    assert conversion_vl_to_el(Decimal("5.5")) == Decimal("2.75")


def test_invalid_interval_is_rejected():
    with pytest.raises(LeaveRuleError):
        chargeable_days("EL", date(2026, 1, 6), date(2026, 1, 5))
