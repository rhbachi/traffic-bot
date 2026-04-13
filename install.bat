@echo off
echo ==========================================
echo   Traffic Bot - Installation
echo ==========================================

echo.
echo [1/4] Installation des dependances Python...
pip install -r requirements.txt

echo.
echo [2/4] Installation de Playwright...
playwright install chromium

echo.
echo [3/4] Construction du frontend...
cd traffic-bot-ui
pnpm install
pnpm build
cd ..

echo.
echo [4/4] Copie du frontend vers le backend...
xcopy /E /Y traffic-bot-ui\dist frontend\dist\

echo.
echo ==========================================
echo   Installation terminee !
echo   Lancez start.bat pour demarrer le bot
echo ==========================================
pause
