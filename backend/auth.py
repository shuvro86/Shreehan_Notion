"""Username/password authentication with email OTP enrollment and recovery."""
from __future__ import annotations

import hashlib
import hmac
import re
import secrets
import sqlite3
import uuid
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, Request, Response
from pydantic import BaseModel, Field
from typing import Literal

from backend.db import connection, create_starter_data, now
from backend.mailer import send_code

auth_router = APIRouter(prefix="/api/auth", tags=["authentication"])
COOKIE = "shreehan_session"


def utc_after(minutes=0, days=0):
    return (datetime.now(timezone.utc) + timedelta(minutes=minutes, days=days)).isoformat()


def hash_password(password: str) -> str:
    salt = secrets.token_bytes(16)
    digest = hashlib.pbkdf2_hmac("sha256", password.encode(), salt, 600_000)
    return f"pbkdf2_sha256$600000${salt.hex()}${digest.hex()}"


def check_password(password: str, stored: str) -> bool:
    try:
        algorithm, rounds, salt, digest = stored.split("$")
        if algorithm != "pbkdf2_sha256":
            return False
        actual = hashlib.pbkdf2_hmac("sha256", password.encode(), bytes.fromhex(salt), int(rounds))
        return hmac.compare_digest(actual, bytes.fromhex(digest))
    except (ValueError, AttributeError):
        return False


def hash_code(challenge_id: str, code: str) -> str:
    return hashlib.pbkdf2_hmac("sha256", code.encode(), challenge_id.encode(), 120_000).hex()


def token_hash(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()


def session_for(db, response: Response, user_id: str):
    token = secrets.token_urlsafe(32)
    expiry = utc_after(days=7)
    db.execute("INSERT INTO sessions VALUES (?,?,?,?)", (token_hash(token), user_id, expiry, now()))
    response.set_cookie(COOKIE, token, httponly=True, secure=__import__("os").getenv("APP_ENV") == "production", samesite="lax", max_age=7 * 86400, path="/")


def current_user(request: Request):
    token = request.cookies.get(COOKIE)
    if not token:
        raise HTTPException(401, "Please sign in to continue.")
    with connection() as db:
        row = db.execute("SELECT users.id,users.username,users.email FROM sessions JOIN users ON users.id=sessions.user_id WHERE sessions.token_hash=? AND sessions.expires_at>? AND users.verified_at IS NOT NULL", (token_hash(token), now())).fetchone()
    if not row:
        raise HTTPException(401, "Your session has expired. Please sign in again.")
    return dict(row)


class Signup(BaseModel):
    username: str = Field(min_length=3, max_length=32)
    email: str = Field(min_length=5, max_length=254)


class EmailCode(BaseModel):
    email: str
    code: str = Field(pattern=r"^[0-9]{6}$")


class PasswordTicket(BaseModel):
    ticket: str
    password: str = Field(min_length=6, max_length=256)


class Login(BaseModel):
    username: str
    password: str


class ChangePassword(BaseModel):
    new_password: str = Field(min_length=6, max_length=256)
    confirm_password: str


class EmailOnly(BaseModel):
    email: str


class ResendCode(BaseModel):
    email: str
    purpose: Literal["signup", "password_reset"]


def new_challenge(db, user_id: str, purpose: str, email: str):
    code = f"{secrets.randbelow(1_000_000):06d}"
    challenge_id = str(uuid.uuid4())
    db.execute("DELETE FROM otp_challenges WHERE user_id=? AND purpose=?", (user_id, purpose))
    db.execute("INSERT INTO otp_challenges VALUES (?,?,?,?,?,?,?,?)", (challenge_id, user_id, purpose, hash_code(challenge_id, code), utc_after(minutes=10), 0, None, now()))
    try:
        return send_code(email, code, purpose)
    except RuntimeError as exc:
        raise HTTPException(503, str(exc)) from exc


@auth_router.post("/resend-code")
def resend_code(body: ResendCode):
    delivery = None
    with connection() as db:
        row = db.execute("SELECT id,email,verified_at FROM users WHERE email=? COLLATE NOCASE", (body.email.strip(),)).fetchone()
        eligible = row and (body.purpose == "signup") == (row["verified_at"] is None)
        if eligible:
            latest = db.execute("SELECT created_at FROM otp_challenges WHERE user_id=? AND purpose=? ORDER BY created_at DESC LIMIT 1", (row["id"], body.purpose)).fetchone()
            if latest and datetime.fromisoformat(latest["created_at"]) > datetime.now(timezone.utc) - timedelta(seconds=60):
                raise HTTPException(429, "Please wait a minute before requesting another code.")
            delivery = new_challenge(db, row["id"], body.purpose, row["email"])
    return {"message": "If this email can receive a code, a new one is on its way.", "delivery": delivery}


def verify_code(db, email: str, code: str, purpose: str):
    row = db.execute("SELECT otp_challenges.* FROM otp_challenges JOIN users ON users.id=otp_challenges.user_id WHERE users.email=? COLLATE NOCASE AND purpose=? ORDER BY created_at DESC LIMIT 1", (email.strip(), purpose)).fetchone()
    if not row or row["consumed_at"] or row["expires_at"] <= now() or row["attempts"] >= 5:
        raise HTTPException(400, "The code is invalid or expired. Request a new one.")
    db.execute("UPDATE otp_challenges SET attempts=attempts+1 WHERE id=?", (row["id"],))
    if not hmac.compare_digest(hash_code(row["id"], code), row["code_hash"]):
        return None
    db.execute("UPDATE otp_challenges SET consumed_at=? WHERE id=?", (now(), row["id"]))
    return row["id"]


@auth_router.post("/signup")
def signup(body: Signup):
    username, email = body.username.strip(), body.email.strip().lower()
    if not re.fullmatch(r"[A-Za-z0-9_]{3,32}", username) or not re.fullmatch(r"[^\s@]+@[^\s@]+\.[^\s@]+", email):
        raise HTTPException(400, "Use a username of 3–32 letters, numbers, or underscores and a valid email.")
    with connection() as db:
        try:
            user_id = str(uuid.uuid4())
            db.execute("INSERT INTO users VALUES (?,?,?,?,?,?)", (user_id, username, email, None, None, now()))
            delivery = new_challenge(db, user_id, "signup", email)
        except sqlite3.IntegrityError:
            raise HTTPException(409, "That username or email is already registered.")
    return {"message": "Verification code sent." if delivery == "email" else "Development code written to the server log; email is not configured.", "delivery": delivery}


@auth_router.post("/verify-signup")
def verify_signup(body: EmailCode):
    with connection() as db:
        ticket = verify_code(db, body.email, body.code, "signup")
    if not ticket:
        raise HTTPException(400, "The code is invalid or expired. Request a new one.")
    return {"ticket": ticket}


def ticket_user(db, ticket: str, purpose: str):
    row = db.execute("SELECT user_id FROM otp_challenges WHERE id=? AND purpose=? AND consumed_at IS NOT NULL AND expires_at>?", (ticket, purpose, now())).fetchone()
    if not row:
        raise HTTPException(400, "Verification expired. Please request a new code.")
    return row["user_id"]


@auth_router.post("/set-password")
def set_password(body: PasswordTicket, response: Response):
    with connection() as db:
        user_id = ticket_user(db, body.ticket, "signup")
        db.execute("UPDATE users SET password_hash=?, verified_at=? WHERE id=? AND verified_at IS NULL", (hash_password(body.password), now(), user_id))
        if db.execute("SELECT changes()").fetchone()[0] != 1:
            raise HTTPException(400, "This account is already active.")
        create_starter_data(db, user_id)
        db.execute("DELETE FROM otp_challenges WHERE id=?", (body.ticket,))
        session_for(db, response, user_id)
    return {"message": "Account ready."}


@auth_router.post("/login")
def login(body: Login, response: Response):
    with connection() as db:
        row = db.execute("SELECT id,password_hash FROM users WHERE username=? COLLATE NOCASE AND verified_at IS NOT NULL", (body.username.strip(),)).fetchone()
        if not row or not check_password(body.password, row["password_hash"]):
            raise HTTPException(401, "Username or password is incorrect.")
        session_for(db, response, row["id"])
    return {"message": "Signed in."}


@auth_router.post("/change-password")
def change_password(body: ChangePassword, request: Request, user=Depends(current_user)):
    if body.new_password != body.confirm_password:
        raise HTTPException(400, "New passwords do not match.")
    with connection() as db:
        row = db.execute("SELECT password_hash FROM users WHERE id=?", (user["id"],)).fetchone()
        if not row:
            raise HTTPException(401, "Please sign in to continue.")
        if check_password(body.new_password, row["password_hash"]):
            raise HTTPException(400, "Choose a different new password.")
        db.execute("UPDATE users SET password_hash=? WHERE id=?", (hash_password(body.new_password), user["id"]))
        current_token = request.cookies.get(COOKIE)
        db.execute("DELETE FROM sessions WHERE user_id=? AND token_hash<>?", (user["id"], token_hash(current_token or "")))
    return {"message": "Password changed."}


@auth_router.post("/forgot-password")
def forgot_password(body: EmailOnly):
    with connection() as db:
        row = db.execute("SELECT id,email FROM users WHERE email=? COLLATE NOCASE AND verified_at IS NOT NULL", (body.email.strip(),)).fetchone()
        if row:
            new_challenge(db, row["id"], "password_reset", row["email"])
    return {"message": "If this email has an account, a code is on its way."}


@auth_router.post("/verify-reset")
def verify_reset(body: EmailCode):
    with connection() as db:
        ticket = verify_code(db, body.email, body.code, "password_reset")
    if not ticket:
        raise HTTPException(400, "The code is invalid or expired. Request a new one.")
    return {"ticket": ticket}


@auth_router.post("/reset-password")
def reset_password(body: PasswordTicket):
    with connection() as db:
        user_id = ticket_user(db, body.ticket, "password_reset")
        db.execute("UPDATE users SET password_hash=? WHERE id=?", (hash_password(body.password), user_id))
        db.execute("DELETE FROM sessions WHERE user_id=?", (user_id,))
        db.execute("DELETE FROM otp_challenges WHERE id=?", (body.ticket,))
    return {"message": "Password updated."}


@auth_router.get("/me")
def me(user=Depends(current_user)):
    return user


@auth_router.post("/logout")
def logout(request: Request, response: Response):
    token = request.cookies.get(COOKIE)
    if token:
        with connection() as db:
            db.execute("DELETE FROM sessions WHERE token_hash=?", (token_hash(token),))
    response.delete_cookie(COOKIE, path="/")
    return {"message": "Signed out."}
