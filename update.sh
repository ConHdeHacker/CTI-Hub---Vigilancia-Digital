#!/bin/bash

# Vigilancia CTI - Script de Actualización Automática
# Este script descarga los últimos cambios de GitHub, instala dependencias, compila y reinicia la app.

echo "===================================================="
# shellcheck disable=SC2112
echo "   Vigilancia CTI - Actualizador de Sistema"
echo "===================================================="

# 1. Verificar si es un repositorio git
if [ ! -d .git ]; then
    echo "Error: No se detectó un repositorio Git. Este script solo funciona si la app fue clonada con git."
    exit 1
fi

# 2. Backup de seguridad de la base de datos
echo "[1/5] Creando copia de seguridad de la base de datos..."
if [ -f surveillance.db ]; then
    BACKUP_NAME="surveillance_backup_$(date +%Y%m%d_%H%M%S).db"
    cp surveillance.db "$BACKUP_NAME"
    echo "Backup creado: $BACKUP_NAME"
else
    echo "No se encontró base de datos previa para respaldar."
fi

# 3. Descargar cambios de GitHub
echo "[2/5] Descargando actualizaciones desde GitHub..."
git pull origin main
if [ $? -ne 0 ]; then
    echo "Error: No se pudieron descargar los cambios. Verifique su conexión o si hay conflictos locales."
    exit 1
fi

# 4. Instalar nuevas dependencias
echo "[3/5] Actualizando dependencias..."
npm install
if [ $? -ne 0 ]; then
    echo "Error durante la instalación de dependencias."
    exit 1
fi

# 5. Re-compilar el Frontend
echo "[4/5] Re-compilando assets (Vite build)..."
npm run build
if [ $? -ne 0 ]; then
    echo "Error durante la compilación."
    exit 1
fi

# 6. Reiniciar la aplicación en PM2
echo "[5/5] Reiniciando la aplicación en PM2..."
if command -v pm2 &> /dev/null; then
    pm2 restart vigilancia-cti
    echo "Aplicación reiniciada con éxito."
else
    echo "Advertencia: PM2 no está instalado o la app no está gestionada por PM2."
    echo "Inicie la app manualmente con: npm start"
fi

echo "===================================================="
echo "   ACTUALIZACIÓN COMPLETADA CON ÉXITO"
echo "===================================================="
echo "La base de datos se ha mantenido intacta."
echo "Se ha guardado un backup preventivo en: $BACKUP_NAME"
echo "===================================================="
