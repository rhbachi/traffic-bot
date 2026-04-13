import asyncio
import json
import logging
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, HTTPException, BackgroundTasks, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from pydantic import BaseModel
from typing import Optional, List

import database
import bot_engine
import auth

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Init DB on startup
database.init_db()


@asynccontextmanager
async def lifespan(app: FastAPI):
    yield
    # Stop all campaigns on shutdown
    for cid in bot_engine.get_running_campaigns():
        bot_engine.stop_campaign(cid)


app = FastAPI(title="Traffic Bot API", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Serve frontend static files
static_dir = Path(__file__).parent.parent / "frontend" / "dist"
if static_dir.exists():
    app.mount("/assets", StaticFiles(directory=str(static_dir / "assets")), name="assets")


# ─── Models ───────────────────────────────────────────────────────────────────

class CampaignCreate(BaseModel):
    name: str
    search_engine: str = "google"
    keywords: List[str] = []
    target_url: str = ""
    daily_visits: int = 100
    min_time_on_site: int = 30
    max_time_on_site: int = 180
    bounce_rate: int = 30
    use_proxies: bool = True
    device_type: str = "desktop"
    country: str = "US"
    schedule_enabled: bool = False
    schedule_start: Optional[str] = None
    schedule_end: Optional[str] = None


class CampaignUpdate(BaseModel):
    name: Optional[str] = None
    search_engine: Optional[str] = None
    keywords: Optional[List[str]] = None
    target_url: Optional[str] = None
    daily_visits: Optional[int] = None
    min_time_on_site: Optional[int] = None
    max_time_on_site: Optional[int] = None
    bounce_rate: Optional[int] = None
    use_proxies: Optional[bool] = None
    device_type: Optional[str] = None
    country: Optional[str] = None
    schedule_enabled: Optional[bool] = None
    schedule_start: Optional[str] = None
    schedule_end: Optional[str] = None


class ProxyCreate(BaseModel):
    address: str
    port: int
    username: Optional[str] = None
    password: Optional[str] = None
    type: str = "http"


class BulkProxyImport(BaseModel):
    proxies: str  # newline-separated proxy list


class SettingsUpdate(BaseModel):
    data: dict


class RegisterBody(BaseModel):
    email: str
    password: str
    role: str = "user"


class LoginBody(BaseModel):
    email: str
    password: str


class UpdateRoleBody(BaseModel):
    role: str


# ─── Auth ─────────────────────────────────────────────────────────────────────

@app.post("/api/auth/register")
def register(body: RegisterBody):
    if database.get_user_by_email(body.email):
        raise HTTPException(status_code=400, detail="Email déjà utilisé")
    password_hash = auth.hash_password(body.password)
    # First user ever becomes admin automatically
    all_users = database.get_all_users()
    role = "admin" if len(all_users) == 0 else body.role
    user = database.create_user(body.email, password_hash, role)
    token = auth.create_access_token(user["id"], user["email"], user["role"])
    return {"token": token, "user": {k: v for k, v in user.items() if k != "password_hash"}}


@app.post("/api/auth/login")
def login(body: LoginBody):
    user = database.get_user_by_email(body.email)
    if not user or not auth.verify_password(body.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Email ou mot de passe incorrect")
    if user["is_banned"]:
        raise HTTPException(status_code=403, detail="Compte suspendu")
    token = auth.create_access_token(user["id"], user["email"], user["role"])
    return {"token": token, "user": {k: v for k, v in user.items() if k != "password_hash"}}


@app.get("/api/auth/me")
def me(current_user: dict = Depends(auth.get_current_user)):
    return {k: v for k, v in current_user.items() if k != "password_hash"}


# ─── Admin – Users ────────────────────────────────────────────────────────────

@app.get("/api/admin/users")
def list_users(_: dict = Depends(auth.require_admin)):
    users = database.get_all_users()
    return [{k: v for k, v in u.items() if k != "password_hash"} for u in users]


@app.patch("/api/admin/users/{user_id}/role")
def update_role(user_id: int, body: UpdateRoleBody, _: dict = Depends(auth.require_admin)):
    if body.role not in ("user", "admin"):
        raise HTTPException(status_code=400, detail="Rôle invalide")
    user = database.update_user_role(user_id, body.role)
    if not user:
        raise HTTPException(status_code=404, detail="Utilisateur introuvable")
    return {k: v for k, v in user.items() if k != "password_hash"}


@app.patch("/api/admin/users/{user_id}/ban")
def ban_user(user_id: int, _: dict = Depends(auth.require_admin)):
    user = database.set_user_banned(user_id, True)
    return {k: v for k, v in user.items() if k != "password_hash"}


@app.patch("/api/admin/users/{user_id}/unban")
def unban_user(user_id: int, _: dict = Depends(auth.require_admin)):
    user = database.set_user_banned(user_id, False)
    return {k: v for k, v in user.items() if k != "password_hash"}


@app.delete("/api/admin/users/{user_id}")
def delete_user(user_id: int, _: dict = Depends(auth.require_admin)):
    database.delete_user(user_id)
    return {"ok": True}


@app.get("/api/admin/stats")
def admin_stats(_: dict = Depends(auth.require_admin)):
    user_counts = database.count_users()
    campaigns = database.get_all_campaigns()
    total_visits = sum(c.get("total_visits", 0) for c in campaigns)
    successful = sum(c.get("successful_visits", 0) for c in campaigns)
    return {
        "users": user_counts,
        "total_campaigns": len(campaigns),
        "running_campaigns": len(bot_engine.get_running_campaigns()),
        "total_visits": total_visits,
        "successful_visits": successful,
        "success_rate": round(successful / total_visits * 100, 1) if total_visits else 0,
        "active_proxies": len(database.get_all_active_proxies()),
    }


# ─── Campaigns ────────────────────────────────────────────────────────────────

@app.get("/api/campaigns")
def list_campaigns(current_user: dict = Depends(auth.get_current_user)):
    campaigns = database.get_campaigns(current_user["id"])
    for c in campaigns:
        c["running"] = bot_engine.is_campaign_running(c["id"])
        if isinstance(c.get("keywords"), str):
            try:
                c["keywords"] = json.loads(c["keywords"])
            except Exception:
                c["keywords"] = []
    return campaigns


@app.post("/api/campaigns")
def create_campaign(data: CampaignCreate, current_user: dict = Depends(auth.get_current_user)):
    return database.create_campaign(data.model_dump(), current_user["id"])


@app.get("/api/campaigns/{campaign_id}")
def get_campaign(campaign_id: int, current_user: dict = Depends(auth.get_current_user)):
    c = database.get_campaign(campaign_id)
    if not c or c["user_id"] != current_user["id"]:
        raise HTTPException(status_code=404, detail="Campaign not found")
    c["running"] = bot_engine.is_campaign_running(campaign_id)
    if isinstance(c.get("keywords"), str):
        try:
            c["keywords"] = json.loads(c["keywords"])
        except Exception:
            c["keywords"] = []
    return c


@app.put("/api/campaigns/{campaign_id}")
def update_campaign(campaign_id: int, data: CampaignUpdate, current_user: dict = Depends(auth.get_current_user)):
    c = database.get_campaign(campaign_id)
    if not c or c["user_id"] != current_user["id"]:
        raise HTTPException(status_code=404, detail="Campaign not found")
    update_data = {k: v for k, v in data.model_dump().items() if v is not None}
    return database.update_campaign(campaign_id, update_data)


@app.delete("/api/campaigns/{campaign_id}")
def delete_campaign(campaign_id: int, current_user: dict = Depends(auth.get_current_user)):
    c = database.get_campaign(campaign_id)
    if not c or c["user_id"] != current_user["id"]:
        raise HTTPException(status_code=404, detail="Campaign not found")
    bot_engine.stop_campaign(campaign_id)
    database.delete_campaign(campaign_id, current_user["id"])
    return {"ok": True}


@app.post("/api/campaigns/{campaign_id}/start")
async def start_campaign(campaign_id: int, background_tasks: BackgroundTasks, current_user: dict = Depends(auth.get_current_user)):
    c = database.get_campaign(campaign_id)
    if not c or c["user_id"] != current_user["id"]:
        raise HTTPException(status_code=404, detail="Campaign not found")
    if bot_engine.is_campaign_running(campaign_id):
        return {"status": "already_running"}
    if isinstance(c.get("keywords"), str):
        try:
            c["keywords"] = json.loads(c["keywords"])
        except Exception:
            c["keywords"] = []
    database.update_campaign(campaign_id, {"status": "running"})
    background_tasks.add_task(bot_engine.start_campaign, c)
    return {"status": "started"}


@app.post("/api/campaigns/{campaign_id}/stop")
def stop_campaign(campaign_id: int, current_user: dict = Depends(auth.get_current_user)):
    c = database.get_campaign(campaign_id)
    if not c or c["user_id"] != current_user["id"]:
        raise HTTPException(status_code=404, detail="Campaign not found")
    bot_engine.stop_campaign(campaign_id)
    database.update_campaign(campaign_id, {"status": "stopped"})
    return {"status": "stopped"}


# ─── Proxies ──────────────────────────────────────────────────────────────────

@app.get("/api/proxies")
def list_proxies(current_user: dict = Depends(auth.get_current_user)):
    return database.get_proxies(current_user["id"])


@app.post("/api/proxies")
def add_proxy(data: ProxyCreate, current_user: dict = Depends(auth.get_current_user)):
    return database.add_proxy(data.model_dump(), current_user["id"])


@app.post("/api/proxies/bulk")
def bulk_import(data: BulkProxyImport, current_user: dict = Depends(auth.get_current_user)):
    lines = data.proxies.strip().splitlines()
    added = database.bulk_add_proxies(lines, current_user["id"])
    return {"added": added}


@app.delete("/api/proxies/{proxy_id}")
def delete_proxy(proxy_id: int, current_user: dict = Depends(auth.get_current_user)):
    database.delete_proxy(proxy_id, current_user["id"])
    return {"ok": True}


# ─── Logs ─────────────────────────────────────────────────────────────────────

@app.get("/api/logs")
def get_logs(campaign_id: Optional[int] = None, limit: int = 100, current_user: dict = Depends(auth.get_current_user)):
    return database.get_logs(current_user["id"], campaign_id, limit)


# ─── Stats ────────────────────────────────────────────────────────────────────

@app.get("/api/stats")
def get_stats(current_user: dict = Depends(auth.get_current_user)):
    uid = current_user["id"]
    campaigns = database.get_campaigns(uid)
    total_visits = sum(c.get("total_visits", 0) for c in campaigns)
    successful = sum(c.get("successful_visits", 0) for c in campaigns)
    failed = sum(c.get("failed_visits", 0) for c in campaigns)
    running = sum(1 for c in campaigns if bot_engine.is_campaign_running(c["id"]))
    proxies = database.get_active_proxies(uid)

    return {
        "total_campaigns": len(campaigns),
        "running_campaigns": running,
        "total_visits": total_visits,
        "successful_visits": successful,
        "failed_visits": failed,
        "success_rate": round(successful / total_visits * 100, 1) if total_visits else 0,
        "active_proxies": len(proxies),
    }


# ─── Settings ─────────────────────────────────────────────────────────────────

@app.get("/api/settings")
def get_settings(current_user: dict = Depends(auth.get_current_user)):
    return database.get_settings(current_user["id"])


@app.put("/api/settings")
def update_settings(data: SettingsUpdate, current_user: dict = Depends(auth.get_current_user)):
    database.update_settings(data.data, current_user["id"])
    return database.get_settings(current_user["id"])


# ─── Frontend ─────────────────────────────────────────────────────────────────

@app.get("/")
@app.get("/{path:path}")
async def serve_frontend(path: str = ""):
    index = Path(__file__).parent.parent / "frontend" / "dist" / "index.html"
    if index.exists():
        return FileResponse(str(index))
    return {"message": "Traffic Bot API running. Frontend not built yet."}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=False)
