@echo off
REM Buscar Node.js y ejecutar npm install

setlocal enabledelayedexpansion

REM Rutas comunes donde se instala Node.js
set "paths=C:\Program Files\nodejs;C:\Program Files (x86)\nodejs;C:\tools\nodejs;C:\nodejs"

for %%P in (%paths%) do (
    if exist "%%P\npm.cmd" (
        echo Encontrado Node.js en: %%P
        cd /d "%~dp0"
        echo.
        echo Instalando dependencias...
        "%%P\npm.cmd" install
        if errorlevel 0 (
            echo.
            echo ✓ Dependencias instaladas exitosamente
            echo.
            echo Para iniciar el servidor de desarrollo, ejecuta:
            echo npm run dev
        )
        exit /b 0
    )
)

echo.
echo ERROR: No se encontro Node.js instalado
echo.
echo Por favor instala Node.js desde: https://nodejs.org/
echo Descarga la version LTS (Long Term Support)
echo.
pause
