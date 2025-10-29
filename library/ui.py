"""Presentation helpers for rendering library data with themes."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Iterable, List

from .library import Library
from .models import Book, Member

RESET = "\033[0m"


@dataclass(frozen=True)
class Theme:
    """ANSI color theme definition."""

    name: str
    foreground: str
    background: str

    def apply(self, text: str) -> str:
        return f"\033[{self.foreground};{self.background}m{text}{RESET}"


DARK_MONO_THEME = Theme(name="dark-mono", foreground="97", background="40")


def _format_section_header(title: str, *, theme: Theme) -> str:
    return theme.apply(title.upper())


def _format_list(items: Iterable[str]) -> str:
    return "\n".join(f"- {item}" for item in items) or "(none)"


def render_library(library: Library, *, theme: Theme = DARK_MONO_THEME) -> str:
    """Render the library state using the given theme."""

    books: List[Book] = library.list_books()
    members: List[Member] = library.list_members()
    books_section = _format_section_header("Books", theme=theme)
    members_section = _format_section_header("Members", theme=theme)
    books_list = _format_list(f"{book.title} — {book.author} (ISBN {book.isbn})" for book in books)
    members_list = _format_list(f"{member.name} (ID {member.id})" for member in members)
    return f"{books_section}\n{books_list}\n\n{members_section}\n{members_list}"
