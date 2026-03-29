import os

OUTPUT_FILE = 'proyecto_completo.txt'

EXTENSIONES_TEXTO = {
    '.js',
    '.jsx',
    '.html',
    '.css',
    '.json',
    '.md',
    '.sql',
    '.yml',
    '.py',
    '.gs',
}

# Ahora podemos poner nombres de archivos, carpetas o rutas relativas
IGNORAR_TOTALMENTE = {
    'backups',
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
    'scripts/credentials.json',  # Rutas específicas
}

EXTENSIONES_OMITIR = {
    '.png',
    '.jpg',
    '.jpeg',
    '.webp',
    '.svg',
    '.ico',
    '.pdf',
    '.woff',
    '.woff2',
}


def empaquetar_proyecto():
    count = 0
    # Normalizamos las rutas de ignorados para que funcionen en cualquier SO
    ignorar_norm = {os.path.normpath(i) for i in IGNORAR_TOTALMENTE}

    with open(OUTPUT_FILE, 'w', encoding='utf-8') as outfile:
        for root, dirs, files in os.walk('.'):
            # 1. Filtrar carpetas (evita entrar en node_modules, .git, etc.)
            dirs[:] = [d for d in dirs if d not in ignorar_norm]

            for file in files:
                path_relativo = os.path.relpath(os.path.join(root, file), '.')
                path_norm = os.path.normpath(path_relativo)

                # 2. Check de ignorados (por nombre de archivo o por ruta completa)
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

                if ext.lower() in EXTENSIONES_TEXTO:
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


if __name__ == '__main__':
    empaquetar_proyecto()
