"""Data models used by the library package."""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import date
from typing import Optional


@dataclass(eq=True, frozen=True)
class Book:
    """A book that can be loaned to a library member."""

    isbn: str
    title: str
    author: str
    published: Optional[date] = None

    def __post_init__(self) -> None:  # type: ignore[override]
        if not self.isbn:
            raise ValueError("ISBN must not be empty")
        if not self.title:
            raise ValueError("Title must not be empty")
        if not self.author:
            raise ValueError("Author must not be empty")


@dataclass(eq=True, frozen=True)
class Member:
    """A member who can borrow books from the library."""

    id: str
    name: str
    email: Optional[str] = None
    joined: date = field(default_factory=date.today)

    def __post_init__(self) -> None:  # type: ignore[override]
        if not self.id:
            raise ValueError("Member id must not be empty")
        if not self.name:
            raise ValueError("Member name must not be empty")
