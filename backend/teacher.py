"""Teacher-managed work and student-owned submissions, shared by SQLite and Turso."""
from datetime import date
import sqlite3
from typing import Literal
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field, field_validator

from backend.auth import current_user
from backend.db import connection, now
from backend.content import current_library
from backend.mailer import send_teacher_remarks

router = APIRouter(prefix="/api/coursework", tags=["coursework"])
SUBJECTS = ["Mathematics", "Bangla 1", "Bangla 2", "Bangladesh Studies", "English Language",
            "English Dictation & Spelling", "English Literature", "History", "Geography", "Science", "Poetry"]


def teacher_only(user=Depends(current_user)):
    if user["role"] != "teacher":
        raise HTTPException(403, "Teacher access required.")
    return user


def owned(db, item_id, user):
    key = "teacher_id" if user["role"] == "teacher" else "student_id"
    row = db.execute(f"SELECT * FROM coursework WHERE id=? AND {key}=?", (item_id, user["id"])).fetchone()
    if not row:
        raise HTTPException(404, "Work not found.")
    return dict(row)


def source_items():
    library = current_library()
    items = [{"id": "homework:" + i["id"], "title": i["title"], "instructions": i["title"],
              "kind": "Homework", "url": i.get("notionUrl", ""), "subject": ""}
             for i in library.get("homework", {}).get("items", [])]
    items += [{"id": "record:" + r["id"], "title": r["title"], "instructions": r.get("body", ""),
               "kind": r["collection"], "url": r.get("url", ""), "subject": r.get("subject", "")}
              for r in library.get("records", []) if r.get("collection") in ("Assignment", "Homework")]
    return items


@router.get("")
def list_work(user=Depends(current_user)):
    teacher = user["role"] == "teacher"
    key = "teacher_id" if teacher else "student_id"
    with connection() as db:
        items = [dict(r) for r in db.execute(f"SELECT c.*,u.username AS student_name FROM coursework c JOIN users u ON u.id=c.student_id WHERE c.{key}=? ORDER BY c.due_date DESC,c.created_at DESC", (user["id"],))]
        students = [dict(r) for r in db.execute("SELECT id,username FROM users WHERE verified_at IS NOT NULL AND id NOT IN (SELECT user_id FROM teachers) ORDER BY username")] if teacher else []
    return {"role": user["role"], "items": items, "students": students, "subjects": SUBJECTS}


@router.get("/sources")
def sources(user=Depends(teacher_only)):
    return {"items": source_items()}


class Work(BaseModel):
    student_id: str
    kind: Literal["Homework", "Assignment"]
    subject: str
    title: str = Field(min_length=1, max_length=200)
    instructions: str = Field(default="", max_length=10000)
    due_date: date
    source_id: str | None = Field(default=None, max_length=200)

    @field_validator("title")
    @classmethod
    def clean_title(cls, value):
        if not value.strip():
            raise ValueError("Enter a title.")
        return value.strip()

    @field_validator("subject")
    @classmethod
    def valid_subject(cls, value):
        if value not in SUBJECTS:
            raise ValueError("Choose a listed subject.")
        return value


class ClassTask(BaseModel):
    """A task created without a student picker goes to every active student."""
    kind: Literal["Homework", "Assignment"]
    subject: str
    title: str = Field(min_length=1, max_length=200)
    instructions: str = Field(default="", max_length=10000)
    due_date: date

    @field_validator("title")
    @classmethod
    def clean_title(cls, value):
        return Work.clean_title(value)

    @field_validator("subject")
    @classmethod
    def valid_subject(cls, value):
        return Work.valid_subject(value)


@router.post("/class-task", status_code=201)
def create_class_task(body: ClassTask, user=Depends(teacher_only)):
    """Fan out one teacher task atomically, preserving student-owned reviews."""
    with connection() as db:
        students = db.execute("SELECT id FROM users WHERE verified_at IS NOT NULL AND id NOT IN (SELECT user_id FROM teachers) ORDER BY id").fetchall()
        if not students:
            raise HTTPException(409, "An active student account is needed before creating a task.")
        timestamp = now()
        ids = []
        for student in students:
            item_id = str(uuid4())
            db.execute("INSERT INTO coursework (id,teacher_id,student_id,kind,subject,title,instructions,due_date,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?)",
                       (item_id, user["id"], student["id"], body.kind, body.subject, body.title, body.instructions, body.due_date.isoformat(), timestamp, timestamp))
            ids.append(item_id)
    return {"count": len(ids), "ids": ids}


@router.post("", status_code=201)
def create_work(body: Work, user=Depends(teacher_only)):
    source_url = ""
    if body.source_id:
        source = next((i for i in source_items() if i["id"] == body.source_id), None)
        if not source or source["kind"] != body.kind:
            raise HTTPException(400, "Choose an available source of the same work type.")
        source_url = source["url"]
    with connection() as db:
        if not db.execute("SELECT id FROM users WHERE id=? AND verified_at IS NOT NULL AND id NOT IN (SELECT user_id FROM teachers)", (body.student_id,)).fetchone():
            raise HTTPException(400, "Choose an active student.")
        item_id, timestamp = str(uuid4()), now()
        try:
            db.execute("INSERT INTO coursework (id,teacher_id,student_id,kind,subject,title,instructions,due_date,source_id,source_url,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)",
                       (item_id, user["id"], body.student_id, body.kind, body.subject, body.title, body.instructions, body.due_date.isoformat(), body.source_id, source_url, timestamp, timestamp))
        except sqlite3.IntegrityError:
            raise HTTPException(409, "This source is already assigned to this student.")
        return owned(db, item_id, user)


@router.put("/{item_id}")
def edit_work(item_id: str, body: Work, user=Depends(teacher_only)):
    with connection() as db:
        row = owned(db, item_id, user)
        if row["student_id"] != body.student_id or row["source_id"] != body.source_id or row["kind"] != body.kind:
            raise HTTPException(400, "Student, type and source cannot change after assignment.")
        db.execute("UPDATE coursework SET title=?,instructions=?,subject=?,due_date=?,updated_at=? WHERE id=?",
                   (body.title, body.instructions, body.subject, body.due_date.isoformat(), now(), item_id))
        return owned(db, item_id, user)


class Review(BaseModel):
    status: Literal["pending", "completed"]
    score: int | None = Field(default=None, ge=1, le=10, strict=True)
    remarks: str = Field(default="", max_length=4000)


@router.put("/{item_id}/review")
def review(item_id: str, body: Review, user=Depends(teacher_only)):
    with connection() as db:
        owned(db, item_id, user)
        timestamp = now()
        db.execute("UPDATE coursework SET status=?,score=?,remarks=?,reviewed_at=?,updated_at=? WHERE id=?",
                   (body.status, body.score, body.remarks, timestamp, timestamp, item_id))
        return owned(db, item_id, user)


class Submission(BaseModel):
    submission: str = Field(min_length=1, max_length=10000)

    @field_validator("submission")
    @classmethod
    def not_blank(cls, value):
        if not value.strip():
            raise ValueError("Enter your answer or describe the work completed.")
        return value.strip()


@router.put("/{item_id}/submission")
def submit(item_id: str, body: Submission, user=Depends(current_user)):
    if user["role"] != "student":
        raise HTTPException(403, "Only the assigned student can submit work.")
    with connection() as db:
        row = owned(db, item_id, user)
        if row["status"] == "completed":
            raise HTTPException(409, "Ask your teacher to reopen this work before resubmitting.")
        timestamp = now()
        db.execute("UPDATE coursework SET submission=?,submitted_at=?,score=NULL,reviewed_at=NULL,updated_at=? WHERE id=?", (body.submission, timestamp, timestamp, item_id))
        return owned(db, item_id, user)


@router.post("/{item_id}/email")
def email_remarks(item_id: str, user=Depends(teacher_only)):
    with connection() as db:
        row = owned(db, item_id, user)
        student = db.execute("SELECT username FROM users WHERE id=?", (row["student_id"],)).fetchone()["username"]
    if not row["remarks"].strip():
        raise HTTPException(400, "Save a comment before sending email.")
    try:
        send_teacher_remarks(student, row)
    except RuntimeError as exc:
        raise HTTPException(503, str(exc)) from None
    return {"message": "Email accepted for delivery to sun.srs86@gmail.com."}
