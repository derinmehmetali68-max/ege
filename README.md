# ege Library Management Toolkit

This repository contains a simple, fully-tested Python module that can be used to
manage a small library. It ships with a dark monochrome theme for presenting the
catalogue in a terminal and supports the following tasks:

- Registering and removing members.
- Adding books to the catalogue and removing them when they are not on loan.
- Loaning books to members and returning them later.
- Listing books and members in a deterministic order.
- Checking whether a loaned book is overdue.

## Getting started

1. Create and activate a virtual environment (optional but recommended).
2. Install the project dependencies:

   ```bash
   pip install -r requirements-dev.txt
   ```

3. Run the test-suite to confirm everything works:

   ```bash
   pytest
   ```

## Example

```python
from datetime import date

from library import Book, Library, Member, render_library

library = Library()
library.add_book(Book(isbn="9780140449136", title="The Odyssey", author="Homer"))
library.register_member(Member(id="42", name="Ada"))

due_date = library.loan_book("9780140449136", "42", loan_date=date(2024, 1, 1))
print(f"Due on {due_date}")

print(render_library(library))  # renders with the default dark monochrome theme
```

## Development dependencies

The tests rely on `pytest`. Development dependencies are listed in
`requirements-dev.txt`.
