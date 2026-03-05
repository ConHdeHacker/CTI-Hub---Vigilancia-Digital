# Vigilancia CTI - Guía de Actualización

Este documento describe el proceso para actualizar la plataforma Vigilancia CTI a la última versión disponible en el repositorio de GitHub.

## Proceso de Actualización por Consola

Para garantizar la integridad de los datos y la correcta aplicación de los cambios, siga estos pasos desde la consola de comandos en el directorio raíz de la aplicación:

### 1. Realizar Backup de la Base de Datos (Recomendado)
Antes de cualquier actualización, es fundamental respaldar la base de datos SQLite:
```bash
cp surveillance.db surveillance.db.bak_$(date +%Y%m%d)
```

### 2. Obtener los últimos cambios de GitHub
Descargue la última versión estable del repositorio:
```bash
git fetch origin
git pull origin main
```

### 3. Actualizar Dependencias
Si la nueva versión incluye cambios en las librerías, actualícelas:
```bash
npm install
```

### 4. Compilar la Aplicación
Genere los archivos de producción optimizados:
```bash
npm run build
```

### 5. Reiniciar el Servicio
Reinicie el servidor para aplicar los cambios:
```bash
# Si usa pm2:
pm2 restart surveillance-app

# O simplemente reinicie el proceso de node/tsx
npm run dev
```

## Notas Importantes
- **Persistencia**: La información almacenada en `surveillance.db` no se verá alterada por el proceso de `git pull`, ya que el archivo de base de datos está excluido del control de versiones.
- **Rollback**: Si necesita volver a la versión anterior, puede restaurar el backup de la base de datos y usar `git checkout` para volver a un commit o tag anterior.
