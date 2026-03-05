# Vigilancia CTI - Guía de Gestión

Este documento describe los procesos para instalar y actualizar la plataforma Vigilancia CTI.

---

## 🚀 Instalación

Para una instalación rápida y automática, puede utilizar el script de instalación incluido.

### Proceso Automático (Recomendado)

1. Otorgue permisos de ejecución al script:
   ```bash
   chmod +x install.sh
   ```
2. Ejecute el script:
   ```bash
   ./install.sh
   ```
   *El script le guiará para configurar el **puerto de red**.*

3. Una vez finalizado, inicie la aplicación:
   ```bash
   npm start
   ```
   *La primera pantalla que verá al acceder será el **Login**, donde deberá introducir las credenciales creadas en el paso anterior.*

### Proceso Manual

Si prefiere realizar la instalación paso a paso:

1. **Instalar Dependencias**:
   ```bash
   npm install
   ```
2. **Configurar Entorno**:
   Cree un archivo `.env` en la raíz del proyecto y defina las variables necesarias:
   ```env
   PORT=3000
   APP_MODE=production
   ```
3. **Iniciar la aplicación**:
   ```bash
   npm start
   ```
   *La primera vez que acceda, utilice las credenciales por defecto:*
   - **Usuario**: `admin`
   - **Contraseña**: `admin123`
   
   *El sistema le solicitará obligatoriamente cambiar la contraseña tras el primer inicio de sesión.*
3. **Compilar**:
   ```bash
   npm run build
   ```
4. **Iniciar**:
   ```bash
   npm start
   ```

---

## 🔄 Actualización

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
npm start
```

---

## 📝 Notas Importantes
- **Persistencia**: La información almacenada en `surveillance.db` no se verá alterada por el proceso de `git pull`, ya que el archivo de base de datos está excluido del control de versiones.
- **Rollback**: Si necesita volver a la versión anterior, puede restaurar el backup de la base de datos y usar `git checkout` para volver a un commit o tag anterior.
- **Configuración de Puerto**: El puerto se configura mediante la variable de entorno `PORT` en el archivo `.env`.
