# 🎵 Music Lab - Sound Discovery Interface

Interfaz moderna para descubrir sonidos similares usando la API de Freesound con visualización de waveforms en tiempo real.

## 🚀 Inicio Rápido (Lee esto primero!)

**⚠️ IMPORTANTE:** La web se ve igual después de cambios?

👉 **Lee esto primero:** [`START_HERE.md`](./START_HERE.md) (30 segundos)

O sigue los pasos:

```bash
# 1. Reinicia servidor
npm run dev

# 2. Limpiar caché navegador
# Ctrl+Shift+Delete → Borrar todo → Recarga (Ctrl+Shift+R)

# 3. Configura API key de Freesound
# Edita .env.local y agrega tu API key
# (Ver START_HERE.md para instrucciones)
```

Luego abre: http://localhost:5173

## 📁 Estructura

```
src/
├── main.tsx              # Punto de entrada
├── App.tsx               # Componente raíz
├── components/
│   ├── Home.tsx          # Página principal
│   ├── RecordUpload.tsx  # Grabación/carga de audio
│   ├── Results.tsx       # Resultados de búsqueda
│   ├── FreesoundWaveform.tsx  # Visualizador de ondas
│   └── Layout.tsx        # Barra de navegación
├── freesoundService.ts   # Integración con Freesound API
├── audioAnalyzer.ts      # Web Audio API utilities
└── styles/
    ├── index.css         # Estilos principales
    ├── theme.css         # Variables de tema
    ├── tailwind.css      # Configuración Tailwind
    └── fonts.css         # Fuentes
```

## 🎨 Características

- ✨ Interfaz minimalista con tema oscuro
- 🎵 Grabación de audio directa desde micrófono
- 📤 Carga de archivos de audio (WAV, MP3, OGG, FLAC)
- 🌊 Visualización de waveforms en tiempo real con Web Audio API
- 🔍 Búsqueda de sonidos similares en Freesound
- 🎯 Visualización de puntuación de similitud
- 📊 Información detallada de audio (duración, sample rate, bit depth)
- 🎨 Gradientes personalizados (amarillo, naranja, verde)
- 📱 Componentes responsivos
- 🚀 Navegación fluida entre pantallas

## 📦 Dependencias

- **React 18** - Framework UI
- **Vite 6** - Build tool
- **Tailwind CSS 4** - Utilidades CSS
- **Lucide React** - Iconografía
- **Recharts** - Gráficos (opcional)
- **Web Audio API** - Análisis de audio en tiempo real (nativo del navegador)

## 🔧 Comandos

- `npm run dev` - Desarrollo con hot reload
- `npm run build` - Construcción para producción
- `npm run preview` - Vista previa de la build

## 🎯 Características de Audio

### Grabación en Tiempo Real
- Captura directa del micrófono
- Visualización en vivo del waveform
- Información de audio: duración, sample rate, bit depth
- Reproducción y re-grabación

### Análisis de Waveform
- Extracción de datos de amplitud
- Cálculo de RMS (Root Mean Square)
- Datos de pico para visualización de waveform
- Normalización de datos para mejor visualización

### Integración Freesound
- Búsqueda de sonidos similares
- Visualización de waveforms de Freesound
- Reproducción de vista previa de resultados
- Descarga de sonidos encontrados

