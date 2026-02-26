# Plataforma de Vigilancia Digital y CTI

Esta plataforma es un sistema integral de Inteligencia de Amenazas (CTI) que permite la monitorización de activos digitales, gestión de alertas y configuración de conectores de categorización.

## Requisitos Previos

- Ubuntu 22.04 LTS o superior
- Node.js 18.x o superior
- npm 9.x o superior

## Instalación Sencilla en Ubuntu

Sigue estos pasos para desplegar la aplicación en tu servidor:

1. **Actualizar el sistema e instalar dependencias básicas:**
   ```bash
   sudo apt update && sudo apt upgrade -y
   sudo apt install -y git curl build-essential
   ```

2. **Instalar Node.js (v18):**
   ```bash
   curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
   sudo apt install -y nodejs
   ```

3. **Clonar el repositorio y entrar en la carpeta:**
   ```bash
   git clone <url-del-repositorio>
   cd <nombre-de-la-carpeta>
   ```

3. **Configurar la aplicación:**
   El proyecto ya incluye un archivo `.env` por defecto. Puedes editarlo para cambiar el modo o el puerto:
   ```bash
   nano .env
   ```
   Dentro del archivo verás:
   - `APP_MODE`: Cámbialo a `production` para una instalación limpia o déjalo en `development` para datos de prueba.
   - `PORT`: Define el puerto en el que quieres que se exponga la herramienta (por defecto 3000).

4. **Instalar dependencias del proyecto:**
   ```bash
   npm install
   ```

5. **Construir la aplicación para producción:**
   ```bash
   npm run build
   ```

6. **Iniciar la aplicación:**

   ### Modo A: Inicio Directo (Para pruebas rápidas)
   ```bash
   npm start
   ```
   *Nota: Esto iniciará el servidor en el puerto 3000.*

   ### Modo B: Producción con PM2 (Recomendado)
   PM2 permite que la aplicación se ejecute en segundo plano y se reinicie automáticamente si falla.

   1. **Instalar PM2 globalmente:**
      ```bash
      sudo npm install -g pm2
      ```

   2. **Lanzar la aplicación:**
      ```bash
      pm2 start server.ts --name "cti-platform" --interpreter tsx
      ```

   3. **(Opcional) Configurar inicio automático al reiniciar el servidor:**
      ```bash
      pm2 save
      pm2 startup
      ```
      *Nota: El comando `pm2 startup` te devolverá una línea que empieza por `sudo env PATH=...`. Debes copiar y pegar esa línea exacta en tu terminal para completar la configuración.*

La aplicación estará disponible en `http://tu-ip-del-servidor:3000`.

## Estructura del Proyecto

- `server.ts`: Servidor backend Express con base de datos SQLite.
- `src/App.tsx`: Aplicación frontend principal en React.
- `categorization-connector/`: Microservicio independiente para categorización de amenazas.

## Configuración

La configuración se gestiona a través del panel de administración dentro de la aplicación (solo para Super Admins). Puedes configurar:
- Idioma de la interfaz.
- Etiquetas de categorías de alertas.
- Conectores y proveedores de inteligencia.
- Logs de depuración del sistema.
