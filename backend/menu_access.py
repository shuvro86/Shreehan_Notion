"""Role-scoped menu configuration shared by the API and page gate."""
from fastapi import HTTPException

MENU_ITEMS = {
    "student": (
        ("overview", "Overview", "/", False),
        ("tasks", "My tasks", "/", False),
        ("collections", "Collections", "/", False),
        ("library", "Document library", "/library", False),
        ("assistant", "Digital Twin", "/assistant", False),
        ("practice", "Class 2 practice", "/practice", False),
        ("kanban", "Project board", "/kanban", False),
        ("coursework", "Teacher work", "/coursework", False),
    ),
    "teacher": (
        ("teacher_dashboard", "Teacher dashboard", "/teacher", False),
        ("coursework", "Coursework", "/coursework", False),
    ),
    "admin": (
        ("admin_accounts", "Accounts", "/admin", True),
        ("admin_menus", "Menu access", "/admin", True),
        ("admin_feedback", "Teacher updates", "/admin", True),
        ("admin_setup", "Setup", "/admin", False),
    ),
}


def menu_settings(db, role):
    overrides = {row["menu_key"]: bool(row["enabled"]) for row in db.execute(
        "SELECT menu_key,enabled FROM role_menu_access WHERE role=?", (role,))}
    return [{"key": key, "label": label, "path": path, "locked": locked,
             "enabled": True if locked else overrides.get(key, True)}
            for key, label, path, locked in MENU_ITEMS.get(role, ())]


def enabled_menus(db, role):
    return [item["key"] for item in menu_settings(db, role) if item["enabled"]]


def set_menu(db, role, key, enabled):
    item = next((item for item in MENU_ITEMS.get(role, ()) if item[0] == key), None)
    if not item:
        raise HTTPException(400, "Choose a menu belonging to that role.")
    if item[3]:
        raise HTTPException(400, "This administrator menu must remain available.")
    if not enabled and len(enabled_menus(db, role)) == 1 and key in enabled_menus(db, role):
        raise HTTPException(409, "Keep at least one menu available for this role.")
    db.execute("INSERT INTO role_menu_access (role,menu_key,enabled) VALUES (?,?,?) ON CONFLICT(role,menu_key) DO UPDATE SET enabled=excluded.enabled",
               (role, key, int(enabled)))


def allowed_path(db, role, path):
    settings = menu_settings(db, role)
    if path == "/":
        return role == "student" and any(item["enabled"] and item["path"] == "/" for item in settings)
    return any(item["enabled"] and item["path"] == path for item in settings)


def first_path(db, role):
    return next((item["path"] for item in menu_settings(db, role) if item["enabled"]), "/login")
