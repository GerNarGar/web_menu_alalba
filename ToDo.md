                        img.save(PLATOS_DIR / webp_filename, 'WEBP', quality=90)
                img.save(poster_path, 'WEBP', quality=90, method=6)
image_max_width


# 📋 Lista de tareas pendientes

## 🟡 Media-Alta prioridad

### 3. Tokens de mesa (seguridad de pedidos)
- **Hoja `Mesas`** con columnas: `numero`, `token`, `creado`, `expira`, `activo`.
- **Generación de tokens**: script en GAS que genere token único para cada mesa y lo guarde en la hoja.
- **QR**: incluir `?mesa=X&token=...` en la URL del QR.
- **Frontend**: al enviar pedido, enviar también el token.
- **Backend (endpoint de pedidos)**: validar token contra hoja `Mesas` (vía API de Google Sheets), comprobar que no haya expirado. Rechazar si no es válido.

---

## 🟢 Media prioridad

### 4. Sincronización de cambios en español con `Menu_INT`
- **Opción en GAS**: nuevo menú o ampliar “Generar / Actualizar Traducción IA” para:
  - Comparar `nombre_es` y `descripcion_es` de `Menu_ES` con los almacenados en `Menu_INT` para cada ID.
  - Si hay diferencias, preguntar al gestor si desea retraducir automáticamente inglés y francés.
  - Actualizar `Menu_INT` con los nuevos textos traducidos.

### 5. Endpoint de envío de pedidos a Telegram
- **Desarrollar un script PHP en IONOS** que:
  - Reciba vía POST: `mesa`, `token`, `items` (array de `{id, cantidad}`).
  - Valide token contra la hoja `Mesas` (usando API de Google Sheets).
  - Descargue `menu-data.json` del repositorio para recalcular totales.
  - Formatee mensaje y envíe a Telegram.
  - Responda con JSON de éxito/error.
- **En `app.js`**: reemplazar `alert` por `fetch` a este endpoint, mostrar confirmación y vaciar carrito si éxito.


## 🔵 Media-Baja prioridad

### 7. Analytics DIY (opcional)
- Crear un endpoint en GAS (`doPost`) que registre eventos (vista de plato, clic en añadir) en una hoja oculta.
- En `app.js`, añadir `fetch` a ese endpoint con los datos relevantes (sin información personal).

---

**Nota**: Las tareas 2 y 3 de la versión anterior se han integrado en el punto 2 como subfunciones. El logging se ha descartado temporalmente. La notificación por Telegram ya está operativa y verificada.