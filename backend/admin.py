"""Account role administration. Historic teacher rows remain as coursework references."""
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from backend.auth import current_user
from backend.db import connection

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


@router.get("/users")
def list_users(_user=Depends(admin_only)):
    with connection() as db:
        return {"users": accounts(db), "selfId": _user["id"]}


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
        if body.role == "teacher":
            db.execute("INSERT OR IGNORE INTO teachers (user_id) VALUES (?)", (user_id,))
        db.execute("INSERT INTO account_roles (user_id,role) VALUES (?,?) ON CONFLICT(user_id) DO UPDATE SET role=excluded.role", (user_id, body.role))
        db.execute("DELETE FROM sessions WHERE user_id=?", (user_id,))
        return {"users": accounts(db)}
