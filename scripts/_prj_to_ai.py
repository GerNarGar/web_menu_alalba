import os
import re
import subprocess

# --- Configuración ---
OUTPUT_FILE = 'proyecto_completo.txt'

EXTENSIONES_TEXTO = {
    '.js',
    '.jsx',
    '.html',
    '.css',
    '.json',
    '.md',
    '.sql',
    '.ts',
    '.toml',
    '.yml',
    '.py',
    '.gs',
    '.gitignore',
}

IGNORAR_TOTALMENTE = {
    'backups/supabase',
    'referencias',
    'node_modules',
    '.git',
    'package-lock.json',
    '.env.local',
    '.env',
    'dist',
    'build',
    '.DS_Store',
    '.idea',
    'NOTES.md',
    'ToDo.md',
    'SETUP.md',
    'scripts/_prj_to_ai.py',
    'scripts/.env',
    'scripts/credentials.json',
    # '.vscode',
    'docs/Prompt Inicial.md',
    '.temp',
}

EXTENSIONES_OMITIR = {
    '.png',
    '.jpg',
    '.jpeg',
    '.svg',
    '.ico',
    '.pdf',
    '.woff',
    '.woff2',
    '.webp',
    '.mp4',
    '.mov',
}


def obtener_ref_desde_env():
    """Busca VITE_SUPABASE_REF en el archivo .env.local"""
    try:
        with open('.env.local', 'r', encoding='utf-8') as f:
            contenido = f.read()
            match = re.search(r'VITE_SUPABASE_REF\s*=\s*["\']?([^"\']+)["\']?', contenido)
            if match:
                return match.group(1)
    except FileNotFoundError:
        print('❌ Error: No se encontró el archivo .env.local')
    return None


def generar_backup_sql():
    """Configura Supabase y genera el dump de la base de datos."""
    print('⏳ Iniciando proceso de backup con Supabase...')
    ref = obtener_ref_desde_env()
    if not ref:
        print('❌ No se pudo obtener la referencia del proyecto de .env.local. Abortando backup.')
        return

    try:
        # 1. Login (Nota: Si ya estás logueado, este paso es rápido o se puede omitir)
        # Si prefieres no hacerlo interactivo cada vez, asegúrate de haber hecho 'supabase login' antes una vez.
        print(f'🔑 Verificando sesión de Supabase...')
        # Intentamos un comando simple para ver si hay sesión
        # subprocess.run(['supabase', 'login'], check=True)

        # 2. Link del proyecto
        # print(f'🔗 Vinculando proyecto con referencia: {ref}...')
        # subprocess.run(
        #     ['supabase', 'link', '--project-ref', ref, '--debug'],
        #     check=True,
        #     capture_output=True,
        #     text=True,
        # )

        # 3. Generar el Backup
        os.makedirs('backups', exist_ok=True)
        print('💾 Generando backup_completo.sql...')
        subprocess.run(
            ['supabase', 'db', 'dump', '-f', 'backup_completo.sql'],
            cwd='backups',
            check=True,
            capture_output=True,
            text=True,
        )
        print('✅ Backup SQL generado correctamente en backups/backup_completo.sql')
    except subprocess.CalledProcessError as e:
        print(f'❌ Error en comando de Supabase:\n{e.stderr}')
        print('⚠️ Continuando con el empaquetado del proyecto sin actualizar el backup...')
    except FileNotFoundError:
        print("❌ No se encontró el comando 'supabase'. ¿Está instalado?")


def empaquetar_proyecto():
    print('⏳ Empaquetando archivos de código...')
    count = 0

    # Normalizamos las rutas de la lista de ignorados para que funcionen bien en cualquier OS (Windows/Mac/Linux)
    ignorar_norm = {os.path.normpath(i) for i in IGNORAR_TOTALMENTE}

    with open(OUTPUT_FILE, 'w', encoding='utf-8') as outfile:
        for root, dirs, files in os.walk('.'):
            # 1. Filtrar carpetas evaluando tanto su nombre suelto como su ruta relativa
            dirs_permitidos = []
            for d in dirs:
                ruta_dir_relativa = os.path.normpath(os.path.relpath(os.path.join(root, d), '.'))
                # Ignorar si el nombre exacto de la carpeta o la ruta completa están en la lista
                if d not in ignorar_norm and ruta_dir_relativa not in ignorar_norm:
                    dirs_permitidos.append(d)
            dirs[:] = (
                dirs_permitidos  # Modificamos in-place para que os.walk no entre en las ignoradas
            )

            for file in files:
                path_relativo = os.path.relpath(os.path.join(root, file), '.')
                path_norm = os.path.normpath(path_relativo)

                # 2. Check de ignorados por archivo (nombre o ruta)
                if (
                    file in ignorar_norm
                    or path_norm in ignorar_norm
                    or path_norm == OUTPUT_FILE
                    or file == os.path.basename(__file__)
                ):
                    continue

                # 3. Filtro por extensión
                _, ext = os.path.splitext(file)
                if ext.lower() in EXTENSIONES_OMITIR:
                    continue

                # AQUÍ ESTÁ LA MAGIA PARA EL .gitignore:
                # Comprobamos si la extensión ESTÁ en la lista OR si el nombre del archivo ESTÁ en la lista
                if ext.lower() in EXTENSIONES_TEXTO or file.lower() in EXTENSIONES_TEXTO:
                    outfile.write(f'\n{"=" * 60}\n')
                    outfile.write(f'ARCHIVO: {path_relativo}\n')
                    outfile.write(f'{"=" * 60}\n\n')

                    try:
                        with open(os.path.join(root, file), 'r', encoding='utf-8') as infile:
                            outfile.write(infile.read())
                            count += 1
                    except Exception as e:
                        outfile.write(f'Error al leer archivo: {e}')
                    outfile.write('\n')

    print(f'✅ ¡Hecho! Se han empaquetado {count} archivos en: {OUTPUT_FILE}')


def generar_arbol(ruta_base='.', archivo_salida='estructura_proyecto.txt'):
    """
    Genera un archivo de texto con el árbol de directorios del proyecto,
    respetando las reglas de ignorar para no saturar el archivo.
    """
    ignorar_norm = {os.path.normpath(i) for i in IGNORAR_TOTALMENTE}

    with open(archivo_salida, 'w', encoding='utf-8') as f:
        f.write('ESTRUCTURA DEL PROYECTO\n')
        f.write('=' * 50 + '\n\n')

        for root, dirs, files in os.walk(ruta_base):
            # Misma lógica de filtrado de carpetas que en empaquetar_proyecto
            dirs_permitidos = []
            for d in dirs:
                ruta_dir_relativa = os.path.normpath(os.path.relpath(os.path.join(root, d), '.'))
                if d not in ignorar_norm and ruta_dir_relativa not in ignorar_norm:
                    dirs_permitidos.append(d)
            dirs[:] = dirs_permitidos

            nivel = root.replace(ruta_base, '').count(os.sep)
            indentacion = '    ' * nivel
            carpeta = os.path.basename(root)

            if nivel == 0:
                f.write(f'📁 {carpeta if carpeta else "."}/\n')
            else:
                f.write(f'{indentacion}📁 {carpeta}/\n')

            sub_indentacion = '    ' * (nivel + 1)
            for archivo in files:
                path_relativo = os.path.normpath(os.path.relpath(os.path.join(root, archivo), '.'))

                # Filtrar archivos igual que en el empaquetado
                if (
                    archivo in ignorar_norm
                    or path_relativo in ignorar_norm
                    or archivo == OUTPUT_FILE
                    or archivo == archivo_salida
                    or archivo == os.path.basename(__file__)
                ):
                    continue

                f.write(f'{sub_indentacion}📄 {archivo}\n')

    print(f'✅ Árbol de directorios generado en: {archivo_salida}')


if __name__ == '__main__':
    generar_arbol()
    # generar_backup_sql()
    empaquetar_proyecto()
