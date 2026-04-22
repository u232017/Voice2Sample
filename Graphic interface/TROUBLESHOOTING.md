# 🔧 Guía de Solución de Problemas - SonicMatch

## Problema 1: La web sigue siendo igual después de los cambios

### ✅ Solución

**Paso 1: Detener el servidor**
```bash
# Presiona Ctrl+C en la terminal donde se ejecuta el servidor
```

**Paso 2: Limpiar caché de Vite**
```bash
# En Windows
rmdir /s /q node_modules\.vite
# En Mac/Linux
rm -rf node_modules/.vite
```

**Paso 3: Reinstalar dependencias**
```bash
npm install
```

**Paso 4: Reiniciar servidor**
```bash
npm run dev
```

**Paso 5: Limpiar caché del navegador**
```
En Chrome/Edge/Firefox:
1. Presiona Ctrl+Shift+Delete (o Cmd+Shift+Delete en Mac)
2. Selecciona "Todas las cookies y otros datos de sitio"
3. Presiona "Borrar datos"
4. Recarga la página (Ctrl+Shift+R para recarga dura)
```

---

## Problema 2: No aparecen resultados de Freesound

### ✅ Solución

**Paso 1: Verificar que tienes API key**
```bash
# Abre el archivo .env.local
# Debe verse así:
VITE_FREESOUND_API_KEY=xxxxxxxxxxxxx

# NO debe verse así:
VITE_FREESOUND_API_KEY=your_api_key_here
VITE_FREESOUND_API_KEY=
```

**Paso 2: Obtener API key (si no la tienes)**
```
1. Ve a: https://freesound.org/api/apply/
2. Haz clic en "Crear cuenta" o "Log in"
3. Completa el formulario si es nuevo usuario
4. Ve a "Applications" o "My Applications"
5. Haz clic en "Create a new API request"
6. Completa el formulario:
   - Name: SonicMatch (o lo que quieras)
   - Purpose: Audio search and discovery
7. Acepta los términos
8. Recibirás un API key (similar a: abc123def456...)
```

**Paso 3: Agregar API key a .env.local**
```bash
# Edita el archivo .env.local
# Cambia esto:
VITE_FREESOUND_API_KEY=your_api_key_here

# Por esto:
VITE_FREESOUND_API_KEY=tu_api_key_real_aqui
```

**Paso 4: Reiniciar servidor**
```bash
# Detén el servidor (Ctrl+C)
# Ejecuta nuevamente:
npm run dev
```

**Paso 5: Verificar en consola del navegador**
```bash
# En el navegador:
1. Presiona F12 (o Ctrl+Shift+I)
2. Ve a la pestaña "Console"
3. Busca errores rojos
4. Si ves "Freesound API key not configured"
   significa que .env.local no se lee correctamente
```

---

## Problema 3: No puedo grabar sonido / El micrófono no funciona

### ✅ Solución

**Paso 1: Verificar permisos del navegador**
```
1. Ve a http://localhost:5173
2. El navegador debe pedirte permiso para acceder al micrófono
3. Haz clic en "Permitir" o "Allow"
4. Si dice "Bloqueado":
   - Chrome/Edge: Haz clic en el icono de candado (🔒) en la barra de direcciones
   - Selecciona "Permisos del sitio"
   - En "Micrófono" selecciona "Permitir"
```

**Paso 2: Verificar que funciona la grabación**
```
1. Abre la página de RecordUpload
2. Haz clic en el botón de micrófono (🎤)
3. Deberías ver un botón ROJO pulsante que dice "Recording..."
4. Haz clic en el botón rojo para detener
5. Deberías ver el waveform del audio grabado
```

**Paso 3: Si aún no funciona, revisa la consola**
```
1. Presiona F12
2. Ve a la pestaña "Console"
3. Busca mensajes de error
4. Errores comunes:
   - "NotAllowedError: Permission denied"
     → El usuario rechazó el permiso del micrófono
   - "NotFoundError: No media devices found"
     → No hay micrófono conectado
   - "PermissionError"
     → El navegador no tiene permiso
```

**Paso 4: Soluciones por navegador**

**Chrome/Edge:**
- Ve a `chrome://settings/content/microphone` (o edge equivalente)
- Asegúrate que http://localhost:5173 esté en "Permitir"
- Si está en "Bloquear", haz clic en X para remover

**Firefox:**
- Ve a `about:preferences#privacy`
- Busca "Permisos"
- Verifica "Micrófono"
- Haz clic en "Configuración" si está bloqueado

**Safari (Mac):**
- System Preferences → Security & Privacy → Microphone
- Asegúrate que Safari está en la lista de permitidos

---

## Problema 4: Errores de compilación/TypeScript

### ✅ Solución

**Error: "Cannot find module 'freesoundService'"**
```bash
# Solución: El archivo no está en la ubicación correcta
# Verifica que exista:
# src/freesoundService.ts
# src/audioAnalyzer.ts

# Si no existen, descarga nuevamente los archivos
```

**Error: "Property 'audioRef' does not exist"**
```bash
# Solución: Limpiar node_modules y reinstalar
rm -rf node_modules
npm install
npm run dev
```

**Error: "Cannot find name 'MediaRecorder'"**
```typescript
// Solución: TypeScript no reconoce la API
// El archivo debe tener la configuración correcta en tsconfig.json
// Verifica que incluya:
// "dom" en libs: ["ES2020", "DOM", "DOM.Iterable"]
```

---

## Problema 5: El servidor no inicia

### ✅ Solución

**Error: "Port 5173 is already in use"**
```bash
# Solución 1: Terminar el proceso anterior
# En Windows:
netstat -ano | findstr :5173
# Anota el PID y:
taskkill /PID <numero_pid> /F

# En Mac/Linux:
lsof -i :5173
# Anota el PID y:
kill -9 <numero_pid>

# Solución 2: Usar un puerto diferente
npm run dev -- --port 3000
```

**Error: "npm: command not found"**
```bash
# Node.js/npm no está instalado
# Descarga e instala desde: https://nodejs.org/
# Versión recomendada: LTS (18.x o superior)
```

---

## Problema 6: El waveform no se muestra

### ✅ Solución

**Paso 1: Verificar que hay audio grabado**
```
1. Abre la consola (F12)
2. Graba un sonido
3. Deberías ver un waveform generado automáticamente
```

**Paso 2: Si no se ve nada**
```
- El audio probablemente no se grabó
- Vuelve a intentar con micrófono permitido
- Verifica que el navegador muestre "Recording..."
```

**Paso 3: Si se ve pero se ve extraño**
```
- Podría ser un problema de normalización de datos
- Intenta con un audio más fuerte
- Haz ruido en el micrófono mientras grabas
```

---

## Problema 7: Los resultados de Freesound cargan pero sin waveforms

### ✅ Solución

**Paso 1: Esto es normal**
```
Los waveforms de Freesound se cargan como imágenes.
Si no se ven, podría ser:
- Problema de CORS
- URL de imagen inválida
- Problema de conexión a internet
```

**Paso 2: Soluciones**
```
1. Abre F12 → Network
2. Recarga la página
3. Filtra por "waveform"
4. Si ves errores 404 o CORS, significa que Freesound tiene limitaciones
```

---

## ✅ Checklist de Configuración Completa

Sigue estos pasos en orden:

- [ ] 1. Node.js instalado: `node -v`
- [ ] 2. npm instalado: `npm -v`
- [ ] 3. Entrar a carpeta: `cd "Graphic interface"`
- [ ] 4. Instalar dependencias: `npm install`
- [ ] 5. Crear .env.local: `cp .env.example .env.local` (o copy en Windows)
- [ ] 6. Obtener API key de Freesound
- [ ] 7. Editar .env.local y agregar API key
- [ ] 8. Iniciar servidor: `npm run dev`
- [ ] 9. Abrir navegador: http://localhost:5173
- [ ] 10. Permitir acceso al micrófono
- [ ] 11. Probar grabar sonido
- [ ] 12. Probar analizar

---

## 🆘 Aún no funciona?

**Próximos pasos:**
1. Abre F12 (Consola del navegador)
2. Copia TODO lo que ves en rojo
3. Crea un issue en GitHub con:
   - El error exacto
   - Los pasos que seguiste
   - Tu sistema operativo
   - Tu navegador y versión

---

## 📞 Comandos Útiles

```bash
# Ver si puerto está en uso (Windows)
netstat -ano | findstr :5173

# Ver procesos Node (Mac/Linux)
ps aux | grep node

# Limpiar npm cache
npm cache clean --force

# Verificar versión de Node
node -v

# Reinstalar todo
rm -rf node_modules package-lock.json
npm install

# Ejecutar con puerto diferente
npm run dev -- --port 3000

# Build para producción
npm run build

# Preview de build
npm run preview
```

---

## 🎯 Resumen Rápido

Si solo ves la pantalla de inicio pero ninguna funcionalidad:

```bash
# 1. Detén el servidor (Ctrl+C)
# 2. Ejecuta:
npm install
npm run dev

# 3. Abre http://localhost:5173 en navegador nuevo
# 4. Limpiar caché (Ctrl+Shift+Delete)
# 5. Si no funciona, agrega API key a .env.local
```

**¡Debería funcionar! 🚀**
