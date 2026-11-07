from typing import Literal, Any
from pydantic import BaseModel, ConfigDict, Field, StrictBool, model_validator

Status = Literal["Open", "Under review", "Needs more evidence", "Resolved", "Closed"]


class Input(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)


class CaseInput(Input):
    title: str = Field(min_length=1, max_length=100)
    description: str = Field(min_length=1, max_length=1500)
    accountIds: list[str] = Field(default_factory=list, max_length=500)
    commentIds: list[str] = Field(default_factory=list, max_length=500)

    @model_validator(mode="after")
    def associations(self):
        if not self.accountIds and not self.commentIds:
            raise ValueError("Associate at least one account or evidence comment.")
        if any(not v or len(v) > 64 for v in self.accountIds + self.commentIds):
            raise ValueError("Invalid record identifier.")
        self.accountIds = list(dict.fromkeys(self.accountIds))
        self.commentIds = list(dict.fromkeys(self.commentIds))
        return self


class CaseCreate(CaseInput):
    status: Status = "Open"
    decision: str = Field(default="", max_length=1500)

    @model_validator(mode="after")
    def decision_required(self):
        if self.status in ("Closed", "Resolved") and not self.decision:
            raise ValueError("Record a decision before resolving or closing the case.")
        return self


class StatusInput(Input):
    status: Status
    decision: str = Field(default="", max_length=1500)

    @model_validator(mode="after")
    def decision_required(self):
        if self.status in ("Closed", "Resolved") and not self.decision:
            raise ValueError("Record a decision before resolving or closing the case.")
        return self


class NoteInput(Input):
    text: str = Field(min_length=1, max_length=2000)


class ReviewInput(Input):
    reviewed: StrictBool
    reason: str = Field(min_length=1, max_length=2000)


class Profile(BaseModel):
    id: str
    handle: str
    created: str
    bio: str
    devices: list[str]
    provenanceId: str
    provenanceKind: str
    score: int


class Annotation(BaseModel):
    category: str
    method: str
    provenanceId: str


class Comment(BaseModel):
    id: str
    accountId: str
    targetId: str
    text: str
    at: str
    category: str
    source: str
    eventId: str | None = None
    annotations: list[Annotation]
    provenanceId: str
    provenanceKind: str
    reviewed: bool


class Note(BaseModel):
    text: str
    at: str


class Case(BaseModel):
    id: str
    title: str
    description: str
    status: Status
    decision: str
    updatedAt: str
    accountIds: list[str]
    commentIds: list[str]
    notes: list[Note]


class Finding(BaseModel):
    id: str
    runId: str
    accountId: str
    rule: str
    reason: str
    weight: int
    anchorId: str
    commentIds: list[str]


class Device(BaseModel):
    id: str
    name: str
    context: str


class Login(BaseModel):
    id: str
    accountId: str
    deviceId: str
    at: str


class Connection(BaseModel):
    id: str
    source: str
    target: str
    kind: Literal["Device usage", "Coordinated posting"]
    evidence: list[str]
    at: str
    reason: str


class Cluster(BaseModel):
    id: str
    name: str
    members: list[str]
    commentIds: list[str]
    description: str
    kind: str


class Workspace(BaseModel):
    profiles: list[Profile]
    comments: list[Comment]
    devices: list[Device]
    logins: list[Login]
    connections: list[Connection]
    clusters: list[Cluster]
    findings: list[Finding]
    state: dict[str, Any]
    events: list[dict[str, Any]]
    activity: list[dict[str, Any]]
    accounts: list[dict[str, Any]]
    settings: dict[str, Any]
    dashboard: dict[str, Any]


class Page[T](BaseModel):
    items: list[T]
    total: int
    offset: int
    limit: int


class Health(BaseModel):
    status: str
    database: str
    server: str
    version: str
    tables: int
