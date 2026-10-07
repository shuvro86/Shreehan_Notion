"""Teacher-managed work and student-owned submissions, shared by SQLite and Turso."""
from datetime import date, datetime
from zoneinfo import ZoneInfo
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
feedback_router = APIRouter(prefix="/api/teacher-feedback", tags=["teacher feedback"])
SUBJECTS = ["Mathematics", "Bangla 1", "Bangla 2", "Bangladesh Studies", "English Language",
            "English Dictation & Spelling", "English Literature", "History", "Geography", "Science", "Poetry"]


def teacher_only(user=Depends(current_user)):
    if user["role"] != "teacher":
        raise HTTPException(403, "Teacher access required.")
    return user


def bangladesh_day():
    return datetime.now(ZoneInfo("Asia/Dhaka")).date().isoformat()


class DailyFeedback(BaseModel):
    body: str = Field(min_length=1, max_length=5000)

    @field_validator("body")
    @classmethod
    def not_blank(cls, value):
        if not value.strip():
            raise ValueError("Write an update before sending it.")
        return value.strip()


@feedback_router.get("/today")
def today_feedback(user=Depends(teacher_only)):
    day = bangladesh_day()
    with connection() as db:
        row = db.execute("SELECT id,day,body,created_at,updated_at,read_at FROM daily_teacher_feedback WHERE teacher_id=? AND day=?", (user["id"], day)).fetchone()
    return {"day": day, "feedback": dict(row) if row else None}


@feedback_router.put("/today")
def save_today_feedback(body: DailyFeedback, user=Depends(teacher_only)):
    day, timestamp = bangladesh_day(), now()
    with connection() as db:
        db.execute("INSERT INTO daily_teacher_feedback (id,teacher_id,day,body,created_at,updated_at) VALUES (?,?,?,?,?,?) ON CONFLICT(teacher_id,day) DO UPDATE SET body=excluded.body,updated_at=excluded.updated_at,read_at=NULL",
                   (str(uuid4()), user["id"], day, body.body, timestamp, timestamp))
        row = db.execute("SELECT id,day,body,created_at,updated_at,read_at FROM daily_teacher_feedback WHERE teacher_id=? AND day=?", (user["id"], day)).fetchone()
    return {"day": day, "feedback": dict(row)}


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
    if user["role"] == "admin":
        raise HTTPException(403, "Classroom access requires a student or teacher role.")
    teacher = user["role"] == "teacher"
    key = "teacher_id" if teacher else "student_id"
    with connection() as db:
        items = [dict(r) for r in db.execute(f"SELECT c.*,u.username AS student_name FROM coursework c JOIN users u ON u.id=c.student_id WHERE c.{key}=? ORDER BY c.due_date DESC,c.created_at DESC", (user["id"],))]
        students = [dict(r) for r in db.execute("SELECT users.id,users.username FROM users LEFT JOIN account_roles ON account_roles.user_id=users.id WHERE users.verified_at IS NOT NULL AND COALESCE(account_roles.role, CASE WHEN EXISTS (SELECT 1 FROM teachers WHERE teachers.user_id=users.id) THEN 'teacher' ELSE 'student' END)='student' ORDER BY users.username")] if teacher else []
    if teacher:
        grouped = {}
        for item in items:
            group = grouped.get(item["created_at"])
            if group is None:
                group = {**item, "assignments": []}
                grouped[item["created_at"]] = group
            group["assignments"].append(item)
        items = list(grouped.values())
        for group in items:
            assignments = group["assignments"]
            group["status"] = "completed" if all(item["status"] == "completed" for item in assignments) else "pending"
            group["review_state"] = ("done" if all(item["review_state"] == "done" for item in assignments)
                                     else "not_done" if all(item["review_state"] == "not_done" for item in assignments)
                                     else "half_done")
            group["student_count"] = len(assignments)
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
        students = db.execute("SELECT users.id FROM users LEFT JOIN account_roles ON account_roles.user_id=users.id WHERE users.verified_at IS NOT NULL AND COALESCE(account_roles.role, CASE WHEN EXISTS (SELECT 1 FROM teachers WHERE teachers.user_id=users.id) THEN 'teacher' ELSE 'student' END)='student' ORDER BY users.id").fetchall()
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


@router.delete("/class-task/{item_id}")
def delete_class_task(item_id: str, user=Depends(teacher_only)):
    """Remove one teacher task and every student assignment created with it."""
    with connection() as db:
        row = owned(db, item_id, user)
        assignments = db.execute("SELECT id FROM coursework WHERE teacher_id=? AND created_at=?", (user["id"], row["created_at"])).fetchall()
        db.execute("DELETE FROM coursework WHERE teacher_id=? AND created_at=?", (user["id"], row["created_at"]))
    return {"deleted": len(assignments)}


@router.post("", status_code=201)
def create_work(body: Work, user=Depends(teacher_only)):
    source_url = ""
    if body.source_id:
        source = next((i for i in source_items() if i["id"] == body.source_id), None)
        if not source or source["kind"] != body.kind:
            raise HTTPException(400, "Choose an available source of the same work type.")
        source_url = source["url"]
    with connection() as db:
        if not db.execute("SELECT users.id FROM users LEFT JOIN account_roles ON account_roles.user_id=users.id WHERE users.id=? AND users.verified_at IS NOT NULL AND COALESCE(account_roles.role, CASE WHEN EXISTS (SELECT 1 FROM teachers WHERE teachers.user_id=users.id) THEN 'teacher' ELSE 'student' END)='student'", (body.student_id,)).fetchone():
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
    status: Literal["pending", "half_done", "completed"]
    score: int | None = Field(default=None, ge=1, le=10, strict=True)
    remarks: str = Field(default="", max_length=4000)


@router.put("/{item_id}/review")
def review(item_id: str, body: Review, user=Depends(teacher_only)):
    with connection() as db:
        owned(db, item_id, user)
        timestamp = now()
        review_state = {"pending": "not_done", "half_done": "half_done", "completed": "done"}[body.status]
        db.execute("UPDATE coursework SET status=?,review_state=?,score=?,remarks=?,reviewed_at=?,updated_at=? WHERE id=?",
                   ("completed" if body.status == "completed" else "pending", review_state, body.score, body.remarks, timestamp, timestamp, item_id))
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
        db.execute("UPDATE coursework SET submission=?,submitted_at=?,score=NULL,review_state='not_done',reviewed_at=NULL,updated_at=? WHERE id=?", (body.submission, timestamp, timestamp, item_id))
        return owned(db, item_id, user)


@router.post("/{item_id}/email")
def email_remarks(item_id: str, user=Depends(teacher_only)):
    with connection() as db:
        row = owned(db, item_id, user)
        student = db.execute("SELECT username FROM users WHERE id=?", (row["student_id"],)).fetchone()["username"]
    if not row["reviewed_at"]:
        raise HTTPException(400, "Save a review before notifying the guardian.")
    try:
        send_teacher_remarks(student, row)
    except RuntimeError as exc:
        raise HTTPException(503, str(exc)) from None
    return {"message": "Email accepted for delivery to sun.srs86@gmail.com."}
