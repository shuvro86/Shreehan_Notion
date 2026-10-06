"""Email OTP delivery. Console delivery is available only in local development."""
from __future__ import annotations

import os
import html
import httpx
import re
import smtplib
import hashlib
from email.message import EmailMessage


def send_teacher_remarks(student: str, work: dict) -> None:
    """Send only saved remarks to the configured parent; never accept a client recipient."""
    api_key = os.getenv("RESEND_API_KEY", "").strip()
    sender = os.getenv("RESEND_FROM", "").strip()
    if not api_key or not sender:
        raise RuntimeError("Remarks email is unavailable. Configure Resend on the server.")
    text = (f"Teacher remarks for {student}\n\n{work['kind']}: {work['title']}\n"
            f"Subject: {work['subject']}\nDue: {work['due_date']}\nStatus: {work['status']}\n"
            f"Rating: {str(work['score']) + '/10' if work['score'] else 'Not rated'}\n\n{work['remarks']}")
    key = hashlib.sha256(f"{work['id']}:{work['updated_at']}:{text}".encode()).hexdigest()
    try:
        response = httpx.post("https://api.resend.com/emails", headers={"Authorization": f"Bearer {api_key}", "Idempotency-Key": f"teacher-{key}"},
                              json={"from": sender, "to": ["sun.srs86@gmail.com"], "subject": "Teacher remarks — Shreehan HQ", "text": text}, timeout=15)
        response.raise_for_status()
        result = response.json()
        if not isinstance(result, dict) or not result.get("id"):
            raise ValueError("Missing receipt")
    except (httpx.HTTPError, ValueError):
        raise RuntimeError("Email could not be sent. Your saved remarks are safe; please retry.") from None


def send_code(address: str, code: str, purpose: str) -> str:
    if not re.fullmatch(r"[0-9]{6}", code) or purpose not in {"signup", "password_reset"}:
        raise RuntimeError("Invalid verification request.")
    api_key = os.getenv("RESEND_API_KEY", "").strip()
    sender = os.getenv("RESEND_FROM", "").strip()
    if api_key or sender:
        if not api_key or not sender:
            raise RuntimeError("Email verification is temporarily unavailable. Please try again later.")
        action = "Verify your email" if purpose == "signup" else "Reset your password"
        text = f"{action} for Shreehan HQ. Your code is {code}. It expires in 10 minutes. If you did not request this, ignore this email."
        try:
            response = httpx.post(
                "https://api.resend.com/emails",
                headers={"Authorization": f"Bearer {api_key}"},
                json={"from": sender, "to": [address], "subject": f"{action} — Shreehan HQ",
                      "text": text,
                      "html": f'<div style="font-family:Arial,sans-serif;max-width:480px;margin:auto;padding:24px"><h1>{action}</h1><p>Your Shreehan HQ verification code is:</p><p style="font-size:32px;letter-spacing:6px;font-weight:bold">{html.escape(code)}</p><p>This code expires in 10 minutes. Never share it with anyone.</p><p>If you did not request this, you can ignore this email.</p></div>'},
                timeout=15,
            )
            response.raise_for_status()
            result = response.json()
            if not isinstance(result, dict) or not result.get("id"):
                raise ValueError("Missing delivery receipt")
        except (httpx.HTTPError, ValueError) as exc:
            # Never expose provider bodies, addresses, credentials or codes in errors/logs.
            raise RuntimeError("We could not send your code. Please try again in a minute.") from None
        return "email"
    host = os.getenv("SMTP_HOST")
    if not host:
        if os.getenv("VERCEL") or os.getenv("APP_ENV", "development") != "development":
            raise RuntimeError("Email verification is temporarily unavailable. Please try again later.")
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
