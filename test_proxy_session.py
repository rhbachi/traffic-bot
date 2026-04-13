import asyncio
import random
import string
from playwright.async_api import async_playwright

def random_session():
    return "".join(random.choices(string.ascii_lowercase + string.digits, k=8))

PROXY = {
    "server": "http://geo.iproyal.com:12321",
    "username": "zHi6z5D4Zj30kbvY",
    "password": f"3uG89fcqnQ41HMcr_country-ma_session-{random_session()}",
}

async def test():
    print(f"Testing with password: {PROXY['password']}")
    async with async_playwright() as p:
        browser = await p.chromium.launch(
            headless=True,
            proxy=PROXY,
            args=["--no-sandbox"]
        )
        page = await browser.new_page()
        try:
            await page.goto("https://httpbin.org/ip", timeout=30000)
            content = await page.content()
            print("IP check OK:", content[content.find('"origin"'):content.find('"origin"')+40])
        except Exception as e:
            print(f"ERROR httpbin: {e}")

        # Now try Google.ma
        try:
            await page.goto("https://www.google.ma", wait_until="commit", timeout=30000)
            print("Google.ma loaded OK — title:", await page.title())
        except Exception as e:
            print(f"ERROR google.ma: {e}")

        await browser.close()

asyncio.run(test())
