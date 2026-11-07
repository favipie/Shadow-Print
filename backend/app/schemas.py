from datetime import UTC, datetime
from typing import Annotated, Any, Literal

from pydantic import (
    AwareDatetime,
    BaseModel,
    ConfigDict,
    Field,
    StrictBool,
    StringConstraints,
    model_validator,
)

Identifier = Annotated[
    str,
    StringConstraints(
        strip_whitespace=True, min_length=1, max_length=64, pattern=r"^[A-Za-z0-9_-]+$"
    ),
]
NonBlank = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1)]
CaseStatus = Literal["Open", "Under review", "Needs more evidence", "Resolved", "Closed"]


class Input(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)


class Page(Input):
    limit: int = Field(default=50, ge=1, le=100)
    offset: int = Field(default=0, ge=0, le=100_000)


class CommentFilter(Page):
    q: str = Field(default="", max_length=200)
    account_id: Identifier | None = None
    target_id: Identifier | None = None
    provenance_id: Identifier | None = None
    category: str | None = Field(default=None, max_length=64)
    label_method: (
        Literal["Authored label", "Rule example", "Public dataset", "Human review"] | None
    ) = None
    reviewed: bool | None = None
    since: AwareDatetime | None = None
    until: AwareDatetime | None = None

    @model_validator(mode="after")
    def date_order(self):
        if self.since and self.until and self.since > self.until:
            raise ValueError("since must be before or equal to until")
        return self


class AccountFilter(Page):
    q: str = Field(default="", max_length=200)
    provenance_id: Identifier | None = None


class CaseFilter(Page):
    q: str = Field(default="", max_length=200)
    status: CaseStatus | None = None


class CaseWrite(Input):
    title: Annotated[NonBlank, Field(max_length=255)]
    description: str = Field(default="", max_length=10_000)
    status: CaseStatus = "Open"
    decision: str = Field(default="", max_length=10_000)
    account_ids: list[Identifier] = Field(default_factory=list, max_length=100)
    evidence_ids: list[Identifier] = Field(default_factory=list, max_length=200)
    finding_ids: list[Identifier] = Field(default_factory=list, max_length=100)

    @model_validator(mode="after")
    def consistent(self):
        if self.status in ("Resolved", "Closed") and not self.decision:
            raise ValueError("Resolved and closed cases require a decision")
        for field in ("account_ids", "evidence_ids", "finding_ids"):
            ids = getattr(self, field)
            if len(ids) != len(set(ids)):
                raise ValueError(f"Duplicate values in {field}")
        return self


class CaseUpdate(CaseWrite):
    expected_updated_at: AwareDatetime


class NoteWrite(Input):
    body: Annotated[NonBlank, Field(max_length=10_000)]


class ReviewWrite(Input):
    reviewed: StrictBool
    reason: Annotated[NonBlank, Field(max_length=5000)]


class DetectionWrite(Input):
    id: Identifier


class Collection(BaseModel):
    items: list[dict[str, Any]]
    total: int
    limit: int
    offset: int


def utc_naive(value: datetime) -> datetime:
    return value.astimezone(UTC).replace(tzinfo=None)


def wire(value: Any) -> Any:
    """Serialize database timestamps explicitly as UTC, including nested records."""
    if isinstance(value, datetime):
        if value.tzinfo is None:
            value = value.replace(tzinfo=UTC)
        return value.astimezone(UTC).isoformat(timespec="milliseconds").replace("+00:00", "Z")
    if isinstance(value, dict):
        return {key: wire(item) for key, item in value.items()}
    if isinstance(value, (list, tuple)):
        return [wire(item) for item in value]
    return value
