

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
