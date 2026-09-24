"""Authenticated board, dashboard task, and practice progress APIs."""
from __future__ import annotations

import sqlite3

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from backend.auth import current_user
from backend.db import connection, get_board, get_tasks, now

router = APIRouter(prefix="/api", dependencies=[Depends(current_user)], tags=["workspace"])


class Card(BaseModel):
    id: str = Field(min_length=1, max_length=80)
    title: str = Field(min_length=1, max_length=100)
    details: str = Field(max_length=500)


class Column(BaseModel):
    id: str = Field(min_length=1, max_length=80)
    name: str = Field(min_length=1, max_length=30)
    cards: list[Card] = Field(max_length=500)


class Board(BaseModel):
    columns: list[Column] = Field(min_length=5, max_length=5)


@router.get("/board")
def board(user=Depends(current_user)):
    with connection() as db:
        return {"columns": get_board(db, user["id"])}


@router.put("/board")
def save_board(body: Board, user=Depends(current_user)):
    with connection() as db:
        existing = get_board(db, user["id"])
        if [column["id"] for column in existing] != [column.id for column in body.columns]:
            raise HTTPException(400, "The board must keep its original five columns in order.")
        card_ids = [card.id for column in body.columns for card in column.cards]
        if len(card_ids) != len(set(card_ids)) or len(card_ids) > 1000:
            raise HTTPException(400, "Card identifiers must be unique.")
        board_id = db.execute("SELECT id FROM boards WHERE user_id=?", (user["id"],)).fetchone()["id"]
        for column in body.columns:
            db.execute("UPDATE columns SET name=? WHERE id=? AND board_id=?", (column.name.strip(), column.id, board_id))
        db.execute("DELETE FROM cards WHERE column_id IN (SELECT id FROM columns WHERE board_id=?)", (board_id,))
        timestamp = now()
        try:
            for column in body.columns:
                for position, card in enumerate(column.cards):
                    db.execute("INSERT INTO cards VALUES (?,?,?,?,?,?,?)", (card.id, column.id, position, card.title.strip(), card.details.strip(), timestamp, timestamp))
        except sqlite3.IntegrityError:
            raise HTTPException(409, "A card identifier is already in use.")
        return {"columns": get_board(db, user["id"])}


class Task(BaseModel):
    id: str = Field(min_length=1, max_length=80)
    title: str = Field(min_length=1, max_length=160)
    subject: str = Field(min_length=1, max_length=80)
    priority: str = Field(pattern="^(Low|Medium|High)$")
    done: bool


class Tasks(BaseModel):
    tasks: list[Task] = Field(max_length=500)


@router.get("/tasks")
def tasks(user=Depends(current_user)):
    with connection() as db:
        return {"tasks": get_tasks(db, user["id"])}


@router.put("/tasks")
def save_tasks(body: Tasks, user=Depends(current_user)):
    ids = [task.id for task in body.tasks]
    if len(ids) != len(set(ids)):
        raise HTTPException(400, "Task identifiers must be unique.")
    with connection() as db:
        db.execute("DELETE FROM dashboard_tasks WHERE user_id=?", (user["id"],))
        try:
            for position, task in enumerate(body.tasks):
                db.execute("INSERT INTO dashboard_tasks VALUES (?,?,?,?,?,?,?)", (task.id, user["id"], task.title.strip(), task.subject.strip(), task.priority, int(task.done), position))
        except sqlite3.IntegrityError:
            raise HTTPException(409, "A task identifier is already in use.")
        return {"tasks": get_tasks(db, user["id"])}


class Progress(BaseModel):
    known: list[str] = Field(max_length=10000)


@router.get("/practice-progress")
def practice_progress(user=Depends(current_user)):
    with connection() as db:
        return {"known": [row["item_id"] for row in db.execute("SELECT item_id FROM practice_progress WHERE user_id=? AND known=1", (user["id"],))]}


@router.put("/practice-progress")
def save_practice_progress(body: Progress, user=Depends(current_user)):
    known = list(dict.fromkeys(body.known))
    if any(not item or len(item) > 160 for item in known):
        raise HTTPException(400, "Invalid practice item.")
    with connection() as db:
        db.execute("DELETE FROM practice_progress WHERE user_id=?", (user["id"],))
        db.executemany("INSERT INTO practice_progress VALUES (?,?,1)", [(user["id"], item) for item in known])
    return {"known": known}
