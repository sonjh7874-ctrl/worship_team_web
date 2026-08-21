from typing import Literal

from pydantic import BaseModel

AccountEventType = Literal["display_name_changed", "role_changed", "password_reset"]


class AccountEventItem(BaseModel):
    id: int
    event_type: AccountEventType
    old_value: str | None = None
    new_value: str | None = None
    changed_by_name: str
    created_at: str
