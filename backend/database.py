import os
import sqlite3
import json
from datetime import datetime
from pathlib import Path

# Allow overriding DB path via environment variable (useful for Docker volumes)
_default_db = Path(__file__).parent / "traffic_bot.db"
DB_PATH = Path(os.environ.get("DATABASE_PATH", str(_default_db)))


def get_connection():
    conn = sqlite3.connect(str(DB_PATH))
    conn.row_factory = sqlite3.Row
    return conn


def init_db():
    conn = get_connection()
    c = conn.cursor()

    c.execute("""
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            email TEXT UNIQUE NOT NULL,
            password_hash TEXT NOT NULL,
            role TEXT DEFAULT 'user',
            is_banned INTEGER DEFAULT 0,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP
        )
    """)

    c.execute("""
        CREATE TABLE IF NOT EXISTS campaigns (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL DEFAULT 0,
            name TEXT NOT NULL,
            status TEXT DEFAULT 'stopped',
            search_engine TEXT DEFAULT 'google',
            keywords TEXT DEFAULT '[]',
            target_url TEXT,
            daily_visits INTEGER DEFAULT 100,
            min_time_on_site INTEGER DEFAULT 30,
            max_time_on_site INTEGER DEFAULT 180,
            bounce_rate INTEGER DEFAULT 30,
            use_proxies INTEGER DEFAULT 1,
            device_type TEXT DEFAULT 'desktop',
            country TEXT DEFAULT 'US',
            schedule_enabled INTEGER DEFAULT 0,
            schedule_start TEXT,
            schedule_end TEXT,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP,
            total_visits INTEGER DEFAULT 0,
            successful_visits INTEGER DEFAULT 0,
            failed_visits INTEGER DEFAULT 0,
            FOREIGN KEY (user_id) REFERENCES users(id)
        )
    """)

    c.execute("""
        CREATE TABLE IF NOT EXISTS proxies (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL DEFAULT 0,
            address TEXT NOT NULL,
            port INTEGER NOT NULL,
            username TEXT,
            password TEXT,
            type TEXT DEFAULT 'http',
            country TEXT DEFAULT '',
            status TEXT DEFAULT 'active',
            last_used TEXT,
            success_count INTEGER DEFAULT 0,
            fail_count INTEGER DEFAULT 0,
            FOREIGN KEY (user_id) REFERENCES users(id)
        )
    """)

    c.execute("""
        CREATE TABLE IF NOT EXISTS visit_logs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            campaign_id INTEGER,
            keyword TEXT,
            status TEXT,
            proxy_used TEXT,
            time_on_site INTEGER,
            search_engine TEXT,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (campaign_id) REFERENCES campaigns(id)
        )
    """)

    c.execute("""
        CREATE TABLE IF NOT EXISTS settings (
            user_id INTEGER NOT NULL DEFAULT 0,
            key TEXT NOT NULL,
            value TEXT,
            PRIMARY KEY (user_id, key),
            FOREIGN KEY (user_id) REFERENCES users(id)
        )
    """)

    # Migrate existing tables: add columns if missing
    for table in ("campaigns", "proxies"):
        try:
            c.execute(f"ALTER TABLE {table} ADD COLUMN user_id INTEGER NOT NULL DEFAULT 0")
        except Exception:
            pass
    try:
        c.execute("ALTER TABLE proxies ADD COLUMN country TEXT DEFAULT ''")
    except Exception:
        pass

    conn.commit()
    conn.close()


# --- Admin (all users) ---

def get_all_campaigns():
    conn = get_connection()
    rows = conn.execute("SELECT * FROM campaigns ORDER BY created_at DESC").fetchall()
    conn.close()
    return [dict(r) for r in rows]


def get_all_active_proxies():
    conn = get_connection()
    rows = conn.execute("SELECT * FROM proxies WHERE status = 'active'").fetchall()
    conn.close()
    return [dict(r) for r in rows]


# --- Campaigns ---

def get_campaigns(user_id: int):
    conn = get_connection()
    rows = conn.execute(
        "SELECT * FROM campaigns WHERE user_id = ? ORDER BY created_at DESC", (user_id,)
    ).fetchall()
    conn.close()
    return [dict(r) for r in rows]


def get_campaign(campaign_id: int):
    conn = get_connection()
    row = conn.execute("SELECT * FROM campaigns WHERE id = ?", (campaign_id,)).fetchone()
    conn.close()
    return dict(row) if row else None


def create_campaign(data: dict, user_id: int):
    conn = get_connection()
    c = conn.cursor()
    keywords = json.dumps(data.get("keywords", []))
    c.execute("""
        INSERT INTO campaigns (user_id, name, search_engine, keywords, target_url, daily_visits,
            min_time_on_site, max_time_on_site, bounce_rate, use_proxies, device_type,
            country, schedule_enabled, schedule_start, schedule_end)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, (
        user_id, data["name"], data.get("search_engine", "google"), keywords,
        data.get("target_url", ""), data.get("daily_visits", 100),
        data.get("min_time_on_site", 30), data.get("max_time_on_site", 180),
        data.get("bounce_rate", 30), data.get("use_proxies", 1),
        data.get("device_type", "desktop"), data.get("country", "US"),
        data.get("schedule_enabled", 0), data.get("schedule_start"),
        data.get("schedule_end")
    ))
    conn.commit()
    campaign_id = c.lastrowid
    conn.close()
    return get_campaign(campaign_id)


def update_campaign(campaign_id: int, data: dict):
    conn = get_connection()
    if "keywords" in data:
        data["keywords"] = json.dumps(data["keywords"])
    allowed = ["name", "search_engine", "keywords", "target_url", "daily_visits",
               "min_time_on_site", "max_time_on_site", "bounce_rate", "use_proxies",
               "device_type", "country", "schedule_enabled", "schedule_start",
               "schedule_end", "status"]
    fields = {k: v for k, v in data.items() if k in allowed}
    if not fields:
        conn.close()
        return get_campaign(campaign_id)
    set_clause = ", ".join(f"{k} = ?" for k in fields)
    values = list(fields.values()) + [campaign_id]
    conn.execute(f"UPDATE campaigns SET {set_clause} WHERE id = ?", values)
    conn.commit()
    conn.close()
    return get_campaign(campaign_id)


def delete_campaign(campaign_id: int, user_id: int):
    conn = get_connection()
    conn.execute("DELETE FROM campaigns WHERE id = ? AND user_id = ?", (campaign_id, user_id))
    conn.commit()
    conn.close()


def update_campaign_stats(campaign_id: int, success: bool):
    conn = get_connection()
    if success:
        conn.execute("""
            UPDATE campaigns SET total_visits = total_visits + 1,
            successful_visits = successful_visits + 1 WHERE id = ?
        """, (campaign_id,))
    else:
        conn.execute("""
            UPDATE campaigns SET total_visits = total_visits + 1,
            failed_visits = failed_visits + 1 WHERE id = ?
        """, (campaign_id,))
    conn.commit()
    conn.close()


# --- Proxies ---

def get_proxies(user_id: int):
    conn = get_connection()
    rows = conn.execute(
        "SELECT * FROM proxies WHERE user_id = ? ORDER BY id DESC", (user_id,)
    ).fetchall()
    conn.close()
    return [dict(r) for r in rows]


def add_proxy(data: dict, user_id: int):
    conn = get_connection()
    c = conn.cursor()
    c.execute("""
        INSERT INTO proxies (user_id, address, port, username, password, type, country)
        VALUES (?, ?, ?, ?, ?, ?, ?)
    """, (user_id, data["address"], data["port"], data.get("username"), data.get("password"), data.get("type", "http"), data.get("country", "")))
    conn.commit()
    proxy_id = c.lastrowid
    conn.close()
    row = get_connection().execute("SELECT * FROM proxies WHERE id = ?", (proxy_id,)).fetchone()
    return dict(row) if row else None


def bulk_add_proxies(proxy_lines: list, user_id: int, country: str = ""):
    conn = get_connection()
    c = conn.cursor()
    added = 0
    for line in proxy_lines:
        line = line.strip()
        if not line:
            continue
        try:
            parts = line.split(":")
            if len(parts) == 2:
                address, port = parts
                c.execute("INSERT INTO proxies (user_id, address, port, country) VALUES (?, ?, ?, ?)",
                          (user_id, address, int(port), country))
            elif len(parts) == 4:
                address, port, username, password = parts
                c.execute("INSERT INTO proxies (user_id, address, port, username, password, country) VALUES (?, ?, ?, ?, ?, ?)",
                          (user_id, address, int(port), username, password, country))
            added += 1
        except Exception:
            continue
    conn.commit()
    conn.close()
    return added


def delete_proxy(proxy_id: int, user_id: int):
    conn = get_connection()
    conn.execute("DELETE FROM proxies WHERE id = ? AND user_id = ?", (proxy_id, user_id))
    conn.commit()
    conn.close()


def get_active_proxies(user_id: int, country: str = ""):
    conn = get_connection()
    if country:
        # Try to find proxies matching the country first
        rows = conn.execute(
            "SELECT * FROM proxies WHERE user_id = ? AND status = 'active' AND country = ?",
            (user_id, country)
        ).fetchall()
        # Fallback: if no country-matching proxies, use any active proxy
        if not rows:
            rows = conn.execute(
                "SELECT * FROM proxies WHERE user_id = ? AND status = 'active'", (user_id,)
            ).fetchall()
    else:
        rows = conn.execute(
            "SELECT * FROM proxies WHERE user_id = ? AND status = 'active'", (user_id,)
        ).fetchall()
    conn.close()
    return [dict(r) for r in rows]


def update_proxy_stats(proxy_id: int, success: bool):
    conn = get_connection()
    if success:
        conn.execute("""
            UPDATE proxies SET success_count = success_count + 1,
            last_used = CURRENT_TIMESTAMP WHERE id = ?
        """, (proxy_id,))
    else:
        conn.execute("""
            UPDATE proxies SET fail_count = fail_count + 1 WHERE id = ?
        """, (proxy_id,))
    conn.commit()
    conn.close()


# --- Logs ---

def add_log(campaign_id: int, keyword: str, status: str, proxy: str, time_on_site: int, engine: str):
    conn = get_connection()
    conn.execute("""
        INSERT INTO visit_logs (campaign_id, keyword, status, proxy_used, time_on_site, search_engine)
        VALUES (?, ?, ?, ?, ?, ?)
    """, (campaign_id, keyword, status, proxy, time_on_site, engine))
    conn.commit()
    conn.close()


def get_logs(user_id: int, campaign_id: int = None, limit: int = 100):
    conn = get_connection()
    if campaign_id:
        rows = conn.execute("""
            SELECT l.*, c.name as campaign_name FROM visit_logs l
            LEFT JOIN campaigns c ON l.campaign_id = c.id
            WHERE l.campaign_id = ? AND c.user_id = ?
            ORDER BY l.created_at DESC LIMIT ?
        """, (campaign_id, user_id, limit)).fetchall()
    else:
        rows = conn.execute("""
            SELECT l.*, c.name as campaign_name FROM visit_logs l
            LEFT JOIN campaigns c ON l.campaign_id = c.id
            WHERE c.user_id = ?
            ORDER BY l.created_at DESC LIMIT ?
        """, (user_id, limit)).fetchall()
    conn.close()
    return [dict(r) for r in rows]


# --- Settings (per user) ---

_DEFAULT_SETTINGS = {
    "max_concurrent_tasks": "3",
    "default_user_agent_rotation": "true",
    "default_headless": "true",
    "log_retention_days": "30",
}


def get_settings(user_id: int):
    conn = get_connection()
    rows = conn.execute("SELECT key, value FROM settings WHERE user_id = ?", (user_id,)).fetchall()
    conn.close()
    result = dict(_DEFAULT_SETTINGS)
    result.update({r["key"]: r["value"] for r in rows})
    return result


def update_settings(data: dict, user_id: int):
    conn = get_connection()
    for k, v in data.items():
        conn.execute(
            "INSERT OR REPLACE INTO settings (user_id, key, value) VALUES (?, ?, ?)",
            (user_id, k, str(v))
        )
    conn.commit()
    conn.close()


# --- Users ---

def get_user_by_email(email: str):
    conn = get_connection()
    row = conn.execute("SELECT * FROM users WHERE email = ?", (email,)).fetchone()
    conn.close()
    return dict(row) if row else None


def get_user_by_id(user_id: int):
    conn = get_connection()
    row = conn.execute("SELECT * FROM users WHERE id = ?", (user_id,)).fetchone()
    conn.close()
    return dict(row) if row else None


def create_user(email: str, password_hash: str, role: str = "user"):
    conn = get_connection()
    c = conn.cursor()
    c.execute(
        "INSERT INTO users (email, password_hash, role) VALUES (?, ?, ?)",
        (email, password_hash, role),
    )
    conn.commit()
    user_id = c.lastrowid
    conn.close()
    return get_user_by_id(user_id)


def get_all_users():
    conn = get_connection()
    rows = conn.execute("SELECT * FROM users ORDER BY created_at DESC").fetchall()
    conn.close()
    return [dict(r) for r in rows]


def update_user_role(user_id: int, role: str):
    conn = get_connection()
    conn.execute("UPDATE users SET role = ? WHERE id = ?", (role, user_id))
    conn.commit()
    conn.close()
    return get_user_by_id(user_id)


def set_user_banned(user_id: int, is_banned: bool):
    conn = get_connection()
    conn.execute("UPDATE users SET is_banned = ? WHERE id = ?", (int(is_banned), user_id))
    conn.commit()
    conn.close()
    return get_user_by_id(user_id)


def delete_user(user_id: int):
    conn = get_connection()
    conn.execute("DELETE FROM users WHERE id = ?", (user_id,))
    conn.commit()
    conn.close()


def count_users():
    conn = get_connection()
    row = conn.execute("SELECT COUNT(*) as total, "
                       "SUM(CASE WHEN role='admin' THEN 1 ELSE 0 END) as admins, "
                       "SUM(CASE WHEN is_banned=1 THEN 1 ELSE 0 END) as banned "
                       "FROM users").fetchone()
    conn.close()
    return dict(row) if row else {"total": 0, "admins": 0, "banned": 0}
