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

4. **Instalar dependencias del proyecto:**
   ```bash
   npm install
   ```

5. **Construir la aplicación para producción:**
   ```bash
   npm run build
   ```

6. **Iniciar la aplicación:**
   ```bash
   # Opción A: Inicio directo (para pruebas)
   npm start

   # Opción B: Usando PM2 (recomendado para producción)
   sudo npm install -g pm2
   pm2 start server.ts --name "cti-platform" --interpreter tsx
   pm2 save
   pm2 startup
   ```

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
