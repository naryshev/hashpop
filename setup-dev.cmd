@echo off
REM Hashpop dev setup - run from project root. Requires Node.js 18-22.

cd /d "%~dp0"

echo Installing root dependencies...
call npm install
if errorlevel 1 exit /b 1

echo.
echo Installing frontend dependencies...
cd frontend
call npm install
if errorlevel 1 exit /b 1

echo.
echo Installing backend dependencies...
cd ..\backend
call npm install
if errorlevel 1 exit /b 1

echo.
echo Generating Prisma client...
call npx prisma generate
if errorlevel 1 exit /b 1

cd "%~dp0"
echo.
echo Done. Next: npm run dev
echo   Backend: http://localhost:4000   Frontend: http://localhost:3000
