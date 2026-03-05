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

# 3. Configurar Super Admin
echo ""
echo "------------------------------------------------"
echo "   CONFIGURACIÓN DEL USUARIO SUPER ADMIN"
echo "------------------------------------------------"
echo "Este usuario tendrá control total sobre la plataforma."
echo ""

read -p "Nombre de usuario [admin]: " ADMIN_USER
ADMIN_USER=${ADMIN_USER:-admin}

read -p "Email de contacto [admin@cti-platform.com]: " ADMIN_EMAIL
ADMIN_EMAIL=${ADMIN_EMAIL:-admin@cti-platform.com}

# Solicitar password de forma segura
while true; do
    read -s -p "Contraseña para el Super Admin: " ADMIN_PASS
    echo ""
    if [ -z "$ADMIN_PASS" ]; then
        echo "Error: La contraseña no puede estar vacía."
    else
        read -s -p "Confirme la contraseña: " ADMIN_PASS_CONFIRM
        echo ""
        if [ "$ADMIN_PASS" == "$ADMIN_PASS_CONFIRM" ]; then
            break
        else
            echo "Error: Las contraseñas no coinciden. Inténtelo de nuevo."
        fi
    fi
done

# 4. Crear archivo .env
echo "PORT=${APP_PORT}" > .env
echo "APP_MODE=production" >> .env
echo "ADMIN_USER=${ADMIN_USER}" >> .env
echo "ADMIN_EMAIL=${ADMIN_EMAIL}" >> .env
echo "ADMIN_PASS=${ADMIN_PASS}" >> .env

echo ""
echo "Archivo de configuración .env generado correctamente."

# 5. Instalar dependencias
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
