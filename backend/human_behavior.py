import asyncio
import random
import math


async def random_delay(min_ms: int = 500, max_ms: int = 2000):
    await asyncio.sleep(random.randint(min_ms, max_ms) / 1000)


async def human_type(page, selector: str, text: str):
    """Type text character by character with random delays like a human."""
    await page.wait_for_selector(selector, timeout=15000)
    await page.click(selector)
    await random_delay(200, 500)
    for char in text:
        await page.keyboard.type(char)
        await asyncio.sleep(random.uniform(0.05, 0.25))
    await random_delay(300, 700)


async def human_scroll(page, direction: str = "down", distance: int = None):
    """Scroll the page naturally with variable speed."""
    if distance is None:
        distance = random.randint(200, 800)

    steps = random.randint(5, 15)
    step_size = distance // steps

    for _ in range(steps):
        delta = step_size if direction == "down" else -step_size
        await page.mouse.wheel(0, delta)
        await asyncio.sleep(random.uniform(0.05, 0.15))


async def human_move_and_click(page, selector: str):
    """Move mouse naturally to element and click."""
    element = await page.query_selector(selector)
    if not element:
        return False

    box = await element.bounding_box()
    if not box:
        return False

    # Target: random point within element
    target_x = box["x"] + random.uniform(box["width"] * 0.2, box["width"] * 0.8)
    target_y = box["y"] + random.uniform(box["height"] * 0.2, box["height"] * 0.8)

    # Get current mouse position (start from a random spot on screen)
    start_x = random.randint(100, 800)
    start_y = random.randint(100, 600)

    # Move in curve
    await bezier_mouse_move(page, start_x, start_y, target_x, target_y)
    await random_delay(100, 300)
    await page.mouse.click(target_x, target_y)
    return True


async def bezier_mouse_move(page, x1: float, y1: float, x2: float, y2: float):
    """Move mouse along a Bezier curve for natural movement."""
    # Control points for the curve
    cx1 = x1 + random.uniform(-100, 100) + (x2 - x1) * 0.3
    cy1 = y1 + random.uniform(-100, 100) + (y2 - y1) * 0.3
    cx2 = x2 + random.uniform(-100, 100) - (x2 - x1) * 0.3
    cy2 = y2 + random.uniform(-100, 100) - (y2 - y1) * 0.3

    steps = random.randint(20, 40)
    await page.mouse.move(x1, y1)

    for i in range(1, steps + 1):
        t = i / steps
        # Cubic Bezier formula
        x = (1-t)**3 * x1 + 3*(1-t)**2*t * cx1 + 3*(1-t)*t**2 * cx2 + t**3 * x2
        y = (1-t)**3 * y1 + 3*(1-t)**2*t * cy1 + 3*(1-t)*t**2 * cy2 + t**3 * y2
        await page.mouse.move(x, y)
        await asyncio.sleep(random.uniform(0.005, 0.02))


async def simulate_reading(page, duration_seconds: int):
    """Simulate a user reading the page for a given duration."""
    elapsed = 0
    while elapsed < duration_seconds:
        action = random.choices(
            ["scroll_down", "scroll_up", "pause", "move_mouse"],
            weights=[50, 15, 25, 10]
        )[0]

        if action == "scroll_down":
            await human_scroll(page, "down", random.randint(150, 500))
            wait = random.uniform(1.5, 4.0)
        elif action == "scroll_up":
            await human_scroll(page, "up", random.randint(100, 300))
            wait = random.uniform(1.0, 2.5)
        elif action == "pause":
            wait = random.uniform(2.0, 6.0)
        else:
            # Random mouse movement
            x = random.randint(100, 1200)
            y = random.randint(100, 700)
            await page.mouse.move(x, y)
            wait = random.uniform(0.5, 1.5)

        await asyncio.sleep(wait)
        elapsed += wait


def get_random_user_agent(device_type: str = "desktop") -> str:
    desktop_agents = [
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36",
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36",
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:122.0) Gecko/20100101 Firefox/122.0",
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_2_1) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Safari/605.1.15",
        "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36",
    ]
    mobile_agents = [
        "Mozilla/5.0 (iPhone; CPU iPhone OS 17_2_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Mobile/15E148 Safari/604.1",
        "Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Mobile Safari/537.36",
        "Mozilla/5.0 (Linux; Android 13; Samsung Galaxy S23) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36",
        "Mozilla/5.0 (iPhone; CPU iPhone OS 16_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/121.0.0.0 Mobile/15E148 Safari/604.1",
    ]
    safari_agents = [
        # Safari iOS - iPhone
        "Mozilla/5.0 (iPhone; CPU iPhone OS 17_3 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.3 Mobile/15E148 Safari/604.1",
        "Mozilla/5.0 (iPhone; CPU iPhone OS 17_2 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Mobile/15E148 Safari/604.1",
        "Mozilla/5.0 (iPhone; CPU iPhone OS 16_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Mobile/15E148 Safari/604.1",
        "Mozilla/5.0 (iPhone; CPU iPhone OS 15_8 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/15.6.1 Mobile/15E148 Safari/604.1",
        # Safari iPad
        "Mozilla/5.0 (iPad; CPU OS 17_3 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.3 Mobile/15E148 Safari/604.1",
        "Mozilla/5.0 (iPad; CPU OS 16_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Mobile/15E148 Safari/604.1",
        # Safari macOS
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_3) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.3 Safari/605.1.15",
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 13_6) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.1 Safari/605.1.15",
    ]

    if device_type == "safari":
        return random.choice(safari_agents)
    if device_type == "mobile":
        return random.choice(mobile_agents)
    return random.choice(desktop_agents)


COUNTRY_LOCALES = {
    "US": {"locale": "en-US", "timezone": "America/New_York"},
    "GB": {"locale": "en-GB", "timezone": "Europe/London"},
    "FR": {"locale": "fr-FR", "timezone": "Europe/Paris"},
    "DE": {"locale": "de-DE", "timezone": "Europe/Berlin"},
    "CA": {"locale": "en-CA", "timezone": "America/Toronto"},
    "AU": {"locale": "en-AU", "timezone": "Australia/Sydney"},
    "IN": {"locale": "en-IN", "timezone": "Asia/Kolkata"},
    "BR": {"locale": "pt-BR", "timezone": "America/Sao_Paulo"},
    "KR": {"locale": "ko-KR", "timezone": "Asia/Seoul"},
    "TR": {"locale": "tr-TR", "timezone": "Europe/Istanbul"},
    "MA": {"locale": "ar-MA", "timezone": "Africa/Casablanca"},
}


def get_locale_settings(country: str) -> dict:
    return COUNTRY_LOCALES.get(country, COUNTRY_LOCALES["US"])
