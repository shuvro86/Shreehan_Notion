"""Account role administration. Historic teacher rows remain as coursework references."""
import re
import sqlite3
from uuid import uuid4
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field, field_validator

from backend.auth import current_user, hash_password
from backend.db import connection, create_starter_data, now
from backend.menu_access import MENU_ITEMS, menu_settings, set_menu

router = APIRouter(prefix="/api/admin", tags=["administration"])


def admin_only(user=Depends(current_user)):
    if user["role"] != "admin":
        raise HTTPException(403, "Administrator access required.")
    return user


def accounts(db):
    return [dict(row) for row in db.execute("""
        SELECT users.id, users.username, users.email, users.verified_at IS NOT NULL AS active,
            COALESCE(account_roles.role, CASE WHEN teachers.user_id IS NOT NULL THEN 'teacher' ELSE 'student' END) AS role
        FROM users LEFT JOIN account_roles ON account_roles.user_id=users.id
        LEFT JOIN teachers ON teachers.user_id=users.id ORDER BY users.username
    """)]


def validate_identity(username: str, email: str):
    username, email = username.strip(), email.strip().lower()
    if not re.fullmatch(r"[A-Za-z0-9_]{3,32}", username) or not re.fullmatch(r"[^\s@]+@[^\s@]+\.[^\s@]+", email):
        raise ValueError("Use a username of 3–32 letters, numbers, or underscores and a valid email.")
    return username, email


class AccountCreate(BaseModel):
    username: str = Field(min_length=3, max_length=32)
    email: str = Field(min_length=5, max_length=254)
    password: str = Field(min_length=6, max_length=256)
    role: Literal["student", "teacher", "admin"] = "student"

    @field_validator("username", "email")
    @classmethod
    def trim(cls, value):
        return value.strip()


class AccountUpdate(BaseModel):
    username: str = Field(min_length=3, max_length=32)
    email: str = Field(min_length=5, max_length=254)
    role: Literal["student", "teacher", "admin"]
    password: str | None = Field(default=None, min_length=6, max_length=256)


def assign_role(db, user_id: str, role: str):
    if role == "teacher":
        db.execute("INSERT OR IGNORE INTO teachers (user_id) VALUES (?)", (user_id,))
    db.execute("INSERT INTO account_roles (user_id,role) VALUES (?,?) ON CONFLICT(user_id) DO UPDATE SET role=excluded.role", (user_id, role))


@router.get("/users")
def list_users(_user=Depends(admin_only)):
    with connection() as db:
        return {"users": accounts(db), "selfId": _user["id"]}


@router.get("/menu-access")
def list_menu_access(_actor=Depends(admin_only)):
    with connection() as db:
        return {"roles": {role: menu_settings(db, role) for role in MENU_ITEMS}}


class MenuChange(BaseModel):
    role: Literal["student", "teacher", "admin"]
    menu_key: str
    enabled: bool


@router.put("/menu-access")
def change_menu_access(body: MenuChange, _actor=Depends(admin_only)):
    with connection() as db:
        set_menu(db, body.role, body.menu_key, body.enabled)
        return {"roles": {role: menu_settings(db, role) for role in MENU_ITEMS}}


@router.get("/feedback")
def teacher_feedback(_actor=Depends(admin_only)):
    with connection() as db:
        items = [dict(row) for row in db.execute("""
            SELECT f.id,f.day,f.body,f.created_at,f.updated_at,f.read_at,u.username AS teacher_name
            FROM daily_teacher_feedback f JOIN users u ON u.id=f.teacher_id
            ORDER BY f.updated_at DESC LIMIT 100
        """)]
        unread = db.execute("SELECT COUNT(*) AS count FROM daily_teacher_feedback WHERE read_at IS NULL").fetchone()["count"]
    return {"items": items, "unread": unread}


@router.put("/feedback/{feedback_id}/read")
def read_teacher_feedback(feedback_id: str, _actor=Depends(admin_only)):
    with connection() as db:
        if not db.execute("SELECT id FROM daily_teacher_feedback WHERE id=?", (feedback_id,)).fetchone():
            raise HTTPException(404, "Update not found.")
        db.execute("UPDATE daily_teacher_feedback SET read_at=COALESCE(read_at,?) WHERE id=?", (now(), feedback_id))
    return {"message": "Update marked as read."}


@router.post("/users", status_code=201)
def create_user(body: AccountCreate, _actor=Depends(admin_only)):
    try:
        username, email = validate_identity(body.username, body.email)
    except ValueError as exc:
        raise HTTPException(400, str(exc)) from None
    with connection() as db:
        user_id, timestamp = str(uuid4()), now()
        try:
            db.execute("INSERT INTO users (id,username,email,password_hash,verified_at,created_at) VALUES (?,?,?,?,?,?)", (user_id, username, email, hash_password(body.password), timestamp, timestamp))
            create_starter_data(db, user_id)
            assign_role(db, user_id, body.role)
        except sqlite3.IntegrityError:
            raise HTTPException(409, "That username or email is already registered.") from None
        return {"users": accounts(db), "id": user_id}


@router.put("/users/{user_id}")
def update_user(user_id: str, body: AccountUpdate, actor=Depends(admin_only)):
    if user_id == actor["id"]:
        raise HTTPException(400, "Use Setup to change your own password. Your administrator account cannot be edited here.")
    try:
        username, email = validate_identity(body.username, body.email)
    except ValueError as exc:
        raise HTTPException(400, str(exc)) from None
    with connection() as db:
        if not db.execute("SELECT id FROM users WHERE id=?", (user_id,)).fetchone():
            raise HTTPException(404, "Account not found.")
        try:
            if body.password:
                db.execute("UPDATE users SET username=?,email=?,password_hash=? WHERE id=?", (username, email, hash_password(body.password), user_id))
            else:
                db.execute("UPDATE users SET username=?,email=? WHERE id=?", (username, email, user_id))
            assign_role(db, user_id, body.role)
        except sqlite3.IntegrityError:
            raise HTTPException(409, "That username or email is already registered.") from None
        db.execute("DELETE FROM sessions WHERE user_id=?", (user_id,))
        return {"users": accounts(db)}


@router.delete("/users/{user_id}")
def delete_user(user_id: str, actor=Depends(admin_only)):
    if user_id == actor["id"]:
        raise HTTPException(400, "You cannot delete your own administrator account.")
    with connection() as db:
        if not db.execute("SELECT id FROM users WHERE id=?", (user_id,)).fetchone():
            raise HTTPException(404, "Account not found.")
        db.execute("DELETE FROM coursework WHERE teacher_id=? OR student_id=?", (user_id, user_id))
        db.execute("DELETE FROM users WHERE id=?", (user_id,))
        return {"users": accounts(db)}


class RoleChange(BaseModel):
    role: Literal["student", "teacher", "admin"]


@router.put("/users/{user_id}/role")
def set_role(user_id: str, body: RoleChange, actor=Depends(admin_only)):
    if user_id == actor["id"]:
        raise HTTPException(400, "You cannot change your own administrator role.")
    with connection() as db:
        target = db.execute("SELECT id,verified_at FROM users WHERE id=?", (user_id,)).fetchone()
        if not target:
            raise HTTPException(404, "Account not found.")
        if target["verified_at"] is None:
            raise HTTPException(400, "Activate this account before assigning a role.")
        assign_role(db, user_id, body.role)
        db.execute("DELETE FROM sessions WHERE user_id=?", (user_id,))
        return {"users": accounts(db)}
