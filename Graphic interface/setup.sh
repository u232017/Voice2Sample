#!/bin/bash
# Setup and run script for SonicMatch

echo "🎵 SonicMatch - Setup y ejecución"
echo "=================================="
echo ""

# Paso 1: Verificar Node.js
echo "1️⃣ Verificando Node.js..."
if ! command -v node &> /dev/null; then
    echo "❌ Node.js no está instalado"
    exit 1
fi
echo "✅ Node.js instalado: $(node -v)"
echo ""

# Paso 2: Instalar dependencias
echo "2️⃣ Instalando dependencias..."
npm install
echo "✅ Dependencias instaladas"
echo ""

# Paso 3: Crear archivo .env.local si no existe
echo "3️⃣ Configurando variables de entorno..."
if [ ! -f .env.local ]; then
    cp .env.example .env.local
    echo "✅ Archivo .env.local creado"
    echo ""
    echo "⚠️  IMPORTANTE: Edita .env.local y agrega tu API key de Freesound:"
    echo "   VITE_FREESOUND_API_KEY=tu_key_aqui"
    echo ""
    echo "   Para obtener la API key:"
    echo "   1. Ve a: https://freesound.org/api/apply/"
    echo "   2. Crea una cuenta si no tienes"
    echo "   3. Solicita una API application"
    echo "   4. Copia tu API key"
    echo ""
else
    echo "✅ Archivo .env.local ya existe"
fi
echo ""

# Paso 4: Verificar API key
echo "4️⃣ Verificando API key..."
if grep -q "VITE_FREESOUND_API_KEY=your_api_key_here" .env.local || grep -q "VITE_FREESOUND_API_KEY=$" .env.local; then
    echo "⚠️  API key no configurada"
    echo "   Edita .env.local y agrega tu API key de Freesound"
else
    echo "✅ API key parece estar configurada"
fi
echo ""

# Paso 5: Ejecutar dev server
echo "5️⃣ Iniciando servidor de desarrollo..."
echo "🚀 Abre el navegador en: http://localhost:5173"
echo ""
npm run dev
