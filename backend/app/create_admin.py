"""Create an admin account (admins can't self-register).

Usage: python -m app.create_admin admin@hiredove.com "Admin Name"
The password is read interactively so it never lands in shell history.
"""

import getpass
import sys

from sqlalchemy import select

from app.core.database import SessionLocal
from app.core.security import hash_password
from app.models.user import User, UserRole


def main() -> None:
    if len(sys.argv) != 3:
        sys.exit(__doc__)
    email, full_name = sys.argv[1].lower(), sys.argv[2]
    password = getpass.getpass("Password: ")
    if len(password) < 8:
        sys.exit("Password must be at least 8 characters")

    with SessionLocal() as db:
        if db.scalar(select(User).where(User.email == email)):
            sys.exit(f"{email} already exists")
        db.add(User(email=email, full_name=full_name, role=UserRole.admin,
                    hashed_password=hash_password(password)))
        db.commit()
    print(f"Admin {email} created")


if __name__ == "__main__":
    main()
