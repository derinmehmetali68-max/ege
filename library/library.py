"""Library class that manages books and loans."""

from __future__ import annotations

from collections import defaultdict
from datetime import date
from typing import Dict, Iterable, List, Optional, Set

from .models import Book, Member


class Library:
    """A simple in-memory library implementation."""

    def __init__(self, *, loan_period_days: int = 14) -> None:
        if loan_period_days <= 0:
            raise ValueError("Loan period must be positive")
        self._loan_period = loan_period_days
        self._books: Dict[str, Book] = {}
        self._members: Dict[str, Member] = {}
        self._loans: Dict[str, str] = {}
        self._member_loans: Dict[str, Set[str]] = defaultdict(set)
        self._due_dates: Dict[str, date] = {}

    @property
    def loan_period_days(self) -> int:
        """Return the maximum loan period in days."""

        return self._loan_period

    def register_member(self, member: Member) -> None:
        """Register a new member with the library."""

        if member.id in self._members:
            raise ValueError(f"Member {member.id} already registered")
        self._members[member.id] = member

    def unregister_member(self, member_id: str) -> None:
        """Remove a member from the library if they have no active loans."""

        if self._member_loans.get(member_id):
            raise ValueError("Member has active loans and cannot be removed")
        self._members.pop(member_id, None)

    def add_books(self, books: Iterable[Book]) -> None:
        """Add multiple books to the library."""

        for book in books:
            self.add_book(book)

    def add_book(self, book: Book) -> None:
        """Add a single book to the library."""

        if book.isbn in self._books:
            raise ValueError(f"Book {book.isbn} already exists")
        self._books[book.isbn] = book

    def remove_book(self, isbn: str) -> None:
        """Remove a book from the library if it is not loaned."""

        if isbn in self._loans:
            raise ValueError("Cannot remove a book that is currently loaned")
        self._books.pop(isbn, None)

    def loan_book(self, isbn: str, member_id: str, *, loan_date: Optional[date] = None) -> date:
        """Loan a book to a member and return the due date."""

        if isbn not in self._books:
            raise KeyError(f"Unknown book {isbn}")
        if member_id not in self._members:
            raise KeyError(f"Unknown member {member_id}")
        if isbn in self._loans:
            raise ValueError("Book already loaned")
        loan_date = loan_date or date.today()
        due_date = loan_date + self._loan_period_delta
        self._loans[isbn] = member_id
        self._member_loans[member_id].add(isbn)
        self._due_dates[isbn] = due_date
        return due_date

    def return_book(self, isbn: str) -> None:
        """Return a previously loaned book."""

        member_id = self._loans.pop(isbn, None)
        if member_id is None:
            raise KeyError(f"Book {isbn} is not currently loaned")
        self._member_loans[member_id].discard(isbn)
        self._due_dates.pop(isbn, None)

    def get_member_loans(self, member_id: str) -> List[Book]:
        """Return a list of books currently loaned by the member."""

        if member_id not in self._members:
            raise KeyError(f"Unknown member {member_id}")
        return [self._books[isbn] for isbn in sorted(self._member_loans.get(member_id, set()))]

    def list_books(self) -> List[Book]:
        """Return a list of all books sorted by title."""

        return sorted(self._books.values(), key=lambda book: book.title.lower())

    def list_members(self) -> List[Member]:
        """Return a list of registered members sorted by name."""

        return sorted(self._members.values(), key=lambda member: member.name.lower())

    def books_on_loan(self) -> Dict[Book, Member]:
        """Return a mapping of books currently on loan to their members."""

        return {self._books[isbn]: self._members[member_id] for isbn, member_id in self._loans.items()}

    def is_overdue(self, isbn: str, on_date: Optional[date] = None) -> bool:
        """Return whether the specified book is overdue."""

        if isbn not in self._loans:
            raise KeyError(f"Book {isbn} is not currently loaned")
        on_date = on_date or date.today()
        due_date = self._due_dates[isbn]
        return on_date > due_date

    @property
    def _loan_period_delta(self):
        from datetime import timedelta

        return timedelta(days=self._loan_period)
