# 🎵 Music Lab - Interfaz de Descubrimiento de Sonidos

Interfaz moderna para descubrir sonidos similares usando la API de Freesound.

## 🚀 Cómo Ver y Ejecutar la Interfaz

### Instalación
```bash
npm install  # Las dependencias ya están instaladas
```

### Ejecutar en desarrollo
```bash
npm run dev
```
Abre tu navegador en **[http://localhost:5173](http://localhost:5173)**

### Construir para producción
```bash
npm run build
npm run preview  # Ver la build compilada
```

## 📁 Estructura del Proyecto

```
Graphic interface/
├── src/
│   ├── main.tsx                    # Punto de entrada de React
│   ├── App.tsx                     # Componente raíz
│   ├── components/
│   │   ├── Home.tsx                # Página principal
│   │   ├── RecordUpload.tsx        # Grabación/carga de audio
│   │   ├── Results.tsx             # Resultados de búsqueda
│   │   ├── FreesoundWaveform.tsx   # Visualizador de ondas de audio
│   │   └── Layout.tsx              # Barra de navegación
│   └── styles/
│       ├── index.css               # Estilos principales
│       ├── theme.css               # Variables de tema
│       ├── tailwind.css            # Configuración Tailwind
│       └── fonts.css               # Fuentes
├── index.html                      # Archivo HTML principal
├── vite.config.ts                  # Configuración de Vite
├── tailwind.config.js              # Configuración de Tailwind CSS
├── postcss.config.mjs              # Configuración de PostCSS
└── package.json                    # Dependencias del proyecto
```

## 🎨 Características

- **Interfaz minimalista** con tema oscuro moderno
- **Visualización de ondas de audio** animadas en tiempo real
- **Gradientes personalizados** (amarillo, naranja, verde)
- **Componentes responsivos** que se adaptan a cualquier pantalla
- **Navegación fluida** entre pantallas de grabación y resultados
- **Reproducción de audio** integrada para comparar sonidos

## 🔄 Flujo de Usuario

1. **Usuario abre la aplicación**
2. **Elige método de entrada:** grabar sonido o cargar archivo
3. **Sistema procesa el audio** y muestra pantalla de carga
4. **Búsqueda en Freesound API** para encontrar sonidos similares
5. **Mostrar resultados recomendados**
6. **Interactuar:** escuchar, comparar y descargar sonidos

## 📦 Dependencias

- **React 18** - Framework UI
- **Vite 6** - Build tool ultra rápido
- **Tailwind CSS 4** - Utilidades CSS
- **Lucide React** - Iconografía
- **Recharts** - Gráficos (opcional)
- **TypeScript 5** - Tipado estático

## 🔧 Comandos

- `npm run dev` - Desarrollo con hot reload
- `npm run build` - Construcción para producción
- `npm run preview` - Vista previa de la build

## 📝 Notas

- El servidor de desarrollo se ejecuta en **puerto 5173**
- Todos los componentes están en **TypeScript + React**
- Los estilos se gestionan con **Tailwind CSS** y **CSS personalizado**
- Ver [interface-flow.md](./interface-flow.md) para detalles técnicos del flujo
