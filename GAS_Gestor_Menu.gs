// ============================================================
// ARCHIVO: GAS_Gestor_Menu.gs
// ============================================================

const HOJA_ESPANOL = "Menu_ES";
const HOJA_INTERNACIONAL = "Menu_INT";
const HOJA_CATEGORIAS = "Categorias";
const HOJA_CONFIGURACION = "Config";

function onOpen() {
  const interfaz = SpreadsheetApp.getUi();
  interfaz
    .createMenu("🍔 Menú Web")
    .addItem(
      "1. Sincronizar y Traducir Textos (IA)",
      "sincronizarYTraducirTextos",
    )
    .addSeparator()
    .addItem("2. Validar", "ejecutarValidacion")
    .addSeparator()
    .addItem("3. 🚀 Publicar en Web", "validarYLanzarPublicacion")
    .addToUi();
}

function onEdit(evento) {
  if (!evento || !evento.range) return;
  const hoja_activa = evento.range.getSheet();
  if (hoja_activa.getName() !== HOJA_ESPANOL) return;

  const fila = evento.range.getRow();
  const columna = evento.range.getColumn();

  // Autogenerar ID si se edita Categoría (col 2) o Nombre (col 6)
  if (fila > 1 && (columna === 2 || columna === 6)) {
    const celda_id = hoja_activa.getRange(fila, 1);
    if (!celda_id.getValue()) {
      const todos_los_ids = hoja_activa
        .getRange("A2:A")
        .getValues()
        .flat()
        .filter((v) => !isNaN(v) && v !== "");
      const id_maximo =
        todos_los_ids.length > 0 ? Math.max(...todos_los_ids) : 0;
      celda_id.setValue(id_maximo + 1);
      hoja_activa
        .getRange(fila, 1, 1, hoja_activa.getLastColumn())
        .setBackground("#E8F5E9");
    }
  }
}

function ejecutarValidacion() {
  const interfaz = SpreadsheetApp.getUi();
  const resultado = analizarDatosMenu(interfaz);
  mostrarReporteHTML(interfaz, resultado, false);
}

function validarYLanzarPublicacion() {
  const interfaz = SpreadsheetApp.getUi();
  const resultado = analizarDatosMenu(interfaz);

  if (!resultado.es_valido) {
    mostrarReporteHTML(interfaz, resultado, true);
    return;
  }

  if (resultado.advertencias.length > 0) {
    const respuesta = interfaz.alert(
      "⚠️ Advertencias detectadas",
      "Hay advertencias menores (como vídeos largos). ¿Deseas publicar de todos modos?",
      interfaz.ButtonSet.YES_NO,
    );
    if (respuesta !== interfaz.Button.YES) return;
  }

  dispararAccionGithub(interfaz, resultado.configuracion);
}

// ============================================================
// LÓGICA PRINCIPAL DE VALIDACIÓN
// ============================================================
function analizarDatosMenu(interfaz) {
  const libro_actual = SpreadsheetApp.getActiveSpreadsheet();
  const hojas = {
    es: libro_actual.getSheetByName(HOJA_ESPANOL),
    int: libro_actual.getSheetByName(HOJA_INTERNACIONAL),
    cat: libro_actual.getSheetByName(HOJA_CATEGORIAS),
    conf: libro_actual.getSheetByName(HOJA_CONFIGURACION),
  };

  if (!hojas.es || !hojas.int || !hojas.cat || !hojas.conf) {
    return {
      es_valido: false,
      errores: ["Faltan hojas principales en el documento."],
      advertencias: [],
    };
  }

  // 1. Validar Configuración
  const res_config = extraerValidarConfiguracion(hojas.conf);
  if (res_config.errores.length > 0) {
    return {
      es_valido: false,
      errores: res_config.errores,
      advertencias: [],
      configuracion: res_config.configuracion,
    };
  }

  // 2. Control de Columnas Dinámico
  const datos_es = hojas.es.getDataRange().getValues();
  const cabeceras = datos_es[0].map((h) => h.toString().trim().toLowerCase());
  const indices = {
    id: cabeceras.indexOf("id"),
    cat: cabeceras.indexOf("categoria"),
    activo: cabeceras.indexOf("activo"),
    precio: cabeceras.indexOf("precio"),
    img: cabeceras.indexOf("img_filename"),
    video: cabeceras.indexOf("video_filename"),
    nombre: cabeceras.indexOf("nombre"),
  };

  const columnas_faltantes = Object.entries(indices)
    .filter(([clave, idx]) => idx === -1 && clave !== "video")
    .map(([clave]) => clave);
  if (columnas_faltantes.length > 0) {
    return {
      es_valido: false,
      errores: [
        `Faltan columnas obligatorias en ${HOJA_ESPANOL}: ${columnas_faltantes.join(", ")}`,
      ],
      advertencias: [],
      configuracion: res_config.configuracion,
    };
  }

  // 3. Consulta de Google Drive
  let mapa_archivos_drive = {};
  try {
    libro_actual.toast("Consultando Google Drive...", "Validando");
    const archivos = obtenerMetadatosDrive(
      res_config.configuracion["image_drive_folder_id"].toString().trim(),
    );
    Object.keys(archivos).forEach(
      (k) => (mapa_archivos_drive[k.toLowerCase()] = archivos[k]),
    );

    const nombre_logo = res_config.configuracion["restaurante_image"];
    if (nombre_logo && nombre_logo.toString().trim() !== "") {
      if (!mapa_archivos_drive[nombre_logo.toString().trim().toLowerCase()]) {
        return {
          es_valido: false,
          errores: [
            `El logo "${nombre_logo}" configurado en la pestaña Config NO existe en la carpeta de Drive.`,
          ],
          advertencias: [],
          configuracion: res_config.configuracion,
        };
      }
    }
  } catch (error) {
    return {
      es_valido: false,
      errores: [error.message],
      advertencias: [],
      configuracion: res_config.configuracion,
    };
  }

  // 4. Preparar Contexto y Limpiar Notas Anteriores
  hojas.es.clearNotes();
  const contexto = {
    hoja_es: hojas.es,
    errores: [],
    advertencias: [],
    indices: indices,
    archivos_drive: mapa_archivos_drive,
    categorias_validas: hojas.cat
      .getDataRange()
      .getValues()
      .slice(1)
      .map((r) => r[0].toString().trim().toLowerCase())
      .filter(Boolean),
    diccionario_traducciones: mapearTraducciones(hojas.int),
    ids_procesados: new Set(),
    ancho_minimo_imagen:
      parseInt(res_config.configuracion["image_min_width"]) || 600,
    tamaño_max_video_mb:
      parseFloat(res_config.configuracion["video_max_size_MB"]) || 50,
  };

  // 5. Validar filas iterativamente
  for (let fila_idx = 1; fila_idx < datos_es.length; fila_idx++) {
    inspeccionarFilaMenu(datos_es[fila_idx], fila_idx + 1, contexto);
  }

  return {
    es_valido: contexto.errores.length === 0,
    errores: contexto.errores,
    advertencias: contexto.advertencias,
    configuracion: res_config.configuracion,
  };
}

// ============================================================
// FUNCIONES DE APOYO Y UTILIDADES
// ============================================================
function extraerValidarConfiguracion(hoja_conf) {
  const datos = hoja_conf.getDataRange().getValues();
  const configuracion = {};
  datos.forEach((fila) => {
    if (fila[0]) configuracion[fila[0].toString().trim()] = fila[1];
  });

  const errores = [];
  const requeridos = [
    "restaurante_nombre",
    "github_username",
    "github_repo",
    "image_drive_folder_id",
    "moneda_simbolo",
  ];
  for (let campo of requeridos) {
    if (
      !configuracion[campo] ||
      configuracion[campo].toString().trim() === ""
    ) {
      errores.push(`Falta parámetro en Config: "${campo}"`);
    }
  }
  return { configuracion, errores };
}

function inspeccionarFilaMenu(fila, numero_fila, contexto) {
  const valor_id = fila[contexto.indices.id];
  if (valor_id === "" || valor_id === null) return;

  const string_id = valor_id.toString().trim().toUpperCase();
  if (string_id.includes("#REF!") || isNaN(Number(valor_id))) {
    insertarNota(
      contexto.hoja_es,
      numero_fila,
      contexto.indices.id + 1,
      "ID inválido.",
    );
    contexto.errores.push(`Fila ${numero_fila}: ID inválido.`);
    return;
  }

  const esta_activo =
    fila[contexto.indices.activo] === true ||
    fila[contexto.indices.activo].toString().toUpperCase() === "TRUE" ||
    fila[contexto.indices.activo] === 1;

  if (contexto.ids_procesados.has(string_id)) {
    insertarNota(
      contexto.hoja_es,
      numero_fila,
      contexto.indices.id + 1,
      "ID Duplicado.",
    );
    contexto.errores.push(`Fila ${numero_fila}: ID ${string_id} duplicado.`);
  }
  contexto.ids_procesados.add(string_id);

  const valor_cat = fila[contexto.indices.cat]
    ? fila[contexto.indices.cat].toString().trim().toLowerCase()
    : "";
  if (!contexto.categorias_validas.includes(valor_cat)) {
    insertarNota(
      contexto.hoja_es,
      numero_fila,
      contexto.indices.cat + 1,
      "Categoría no existe.",
    );
    contexto.errores.push(
      `Fila ${numero_fila}: Categoría "${valor_cat}" no existe.`,
    );
  }

  let precio_parseado = parseFloat(
    fila[contexto.indices.precio]
      ? fila[contexto.indices.precio].toString().replace(",", ".")
      : "0",
  );
  if (isNaN(precio_parseado) || precio_parseado <= 0) {
    insertarNota(
      contexto.hoja_es,
      numero_fila,
      contexto.indices.precio + 1,
      "Precio inválido.",
    );
    contexto.errores.push(`Fila ${numero_fila}: Precio inválido.`);
  }

  if (esta_activo) {
    if (
      !fila[contexto.indices.nombre] ||
      fila[contexto.indices.nombre].toString().trim() === ""
    ) {
      insertarNota(
        contexto.hoja_es,
        numero_fila,
        contexto.indices.nombre + 1,
        "Falta el Nombre.",
      );
      contexto.errores.push(`Fila ${numero_fila}: Falta NOMBRE.`);
    }

    validarArchivoMultimedia(
      fila[contexto.indices.img],
      "imagen",
      numero_fila,
      contexto.indices.img + 1,
      contexto,
    );
    if (contexto.indices.video !== -1) {
      validarArchivoMultimedia(
        fila[contexto.indices.video],
        "video",
        numero_fila,
        contexto.indices.video + 1,
        contexto,
      );
    }

    if (
      !contexto.diccionario_traducciones[string_id] ||
      !contexto.diccionario_traducciones[string_id].nombre_en
    ) {
      contexto.errores.push(
        `Fila ${numero_fila}: Plato ID ${string_id} sin traducciones en ${HOJA_INTERNACIONAL}.`,
      );
    }
  }
}

function validarArchivoMultimedia(
  nombre_archivo_crudo,
  tipo,
  fila_num,
  col_idx,
  contexto,
) {
  const nombre_archivo = nombre_archivo_crudo
    ? nombre_archivo_crudo.toString().trim()
    : "";
  if (!nombre_archivo && tipo === "video") return;
  if (!nombre_archivo && tipo === "imagen") {
    insertarNota(contexto.hoja_es, fila_num, col_idx, "Falta imagen.");
    return contexto.errores.push(`Fila ${fila_num}: Falta imagen.`);
  }

  const exp_reg =
    tipo === "imagen" ? /^[\w\-]+\.(jpg|jpeg|png)$/i : /^[\w\-]+\.(mp4|mov)$/i;
  if (!exp_reg.test(nombre_archivo)) {
    insertarNota(contexto.hoja_es, fila_num, col_idx, `Formato inválido.`);
    return contexto.errores.push(
      `Fila ${fila_num}: Archivo ${nombre_archivo} formato inválido.`,
    );
  }

  const info_archivo = contexto.archivos_drive[nombre_archivo.toLowerCase()];
  if (!info_archivo) {
    insertarNota(contexto.hoja_es, fila_num, col_idx, "No existe en Drive.");
    return contexto.errores.push(
      `Fila ${fila_num}: Archivo "${nombre_archivo}" NO existe en Drive.`,
    );
  }

  if (
    tipo === "imagen" &&
    info_archivo.width > 0 &&
    info_archivo.width < contexto.ancho_minimo_imagen
  ) {
    insertarNota(
      contexto.hoja_es,
      fila_num,
      col_idx,
      `Ancho < ${contexto.ancho_minimo_imagen}px`,
    );
    contexto.errores.push(
      `Fila ${fila_num}: Imagen "${nombre_archivo}" muy pequeña (${info_archivo.width}px).`,
    );
  } else if (tipo === "video") {
    const tamaño_mb = (info_archivo.size / (1024 * 1024)).toFixed(2);
    if (info_archivo.size > contexto.tamaño_max_video_mb * 1024 * 1024) {
      insertarNota(
        contexto.hoja_es,
        fila_num,
        col_idx,
        `Pesado: ${tamaño_mb}MB`,
      );
      contexto.errores.push(
        `Fila ${fila_num}: Video "${nombre_archivo}" pesa ${tamaño_mb}MB (máx ${contexto.tamaño_max_video_mb}MB).`,
      );
    }
    if (info_archivo.duration > 12) {
      contexto.advertencias.push(
        `Fila ${fila_num}: Video "${nombre_archivo}" dura ${info_archivo.duration.toFixed(1)}s. (Recomendado: < 12s).`,
      );
    }
  }
}

function mapearTraducciones(hoja_int) {
  const dict = {};
  const datos = hoja_int.getDataRange().getValues();
  const cabeceras = datos[0].map((h) => h.toString().trim().toLowerCase());
  const idx_id = cabeceras.indexOf("id");
  const idx_nom_en = cabeceras.indexOf("nombre_en");
  const idx_nom_fr = cabeceras.indexOf("nombre_fr");

  if (idx_id === -1) return dict;

  datos.slice(1).forEach((fila) => {
    if (fila[idx_id]) {
      dict[fila[idx_id].toString().trim().toUpperCase()] = {
        nombre_en: idx_nom_en !== -1 ? fila[idx_nom_en] : "",
        nombre_fr: idx_nom_fr !== -1 ? fila[idx_nom_fr] : "",
      };
    }
  });
  return dict;
}

function insertarNota(hoja, fila, columna, mensaje) {
  hoja.getRange(fila, columna).setNote("🚨 ERROR: " + mensaje);
}

function obtenerMetadatosDrive(id_carpeta) {
  const mapa_archivos = {};
  let token = null;
  do {
    const respuesta = Drive.Files.list({
      q: `'${id_carpeta}' in parents and trashed = false`,
      fields:
        "nextPageToken, files(name, imageMediaMetadata, size, videoMediaMetadata)",
      pageToken: token,
      pageSize: 1000,
    });
    if (respuesta.files) {
      respuesta.files.forEach((f) => {
        mapa_archivos[f.name.trim()] = {
          width: f.imageMediaMetadata ? f.imageMediaMetadata.width : 0,
          size: f.size || 0,
          duration: f.videoMediaMetadata
            ? f.videoMediaMetadata.durationMillis / 1000
            : 0,
        };
      });
    }
    token = respuesta.nextPageToken;
  } while (token);
  return mapa_archivos;
}

function dispararAccionGithub(interfaz, configuracion) {
  const token_github =
    PropertiesService.getScriptProperties().getProperty("GITHUB_TOKEN");
  if (!token_github)
    return interfaz.alert(
      "Error",
      "No hay GITHUB_TOKEN configurado.",
      interfaz.ButtonSet.OK,
    );

  const propietario = configuracion.github_username.toString().trim();
  const repositorio = configuracion.github_repo.toString().trim();
  const endpoint = `https://api.github.com/repos/${propietario}/${repositorio}/actions/workflows/sync.yml/dispatches`;

  try {
    const solicitud = UrlFetchApp.fetch(endpoint, {
      method: "post",
      contentType: "application/json",
      muteHttpExceptions: true,
      headers: {
        Authorization: "token " + token_github,
        Accept: "application/vnd.github.v3+json",
      },
      payload: JSON.stringify({ ref: "main" }),
    });
    if (solicitud.getResponseCode() === 204) {
      interfaz.alert(
        "🚀 Lanzado",
        `El menú se sincronizará en breve en la web.`,
        interfaz.ButtonSet.OK,
      );
    } else {
      interfaz.alert(
        "Error de GitHub",
        solicitud.getContentText(),
        interfaz.ButtonSet.OK,
      );
    }
  } catch (error) {
    interfaz.alert(
      "Error de conexión",
      error.toString(),
      interfaz.ButtonSet.OK,
    );
  }
}

// ============================================================
// LÓGICA DE SINCRONIZACIÓN Y TRADUCCIÓN (MEJORADA POR LOTE)
// ============================================================
function sincronizarYTraducirTextos() {
  const interfaz = SpreadsheetApp.getUi();
  const libro = SpreadsheetApp.getActiveSpreadsheet();
  const hoja_es = libro.getSheetByName(HOJA_ESPANOL);
  if (!hoja_es) return;

  let hoja_int = libro.getSheetByName(HOJA_INTERNACIONAL);
  if (!hoja_int) {
    hoja_int = libro.insertSheet(HOJA_INTERNACIONAL);
    hoja_int.appendRow([
      "id",
      "nombre_es",
      "nombre_en",
      "nombre_fr",
      "descripcion_es",
      "descripcion_en",
      "descripcion_fr",
    ]);
    hoja_int.getRange("A1:G1").setFontWeight("bold").setBackground("#F3F3F3");
    hoja_int.setFrozenRows(1);
  }

  const datos_es = hoja_es.getDataRange().getValues();
  const cab_es = datos_es.shift();
  const idx_es = {
    id: cab_es.indexOf("id"),
    nom: cab_es.indexOf("nombre"),
    desc: cab_es.indexOf("descripcion"),
  };

  if (idx_es.id === -1 || idx_es.nom === -1) {
    return interfaz.alert(
      "Error",
      `Faltan columnas "id" o "nombre" en ${HOJA_ESPANOL}.`,
      interfaz.ButtonSet.OK,
    );
  }

  // Preparamos matriz de escritura para Menu_INT
  const datos_int = hoja_int.getDataRange().getValues();
  const cab_int = datos_int[0];
  const mapa_int = {};
  datos_int.slice(1).forEach((fila, i) => {
    if (fila[0])
      mapa_int[fila[0].toString().trim().toUpperCase()] = {
        idx_fila: i + 1,
        datos: fila,
      }; // idx_fila + 1 porque quitamos cabecera
  });

  // Array que almacenará todos los datos a reescribir masivamente (Batch)
  const nueva_matriz_int = [];
  let cont_nuevos = 0,
    cont_trads = 0;

  libro.toast(
    "Evaluando textos y sincronizando con Menu_INT...",
    "En marcha 🤖",
  );

  for (let i = 0; i < datos_es.length; i++) {
    const fila_es = datos_es[i];
    if (
      !fila_es[idx_es.id] ||
      fila_es[idx_es.id].toString().includes("#") ||
      !fila_es[idx_es.nom]
    )
      continue;

    const id_plato = fila_es[idx_es.id].toString().trim().toUpperCase();
    const texto_nom_es = fila_es[idx_es.nom].toString().trim();
    const texto_desc_es = (fila_es[idx_es.desc] || "").toString().trim();

    let fila_final_int = [
      id_plato,
      texto_nom_es,
      "",
      "",
      texto_desc_es,
      "",
      "",
    ];

    if (mapa_int[id_plato]) {
      // Existe en INT. Mantenemos traducciones existentes, pero FORZAMOS actualizar los textos en Español de referencia
      const datos_existentes = mapa_int[id_plato].datos;
      fila_final_int[2] = datos_existentes[2]; // nombre_en
      fila_final_int[3] = datos_existentes[3]; // nombre_fr
      fila_final_int[5] = datos_existentes[5]; // descripcion_en
      fila_final_int[6] = datos_existentes[6]; // descripcion_fr

      // Traducir solo si están vacíos
      if (!fila_final_int[2] && texto_nom_es) {
        fila_final_int[2] = LanguageApp.translate(texto_nom_es, "es", "en");
        cont_trads++;
      }
      if (!fila_final_int[3] && texto_nom_es) {
        fila_final_int[3] = LanguageApp.translate(texto_nom_es, "es", "fr");
        cont_trads++;
      }
      if (!fila_final_int[5] && texto_desc_es) {
        fila_final_int[5] = LanguageApp.translate(texto_desc_es, "es", "en");
        cont_trads++;
      }
      if (!fila_final_int[6] && texto_desc_es) {
        fila_final_int[6] = LanguageApp.translate(texto_desc_es, "es", "fr");
        cont_trads++;
      }
    } else {
      // Nuevo plato
      if (texto_nom_es) {
        fila_final_int[2] = LanguageApp.translate(texto_nom_es, "es", "en");
        fila_final_int[3] = LanguageApp.translate(texto_nom_es, "es", "fr");
        cont_trads += 2;
      }
      if (texto_desc_es) {
        fila_final_int[5] = LanguageApp.translate(texto_desc_es, "es", "en");
        fila_final_int[6] = LanguageApp.translate(texto_desc_es, "es", "fr");
        cont_trads += 2;
      }
      cont_nuevos++;
    }

    nueva_matriz_int.push(fila_final_int);
  }

  // Escritura por Lote (1 sola llamada a la API = Máximo rendimiento)
  if (nueva_matriz_int.length > 0) {
    // Rellenamos con blancos si la matriz anterior era más larga (para sobreescribir limpio)
    hoja_int
      .getRange(
        2,
        1,
        Math.max(nueva_matriz_int.length, datos_int.length - 1),
        7,
      )
      .clearContent();
    hoja_int
      .getRange(2, 1, nueva_matriz_int.length, 7)
      .setValues(nueva_matriz_int);
  }

  libro.toast("Sincronización finalizada", "Hecho ✅");
  if (cont_trads > 0 || cont_nuevos > 0) {
    interfaz.alert(
      "¡Éxito!",
      `Platos sincronizados.\nNuevos detectados: ${cont_nuevos}\nTextos traducidos (IA): ${cont_trads}`,
      interfaz.ButtonSet.OK,
    );
  } else {
    interfaz.alert(
      "Todo al día",
      "No se detectaron campos vacíos para traducir. Textos de referencia actualizados.",
      interfaz.ButtonSet.OK,
    );
  }
}

// ============================================================
// UI HTML REPORTES
// ============================================================
function mostrarReporteHTML(interfaz, resultado, es_bloqueo) {
  if (resultado.es_valido && resultado.advertencias.length === 0) {
    return interfaz.alert(
      "✅ Todo Correcto",
      "El menú está validado y listo.",
      interfaz.ButtonSet.OK,
    );
  }

  let html_str = `<div style="font-family: Arial, sans-serif; padding: 10px;">`;
  if (!resultado.es_valido) html_str += renderizarErrores(resultado.errores);
  if (resultado.advertencias.length > 0)
    html_str += renderizarAdvertencias(resultado.advertencias);
  html_str += `</div>`;

  const html_output = HtmlService.createHtmlOutput(html_str)
    .setWidth(600)
    .setHeight(450);
  interfaz.showModalDialog(
    html_output,
    es_bloqueo ? "🛑 Publicación Bloqueada" : "📋 Reporte de Validación",
  );
}

function renderizarErrores(errores) {
  let html = `<h3 style="color: #d32f2f;">❌ Se encontraron ${errores.length} Errores:</h3>`;
  html += `<p style="font-size: 12px; color: #555;">Se han añadido notas en las celdas afectadas.</p>`;
  html += `<ul style="color: #d32f2f; font-size: 14px; background: #ffebee; padding: 15px; border-radius: 8px;">`;
  errores.forEach((e) => (html += `<li style="margin-bottom: 5px;">${e}</li>`));
  return html + `</ul>`;
}

function renderizarAdvertencias(advertencias) {
  let html = `<h3 style="color: #f57c00;">⚠️ Advertencias:</h3>`;
  html += `<ul style="color: #ef6c00; font-size: 14px; background: #fff3e0; padding: 15px; border-radius: 8px;">`;
  advertencias.forEach(
    (a) => (html += `<li style="margin-bottom: 5px;">${a}</li>`),
  );
  return html + `</ul>`;
}

// ============================================================
// PROXY SEGURO PARA ENVIOS A TELEGRAM (Soporta CORS local)
// ============================================================
function doPost(e) {
  try {
    // Leemos el mensaje como parámetro de formulario estándar
    const textoMensaje = e.parameter.mensaje;
    if (!textoMensaje) throw new Error("No se recibió el parámetro 'mensaje'");

    const scriptProps = PropertiesService.getScriptProperties();
    const tokenBot = scriptProps.getProperty("TELEGRAM_BOT_TOKEN");
    const chatId = scriptProps.getProperty("TELEGRAM_CHAT_ID");

    if (!tokenBot || !chatId) {
      throw new Error("El Bot de Telegram no está configurado.");
    }

    const opciones = {
      method: "post",
      contentType: "application/json",
      muteHttpExceptions: true,
      payload: JSON.stringify({
        chat_id: chatId,
        text: textoMensaje,
        parse_mode: "HTML",
      }),
    };

    UrlFetchApp.fetch(
      `https://api.telegram.org/bot${tokenBot}/sendMessage`,
      opciones,
    );

    return ContentService.createTextOutput(
      JSON.stringify({ status: "success" }),
    ).setMimeType(ContentService.MimeType.JSON);
  } catch (error) {
    return ContentService.createTextOutput(
      JSON.stringify({ status: "error", error: error.toString() }),
    ).setMimeType(ContentService.MimeType.JSON);
  }
}
