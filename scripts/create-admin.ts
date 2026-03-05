import Database from 'better-sqlite3';
import { v4 as uuidv4 } from 'uuid';
import readline from 'readline';

const db = new Database('database.sqlite');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function question(query: string): Promise<string> {
  return new Promise((resolve) => rl.question(query, resolve));
}

async function main() {
  console.log("\n------------------------------------------------");
  console.log("   CONFIGURACIÓN DEL USUARIO SUPER ADMIN");
  console.log("------------------------------------------------");
  console.log("Este script creará el usuario con control total.");
  console.log("");

  const username = await question("Nombre de usuario [admin]: ") || "admin";
  const email = await question("Email de contacto [admin@cti-platform.com]: ") || "admin@cti-platform.com";
  
  // Para la contraseña usamos una forma de ocultar la entrada si es posible, 
  // pero en scripts de node simples readline no lo soporta nativamente sin librerías extra.
  // Como estamos en un entorno controlado, usaremos una pregunta normal o pediremos confirmación.
  
  let password = "";
  while (true) {
    password = await question("Contraseña para el Super Admin: ");
    if (!password) {
      console.log("Error: La contraseña no puede estar vacía.");
      continue;
    }
    const confirm = await question("Confirme la contraseña: ");
    if (password === confirm) {
      break;
    }
    console.log("Error: Las contraseñas no coinciden. Inténtelo de nuevo.");
  }

  try {
    // Asegurarse de que la tabla existe (por si acaso)
    db.exec(`
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE NOT NULL,
        email TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        role TEXT NOT NULL,
        client_id INTEGER,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    const insertUser = db.prepare("INSERT INTO users (username, email, password, role, client_id) VALUES (?, ?, ?, ?, ?)");
    insertUser.run(username, email, password, "super_admin", null);
    
    console.log("\n[SUCCESS] Usuario Super Admin creado correctamente en la base de datos.");
    console.log("[INFO] No se han guardado secretos en archivos de configuración.");
  } catch (error: any) {
    if (error.message.includes('UNIQUE constraint failed')) {
      console.log("\n[ERROR] El usuario ya existe en la base de datos.");
    } else {
      console.error("\n[ERROR] No se pudo crear el usuario:", error.message);
    }
  } finally {
    rl.close();
    db.close();
  }
}

main();
