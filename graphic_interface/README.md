# 🎵 Music Lab - Sound Discovery Interface

Interfaz moderna para descubrir sonidos similares usando la API de Freesound.

## 🚀 Inicio Rápido

### Con Node.js (Recomendado)

```bash
# Instalar dependencias
npm install

# Ejecutar servidor de desarrollo
npm run dev
```

Abre [http://localhost:5173](http://localhost:5173) en tu navegador.

### Con Python (Alternativa)

```bash
python server.py
```

Abre [http://localhost:8000](http://localhost:8000) en tu navegador.

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
└── styles/
    ├── index.css         # Estilos principales
    ├── theme.css         # Variables de tema
    ├── tailwind.css      # Configuración Tailwind
    └── fonts.css         # Fuentes
```

## 🎨 Características

- Interfaz minimalista con tema oscuro
- Visualización de ondas de audio animadas
- Gradientes personalizados (amarillo, naranja, verde)
- Componentes responsivos
- Navegación fluida entre pantallas

## 📦 Dependencias

- **React 18** - Framework UI
- **Vite 6** - Build tool
- **Tailwind CSS 4** - Utilidades CSS
- **Lucide React** - Iconografía
- **Recharts** - Gráficos (opcional)

## 🔧 Comandos

- `npm run dev` - Desarrollo con hot reload
- `npm run build` - Construcción para producción
- `npm run preview` - Vista previa de la build
