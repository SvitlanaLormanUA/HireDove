"""Best-effort post-commit email; logs never include addresses, bodies or credentials."""
import logging
import smtplib
import ssl
from email.message import EmailMessage

from app.core.config import get_settings

logger = logging.getLogger("hiredove.email")


def send_email(recipient: str, title: str, message: str) -> bool:
    settings = get_settings()
    if settings.email_mode == "console":
        logger.info("Development email suppressed")
        return True
    try:
        email = EmailMessage()
        email["From"] = settings.smtp_from
        email["To"] = recipient
        email["Subject"] = title
        email.set_content(message)
        with smtplib.SMTP(settings.smtp_host, settings.smtp_port, timeout=10) as smtp:
            if settings.smtp_starttls:
                smtp.starttls(context=ssl.create_default_context())
            if settings.smtp_username:
                smtp.login(settings.smtp_username, settings.smtp_password.get_secret_value())
            smtp.send_message(email)
        return True
    except Exception:
        # Deliberately omit exception text, which providers can fill with private data.
        logger.warning("Email delivery failed; committed notification remains available")
        return False
