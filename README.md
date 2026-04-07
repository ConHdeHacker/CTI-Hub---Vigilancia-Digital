# Vigilancia CTI - Plataforma de Inteligencia de Amenazas

Plataforma integral para la gestión de alertas de ciberinteligencia, monitorización de activos y gestión de takedowns.

## 🚀 Despliegue Rápido (Automático)

La forma más sencilla de instalar y configurar todo el entorno (incluyendo persistencia con PM2) es usar el script de instalación:

```bash
chmod +x install.sh
./install.sh
```

El script se encargará de:
1. Verificar dependencias (Node.js, NPM).
2. Instalar dependencias del proyecto.
3. Configurar el puerto y el **Modo Demo**.
4. Compilar el frontend.
5. Configurar PM2 para que la app se mantenga activa permanentemente.
6. Generar el comando para que la app inicie automáticamente al arrancar el servidor.

---

## 🛠️ Despliegue Manual (Paso a paso)

Si prefieres configurar el entorno manualmente, sigue estos pasos:

### 1. Preparar el entorno
Asegúrate de tener Node.js (v18+) instalado. El aislamiento del entorno se gestiona mediante el directorio local `node_modules`.

```bash
npm install
```

### 2. Configuración (.env)
Crea un archivo `.env` en la raíz con el siguiente contenido:
```env
PORT=3000
APP_MODE=production
DEMO_MODE=false
```

### 3. Compilación y Ejecución
```bash
# Compilar el frontend
npm run build

# Iniciar en modo producción
npm start
```

---

## 📊 Entorno de Pruebas (Modo Demo)

Para desplegar un entorno con **información de prueba** (alertas, clientes y conectores pre-cargados):

1. Durante la ejecución de `./install.sh`, responde **'s'** cuando se te pregunte por el Modo Demo.
2. O manualmente, edita tu `.env` y establece `DEMO_MODE=true`, luego reinicia la app.

---

## 🔄 Persistencia y Auto-inicio (PM2)

Para asegurar que la aplicación sobreviva a reinicios del servidor:

1. **Instalar PM2**: `npm install -g pm2`
2. **Iniciar**: `pm2 start ecosystem.config.cjs`
3. **Persistencia**:
   ```bash
   pm2 startup
   # Ejecuta el comando que devuelva la terminal (con sudo)
   pm2 save
   ```

### Comandos Útiles de PM2:
- `pm2 status`: Ver estado de la aplicación.
- `pm2 logs vigilancia-cti`: Ver logs en tiempo real.
- `pm2 restart vigilancia-cti`: Reiniciar la aplicación.

---

## 📁 Estructura del Proyecto
- `/src`: Código fuente del Frontend (React + Vite).
- `server.ts`: Servidor Backend (Express + SQLite).
- `surveillance.db`: Base de datos local (SQLite).
- `ecosystem.config.cjs`: Configuración de procesos PM2.
