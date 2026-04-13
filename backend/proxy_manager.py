import random
import string
from urllib.parse import quote
from typing import Optional
from database import get_active_proxies, update_proxy_stats


def _random_session_id() -> str:
    """Generate a random 8-char alphanumeric session ID for IPRoyal sticky sessions."""
    return "".join(random.choices(string.ascii_lowercase + string.digits, k=8))


class ProxyManager:
    def __init__(self):
        self._proxies = []
        self._index = 0

    def reload(self):
        self._proxies = get_active_proxies()
        random.shuffle(self._proxies)
        self._index = 0

    def get_proxy(self) -> Optional[dict]:
        if not self._proxies:
            self.reload()
        if not self._proxies:
            return None
        proxy = self._proxies[self._index % len(self._proxies)]
        self._index += 1
        return proxy

    def format_for_playwright(self, proxy: dict) -> dict:
        # IPRoyal et la plupart des providers résidentiels = HTTP uniquement
        ptype = proxy["type"] if proxy["type"] in ("socks5", "socks4") else "http"

        username = proxy.get("username", "")
        password = proxy.get("password", "")

        # Inject sticky session for IPRoyal residential proxies so the same
        # IP is kept for the entire visit (avoids Google detecting IP hops).
        if proxy.get("address", "").endswith("iproyal.com") and username and "_session-" not in password:
            session_id = _random_session_id()
            password = f"{password}_session-{session_id}"

        if username:
            # Embed credentials directly in the server URL to avoid
            # ERR_PROXY_AUTH_UNSUPPORTED with complex passwords in Playwright.
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
