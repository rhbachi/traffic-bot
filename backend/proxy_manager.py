import random
import string
from urllib.parse import quote
from typing import Optional
from database import get_active_proxies, update_proxy_stats


def _random_session_id() -> str:
    return "".join(random.choices(string.ascii_lowercase + string.digits, k=8))


class ProxyManager:
    def get_proxy(self, user_id: int) -> Optional[dict]:
        proxies = get_active_proxies(user_id)
        if not proxies:
            return None
        return random.choice(proxies)

    def format_for_playwright(self, proxy: dict) -> dict:
        ptype = proxy["type"] if proxy["type"] in ("socks5", "socks4") else "http"
        username = proxy.get("username", "")
        password = proxy.get("password", "")

        if proxy.get("address", "").endswith("iproyal.com") and username and "_session-" not in password:
            session_id = _random_session_id()
            password = f"{password}_session-{session_id}"

        if username:
            u = quote(username, safe="")
            p = quote(password, safe="")
            server = f"{ptype}://{u}:{p}@{proxy['address']}:{proxy['port']}"
        else:
            server = f"{ptype}://{proxy['address']}:{proxy['port']}"

        return {"server": server}

    def mark_success(self, proxy: dict):
        if proxy and proxy.get("id"):
            update_proxy_stats(proxy["id"], success=True)

    def mark_failure(self, proxy: dict):
        if proxy and proxy.get("id"):
            update_proxy_stats(proxy["id"], success=False)


proxy_manager = ProxyManager()
