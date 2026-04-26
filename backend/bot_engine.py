import asyncio
import random
import json
import logging
import zipfile
import os
import shutil
import string
import tempfile
import glob
from typing import Optional

import nodriver as uc
from nodriver import Config

from human_behavior import get_random_user_agent, get_locale_settings
from proxy_manager import proxy_manager
from database import add_log, update_campaign_stats, get_settings
from captcha_solver import CaptchaSolver

logger = logging.getLogger(__name__)

SEARCH_ENGINES = {
    "google": {
        "url": "https://www.google.com",
        "search_box": 'textarea[name="q"], input[name="q"]',
        "result_selector": "#rso a",
    },
    "bing": {
        "url": "https://www.bing.com",
        "search_box": "#sb_form_q",
        "result_selector": "li.b_algo h2 a",
    },
    "duckduckgo": {
        "url": "https://duckduckgo.com",
        "search_box": 'input[name="q"]',
        "result_selector": 'article[data-testid="result"] a[data-testid="result-title-a"]',
    },
    "google_maps": {
        "url": "https://www.google.com/maps",
        "search_box": "input#searchboxinput",
        "result_selector": 'div[role="feed"] a',
    },
}

# Track active tasks per campaign
active_tasks: dict = {}


# ─── Proxy Extension ──────────────────────────────────────────────────────────

def _make_session_id() -> str:
    return "".join(random.choices(string.ascii_lowercase + string.digits, k=8))


def _create_proxy_extension(proxy: dict, session_id: str) -> str:
    """
    Build a Chrome extension zip that handles authenticated proxy.
    Returns the path to the zip file (caller must clean up).
    """
    password = proxy.get("password", "")
    # Sticky session for IPRoyal
    if proxy.get("address", "").endswith("iproyal.com") and "_session-" not in password:
        password = f"{password}_session-{session_id}"

    ptype = proxy.get("type", "http")
    if ptype not in ("socks5", "socks4"):
        ptype = "http"

    manifest = json.dumps({
        "version": "1.0.0",
        "manifest_version": 2,
        "name": "Proxy Auth",
        "permissions": [
            "proxy", "tabs", "unlimitedStorage", "storage",
            "<all_urls>", "webRequest", "webRequestBlocking"
        ],
        "background": {"scripts": ["background.js"]},
        "minimum_chrome_version": "22.0.0"
    })

    background = """
var config = {
    mode: "fixed_servers",
    rules: {
        singleProxy: { scheme: "%s", host: "%s", port: parseInt(%s) },
        bypassList: ["localhost"]
    }
};
chrome.proxy.settings.set({value: config, scope: "regular"}, function(){});
chrome.webRequest.onAuthRequired.addListener(
    function(details) {
        return { authCredentials: { username: "%s", password: "%s" } };
    },
    { urls: ["<all_urls>"] },
    ["blocking"]
);
""" % (ptype, proxy["address"], proxy["port"], proxy.get("username", ""), password)

    tmp = tempfile.mkdtemp(prefix="bot_proxy_")
    plugin_path = os.path.join(tmp, "proxy.zip")
    with zipfile.ZipFile(plugin_path, "w") as zp:
        zp.writestr("manifest.json", manifest)
        zp.writestr("background.js", background)
    return plugin_path


def _cleanup_plugin(plugin_path: str):
    try:
        if plugin_path and os.path.exists(plugin_path):
            shutil.rmtree(os.path.dirname(plugin_path), ignore_errors=True)
    except Exception:
        pass


def _cleanup_chrome_temps():
    """Remove leftover Chromium user-data dirs and temp files."""
    patterns = [
        "/tmp/uc_*",
        "/tmp/bot_proxy_*",
        "/tmp/.org.chromium.*",
        "/tmp/chrome_*",
        "/tmp/.com.google.Chrome*",
        "/tmp/extension_*",
        "/tmp/nodriver_*",
        "/root/.config/chromium",
        "/root/.config/google-chrome",
        "/root/.cache/chromium",
    ]
    for pattern in patterns:
        for path in glob.glob(pattern):
            try:
                shutil.rmtree(path, ignore_errors=True) if os.path.isdir(path) else os.remove(path)
            except Exception:
                pass




# ─── Human Behavior (nodriver) ────────────────────────────────────────────────

async def _rnd(min_ms=500, max_ms=2000):
    await asyncio.sleep(random.randint(min_ms, max_ms) / 1000)


async def _type(tab, selector: str, text: str):
    """Type character by character with human delays. Returns the element.
    Handles comma-separated selectors (nodriver only supports single selectors).
    """
    el = None
    for sel in selector.split(","):
        sel = sel.strip()
        try:
            el = await tab.select(sel, timeout=5)
            if el:
                break
        except Exception:
            continue
    if not el:
        raise Exception(f"[BOT] Selector not found: {selector}")
    await el.click()
    await asyncio.sleep(random.uniform(0.2, 0.5))
    for char in text:
        await el.send_keys(char)
        await asyncio.sleep(random.uniform(0.05, 0.25))
    await asyncio.sleep(random.uniform(0.3, 0.7))
    return el


async def _scroll(tab, direction="down", distance=None):
    if distance is None:
        distance = random.randint(200, 800)
    steps = random.randint(5, 15)
    step_size = max(1, distance // steps)
    for _ in range(steps):
        if direction == "down":
            await tab.scroll_down(step_size)
        else:
            await tab.scroll_up(step_size)
        await asyncio.sleep(random.uniform(0.05, 0.15))


async def _simulate_reading(tab, duration_seconds: int):
    elapsed = 0.0
    while elapsed < duration_seconds:
        action = random.choices(
            ["scroll_down", "scroll_up", "pause"],
            weights=[50, 15, 35]
        )[0]
        if action == "scroll_down":
            await _scroll(tab, "down", random.randint(150, 500))
            wait = random.uniform(1.5, 4.0)
        elif action == "scroll_up":
            await _scroll(tab, "up", random.randint(100, 300))
            wait = random.uniform(1.0, 2.5)
        else:
            wait = random.uniform(2.0, 6.0)
        await asyncio.sleep(wait)
        elapsed += wait


# ─── CAPTCHA ──────────────────────────────────────────────────────────────────

async def _handle_captcha(tab) -> bool:
    """Detect and solve reCAPTCHA if present. Returns True if clear."""
    try:
        captcha_el = await tab.select('iframe[src*="recaptcha"], div.g-recaptcha', timeout=3)
        if not captcha_el:
            return True

        logger.info("[CAPTCHA] reCAPTCHA detected")
        settings = get_settings()
        api_key = settings.get("captcha_api_key", "").strip()
        if not api_key:
            logger.warning("[CAPTCHA] No API key — skipping")
            return False

        solver = CaptchaSolver(api_key)
        site_key = await tab.evaluate("""
            (() => {
                const el = document.querySelector('[data-sitekey]');
                if (el) return el.getAttribute('data-sitekey');
                const iframe = document.querySelector('iframe[src*="recaptcha"]');
                if (iframe) {
                    const m = iframe.src.match(/[?&]k=([^&]+)/);
                    return m ? m[1] : null;
                }
                return null;
            })()
        """)
        if not site_key:
            logger.warning("[CAPTCHA] Could not extract site key")
            return False

        page_url = tab.url
        logger.info(f"[CAPTCHA] Submitting to solver — key: {site_key[:20]}...")
        token = await solver.solve_recaptcha_v2(site_key, page_url)
        if not token:
            return False

        await tab.evaluate(f"""
            (() => {{
                const el = document.querySelector('#g-recaptcha-response, [name="g-recaptcha-response"]');
                if (el) el.value = '{token}';
                if (typeof ___grecaptcha_cfg !== 'undefined') {{
                    Object.values(___grecaptcha_cfg.clients).forEach(c => {{
                        const cb = Object.entries(c).find(([k,v]) => k==='callback' && typeof v==='function');
                        if (cb) cb[1]('{token}');
                    }});
                }}
            }})()
        """)
        await asyncio.sleep(1.5)
        logger.info("[CAPTCHA] Token injected")
        return True

    except Exception as e:
        logger.debug(f"[CAPTCHA] check error: {e}")
        return True  # Assume no captcha if detection itself fails


# ─── Browser Launch ───────────────────────────────────────────────────────────

async def _launch(campaign: dict, session_id: str):
    """Launch a nodriver browser with correct config. Returns (browser, plugin_path)."""
    locale_settings = get_locale_settings(campaign.get("country", "US"))
    user_agent = get_random_user_agent(campaign.get("device_type", "desktop"))

    import os
    config = Config()
    # In Docker/VPS there is no display — must run headless
    config.headless = os.environ.get("BROWSER_HEADLESS", "true").lower() != "false"
    config.sandbox = False
    config.lang = locale_settings["locale"]

    # Point to system Chromium when running in Docker
    chromium_path = os.environ.get("CHROME_BIN", "")
    if not chromium_path:
        for candidate in ["/usr/bin/chromium", "/usr/bin/chromium-browser", "/usr/bin/google-chrome"]:
            if os.path.exists(candidate):
                chromium_path = candidate
                break
    if chromium_path:
        config.browser_executable_path = chromium_path

    # Only add args NOT managed by Config attributes
    # (sandbox, headless are set via config.sandbox/config.headless above)
    config.add_argument(f"--user-agent={user_agent}")
    config.add_argument("--disable-gpu")
    config.add_argument("--disable-dev-shm-usage")
    config.add_argument("--disable-software-rasterizer")
    config.add_argument("--window-size=1920,1080")
    config.add_argument("--disk-cache-size=0")
    config.add_argument("--media-cache-size=0")
    config.add_argument("--disable-application-cache")
    config.add_argument("--remote-debugging-address=127.0.0.1")

    proxy = None
    proxy_str = "direct"
    plugin_path = None
    _proxy_auth = None  # (username, password) if credentials needed

    if campaign.get("use_proxies"):
        proxy = proxy_manager.get_proxy(campaign.get("user_id", 0), campaign.get("country", ""))
        if proxy:
            proxy_str = f"{proxy['address']}:{proxy['port']}"
            ptype = "http" if proxy.get("type") not in ("socks5", "socks4") else proxy["type"]
            config.add_argument(f"--proxy-server={ptype}://{proxy['address']}:{proxy['port']}")
            # SOCKS proxies resolve DNS locally by default — force DNS through the proxy
            # to prevent the VPS IP from leaking via DNS queries
            if ptype in ("socks5", "socks4"):
                config.add_argument("--proxy-dns")
            if proxy.get("username"):
                password = proxy.get("password", "")
                # Sticky session for IPRoyal
                if proxy.get("address", "").endswith("iproyal.com") and "_session-" not in password:
                    password = f"{password}_session-{session_id}"
                _proxy_auth = (proxy["username"], password)

    browser = await uc.start(config=config)
    tab = browser.main_tab

    # Handle proxy authentication via CDP Fetch interception.
    # Chrome extensions are silently ignored in headless mode, causing Chrome to
    # bypass the proxy entirely and connect directly from the VPS.
    # CDP Fetch auth interception is headless-safe and triggers before any navigation.
    if _proxy_auth:
        _u, _p = _proxy_auth
        try:
            await tab.send(uc.cdp.fetch.enable(handle_auth_requests=True))

            # Without patterns, fetch.enable intercepts ALL requests (RequestPaused).
            # We must continue them immediately or Chrome hangs on every resource load.
            async def _continue_request(event: uc.cdp.fetch.RequestPaused):
                try:
                    await tab.send(uc.cdp.fetch.continue_request(request_id=event.request_id))
                except Exception:
                    pass

            async def _handle_proxy_auth(event: uc.cdp.fetch.AuthRequired):
                try:
                    await tab.send(uc.cdp.fetch.continue_with_auth(
                        request_id=event.request_id,
                        auth_challenge_response=uc.cdp.fetch.AuthChallengeResponse(
                            response="ProvideCredentials",
                            username=_u,
                            password=_p,
                        )
                    ))
                except Exception:
                    pass

            tab.add_handler(uc.cdp.fetch.RequestPaused, _continue_request)
            tab.add_handler(uc.cdp.fetch.AuthRequired, _handle_proxy_auth)
        except Exception as e:
            logger.warning("[BOT] CDP proxy auth setup failed: %s", e)

    # Inject timezone via CDP
    try:
        await tab.send(uc.cdp.emulation.set_timezone_override(
            timezone_id=locale_settings["timezone"]
        ))
    except Exception:
        pass

    return browser, tab, proxy, proxy_str, plugin_path


# ─── Visit Logic ──────────────────────────────────────────────────────────────

async def run_visit(campaign: dict) -> bool:
    engine_config = SEARCH_ENGINES.get(campaign["search_engine"], SEARCH_ENGINES["google"])
    raw_kw = campaign.get("keywords", [])
    keywords = raw_kw if isinstance(raw_kw, list) else json.loads(raw_kw or "[]")
    if not keywords:
        keywords = [campaign.get("target_url", "")]

    keyword = random.choice(keywords)
    session_id = _make_session_id()
    proxy = None
    proxy_str = "direct"
    plugin_path = None
    success = False
    time_on_site = 0

    try:
        browser, tab, proxy, proxy_str, plugin_path = await _launch(campaign, session_id)

        await _rnd(500, 1500)

        if campaign["search_engine"] == "google_maps":
            success, time_on_site = await _visit_google_maps(tab, engine_config, keyword, campaign)
        else:
            success, time_on_site = await _visit_search_engine(tab, engine_config, keyword, campaign)

        browser.stop()

        if proxy:
            if success:
                proxy_manager.mark_success(proxy)
            else:
                proxy_manager.mark_failure(proxy)

        add_log(campaign["id"], keyword, "success" if success else "failed",
                proxy_str, time_on_site, campaign["search_engine"])
        update_campaign_stats(campaign["id"], success)

    except Exception as e:
        logger.error(f"Visit error campaign {campaign['id']}: {e}")
        if proxy:
            proxy_manager.mark_failure(proxy)
        add_log(campaign["id"], keyword, "error", proxy_str, 0, campaign["search_engine"])
        update_campaign_stats(campaign["id"], False)
    finally:
        _cleanup_plugin(plugin_path)
        _cleanup_chrome_temps()

    return success


async def _visit_search_engine(tab, engine_config: dict, keyword: str, campaign: dict):
    time_on_site = 0
    try:
        logger.info(f"[BOT] → {engine_config['url']} keyword: {keyword}")
        await tab.get(engine_config["url"])
        logger.info(f"[BOT] Page loaded")
        await _rnd(1000, 2500)

        # Cookie consent via JS (no blocking waits)
        consented = await tab.evaluate("""
            (() => {
                const texts = ['Accept all', 'Tout accepter', "J'accepte", 'Accepter tout', 'I agree', 'Agree'];
                const btns = document.querySelectorAll('button, [role="button"]');
                for (const btn of btns) {
                    if (texts.some(t => btn.innerText && btn.innerText.trim().startsWith(t))) {
                        btn.click();
                        return btn.innerText.trim();
                    }
                }
                return null;
            })()
        """)
        if consented:
            logger.info(f"[BOT] Consent clicked: {consented}")
            await _rnd(1500, 3000)

        # Wait for search box to be available
        for sel in ['textarea[name="q"]', 'input[name="q"]']:
            try:
                await tab.select(sel, timeout=8)
                break
            except Exception:
                continue

        # Type keyword
        logger.info(f"[BOT] Typing keyword...")
        search_el = await _type(tab, engine_config["search_box"], keyword)
        await search_el.send_keys("\n")
        await asyncio.sleep(3)
        await _rnd(1000, 2000)

        # Handle CAPTCHA
        captcha_ok = await _handle_captcha(tab)
        if not captcha_ok:
            logger.warning("[BOT] CAPTCHA — aborting visit")
            return False, time_on_site

        # Wait for results container to appear
        try:
            await tab.select("#rso, #search, .g", timeout=10)
        except Exception:
            pass
        await asyncio.sleep(1.5)

        logger.info("[BOT] Results page loaded, scanning...")
        await _scroll(tab, "down", random.randint(300, 600))
        await _rnd(800, 2000)

        # Find target URL in results (up to 5 pages)
        target_url = campaign.get("target_url", "")
        clicked = False

        if target_url:
            target_clean = target_url.replace("https://", "").replace("http://", "").rstrip("/")

            for page_num in range(1, 6):
                try:
                    # Use JS to extract all result hrefs — works regardless of selector changes
                    links = await tab.evaluate("""
                        (() => {
                            const anchors = document.querySelectorAll('#rso a[href], #search a[href], .g a[href]');
                            return Array.from(anchors)
                                .map(a => a.href)
                                .filter(h => h && h.startsWith('http') && !h.includes('google.') && !h.includes('webcache'));
                        })()
                    """)

                    if not links:
                        links = []

                    logger.info(f"[BOT] Page {page_num}: {len(links)} links found, looking for {target_clean}")

                    target_href = None
                    for href in links:
                        if target_clean in href:
                            target_href = href
                            break

                    if target_href:
                        # Find and click the element with this href
                        js_click = await tab.evaluate(f"""
                            (() => {{
                                const anchors = document.querySelectorAll('#rso a[href], #search a[href], .g a[href]');
                                for (const a of anchors) {{
                                    if (a.href && a.href.includes('{target_clean}')) {{
                                        a.scrollIntoView({{behavior: 'smooth', block: 'center'}});
                                        return a.href;
                                    }}
                                }}
                                return null;
                            }})()
                        """)
                        if js_click:
                            await asyncio.sleep(random.uniform(0.5, 1.2))
                            await tab.get(target_href)
                            clicked = True
                            logger.info(f"[BOT] Found and navigated to target on page {page_num}!")
                            break

                    if clicked:
                        break

                    # Go to next page via URL parameter (most reliable)
                    if page_num < 5:
                        await _scroll(tab, "down", 800)
                        await _rnd(500, 1000)

                        # Try clicking next button via JS (works for all languages)
                        next_clicked = await tab.evaluate("""
                            (() => {
                                const next = document.querySelector('#pnnext, a[aria-label*="Next"], a[aria-label*="Suivant"], a[aria-label*="Page suivante"], td.b.navend a');
                                if (next) { next.click(); return true; }
                                return false;
                            })()
                        """)
                        if next_clicked:
                            await asyncio.sleep(3)
                            await _rnd(1000, 2000)
                            try:
                                await tab.select("#rso, #search", timeout=8)
                            except Exception:
                                pass
                            await asyncio.sleep(1)
                        else:
                            logger.info(f"[BOT] No next page button found at page {page_num}")
                            break

                except Exception as e:
                    logger.warning(f"[BOT] Page {page_num} error: {e}")
                    break

        if not clicked and target_url:
            url = target_url if target_url.startswith("http") else f"https://{target_url}"
            logger.info(f"[BOT] Not in SERP — direct visit: {url}")
            try:
                await tab.get(url)
                clicked = True
            except Exception as e:
                logger.warning(f"[BOT] Direct visit failed: {e}")

        if clicked:
            bounce_rate = campaign.get("bounce_rate", 30)
            will_bounce = random.randint(1, 100) <= bounce_rate

            if will_bounce:
                min_bounce = max(5, campaign.get("min_time_on_site", 5))
                time_on_site = random.randint(min_bounce, min_bounce + 20)
                await asyncio.sleep(time_on_site)
            else:
                min_t = campaign.get("min_time_on_site", 30)
                max_t = campaign.get("max_time_on_site", 180)
                time_on_site = random.randint(min_t, max_t)
                await _simulate_reading(tab, time_on_site)

            return True, time_on_site

    except Exception as e:
        logger.warning(f"[BOT] Visit error: {e}")

    return False, time_on_site


async def _visit_google_maps(tab, engine_config: dict, keyword: str, campaign: dict):
    time_on_site = 0
    try:
        await tab.get(engine_config["url"])
        await _rnd(1500, 3000)

        search_el = await _type(tab, engine_config["search_box"], keyword)
        await search_el.send_keys("\n")
        await asyncio.sleep(4)

        results = await tab.select_all(engine_config["result_selector"])
        if results:
            await results[0].click()
            await _rnd(1000, 2500)
            time_on_site = random.randint(
                campaign.get("min_time_on_site", 20),
                campaign.get("max_time_on_site", 90)
            )
            await _simulate_reading(tab, time_on_site)
            return True, time_on_site

    except Exception as e:
        logger.warning(f"[BOT] Maps error: {e}")

    return False, time_on_site


# ─── Campaign Loop ────────────────────────────────────────────────────────────

async def start_campaign(campaign: dict):
    campaign_id = campaign["id"]
    if campaign_id in active_tasks:
        return

    active_tasks[campaign_id] = True
    logger.info(f"Campaign {campaign_id} started")

    daily_visits = campaign.get("daily_visits", 100)
    interval = (16 * 3600) / daily_visits

    while active_tasks.get(campaign_id):
        try:
            await run_visit(campaign)
            jitter = interval * random.uniform(0.7, 1.3)
            await asyncio.sleep(jitter)
        except asyncio.CancelledError:
            break
        except Exception as e:
            logger.error(f"Campaign {campaign_id} loop error: {e}")
            await asyncio.sleep(30)

    active_tasks.pop(campaign_id, None)
    logger.info(f"Campaign {campaign_id} stopped")


def stop_campaign(campaign_id: int):
    active_tasks.pop(campaign_id, None)


def is_campaign_running(campaign_id: int) -> bool:
    return campaign_id in active_tasks


def get_running_campaigns() -> list:
    return list(active_tasks.keys())
