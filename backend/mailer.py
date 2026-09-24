"""Email OTP delivery. Console delivery is available only in local development."""
from __future__ import annotations

import os
import smtplib
from email.message import EmailMessage


def send_code(address: str, code: str, purpose: str) -> str:
    host = os.getenv("SMTP_HOST")
    if not host:
        if os.getenv("APP_ENV", "development") != "development":
            raise RuntimeError("SMTP_HOST must be configured outside local development")
        print(f"[LOCAL OTP] {purpose} for {address}: {code}", flush=True)
        return "development_log"
    message = EmailMessage()
    message["From"] = os.getenv("SMTP_FROM", "Shreehan HQ <noreply@localhost>")
    message["To"] = address
    message["Subject"] = "Your Shreehan HQ verification code"
    message.set_content(f"Your Shreehan HQ code is {code}. It expires in 10 minutes. If you did not request this, ignore this email.")
    port = int(os.getenv("SMTP_PORT", "587"))
    try:
        transport = smtplib.SMTP_SSL if port == 465 else smtplib.SMTP
        with transport(host, port, timeout=15) as client:
            if port != 465:
                client.starttls()
            username = os.getenv("SMTP_USERNAME")
            if username:
                client.login(username, os.getenv("SMTP_PASSWORD", ""))
            client.send_message(message)
    except (OSError, smtplib.SMTPException) as exc:
        raise RuntimeError("Email delivery failed. Check the server SMTP settings and try again.") from exc
    return "email"
