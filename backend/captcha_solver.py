import asyncio
import aiohttp
import logging

logger = logging.getLogger(__name__)


class CaptchaSolver:
    """
    Intégration 2captcha pour résoudre reCAPTCHA v2.
    Inscription sur 2captcha.com (~$3 pour 1000 CAPTCHAs).
    """

    def __init__(self, api_key: str):
        self.api_key = api_key
        self.base_url = "http://2captcha.com"

    async def solve_recaptcha_v2(self, site_key: str, page_url: str, timeout: int = 120) -> str | None:
        """
        Résout un reCAPTCHA v2 et retourne le token g-recaptcha-response.
        """
        if not self.api_key:
            logger.warning("[CAPTCHA] No API key configured, skipping")
            return None

        try:
            # Étape 1 : soumettre le CAPTCHA
            async with aiohttp.ClientSession() as session:
                submit_url = f"{self.base_url}/in.php"
                params = {
                    "key": self.api_key,
                    "method": "userrecaptcha",
                    "googlekey": site_key,
                    "pageurl": page_url,
                    "json": 1,
                }
                async with session.post(submit_url, data=params) as resp:
                    data = await resp.json()
                    if data.get("status") != 1:
                        logger.error(f"[CAPTCHA] Submit error: {data}")
                        return None
                    captcha_id = data["request"]
                    logger.info(f"[CAPTCHA] Submitted, ID: {captcha_id}")

                # Étape 2 : polling jusqu'à résolution
                result_url = f"{self.base_url}/res.php"
                result_params = {
                    "key": self.api_key,
                    "action": "get",
                    "id": captcha_id,
                    "json": 1,
                }

                for attempt in range(timeout // 5):
                    await asyncio.sleep(5)
                    async with session.get(result_url, params=result_params) as resp:
                        result = await resp.json()
                        if result.get("status") == 1:
                            token = result["request"]
                            logger.info(f"[CAPTCHA] Solved! Token: {token[:30]}...")
                            return token
                        elif result.get("request") == "CAPCHA_NOT_READY":
                            logger.debug(f"[CAPTCHA] Not ready yet, attempt {attempt + 1}")
                            continue
                        else:
                            logger.error(f"[CAPTCHA] Error: {result}")
                            return None

        except Exception as e:
            logger.error(f"[CAPTCHA] Exception: {e}")
            return None

        logger.error("[CAPTCHA] Timeout waiting for solution")
        return None

    async def inject_token(self, page, token: str):
        """Injecte le token reCAPTCHA dans la page."""
        await page.evaluate(f"""
            document.querySelector('#g-recaptcha-response') &&
            (document.querySelector('#g-recaptcha-response').value = '{token}');

            // Pour les reCAPTCHA cachés
            var el = document.querySelector('[name="g-recaptcha-response"]');
            if (el) el.value = '{token}';

            // Déclencher le callback si présent
            if (typeof ___grecaptcha_cfg !== 'undefined') {{
                Object.entries(___grecaptcha_cfg.clients).forEach(([key, client]) => {{
                    const callback = Object.entries(client).find(([k, v]) =>
                        k === 'callback' && typeof v === 'function'
                    );
                    if (callback) callback[1]('{token}');
                }});
            }}
        """)
        logger.info("[CAPTCHA] Token injected into page")


# Instance globale (configurée via settings)
_solver_instance = None


def get_solver(api_key: str = None) -> CaptchaSolver | None:
    global _solver_instance
    if api_key:
        _solver_instance = CaptchaSolver(api_key)
    return _solver_instance
