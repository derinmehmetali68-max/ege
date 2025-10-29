from datetime import date, timedelta

import pytest

from library import (
    Book,
    DARK_MONO_THEME,
    Library,
    Member,
    Theme,
    render_library,
)


def sample_book(isbn: str = "123") -> Book:
    return Book(isbn=isbn, title="Sample", author="Author")


def sample_member(member_id: str = "m1") -> Member:
    return Member(id=member_id, name="Member")


@pytest.fixture
def library() -> Library:
    lib = Library(loan_period_days=7)
    lib.add_book(sample_book())
    lib.register_member(sample_member())
    return lib


def test_loan_and_return(library: Library) -> None:
    due_date = library.loan_book("123", "m1", loan_date=date(2024, 1, 1))
    assert due_date == date(2024, 1, 8)
    assert library.get_member_loans("m1") == [sample_book()]

    library.return_book("123")
    assert library.get_member_loans("m1") == []


def test_is_overdue(library: Library) -> None:
    library.loan_book("123", "m1", loan_date=date(2024, 1, 1))
    assert library.is_overdue("123", on_date=date(2024, 1, 8)) is False
    assert library.is_overdue("123", on_date=date(2024, 1, 9)) is True


def test_cannot_loan_unknown_book(library: Library) -> None:
    with pytest.raises(KeyError):
        library.loan_book("999", "m1")


def test_cannot_register_duplicate_member(library: Library) -> None:
    with pytest.raises(ValueError):
        library.register_member(sample_member())


def test_listings_sorted() -> None:
    lib = Library()
    lib.add_books(
        [
            Book(isbn="1", title="b title", author="a"),
            Book(isbn="2", title="A Title", author="a"),
        ]
    )
    lib.register_member(Member(id="2", name="Bob"))
    lib.register_member(Member(id="1", name="alice"))

    assert [book.title for book in lib.list_books()] == ["A Title", "b title"]
    assert [member.name for member in lib.list_members()] == ["alice", "Bob"]


def test_theme_application() -> None:
    theme = Theme(name="test", foreground="37", background="40")
    assert theme.apply("hello").startswith("\033[37;40mhello")
    assert theme.apply("hello").endswith("\033[0m")


def test_render_library_uses_dark_theme(library: Library) -> None:
    output = render_library(library)
    assert DARK_MONO_THEME.foreground in output
    assert "BOOKS" in output
