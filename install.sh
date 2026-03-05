#!/bin/bash

# Vigilancia CTI - Script de Instalación Automática

# Configuración por defecto
DEFAULT_PORT=3000

echo "--- Iniciando Instalación de Vigilancia CTI ---"

# 1. Verificar dependencias
if ! command -v node &> /dev/null; then
    echo "Error: Node.js no está instalado. Por favor, instálelo antes de continuar."
    exit 1
fi

if ! command -v npm &> /dev/null; then
    echo "Error: npm no está instalado. Por favor, instálelo antes de continuar."
    exit 1
fi

# 2. Configurar puerto
read -p "Introduzca el puerto de exposición [${DEFAULT_PORT}]: " APP_PORT
APP_PORT=${APP_PORT:-$DEFAULT_PORT}

echo "Configurando la aplicación en el puerto: ${APP_PORT}"

# 3. Crear archivo .env
echo "PORT=${APP_PORT}" > .env
echo "APP_MODE=production" >> .env

# 4. Instalar dependencias
echo "Instalando dependencias de npm..."
npm install

# 5. Compilar la aplicación
echo "Compilando la aplicación (Vite build)..."
npm run build

echo "--- Instalación Completada con Éxito ---"
echo ""
echo "Para iniciar la aplicación, ejecute:"
echo "npm start"
echo ""
echo "La aplicación estará disponible en: http://localhost:${APP_PORT}"
