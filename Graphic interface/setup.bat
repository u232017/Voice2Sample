@echo off
REM Setup and run script for SonicMatch (Windows)

echo.
echo 🎵 SonicMatch - Setup y ejecucion
echo ==================================
echo.

REM Paso 1: Verificar Node.js
echo 1️⃣ Verificando Node.js...
node -v >nul 2>&1
if errorlevel 1 (
    echo ❌ Node.js no esta instalado
    exit /b 1
)
echo ✅ Node.js instalado: 
node -v
echo.

REM Paso 2: Instalar dependencias
echo 2️⃣ Instalando dependencias...
call npm install
echo ✅ Dependencias instaladas
echo.

REM Paso 3: Crear archivo .env.local si no existe
echo 3️⃣ Configurando variables de entorno...
if not exist .env.local (
    copy .env.example .env.local
    echo ✅ Archivo .env.local creado
    echo.
    echo ⚠️ IMPORTANTE: Edita .env.local y agrega tu API key de Freesound:
    echo    VITE_FREESOUND_API_KEY=tu_key_aqui
    echo.
    echo    Para obtener la API key:
    echo    1. Ve a: https://freesound.org/api/apply/
    echo    2. Crea una cuenta si no tienes
    echo    3. Solicita una API application
    echo    4. Copia tu API key
    echo.
) else (
    echo ✅ Archivo .env.local ya existe
)
echo.

REM Paso 4: Verificar API key
echo 4️⃣ Verificando API key...
findstr /R "VITE_FREESOUND_API_KEY=your_api_key_here" .env.local >nul
if not errorlevel 1 (
    echo ⚠️ API key no configurada
    echo    Edita .env.local y agrega tu API key de Freesound
) else (
    echo ✅ API key parece estar configurada
)
echo.

REM Paso 5: Ejecutar dev server
echo 5️⃣ Iniciando servidor de desarrollo...
echo 🚀 Abre el navegador en: http://localhost:5173
echo.
call npm run dev
pause
