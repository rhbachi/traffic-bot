import asyncio
from playwright.async_api import async_playwright

PROXY = {
    "server": "http://geo.iproyal.com:12321",
    "username": "zHi6z5D4Zj30kbvY",
    "password": "3uG89fcqnQ41HMcr_country-fr",
}

async def test():
    async with async_playwright() as p:
        print("Launching browser with proxy...")
        browser = await p.chromium.launch(
            headless=True,
            proxy=PROXY,
            args=["--no-sandbox"]
        )
        page = await browser.new_page()
        print("Navigating to ip check...")
        try:
            await page.goto("https://httpbin.org/ip", timeout=30000)
            content = await page.content()
            print("Response:", content[:300])
        except Exception as e:
            print(f"ERROR: {e}")
        await browser.close()

asyncio.run(test())
