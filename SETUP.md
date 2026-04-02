## 🔧 CONFIGURACIÓN INICIAL (One-time setup)
Paso 1: Google Cloud Credentials

    Ve a Google Cloud Console
    Crea un proyecto nuevo (o usa existente)
    APIs & Services → Enable Google Sheets API
    Credentials → Create Service Account → Download JSON
    Guarda ese archivo como scripts/credentials.json (NO lo subas a Git, está en .gitignore)

Paso 2: Compartir Sheet

    Comparte tu Google Sheet con el email del Service Account (termina en @...gserviceaccount.com) con permisos de Lector.

Paso 3: GitHub Secret (para Actions)
Si usarás el botón de GitHub:

    Repo → Settings → Secrets and variables → Actions
    New repository secret: GOOGLE_CREDENTIALS
    Value: Pega el contenido completo del archivo credentials.json



## Crear un Token en GitHub (La "llave" de acceso)

GitHub no deja que cualquier script entre en tu cuenta sin permiso. Tienes que crear una "llave":

    Ve a tu GitHub, pincha en tu foto (arriba a la derecha) > Settings.

    En el menú de la izquierda, baja hasta el final y dale a Developer settings.

    Selecciona Personal access tokens > Tokens (classic).

    Dale a Generate new token > Generate new token (classic).

    Nombre: Ponle "Google Sheets Menu".

    Expiración: Ponle "No expiration" (para que no deje de funcionar en 30 días).

    Permisos (Scopes): Marca solo la casilla que dice workflow (esto permite al script ejecutar acciones).

    Dale abajo del todo a Generate token.

    ¡IMPORTANTE!: Copia ese código (empieza por ghp_...). Guárdalo en un bloc de notas, porque no volverás a verlo nunca más.

### REPASO CON KIMI:
2. BALANCE DEL SISTEMA (Qué hemos montado)
Flujo completo "One-Click":
plain
Copy

GESTOR (Google Sheets)
        ↓
[Click en Menú > Publicar Web] 
        ↓
GOOGLE APPS SCRIPT ( integrado en Sheet)
        ↓
HTTP POST → GITHUB ACTIONS (webhook)
        ↓
PYTHON (sync.py) lee Sheets → Genera JSON
        ↓
COMMIT automático a GitHub
        ↓
GITHUB PAGES sirve la web estática

El gestor solo toca:

    Editar datos en Menu_ES (como un Excel)
    Opcional: Corregir traducciones en Menu_INT
    Click en menú personalizado "🍔 Publicar Web"
    Esperar 30 segundos

Tecnologías involucradas:

    Frontend: HTML5 + Tailwind CSS + Vanilla JS (PWA)
    Backend: Python (automatización) + GitHub Actions (CI/CD)
    Datos: Google Sheets (CMS) + Google Apps Script (triggers)
    Hosting: GitHub Pages (CDN global gratuito)

3. MIGRACIÓN A DOMINIO PROPIO (Opciones)
Opción A: GitHub Pages + Dominio Personalizado (FÁCIL)
Qué cambia: Solo DNS, ningún archivo de código.

    Configuras un CNAME en tu DNS: menu.tudominio.com → tusuario.github.io
    En repo: Settings → Pages → Custom domain: menu.tudominio.com
    El base_url en Config del Sheet cambia a https://menu.tudominio.com
    Ventaja: Gratis, sigue funcionando igual, HTTPS automático.

Opción B: Hosting Tradicional (cPanel/FTP) (MEDIO)
Qué cambia:

    base_url en Sheet: https://tudominio.com/carpeta/
    Subir contenido de /docs por FTP (no usar GitHub Pages)
    Requisitos: Servidor con HTTPS, soporte para archivos estáticos.
    Script Python: Sigue igual, pero el git push se reemplaza por FTP upload (o sigues usando GitHub solo como storage y luego FTP manual).

Opción C: Vercel/Netlify (FÁCIL)
Qué cambia:

    Conectar repo a Vercel (gratis) en vez de GitHub Pages
    Cambiar base_url en Sheet a la URL de Vercel
    Ventaja: Mejor rendimiento que GitHub Pages en algunas regiones, preview URLs automáticas.

Recomendación: Opción A. Es la más simple y profesional. GitHub Pages es robusto para esto.
4. PRUEBA DE QR (Guía rápida)
Generar QR por mesa:

    URL base: https://ritalee79.github.io/menu-restaurante-qr/?mesa=5
    (cambia el número por cada mesa)
    Generador online gratuito:
        Ve a qr-code-generator.com o qrcode-monkey.com
        Pega la URL con el parámetro mesa
        Descarga PNG/SVG
        Imprime en vinilo resistente (tamaño recomendado: 8x8 cm mínimo para escanear fácil)
    Testeo:
        Abre cámara del móvil → Apunta al QR → Debe abrir navegador directamente
        Verifica que en la web arriba pone "Mesa: 5" (o el número correspondiente)
        Añade algo al carrito → Cambia de mesa (modifica URL a ?mesa=3) → El carrito debe estar vacío (cada mesa tiene carrito independiente por localStorage)

5. GUÍA DE MIGRACIÓN A CUENTAS DEL AMIGO (Checklist)
Cuando quieras pasar esto a las cuentas oficiales del restaurante, sigue este orden:
A. Preparación GitHub (Cuenta nueva)

    Crear cuenta GitHub con email del restaurante
    Crear repo público: menu-restaurante-qr
    Activar GitHub Pages (Source: main branch, folder: /docs)
    Generar Personal Access Token (Settings → Developer settings → Tokens → Fine-grained tokens):
        Permisos: Contents (read/write), Actions (read/write)
        Guardar el token (empieza por ghp_...)

B. Preparación Google Cloud (Cuenta nueva)

    Crear proyecto en Google Cloud Console (nombre: "Menu Restaurante")
    Activar Google Sheets API
    Crear Service Account:
        Nombre: menu-sync
        Rol: Editor (o solo Sheets read-only si prefieres)
        Descargar JSON de credenciales (renombrar a credentials.json)
    Copiar el email del Service Account (termina en @...gserviceaccount.com)

C. Preparación Google Sheets (Nueva hoja)

    Crear Sheets desde cero o hacer "Copia" de la tuya actual
    Compartir la hoja con el email del Service Account (permiso: Editor)
    Actualizar hoja Config:
        github_username: usuario del amigo
        repo_name: nombre del repo
        nombre_restaurante: nombre real

D. Google Apps Script (Nuevo script)

    En la nueva hoja: Extensiones → Apps Script
    Pegar el código GAS (el que te daré abajo) modificado:
        Cambiar GITHUB_TOKEN por el token del paso A4
        Cambiar REPO_OWNER y REPO_NAME
    Guardar → Ejecutar función onOpen una vez para autorizar permisos
    Recargar la hoja (F5) → Debe aparecer el menú "🍔 Menú Restaurante"

E. Subida inicial

    Subir fotos a docs/img/platos/ en el nuevo repo (GitHub web o git)
    Subir iconos a docs/img/icons/icons_small/
    Ejecutar primer sync manual desde tu PC (con credentials.json nuevo) para generar menu-data.json inicial
    Hacer commit/push de todo

F. Verificación

    Abrir web en https://nuevo-usuario.github.io/menu-restaurante-qr/
    Verificar que carga el menú
    Probar botón "Publicar Web" desde Sheets y verificar que se actualiza

Código GAS básico para el menú (resumen):
JavaScript
Copy

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('🍔 Menú Restaurante')
    .addItem('Generar traducciones', 'generarTraducciones')
    .addItem('Publicar Web', 'dispararGitHubAction')
    .addToUi();
}

function dispararGitHubAction() {
  const token = 'ghp_TOKENDELAMIGGOAQUI'; // CAMBIAR
  const owner = 'USUARIOAMIGO'; // CAMBIAR
  const repo = 'menu-restaurante-qr'; // CAMBIAR
  
  UrlFetchApp.fetch(
    `https://api.github.com/repos/${owner}/${repo}/actions/workflows/sync.yml/dispatches`,
    {
      method: 'POST',
      headers: {
        'Authorization': `token ${token}`,
        'Accept': 'application/vnd.github.v3+json'
      },
      payload: JSON.stringify({ ref: 'main' })
    }
  );
  SpreadsheetApp.getUi().alert('🚀 Web actualizándose... (tarda 30s)');
}

Variables críticas a cambiar en cada migración:

    SHEET_ID en sync.py
    github_username y repo_name en hoja Config
    Token GitHub en el código GAS
    URLs en el Sheets si cambia el dominio

### NUEVOS PASOS:

1. Crear un bot de Telegram

    Abre Telegram y busca @BotFather.

    Envía el mensaje: /newbot

    Sigue las instrucciones:

        Pon un nombre para tu bot (ej. Menú Al Daniel Bot)

        Pon un nombre de usuario para el bot (ej. MenuAlDanielBot). Debe terminar en bot.

    Al finalizar, BotFather te dará un token. Guárdalo en un lugar seguro. Es algo como:
    text

    1234567890:ABCdefGHIjklmNOPqrStuVWXyz

    Este token es tu TELEGRAM_BOT_TOKEN.

2. Obtener el ID del chat (chat_id)

Necesitas saber el ID del chat al que enviar los mensajes. Puede ser un grupo, un canal o tu propio chat.
Opción A: Tu propio chat (para pruebas)

    Busca tu bot en Telegram (por su username) y envíale un mensaje cualquiera (ej. /start).

    Abre el siguiente enlace en tu navegador (sustituye TU_TOKEN):
    text

    https://api.telegram.org/botTU_TOKEN/getUpdates

    (Si usas curl, también funciona)

    En la respuesta JSON, busca el chat_id. Si acabas de enviar el mensaje, debería aparecer en result[0].message.chat.id.

Opción B: Grupo (si quieres que varios reciban la notificación)

    Crea un grupo en Telegram y añade tu bot como miembro.

    Envía un mensaje al grupo (cualquier cosa).

    Obtén el chat_id de la misma forma con getUpdates. Puede ser un número negativo.

3. Añadir los secrets en GitHub

Ve a tu repositorio en GitHub:

    Settings → Secrets and variables → Actions

    Haz clic en New repository secret para cada uno:

        TELEGRAM_BOT_TOKEN: pega el token que te dio BotFather.

        TELEGRAM_CHAT_ID: pega el número que obtuviste (puede ser positivo o negativo, pero siempre es un número entero).

4. Verificar que el paso funciona

El código que tienes en sync.yml está bien, pero asegúrate de:

    Los nombres de los secrets coinciden exactamente (TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID).

    La variable MSG está bien formateada. El %0A es un salto de línea para URL encode.

Si quieres probar manualmente que el bot envía mensajes, puedes ejecutar este curl en tu terminal local (sustituyendo los tokens y chat_id reales):
bash

MSG="Prueba de notificación"
curl -s -X POST https://api.telegram.org/botTU_TOKEN/sendMessage \
  -d chat_id=TU_CHAT_ID \
  -d text="$MSG"


Compartir la carpeta de Drive:

    Crea la carpeta en tu Google Drive (ej. "Menu_Imagenes").

    Entra en la carpeta, dale a "Compartir".

    En tu archivo credentials.json (el que tienes para GitHub), busca el valor "client_email" (suele ser algo como tu-proyecto@tu-proyecto.iam.gserviceaccount.com).

    Añade ese correo como Lector (Viewer) en la carpeta de Drive. Esto es vital para que Python pueda descargar las fotos.

    Copia el ID de la carpeta (la cadena de letras y números que aparece en la URL del navegador al estar dentro de la carpeta).

Configurar el Sheet (Config):
Añade estas 3 filas a tu hoja Config:

    drive_images_folder_id | [Pega aquí el ID de tu carpeta]

    webp_quality | 90

    image_max_width | 1200

Activar Drive API en Google Apps Script (GAS):

    Abre tu hoja de cálculo > Extensiones > Apps Script.

    En la barra lateral izquierda, haz clic en el botón "+" al lado de "Servicios".

    Busca "Drive API" en la lista.

    Selecciona la versión por defecto (v3) y haz clic en "Añadir".

    (Esto permite que el script lea el ancho de la imagen sin descargarla).


Paso crítico manual: Ve a tu script de Google > Botón "Implementar" > "Nueva implementación" > Tipo: Aplicación Web. Ejecutar como: Tú. Quién tiene acceso: Cualquier persona. Copia la URL que te da y pégala en la pestaña Config de Sheets bajo la clave gas_webapp_url.
⚠️ IMPORTANTE: Recuerda que en Apps Script, cada vez que cambias código, debes ir a Implementar > Nueva Implementación (no sirve con guardar, hay que crear una nueva versión).