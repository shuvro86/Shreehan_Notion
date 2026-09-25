"""Small DB-API compatibility layer for the official remote libSQL driver."""
import sqlite3


class Row(dict):
    def __getitem__(self, key):
        return list(self.values())[key] if isinstance(key, int) else super().__getitem__(key)


class Cursor:
    def __init__(self, cursor):
        self.cursor = cursor

    def convert(self, values):
        return None if values is None else Row(zip((column[0].lower() for column in self.cursor.description), values))

    def fetchone(self):
        return self.convert(self.cursor.fetchone())

    def fetchall(self):
        return [self.convert(row) for row in self.cursor.fetchall()]

    def __iter__(self):
        return iter(self.fetchall())


class Connection:
    def __init__(self, url, token):
        import libsql
        self.db = libsql.connect(database=url, auth_token=token)

    def execute(self, sql, parameters=()):
        try:
            return Cursor(self.db.execute(sql, parameters))
        except Exception as exc:
            if 'constraint' in str(exc).lower():
                raise sqlite3.IntegrityError('Database constraint failed') from exc
            raise

    def executescript(self, sql):
        return self.db.executescript(sql)

    def commit(self):
        self.db.commit()

    def rollback(self):
        self.db.rollback()

    def close(self):
        self.db.close()
