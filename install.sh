#!/bin/bash

# Vigilancia CTI - Script de Instalación Automática
# Este script configura el entorno, instala dependencias, compila y configura PM2.

echo "===================================================="
echo "   Vigilancia CTI - Instalador de Sistema"
echo "===================================================="

# 1. Verificar dependencias básicas
if ! command -v node &> /dev/null; then
    echo "Error: Node.js no está instalado. Por favor, instálelo (v18+ recomendado)."
    exit 1
fi

if ! command -v npm &> /dev/null; then
    echo "Error: npm no está instalado."
    exit 1
fi

# 2. Configuración de Entorno (Aislamiento)
echo "[1/6] Configurando entorno..."
# En Node.js, el aislamiento se logra mediante node_modules locales.
# Aseguramos que no haya restos de instalaciones previas.
rm -rf node_modules package-lock.json

# 3. Instalación de Dependencias
echo "[2/6] Instalando dependencias (esto puede tardar un poco)..."
npm install
if [ $? -ne 0 ]; then
    echo "Error durante la instalación de dependencias."
    exit 1
fi

# 4. Configuración de Variables de Entorno
echo "[3/6] Configuración de la aplicación..."
read -p "Puerto de escucha [3000]: " APP_PORT
APP_PORT=${APP_PORT:-3000}

read -p "¿Desea activar el MODO DEMO con datos de prueba? (s/n) [n]: " IS_DEMO
if [[ "$IS_DEMO" =~ ^([sS][iI]|[sS])$ ]]; then
    DEMO_FLAG="true"
else
    DEMO_FLAG="false"
fi

cat <<EOF > .env
PORT=${APP_PORT}
APP_MODE=production
DEMO_MODE=${DEMO_FLAG}
EOF

echo "Configuración guardada en .env"

# 5. Compilación del Frontend
echo "[4/6] Compilando assets (Vite build)..."
npm run build
if [ $? -ne 0 ]; then
    echo "Error durante la compilación."
    exit 1
fi

# 6. Configuración de PM2 (Persistencia)
echo "[5/6] Configurando PM2 para persistencia..."
if ! command -v pm2 &> /dev/null; then
    echo "Instalando PM2 globalmente..."
    npm install -g pm2
fi

# Actualizar ecosystem.config.cjs con el puerto elegido si es necesario
# (Aunque ya lee de .env, aseguramos consistencia)

pm2 delete vigilancia-cti 2>/dev/null
pm2 start ecosystem.config.cjs --env production

# 7. Configuración de Inicio Automático (Startup)
echo "[6/6] Configurando inicio automático con el sistema..."
pm2 startup | grep "sudo" > startup_cmd.sh
if [ -s startup_cmd.sh ]; then
    echo "Para que la app inicie automáticamente al arrancar el servidor, ejecute:"
    cat startup_cmd.sh
    echo "Y después ejecute: pm2 save"
else
    pm2 save
fi

echo "===================================================="
echo "   INSTALACIÓN COMPLETADA CON ÉXITO"
echo "===================================================="
echo "App: http://localhost:${APP_PORT}"
echo "Modo Demo: ${DEMO_FLAG}"
echo "Comandos útiles:"
echo "  - Ver logs: pm2 logs vigilancia-cti"
echo "  - Estado: pm2 status"
echo "  - Reiniciar: pm2 restart vigilancia-cti"
echo "===================================================="
rm -f startup_cmd.sh
