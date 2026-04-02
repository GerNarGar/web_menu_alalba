#!/usr/bin/env python3
"""
Sincronizador Menú QR + Procesador de Video
"""

import io
import json
import os
import shutil
import subprocess
import sys
import traceback
from datetime import datetime
from pathlib import Path

from google.oauth2.service_account import Credentials
from googleapiclient.discovery import build
from googleapiclient.http import MediaIoBaseDownload
from PIL import Image


def cargar_variables_entorno(ruta_archivo='.env'):
    """Lee un archivo .env y carga sus variables en os.environ"""
    try:
        with open(ruta_archivo, 'r', encoding='utf-8') as archivo:
            for linea in archivo:
                linea = linea.strip()
                if not linea or linea.startswith('#'):
                    continue
                if '=' in linea:
                    clave, valor = linea.split('=', 1)
                    os.environ[clave.strip()] = valor.strip().strip('\'"')
    except FileNotFoundError:
        pass


# --- CONFIGURACIÓN DE RUTAS ---
DIRECTORIO_BASE = Path(__file__).resolve().parent.parent
ARCHIVO_ENV = DIRECTORIO_BASE / 'scripts' / '.env'
DIRECTORIO_COPIAS_SEGURIDAD = DIRECTORIO_BASE / 'backups'
ARCHIVO_JSON_SALIDA = DIRECTORIO_BASE / 'docs' / 'menu-data.json'
ARCHIVO_JSON_TEMPORAL = DIRECTORIO_BASE / 'docs' / 'temp_menu-data.json'
ARCHIVO_CREDENCIALES_GOOGLE = DIRECTORIO_BASE / 'scripts' / 'credentials.json'
ARCHIVO_REGISTRO_HASHES = DIRECTORIO_BASE / 'scripts' / 'image_hashes.json'

DIRECTORIO_IMAGENES_PLATOS = DIRECTORIO_BASE / 'docs' / 'img' / 'platos'
DIRECTORIO_VIDEOS_PLATOS = DIRECTORIO_BASE / 'docs' / 'img' / 'videos'

cargar_variables_entorno(ARCHIVO_ENV)
IDENTIFICADOR_HOJA_CALCULO = os.environ.get('SHEET_ID')


# --- FUNCIONES AUXILIARES Y NORMALIZACIÓN ---
def evaluar_booleano(valor):
    if isinstance(valor, bool):
        return valor
    return str(valor).strip().lower() in ['true', '1', 'verdadero', 'sí', 'si', 'yes', 'v']


def procesar_precio_numerico(valor):
    try:
        if isinstance(valor, (int, float)):
            return float(valor)
        return float(str(valor).replace(',', '.').strip())
    except (ValueError, TypeError):
        return 0.0


def procesar_numero_entero(valor, valor_por_defecto=999):
    try:
        if not valor:
            return valor_por_defecto
        return int(float(str(valor).replace(',', '.').strip()))
    except (ValueError, TypeError):
        return valor_por_defecto


def convertir_rgb_a_hexadecimal(diccionario_color):
    """Convierte el formato RGB de Google al formato Hexagonal Web. Si está vacío, asume negro."""
    if not diccionario_color or (
        'red' not in diccionario_color
        and 'green' not in diccionario_color
        and 'blue' not in diccionario_color
    ):
        return '#000000'  # Corrección del bug: celdas con fondo negro devuelven dict vacío.

    rojo = int(diccionario_color.get('red', 0) * 255)
    verde = int(diccionario_color.get('green', 0) * 255)
    azul = int(diccionario_color.get('blue', 0) * 255)
    return f'#{rojo:02x}{verde:02x}{azul:02x}'


# --- FUNCIONES DE MEDIOS (VIDEO E IMAGEN) ---
def ejecutar_subproceso_ffmpeg(comando_texto):
    """Ejecuta FFmpeg con límite de tiempo para evitar bloqueos del servidor."""
    try:
        subprocess.run(
            comando_texto, shell=True, check=True, capture_output=True, text=True, timeout=120
        )
        return True
    except subprocess.TimeoutExpired:
        print('Error: FFmpeg excedió el tiempo límite (120s).')
        return False
    except subprocess.CalledProcessError as error:
        print(f'Error en FFmpeg: {error.stderr}')
        return False


def extraer_duracion_video_segundos(ruta_archivo_video):
    try:
        comando = [
            'ffprobe',
            '-v',
            'error',
            '-show_entries',
            'format=duration',
            '-of',
            'json',
            str(ruta_archivo_video),
        ]
        resultado = subprocess.run(comando, capture_output=True, text=True, check=True, timeout=10)
        return float(json.loads(resultado.stdout)['format']['duration'])
    except Exception:
        return 0.0


def comprimir_video_h264(ruta_origen, ruta_destino, tasa_bits_mbps, resolucion_vertical):
    parametro_tasa_bits = f'{tasa_bits_mbps}M'
    comando = [
        'ffmpeg',
        '-y',
        '-i',
        str(ruta_origen),
        '-c:v',
        'libx264',
        '-profile:v',
        'baseline',
        '-level',
        '3.0',
        '-pix_fmt',
        'yuv420p',
        '-movflags',
        '+faststart',
        '-b:v',
        parametro_tasa_bits,
        '-maxrate',
        parametro_tasa_bits,
        '-bufsize',
        '5M',
        '-an',  # Eliminar pista de audio
        '-vf',
        f'scale={resolucion_vertical}:-2',
        str(ruta_destino),
    ]
    return ejecutar_subproceso_ffmpeg(' '.join(comando))


def optimizar_imagen_webp(objeto_imagen_pil, ruta_guardado, maximo_ancho_px, porcentaje_calidad):
    if objeto_imagen_pil.mode in ('RGBA', 'LA') or (
        objeto_imagen_pil.mode == 'P' and 'transparency' in objeto_imagen_pil.info
    ):
        objeto_imagen_pil = objeto_imagen_pil.convert('RGBA')
    elif objeto_imagen_pil.mode != 'RGB':
        objeto_imagen_pil = objeto_imagen_pil.convert('RGB')

    if objeto_imagen_pil.width > maximo_ancho_px:
        nuevo_alto = int(objeto_imagen_pil.height * (maximo_ancho_px / objeto_imagen_pil.width))
        objeto_imagen_pil = objeto_imagen_pil.resize(
            (maximo_ancho_px, nuevo_alto), Image.Resampling.LANCZOS
        )

    objeto_imagen_pil.save(ruta_guardado, 'WEBP', quality=porcentaje_calidad, method=6)


def generar_poster_video(
    ruta_archivo_video, ruta_imagen_salida, maximo_ancho_px, porcentaje_calidad
):
    try:
        archivo_jpg_temporal = ruta_imagen_salida.with_suffix('.jpg')
        comando = [
            'ffmpeg',
            '-y',
            '-i',
            str(ruta_archivo_video),
            '-ss',
            '00:00:00',
            '-vframes',
            '1',
            '-q:v',
            '2',
            str(archivo_jpg_temporal),
        ]
        subprocess.run(comando, check=True, capture_output=True, timeout=30)

        if archivo_jpg_temporal.exists():
            with Image.open(archivo_jpg_temporal) as imagen_capturada:
                optimizar_imagen_webp(
                    imagen_capturada, ruta_imagen_salida, maximo_ancho_px, porcentaje_calidad
                )
            archivo_jpg_temporal.unlink()
            return True
    except Exception as error_proceso:
        print(f'Fallo al extraer fotograma: {error_proceso}')
    return False


# --- EXTRACCIÓN Y LÓGICA DE NEGOCIO ---
def obtener_configuracion_con_tematica_visual(servicio_api_sheets):
    """Extrae las variables de configuración y lee el color real de fondo de la celda."""
    respuesta_api = (
        servicio_api_sheets.spreadsheets()
        .get(
            spreadsheetId=IDENTIFICADOR_HOJA_CALCULO, ranges=['Config!A2:B30'], includeGridData=True
        )
        .execute()
    )

    diccionario_configuracion = {}
    filas_datos = respuesta_api['sheets'][0]['data'][0].get('rowData', [])

    for fila in filas_datos:
        valores_celdas = fila.get('values', [])
        if len(valores_celdas) >= 2 and valores_celdas[0].get('formattedValue'):
            clave_configuracion = valores_celdas[0]['formattedValue'].strip()
            valor_texto_celda = valores_celdas[1].get('formattedValue', '').strip()

            if clave_configuracion.startswith('theme_'):
                propiedades_fondo = (
                    valores_celdas[1].get('effectiveFormat', {}).get('backgroundColor', {})
                )
                valor_texto_celda = convertir_rgb_a_hexadecimal(propiedades_fondo)

            diccionario_configuracion[clave_configuracion] = valor_texto_celda

    return diccionario_configuracion


def gestionar_rotacion_copias_seguridad():
    if ARCHIVO_JSON_SALIDA.exists():
        DIRECTORIO_COPIAS_SEGURIDAD.mkdir(exist_ok=True)
        marca_temporal = datetime.now().strftime('%Y%m%d_%H%M%S')
        shutil.copy2(
            ARCHIVO_JSON_SALIDA, DIRECTORIO_COPIAS_SEGURIDAD / f'menu-data_{marca_temporal}.json'
        )

        historial_backups = sorted(DIRECTORIO_COPIAS_SEGURIDAD.glob('*.json'), key=os.path.getmtime)
        while len(historial_backups) > 5:
            os.remove(historial_backups.pop(0))


def ejecutar_sincronizacion_maestra():
    if not IDENTIFICADOR_HOJA_CALCULO:
        raise ValueError('CRÍTICO: Variable de entorno SHEET_ID no definida.')

    print('🚀 Iniciando orquestación de datos del Menú...')
    alcances_seguridad = [
        'https://www.googleapis.com/auth/spreadsheets.readonly',
        'https://www.googleapis.com/auth/drive.readonly',
    ]
    credenciales_acceso = Credentials.from_service_account_file(
        str(ARCHIVO_CREDENCIALES_GOOGLE), scopes=alcances_seguridad
    )
    cliente_sheets = build('sheets', 'v4', credentials=credenciales_acceso)
    cliente_drive = build('drive', 'v3', credentials=credenciales_acceso)

    configuracion_general = obtener_configuracion_con_tematica_visual(cliente_sheets)

    nombre_usuario_github = configuracion_general.get('github_username', '')
    repositorio_github = configuracion_general.get('github_repo', '')
    id_carpeta_nube = configuracion_general.get('image_drive_folder_id', '')
    simbolo_divisa = configuracion_general.get('moneda_simbolo', '')

    if not all([nombre_usuario_github, repositorio_github, id_carpeta_nube, simbolo_divisa]):
        raise ValueError('CRÍTICO: Existen campos vitales vacíos en la pestaña Configuración.')

    url_base_proyecto = f'https://{nombre_usuario_github}.github.io/{repositorio_github}'

    config_ancho_imagen = procesar_numero_entero(configuracion_general.get('image_max_width', 1200))
    config_calidad_imagen = procesar_numero_entero(configuracion_general.get('image_quality', 90))
    config_tasa_bits_video = float(
        str(configuracion_general.get('video_bitrate_Mbps', '2')).replace(',', '.')
    )
    config_resolucion_video = procesar_numero_entero(
        configuracion_general.get('video_v_resolution', 720)
    )

    DIRECTORIO_IMAGENES_PLATOS.mkdir(parents=True, exist_ok=True)
    DIRECTORIO_VIDEOS_PLATOS.mkdir(parents=True, exist_ok=True)

    # Buscar archivos disponibles en Google Drive
    mapa_archivos_nube = {}
    token_paginacion = None
    while True:
        respuesta_drive = (
            cliente_drive.files()
            .list(
                q=f"'{id_carpeta_nube}' in parents and trashed=false",
                fields='nextPageToken, files(id, name, md5Checksum)',
                pageToken=token_paginacion,
                pageSize=1000,
            )
            .execute()
        )

        for meta_archivo in respuesta_drive.get('files', []):
            mapa_archivos_nube[meta_archivo['name'].strip().lower()] = meta_archivo

        token_paginacion = respuesta_drive.get('nextPageToken')
        if not token_paginacion:
            break

    registro_hashes_locales = (
        json.load(open(ARCHIVO_REGISTRO_HASHES, 'r', encoding='utf-8'))
        if ARCHIVO_REGISTRO_HASHES.exists()
        else {}
    )
    conjunto_imagenes_activas, conjunto_videos_activos = set(), set()

    # Descargar información tabular en lote
    datos_hojas_calculo = (
        cliente_sheets.spreadsheets()
        .values()
        .batchGet(
            spreadsheetId=IDENTIFICADOR_HOJA_CALCULO,
            ranges=['Categorias!A:Z', 'Alergenos!A:Z', 'Menu_INT!A:Z', 'Menu_ES!A:Z'],
        )
        .execute()
        .get('valueRanges', [])
    )

    def transformar_matriz_a_diccionarios(matriz_cruda):
        if not matriz_cruda or len(matriz_cruda) < 2:
            return []
        nombres_columnas = [str(columna).strip() for columna in matriz_cruda[0]]
        return [dict(zip(nombres_columnas, fila)) for fila in matriz_cruda[1:]]

    # Construcción de Categorías
    coleccion_categorias = [
        {
            'id': str(cat.get('id', '')).strip(),
            'order': procesar_numero_entero(cat.get('orden', 999)),
            'label': {
                'es': str(cat.get('label_es', '')).strip(),
                'en': str(cat.get('label_en', '')).strip(),
                'fr': str(cat.get('label_fr', '')).strip(),
            },
        }
        for cat in transformar_matriz_a_diccionarios(datos_hojas_calculo[0].get('values', []))
        if cat.get('id')
    ]

    # Mapa de ordenamiento rápido para el Frontend
    indice_orden_categorias = {
        categoria['id']: categoria['order'] for categoria in coleccion_categorias
    }

    # Construcción Diccionario de Alérgenos
    diccionario_maestro_alergenos = {}
    mapa_busqueda_alergenos = {}
    for registro_alergeno in transformar_matriz_a_diccionarios(
        datos_hojas_calculo[1].get('values', [])
    ):
        id_alergeno = procesar_numero_entero(registro_alergeno.get('Codigo'))
        nombre_base_es = str(registro_alergeno.get('Nombre_Es', '')).strip()
        mapa_busqueda_alergenos[nombre_base_es.lower()] = id_alergeno
        diccionario_maestro_alergenos[id_alergeno] = {
            'code': id_alergeno,
            'name': {
                'es': nombre_base_es,
                'en': str(registro_alergeno.get('Nombre_En') or nombre_base_es).strip(),
                'fr': str(registro_alergeno.get('Nombre_Fr') or nombre_base_es).strip(),
            },
            'icon': f'./img/icons/icons_small/{registro_alergeno.get("Icono")}',
        }

    diccionario_traducciones = {
        str(trad['id']).strip(): trad
        for trad in transformar_matriz_a_diccionarios(datos_hojas_calculo[2].get('values', []))
        if trad.get('id')
    }
    filas_menu_principal = transformar_matriz_a_diccionarios(
        datos_hojas_calculo[3].get('values', [])
    )
    cabeceras_menu_principal = [
        str(header).strip() for header in (datos_hojas_calculo[3].get('values', [[]])[0])
    ]
    lista_columnas_alergenos = [
        columna
        for columna in cabeceras_menu_principal
        if columna.lower() in mapa_busqueda_alergenos
    ]

    coleccion_platos_finales = []

    # Iteración Principal de Platos
    for datos_plato in filas_menu_principal:
        if not datos_plato.get('id') or not evaluar_booleano(datos_plato.get('activo')):
            continue

        identificador_unico = str(datos_plato['id']).strip()
        textos_internacionales = diccionario_traducciones.get(identificador_unico, {})
        identificador_categoria = str(datos_plato.get('categoria', '')).strip()

        # Proceso Imagen Principal
        url_imagen_plato = ''
        nombre_archivo_imagen = str(datos_plato.get('img_filename', '')).strip()

        if nombre_archivo_imagen:
            llave_busqueda_imagen = nombre_archivo_imagen.lower()
            nombre_final_webp = f'{os.path.splitext(llave_busqueda_imagen)[0]}.webp'
            conjunto_imagenes_activas.add(nombre_final_webp)
            url_imagen_plato = f'./img/platos/{nombre_final_webp}'

            if llave_busqueda_imagen in mapa_archivos_nube:
                metadatos_nube = mapa_archivos_nube[llave_busqueda_imagen]
                if (
                    registro_hashes_locales.get(llave_busqueda_imagen)
                    != metadatos_nube['md5Checksum']
                    or not (DIRECTORIO_IMAGENES_PLATOS / nombre_final_webp).exists()
                ):
                    buffer_memoria = io.BytesIO()
                    proceso_descarga = MediaIoBaseDownload(
                        buffer_memoria, cliente_drive.files().get_media(fileId=metadatos_nube['id'])
                    )
                    descarga_finalizada = False
                    while not descarga_finalizada:
                        _, descarga_finalizada = proceso_descarga.next_chunk()
                    buffer_memoria.seek(0)
                    with Image.open(buffer_memoria) as imagen_cruda:
                        optimizar_imagen_webp(
                            imagen_cruda,
                            DIRECTORIO_IMAGENES_PLATOS / nombre_final_webp,
                            config_ancho_imagen,
                            config_calidad_imagen,
                        )
                    registro_hashes_locales[llave_busqueda_imagen] = metadatos_nube['md5Checksum']

        # Proceso Video Secundario
        estructura_datos_video = None
        nombre_archivo_video = str(datos_plato.get('video_filename', '')).strip()

        if nombre_archivo_video and nombre_archivo_video.lower() in mapa_archivos_nube:
            llave_busqueda_video = nombre_archivo_video.lower()
            nombre_base_sin_extension = os.path.splitext(llave_busqueda_video)[0]
            nombre_final_mp4 = f'{nombre_base_sin_extension}.mp4'
            nombre_final_poster = f'{nombre_base_sin_extension}_poster.webp'

            conjunto_videos_activos.update([nombre_final_mp4, nombre_final_poster])
            ruta_fisica_mp4 = DIRECTORIO_VIDEOS_PLATOS / nombre_final_mp4
            ruta_fisica_poster = DIRECTORIO_VIDEOS_PLATOS / nombre_final_poster
            metadatos_video_nube = mapa_archivos_nube[llave_busqueda_video]
            clave_hash_video = f'video_{llave_busqueda_video}'

            if (
                registro_hashes_locales.get(clave_hash_video) != metadatos_video_nube['md5Checksum']
                or not ruta_fisica_mp4.exists()
                or not ruta_fisica_poster.exists()
            ):
                ruta_video_temporal = DIRECTORIO_VIDEOS_PLATOS / f'temp_{nombre_archivo_video}'
                buffer_video = io.BytesIO()
                descargador_video = MediaIoBaseDownload(
                    buffer_video, cliente_drive.files().get_media(fileId=metadatos_video_nube['id'])
                )
                video_descargado = False
                while not video_descargado:
                    _, video_descargado = descargador_video.next_chunk()
                with open(ruta_video_temporal, 'wb') as archivo_temp_escritura:
                    archivo_temp_escritura.write(buffer_video.getbuffer())

                if (
                    comprimir_video_h264(
                        ruta_video_temporal,
                        ruta_fisica_mp4,
                        config_tasa_bits_video,
                        config_resolucion_video,
                    )
                    and ruta_fisica_mp4.exists()
                ):
                    generar_poster_video(
                        ruta_fisica_mp4,
                        ruta_fisica_poster,
                        config_ancho_imagen,
                        config_calidad_imagen,
                    )
                    registro_hashes_locales[clave_hash_video] = metadatos_video_nube['md5Checksum']
                    estructura_datos_video = {
                        'src': f'./img/videos/{nombre_final_mp4}',
                        'poster': f'./img/videos/{nombre_final_poster}',
                        'duration': round(extraer_duracion_video_segundos(ruta_fisica_mp4), 1),
                    }
                if ruta_video_temporal.exists():
                    ruta_video_temporal.unlink()
            else:
                estructura_datos_video = {
                    'src': f'./img/videos/{nombre_final_mp4}',
                    'poster': f'./img/videos/{nombre_final_poster}',
                    'duration': round(extraer_duracion_video_segundos(ruta_fisica_mp4), 1),
                }

        # Enriquecimiento de Alérgenos (Objetos completos, no solo IDs)
        alergenos_enriquecidos = []
        for columna_alergeno in lista_columnas_alergenos:
            if evaluar_booleano(datos_plato.get(columna_alergeno)):
                codigo_alergeno = mapa_busqueda_alergenos[columna_alergeno.strip().lower()]
                alergenos_enriquecidos.append(diccionario_maestro_alergenos[codigo_alergeno])

        coleccion_platos_finales.append(
            {
                'id': procesar_numero_entero(identificador_unico),
                'category': identificador_categoria,
                'price': procesar_precio_numerico(datos_plato.get('precio')),
                # Claves temporales para el algoritmo de ordenamiento estricto
                '_peso_categoria': indice_orden_categorias.get(identificador_categoria, 999),
                '_peso_plato': procesar_numero_entero(datos_plato.get('orden', 999)),
                'is_chef_choice': evaluar_booleano(datos_plato.get('sugerencia_chef')),
                'allergens': alergenos_enriquecidos,
                'image': url_imagen_plato,
                'video': estructura_datos_video,
                'i18n': {
                    'es': {
                        'name': str(datos_plato.get('nombre', '')),
                        'description': str(datos_plato.get('descripcion', '')),
                    },
                    'en': {
                        'name': str(
                            textos_internacionales.get('nombre_en') or datos_plato.get('nombre', '')
                        ),
                        'description': str(
                            textos_internacionales.get('descripcion_en')
                            or datos_plato.get('descripcion', '')
                        ),
                    },
                    'fr': {
                        'name': str(
                            textos_internacionales.get('nombre_fr') or datos_plato.get('nombre', '')
                        ),
                        'description': str(
                            textos_internacionales.get('descripcion_fr')
                            or datos_plato.get('descripcion', '')
                        ),
                    },
                },
            }
        )

    # Ordenamiento Topológico Estricto (Backend asume la responsabilidad)
    coleccion_platos_finales.sort(
        key=lambda plato: (plato['_peso_categoria'], plato['_peso_plato'])
    )

    # Limpiar variables temporales de la estructura JSON
    for plato_individual in coleccion_platos_finales:
        del plato_individual['_peso_categoria']
        del plato_individual['_peso_plato']

    # Recolección de Basura: Borrar huérfanos locales
    for ruta_img_local in DIRECTORIO_IMAGENES_PLATOS.glob('*.webp'):
        if ruta_img_local.name not in conjunto_imagenes_activas:
            os.remove(ruta_img_local)
    for ruta_vid_local in DIRECTORIO_VIDEOS_PLATOS.glob('*'):
        if (
            ruta_vid_local.name not in conjunto_videos_activos
            and not ruta_vid_local.name.startswith('temp_')
        ):
            os.remove(ruta_vid_local)

    registro_hashes_locales = {
        clave: valor
        for clave, valor in registro_hashes_locales.items()
        if not clave.startswith('video_')
        or clave.replace('video_', '') in [v.lower() for v in conjunto_videos_activos]
    }
    json.dump(
        registro_hashes_locales, open(ARCHIVO_REGISTRO_HASHES, 'w', encoding='utf-8'), indent=2
    )

    # === PROCESAR LOGO DEL RESTAURANTE ===
    restaurant_logo = ''
    nombre_logo = str(configuracion_general.get('restaurante_image', '')).strip()
    restaurant_url = str(configuracion_general.get('restaurante_url', '')).strip()

    if nombre_logo and nombre_logo.lower() in mapa_archivos_nube:
        llave_logo = nombre_logo.lower()
        nombre_final_logo = 'logo_restaurante.webp'

        metadatos_logo = mapa_archivos_nube[llave_logo]
        ruta_logo_local = DIRECTORIO_BASE / 'docs' / 'img' / nombre_final_logo

        # Si el logo es nuevo o ha cambiado
        if (
            registro_hashes_locales.get(f'logo_{llave_logo}') != metadatos_logo['md5Checksum']
            or not ruta_logo_local.exists()
        ):
            buffer_memoria = io.BytesIO()
            proceso_descarga = MediaIoBaseDownload(
                buffer_memoria, cliente_drive.files().get_media(fileId=metadatos_logo['id'])
            )
            descarga_finalizada = False
            while not descarga_finalizada:
                _, descarga_finalizada = proceso_descarga.next_chunk()
            buffer_memoria.seek(0)
            with Image.open(buffer_memoria) as imagen_cruda:
                # 400px es suficiente para un logo de navbar
                optimizar_imagen_webp(imagen_cruda, ruta_logo_local, 400, 95)
            registro_hashes_locales[f'logo_{llave_logo}'] = metadatos_logo['md5Checksum']

        restaurant_logo = f'./img/{nombre_final_logo}'

    # Compilar JSON Maestro
    estructura_datos_final = {
        'meta': {
            'restaurant': configuracion_general.get('restaurante_nombre', 'Menú'),
            'restaurant_url': restaurant_url,
            'restaurant_logo': restaurant_logo,
            'currency': simbolo_divisa,
            'currency_position': str(configuracion_general.get('moneda_posicion', 'derecha'))
            .strip()
            .lower(),
            'default_lang': configuracion_general.get('idioma_por_defecto', 'es'),
            'order_lang': str(configuracion_general.get('idioma_comanda', 'fr')).strip().lower(),
            'default_table': configuracion_general.get('mesa_texto_por_defecto', 'No'),
            'theme_primary': configuracion_general.get('theme_primary', '#ff6a00'),
            'theme_background': configuracion_general.get('theme_background', '#000000'),
            'theme_text': configuracion_general.get('theme_text', '#ffffff'),
            'theme_notification': configuracion_general.get('theme_notification', '#ef4444'),
            'allow_orders': evaluar_booleano(configuracion_general.get('permitir_pedidos')),
            'limpiar_carrito_tras_hora': procesar_numero_entero(
                configuracion_general.get('limpiar_carrito_tras_hora', 1)
            ),
            'toast_timeout': procesar_numero_entero(configuracion_general.get('toast_timeout', 4)),
            'vibrar_al_enviar': evaluar_booleano(
                configuracion_general.get('vibrar_al_enviar', True)
            ),
            'swipe_margen_seguridad': procesar_numero_entero(
                configuracion_general.get('swipe_margen_seguridad', 30)
            ),
            'generated_at': datetime.now().isoformat(),
            'base_url': url_base_proyecto,
            'enable_video_feed': evaluar_booleano(
                configuracion_general.get('enable_video_feed', True)
            ),
            'modal_uses_video': evaluar_booleano(
                configuracion_general.get('modal_uses_video', False)
            ),
            'gas_webapp_url': str(configuracion_general.get('gas_webapp_url', '')).strip(),
        },
        'categories': sorted(coleccion_categorias, key=lambda c: c['order']),
        'allergens': list(diccionario_maestro_alergenos.values()),
        'items': coleccion_platos_finales,
    }

    ARCHIVO_JSON_SALIDA.parent.mkdir(exist_ok=True)
    json.dump(
        estructura_datos_final,
        open(ARCHIVO_JSON_TEMPORAL, 'w', encoding='utf-8'),
        ensure_ascii=False,
        indent=2,
    )
    gestionar_rotacion_copias_seguridad()
    os.replace(ARCHIVO_JSON_TEMPORAL, ARCHIVO_JSON_SALIDA)
    print('✅ Orquestación finalizada exitosamente. JSON Listo para Producción.')


if __name__ == '__main__':
    try:
        ejecutar_sincronizacion_maestra()
    except Exception as excepcion_critica:
        traceback.print_exc()
        with open('error_telegram.txt', 'w', encoding='utf-8') as archivo_log_error:
            archivo_log_error.write(f'{type(excepcion_critica).__name__}: {str(excepcion_critica)}')
        sys.exit(1)
