- Se ve una fracion de minuto el menu en nav-bar

IMPORTANTE:
- GAS VALIDAR NUEVOS CAMPOS
- 


SEGURIDAD SPAM TELEGRAM:
# Medidas de seguridad para sistema de pedidos (restaurante pequeño, menú web + Telegram)

## 1. Verificación de origen (Referer/Origin)
- En Google Apps Script (GAS), comprobar la cabecera `Referer` o `Origin` de la petición.
- Solo aceptar peticiones que provengan del dominio de GitHub Pages (o del dominio personalizado del menú).
- **Nota:** No es infalsificable, pero filtra bots y accesos accidentales.

## 2. Token visible en el frontend
- Incluir un token fijo (cadena secreta) en el código JavaScript de la web pública.
- El JS envía ese token a GAS junto con los datos del pedido.
- GAS verifica que el token recibido coincide con el esperado (almacenado en las propiedades del script).
- **Limitación:** El token es visible para cualquiera que inspeccione el código fuente. Se asume riesgo bajo.

## 3. Validación de estructura del pedido
- En GAS, comprobar que la petición contiene los campos obligatorios (mesa, platos, cantidades, etc.) con tipos y rangos esperados.
- Rechazar peticiones con caracteres inesperados, longitud excesiva o valores no numéricos.

## 4. Límite de frecuencia (anti-spam)
- Usar `CacheService` de GAS para limitar peticiones por IP o por identificador de mesa.
- Ejemplo: no permitir más de 1 pedido cada 30 segundos desde la misma IP o misma mesa.
- Almacenar la clave en caché con tiempo de expiración corto.

## 5. QR con parámetro secreto (medida principal)
- El código QR no apunta directamente a la URL base del menú, sino a una URL que incluye un parámetro especial: `?qr=token_mesaX`.
- Cada mesa tiene su propio token (puede ser el número de mesa, una cadena aleatoria, o un token único).
- La página web lee ese parámetro de la URL y lo envía a GAS junto al pedido.
- GAS mantiene una lista de tokens válidos (en `PropertiesService`) y solo acepta pedidos que incluyan uno de ellos.

## 6. Control adicional por mesa
- Opcional: limitar el número de pedidos por token (ej. máximo 3 pedidos por mesa) usando `CacheService` o `PropertiesService`.
- Opcional: establecer una ventana de tiempo para que un token sea válido (ej. solo durante 2 horas después del primer uso, o caducidad diaria).

## 7. Token de mesa no visible en el código fuente estático
- El token de mesa no está incrustado en el JS; se obtiene dinámicamente de `window.location.search`.
- Así, un atacante que visite directamente la URL base (sin el parámetro) no podrá enviar pedidos.
- Sin embargo, si alguien obtiene la URL completa del QR (con el token), puede reutilizarla. Por eso se recomiendan los límites por tiempo/frecuencia.

## 8. (Opcional) Rotación manual de tokens
- Si se detecta abuso, cambiar los tokens en los códigos QR impresos y actualizar la lista en GAS.
- También se puede rotar automáticamente cada día (generando nuevos QR diarios) – más engorroso pero más seguro.

## 9. (Opcional) Campo oculto honeypot
- Añadir en el formulario web un campo que el usuario no ve (CSS: `display:none`) y que los bots suelen rellenar.
- Si ese campo aparece relleno en la petición a GAS, se rechaza el pedido.

## Resumen de la estrategia final (recomendada para el restaurante)
| Capa | Medida | Nivel de seguridad |
|------|--------|---------------------|
| 1 | QR con parámetro secreto por mesa | Alta (filtra accesos sin QR) |
| 2 | Validación del token en GAS | Media (el token viaja por URL, pero caduca o tiene límite) |
| 3 | Límite de frecuencia y/o número de pedidos por mesa | Media-alta |
| 4 | Verificación de origen (Referer) | Baja (complementaria) |
| 5 | Token fijo en JS | Muy baja (solo como capa adicional) |

**Conclusión:** La combinación de **QR con token por mesa + validación en GAS + límites de uso** es suficiente y proporcionada para un restaurante pequeño. No se necesita proxy ni secretos ocultos en GitHub Pages.


🚨 CÓMO FORZAR ERRORES TEMPORALMENTE PARA PROBAR:

    Para probar el error del Dev (Push a GitHub):
    En tu sync.yml, justo debajo de - name: Instalar NPM y Compilar Tailwind, añade una línea que diga run: exit 1. Haz push. El workflow fallará al llegar ahí y enviará el Telegram.

    Para probar el error de GAS (Ejecutando Python):
    En scripts/sync.py, en la línea 1 pon temporalmente raise Exception("Probando alerta de Telegram desde Python"). Al darle en Sheets a "Publicar", Python fallará, el error_telegram.txt capturará tu texto y te llegará el aviso exacto.

### ANALITICS DIY
### B.4) Analytics "DIY" Zero-Cookies con Google Sheets

¡Por supuesto que se puede! Es una práctica genial conocida como "Serverless Logging" usando el ecosistema de Google. Es 100% legal sin banners porque no guardas IPs, ni sesiones, ni usas Cookies. Solo guardas "Han hecho clic en el plato 14".

**El flujo de trabajo:**

**1. El Backend (Google Apps Script):**
Creas un Google Sheet nuevo llamado "Analytics_Restaurante". Vas a *Extensiones > Apps Script* y pegas un código tontísimo como este:
```javascript
// Este script recibe peticiones de tu web y las guarda en el Excel
function doPost(e) {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
  var data = JSON.parse(e.postData.contents);
  
  // Guardamos: Fecha/Hora actual | Acción (ej. "vista" o "añadido") | ID del Plato
  sheet.appendRow([new Date(), data.action, data.itemId]);
  
  return ContentService.createTextOutput("OK");
}
```
Le das a "Implementar como Aplicación Web" dando permisos de acceso a "Cualquier persona". Esto te dará una URL (ej. https://script.google.com/macros/s/ABC123XYZ/exec).

2. El Frontend (Tu app.js):
En tu código, creas una función que lance el dato de forma "silenciosa" (asíncrona) al aire, sin ralentizar la web:
``` JavaScript

// En app.js
logAnalytics(action, itemId) {
    const url = 'https://script.google.com/macros/s/TU_URL_AQUI/exec';
    
    // Lo enviamos mediante fetch sin esperar respuesta (fire and forget)
    fetch(url, {
        method: 'POST',
        mode: 'no-cors', // Importante para que el navegador no bloquee la petición
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            action: action,
            itemId: itemId
        })
    }).catch(e => console.log("Error silencioso de analytics"));
}
```
3. La implementación:

    Cuando el usuario hace clic en una tarjeta y llamas a showDetail(itemId), añades dentro: this.logAnalytics('vista_plato', itemId);

    Cuando el usuario llama a addToCart(itemId), añades: this.logAnalytics('añadido_carrito', itemId);

Resultado:
Tu amigo tendrá un Google Sheet que se va rellenando solo con filas como:
[2023-10-25 21:05:00] | vista_plato | 14
[2023-10-25 21:06:10] | añadido_carrito | 14

Luego él, con una simple "Tabla Dinámica" (Pivot Table) en Google Sheets, puede ver un ranking de los platos más mirados y los más comprados. ¡Magia pura, 0€ de coste, 100% privacidad garantizada y sin molestar al cliente con cookies!
