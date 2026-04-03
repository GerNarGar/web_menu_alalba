/**
 * ==========================================================================
 * MENÚ DIGITAL REACTIVO (Vanilla JS con Proxy y Template Literals)
 * ==========================================================================
 */

// =========================== CONFIGURACIÓN UI ===========================
const CONFIG_UI = {
  transitionModalMs: 300,
  swipeMinDistance: 50,
  swipeMargin: 30,
  videoIntersectionThreshold: 0.6,
  toastDefaultTimeout: 4000,
  cartExpireHours: 1,
  animationCardDelayMax: 0.3,
  vibratePattern: [100, 50, 100],
};

// =========================== UTILIDADES ===========================
const escapeHtml = (str) => {
  if (!str) return "";
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
};

const formatMoney = (value) => {
  const numero = parseFloat(value);
  const cadenaNumerica = isNaN(numero)
    ? value
    : numero % 1 === 0
      ? numero.toString()
      : numero.toFixed(2).replace(".", ",");
  const simbolo = state.menuData?.meta?.currency || "€";
  const posicion = state.menuData?.meta?.currency_position || "derecha";
  return posicion === "izquierda"
    ? `${simbolo} ${cadenaNumerica}`
    : `${cadenaNumerica} ${simbolo}`;
};

const sanitizeAndFormat = (text) => escapeHtml(text);

// =========================== ESTADO REACTIVO ===========================
const state = new Proxy(
  {
    menuData: null,
    lang: "es",
    activeCategory: "",
    activeVideoCategory: "",
    cart: {},
    tableId: "No",
    takeaway: false,
    ordersAllowed: false,
    currentView: "menu",
    toastTimer: null,
    observers: [],
    _toastTimeout: null,
  },
  {
    set(target, prop, value) {
      const oldValue = target[prop];
      target[prop] = value;

      if (prop === "cart") {
        updateCartBadge();
        if (
          document
            .getElementById("capa-modal-carrito")
            ?.classList.contains("mostrar")
        ) {
          renderCartModal();
        }
        if (
          document
            .getElementById("capa-modal-detalle")
            ?.classList.contains("mostrar")
        ) {
          const detailId = document
            .getElementById("area-contenido-detalle")
            .getAttribute("data-plato-id");
          if (detailId) renderDetailBar(detailId);
        }
        document
          .querySelectorAll(".contenedor-controles-cantidad")
          .forEach((container) => {
            const platoId = container.getAttribute("data-plato-control");
            if (platoId) {
              container.innerHTML = buildQuantityControl(
                platoId,
                state.cart[platoId] || 0,
              );
            }
          });
      } else if (prop === "lang") {
        applyTranslations();
        renderCategories();
        if (state.currentView === "menu") renderDishList();
        else if (state.currentView === "video") renderVideoTabs();
      } else if (prop === "activeCategory") {
        if (state.currentView === "menu") {
          renderCategories();
          renderDishList();
          updateUrl();
        } else {
          renderVideoTabs();
          scrollToVideoCategory(value);
        }
      } else if (prop === "currentView") {
        switchView(value);
        updateUrl();
      }
      return true;
    },
  },
);

// =========================== i18n ===========================
const dictionary = {
  es: {
    menu: "Menú",
    my_list: "Mis platos",
    add: "Añadir",
    total: "Total",
    complete_order: "Completar pedido",
    modify: "Modificar",
    confirm_order: "Confirmar",
    table: "Mesa",
    home: "Inicio",
    see_more: "Ver más",
    see_less: "Ver menos",
    empty_menu: "No hay platos disponibles",
    allergens: "Alérgenos",
    chef_suggestion: "Sugerencia del chef",
    sending_order: "Enviando...",
    order_name: "Tu nombre",
    order_phone: "Tu teléfono",
    error_form: "Por favor, rellena tu nombre y teléfono.",
    order_error: "Error al enviar el pedido.",
    success_msg: "Muchas gracias, en breve le atenderá un camarero.",
    success_btn: "Cerrar",
  },
  en: {
    menu: "Menu",
    my_list: "My dishes",
    add: "Add",
    total: "Total",
    complete_order: "Complete order",
    modify: "Modify",
    confirm_order: "Confirm",
    table: "Table",
    home: "Home",
    see_more: "See more",
    see_less: "See less",
    empty_menu: "No dishes available",
    allergens: "Allergens",
    chef_suggestion: "Chef's choice",
    sending_order: "Sending...",
    order_name: "Your name",
    order_phone: "Your phone",
    error_form: "Please fill in your name and phone.",
    order_error: "Error sending the order.",
    success_msg: "Thank you very much, a waiter will be with you shortly.",
    success_btn: "Close",
  },
  fr: {
    menu: "Menu",
    my_list: "Mes plats",
    add: "Ajouter",
    total: "Total",
    complete_order: "Finaliser la commande",
    modify: "Modifier",
    confirm_order: "Confirmer",
    table: "Table",
    home: "Accueil",
    see_more: "Voir plus",
    see_less: "Voir moins",
    empty_menu: "Aucun plat disponible",
    allergens: "Allergènes",
    chef_suggestion: "Suggestion du chef",
    sending_order: "Envoi en cours...",
    order_name: "Votre nom",
    order_phone: "Votre téléphone",
    error_form: "Veuillez indiquer votre nom et téléphone.",
    order_error: "Erreur lors de l'envoi de la commande.",
    success_msg: "Merci beaucoup, un serveur s'occupera de vous sous peu.",
    success_btn: "Fermer",
  },
};

const t = (key) => dictionary[state.lang][key] || key;

const applyTranslations = () => {
  document.querySelectorAll(".elemento-traducible").forEach((el) => {
    const key = el.getAttribute("data-clave-traduccion");
    if (el.tagName === "INPUT") el.placeholder = t(key);
    else el.textContent = t(key);
  });
  document.getElementById("texto-codigo-idioma").textContent =
    state.lang.toUpperCase();
  const flagMap = { es: "🇪🇸", en: "🇬🇧", fr: "🇫🇷" };
  document.getElementById("icono-bandera-idioma").textContent =
    flagMap[state.lang] || "🇪🇸";
};

const getLocalizedText = (item) => item.i18n[state.lang] || item.i18n.es;

// =========================== RENDERIZADO CON TEMPLATES ===========================
/* DISEÑO: Control de cantidad (stepper o botón añadir) - styles.css (.caja-cantidad, .btn-agregar) */
const buildQuantityControl = (platoId, quantity) => {
  if (!state.ordersAllowed) return "";
  if (quantity > 0) {
    return `
            <div class="caja-cantidad">
                <button class="btn-cantidad boton-restar" data-plato-id="${platoId}" data-action="decrement">−</button>
                <span class="text-tema-texto font-semibold text-center flex-1 etiqueta-cantidad">${quantity}</span>
                <button class="btn-cantidad boton-sumar" data-plato-id="${platoId}" data-action="increment">+</button>
            </div>
        `;
  } else {
    return `<button class="btn-agregar" data-plato-id="${platoId}" data-action="add">${t("add")}</button>`;
  }
};

/* DISEÑO: Lista de platos (tarjetas) - styles.css (.tarjeta-plato, .tarjeta-imagen-caja, etc) */
const renderDishList = () => {
  const container = document.getElementById("contenedor-principal-platos");
  const dishes = state.menuData.items.filter(
    (item) => item.category === state.activeCategory && item.image,
  );
  const emptyMsg = document.getElementById("mensaje-estado-vacio");

  if (dishes.length === 0) {
    container.innerHTML = "";
    emptyMsg.classList.remove("hidden");
    emptyMsg.classList.add("flex");
    return;
  }
  emptyMsg.classList.add("hidden");
  emptyMsg.classList.remove("flex");

  let html = "";
  dishes.forEach((dish, idx) => {
    const texts = getLocalizedText(dish);
    const price = formatMoney(dish.price);
    /* DISEÑO: Etiqueta chef miniatura - styles.css (.etiqueta-chef-miniatura) */
    const chefBadge = dish.is_chef_choice
      ? `<div class="nodo-etiqueta-chef etiqueta-chef-miniatura hidden"><svg class="w-3 h-3" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M17 21a1 1 0 0 0 1-1v-5.35c0-.457.316-.844.727-1.041a4 4 0 0 0-2.134-7.589a5 5 0 0 0-9.186 0a4 4 0 0 0-2.134 7.588c.411.198.727.585.727 1.041V20a1 1 0 0 0 1 1ZM6 17h12"/></svg><span>Chef</span></div>`
      : "";
    let allergensHtml = "";
    dish.allergens.forEach((al) => {
      /* DISEÑO: Icono alérgeno en tarjeta - styles.css (.icono-alergeno-tarjeta) */
      allergensHtml += `<img src="${escapeHtml(al.icon)}" class="w-6 h-6 rounded-full icono-alergeno-tarjeta p-1" title="${escapeHtml(al.name[state.lang])}" loading="lazy">`;
    });
    const controlHtml = buildQuantityControl(dish.id, state.cart[dish.id] || 0);
    const delay = Math.min(idx * 0.05, CONFIG_UI.animationCardDelayMax);
    html += `
            <article class="tarjeta-plato entrada-tarjeta" data-plato-id="${dish.id}" style="--retraso: ${delay}s">
                <div class="tarjeta-imagen-caja">
                    <img src="${escapeHtml(dish.image)}" class="tarjeta-imagen nodo-imagen-plato" loading="lazy" draggable="false" oncontextmenu="return false;">
                    ${chefBadge}
                </div>
                <div class="flex-1 flex flex-col justify-between py-1 overflow-hidden">
                    <div>
                        <h3 class="font-semibold text-tema-texto text-base leading-tight mb-1 line-clamp-2 nodo-titulo-plato">${escapeHtml(texts.name)}</h3>
                        <p class="text-lg font-bold text-tema-acento mb-2 nodo-precio-plato">${price}</p>
                        <div class="flex flex-wrap gap-1 mb-2 nodo-contenedor-alergenos">${allergensHtml}</div>
                    </div>
                    <div class="flex items-center justify-end contenedor-controles-cantidad" data-plato-control="${dish.id}">${controlHtml}</div>
                </div>
            </article>
        `;
  });
  container.innerHTML = html;
};

/* DISEÑO: Pestañas de categorías (menú) - styles.css (.pestana-categoria) */
const renderCategories = () => {
  const container = document.getElementById("contenedor-pestanas-categorias");
  let html = "";
  state.menuData.categories.forEach((cat) => {
    const activeClass = cat.id === state.activeCategory ? "activa" : "";
    html += `<button class="pestana-categoria flex-1 text-center whitespace-nowrap px-3 py-2 rounded-full text-sm font-medium transition-colors ${activeClass}" data-categoria-id="${cat.id}">${escapeHtml(cat.label[state.lang])}</button>`;
  });
  container.innerHTML = html;
};

/* DISEÑO: Pestañas de categorías (video) - styles.css (.pestana-categoria-video) */
const renderVideoTabs = () => {
  const container = document.getElementById("contenedor-pestanas-video");
  let html = "";
  state.menuData.categories.forEach((cat) => {
    const activeClass = cat.id === state.activeVideoCategory ? "activa" : "";
    html += `<button class="pestana-categoria-video flex-1 text-center whitespace-nowrap px-3 py-2 rounded-full text-xs font-medium transition-colors ${activeClass}" data-categoria-id="${cat.id}">${escapeHtml(cat.label[state.lang])}</button>`;
  });
  container.innerHTML = html;
};

/* DISEÑO: Feed de videos estilo TikTok - styles.css (.contenedor-video, .interfaz-video, .gradiente-video, etc) */
const renderFeedVideo = () => {
  const container = document.getElementById("area-scroll-videos");
  const order = state.menuData.categories.map((c) => c.id);
  const videoItems = state.menuData.items
    .filter((i) => i.image)
    .sort((a, b) => order.indexOf(a.category) - order.indexOf(b.category));
  if (videoItems.length === 0) {
    container.innerHTML = `<div class="flex items-center justify-center h-full text-tema-suave">${t("empty_menu")}</div>`;
    return;
  }
  let html = "";
  videoItems.forEach((item) => {
    const texts = getLocalizedText(item);
    /* DISEÑO: Etiqueta chef en video - styles.css (.etiqueta-chef-video) */
    const chefHtml = item.is_chef_choice
      ? `<div class="inline-flex items-center space-x-1 py-0.5 rounded-md etiqueta-chef-video mb-1"><svg class="icono-sugerencia-chef" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M17 21a1 1 0 0 0 1-1v-5.35c0-.457.316-.844.727-1.041a4 4 0 0 0-2.134-7.589a5 5 0 0 0-9.186 0a4 4 0 0 0-2.134 7.588c.411.198.727.585.727 1.041V20a1 1 0 0 0 1 1ZM6 17h12"/></svg><span class="text-xs font-semibold">${t("chef_suggestion")}</span></div>`
      : "";
    const videoHtml = item.video
      ? `
            <video class="elemento-video" src="${escapeHtml(item.video.src)}" loop playsinline muted preload="none" oncontextmenu="return false;" disablePictureInPicture controlsList="nodownload"></video>
            <img class="superposicion-poster" src="${escapeHtml(item.video.poster)}" alt="" oncontextmenu="return false;">
            <div class="superposicion-reproducir hidden"><svg class="w-16 h-16 text-tema-texto opacity-80" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg></div>
            `
      : `<img class="img-respaldo" src="${escapeHtml(item.image)}" alt="" oncontextmenu="return false;">`;
    const controlHtml = buildQuantityControl(item.id, state.cart[item.id] || 0);
    let allergensHtml = "";
    if (item.allergens.length) {
      item.allergens.forEach((al) => {
        allergensHtml += `<img src="${escapeHtml(al.icon)}" class="w-7 h-7 rounded-full bg-black/40 p-1 pointer-events-none" oncontextmenu="return false;">`;
      });
    }
    html += `
            <div class="contenedor-video" data-id="${item.id}" data-categoria="${item.category}">
                ${videoHtml}
                <div class="gradiente-video absolute bottom-0 left-0 right-0 h-[55%] z-[3] pointer-events-none"></div>
                <div class="interfaz-video">
                    <div class="mb-4">
                        ${chefHtml}
                        <h3 class="text-2xl font-bold text-tema-texto mb-1 leading-tight drop-shadow-lg">${escapeHtml(texts.name)}</h3>
                        <div class="flex justify-between items-center mb-2">
                            <p class="text-xl font-bold text-tema-acento drop-shadow-md">${formatMoney(item.price)}</p>
                            <div class="flex items-center contenedor-controles-cantidad" data-plato-control="${item.id}">${controlHtml}</div>
                        </div>
                        <div class="texto-expandible text-tema-texto text-sm leading-relaxed mb-1 drop-shadow-md">${escapeHtml(texts.description)}</div>
                        ${item.allergens.length ? `<div class="hidden flex-wrap w-full gap-2 mt-2 mb-2 p-2 -ml-2 rounded-xl active:bg-white/10 transition-colors cursor-pointer" data-toast-alergenos="${item.id}">${allergensHtml}</div>` : ""}
                        <button class="text-tema-suave text-xs font-medium mb-1 drop-shadow-md" data-expandir>${t("see_more")}</button>
                    </div>
                </div>
            </div>
        `;
  });
  container.innerHTML = html;
  setupVideoObservers();
  attachVideoEventDelegation();
};

/* DISEÑO: Modal de detalle de plato - styles.css (.modal-contenedor-backdrop, .modal-contenido-deslizante, etc) */
const renderDetailModal = (platoId) => {
  const dish = state.menuData.items.find((d) => d.id == platoId);
  if (!dish) return;
  const texts = getLocalizedText(dish);
  const useVideo = state.menuData.meta.modal_uses_video && dish.video;
  let contentHtml = `
        <div class="relative h-96 bg-black rounded-b-[2rem] overflow-hidden ${useVideo ? "cursor-pointer" : ""}" id="modal-imagen-container">
            <img src="${escapeHtml(dish.image)}" class="absolute inset-0 w-full h-full object-cover transition-opacity duration-300" draggable="false" oncontextmenu="return false;" id="modal-img">
            ${
              useVideo
                ? `<div class="absolute inset-0 flex items-center justify-center transition-opacity duration-300" id="modal-play-btn"><div class="w-16 h-16 rounded-full bg-white/20 backdrop-blur-md flex items-center justify-center border border-white/30 text-white shadow-xl"><svg class="w-8 h-8 drop-shadow-lg relative right-0.25" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg></div></div>
                <video id="modal-video" class="w-full h-full object-cover hidden" src="${escapeHtml(dish.video.src)}" playsinline loop oncontextmenu="return false;" disablePictureInPicture controlsList="nodownload"></video>`
                : ""
            }
        </div>
        <div class="px-6 py-6 pb-2">
            <h1 class="text-3xl font-bold text-tema-texto mb-2">${escapeHtml(texts.name)}</h1>
            <div class="flex items-center justify-between mb-6">
                <span class="text-2xl font-bold text-tema-acento">${formatMoney(dish.price)}</span>
                ${dish.is_chef_choice ? `<div class="etiqueta-chef-detalle"><svg class="icono-sugerencia-chef" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M17 21a1 1 0 0 0 1-1v-5.35c0-.457.316-.844.727-1.041a4 4 0 0 0-2.134-7.589a5 5 0 0 0-9.186 0a4 4 0 0 0-2.134 7.588c.411.198.727.585.727 1.041V20a1 1 0 0 0 1 1ZM6 17h12"/></svg><span class="ml-1">${t("chef_suggestion")}</span></div>` : ""}
            </div>
            <p class="text-tema-suave text-lg leading-relaxed mb-6 text-left">${escapeHtml(texts.description)}</p>
    `;
  if (dish.allergens.length) {
    contentHtml += `<div class="mb-8"><h3 class="text-sm font-medium text-tema-suave uppercase tracking-wider mb-3">${t("allergens")}</h3><div class="flex flex-wrap gap-2">`;
    dish.allergens.forEach((al) => {
      /* DISEÑO: Alérgenos en modal - styles.css (.icono-alergeno-modal) */
      contentHtml += `<div class="flex items-center space-x-2 icono-alergeno-modal px-2 py-1 rounded-full"><img src="${escapeHtml(al.icon)}" class="w-5 h-5" oncontextmenu="return false;" draggable="false"><span class="text-sm text-tema-suave pr-1">${escapeHtml(al.name[state.lang])}</span></div>`;
    });
    contentHtml += `</div></div>`;
  }
  contentHtml += `</div>`;
  document.getElementById("area-contenido-detalle").innerHTML = contentHtml;
  document
    .getElementById("area-contenido-detalle")
    .setAttribute("data-plato-id", platoId);
  renderDetailBar(platoId);

  if (useVideo) {
    const containerImg = document.getElementById("modal-imagen-container");
    const img = document.getElementById("modal-img");
    const playBtn = document.getElementById("modal-play-btn");
    const video = document.getElementById("modal-video");
    containerImg.addEventListener("click", () => {
      img.style.opacity = "0";
      playBtn.style.opacity = "0";
      setTimeout(() => {
        img.classList.add("hidden");
        playBtn.classList.add("hidden");
        video.classList.remove("hidden");
        video.play();
      }, CONFIG_UI.transitionModalMs);
    });
  }
};

/* DISEÑO: Barra inferior dinámica en modal detalle - styles.css (.btn-primario, .btn-secundario) */
const renderDetailBar = (platoId) => {
  const dish = state.menuData.items.find((d) => d.id == platoId);
  if (!dish || !state.ordersAllowed) return;
  const quantity = state.cart[platoId] || 0;
  let barHtml = "";
  if (quantity > 0) {
    barHtml = `
            <div class="flex items-center justify-between">
                <div class="flex items-center justify-between space-x-2 btn-secundario rounded-full px-3 py-2 h-14 w-40">
                    <button class="w-10 h-10 flex items-center justify-center text-tema-texto text-2xl font-bold rounded-full" data-modal-action="decrement" data-plato-id="${platoId}">−</button>
                    <span class="text-2xl font-bold text-tema-texto text-center flex-1">${quantity}</span>
                    <button class="w-10 h-10 flex items-center justify-center text-tema-texto text-2xl font-bold rounded-full" data-modal-action="increment" data-plato-id="${platoId}">+</button>
                </div>
                <div class="text-right">
                    <div class="text-tema-suave text-sm">${t("total")}</div>
                    <div class="text-2xl font-bold text-tema-texto">${formatMoney(dish.price * quantity)}</div>
                </div>
            </div>
        `;
  } else {
    barHtml = `<button class="w-full h-14 btn-primario font-bold rounded-full text-lg transition-transform" data-modal-action="add" data-plato-id="${platoId}">${t("add")} • ${formatMoney(dish.price)}</button>`;
  }
  const barContainer =
    document.getElementById("barra-dinamica-detalle") ||
    (() => {
      const div = document.createElement("div");
      div.id = "barra-dinamica-detalle";
      div.className = "fixed bottom-0 left-0 right-0 cabecera-cristal p-4 z-10";
      document
        .querySelector("#capa-modal-detalle .modal-contenido-deslizante")
        .appendChild(div);
      return div;
    })();
  barContainer.innerHTML = barHtml;
};

/* DISEÑO: Modal del carrito - styles.css (.tarjeta-carrito, .btn-secundario, etc) */
const renderCartModal = () => {
  const container = document.getElementById("area-contenido-carrito");
  const cartItems = Object.entries(state.cart)
    .map(([id, qty]) => ({
      item: state.menuData.items.find((i) => i.id == id),
      cantidad: qty,
    }))
    .filter((i) => i.item);
  const footer = document.getElementById("area-pie-carrito");
  footer.innerHTML = `<div class="flex justify-between items-center mb-4"><span class="text-tema-suave">${t("total")}</span><span id="etiqueta-precio-total" class="text-2xl font-bold text-tema-texto">0.00</span></div><button id="boton-enviar-pedido" class="w-full btn-primario font-bold py-4 rounded-2xl text-lg flex justify-center items-center">${t("complete_order")}</button>`;

  if (cartItems.length === 0) {
    container.innerHTML = `<div class="flex flex-col items-center justify-center h-full text-tema-suave text-lg">${t("empty_menu")}</div>`;
    footer.classList.add("hidden");
    return;
  }
  footer.classList.remove("hidden");
  let total = 0;
  let itemsHtml = "";
  cartItems.forEach(({ item, cantidad }) => {
    total += item.price * cantidad;
    const texts = getLocalizedText(item);
    itemsHtml += `
            <div class="flex gap-4 tarjeta-carrito p-4 mb-3">
                <img src="${escapeHtml(item.image)}" class="w-20 h-20 object-cover rounded-xl bg-tema-fondo flex-shrink-0" oncontextmenu="return false;">
                <div class="flex-1 flex flex-col justify-between">
                    <div>
                        <h3 class="font-semibold text-tema-texto mb-1 leading-tight">${escapeHtml(texts.name)}</h3>
                        <p class="text-tema-acento font-bold">${formatMoney(item.price)}</p>
                    </div>
                    <div class="flex items-center justify-between mt-2">
                        <div class="flex items-center space-x-3 btn-secundario rounded-full px-2 py-1">
                            <button class="w-8 h-8 flex items-center justify-center text-tema-texto font-bold rounded-full" data-cart-action="decrement" data-plato-id="${item.id}">−</button>
                            <span class="text-tema-texto font-semibold w-4 text-center">${cantidad}</span>
                            <button class="w-8 h-8 flex items-center justify-center text-tema-texto font-bold rounded-full" data-cart-action="increment" data-plato-id="${item.id}">+</button>
                        </div>
                        <span class="text-tema-texto font-bold">${formatMoney(item.price * cantidad)}</span>
                    </div>
                </div>
            </div>
        `;
  });
  container.innerHTML = itemsHtml;
  document.getElementById("etiqueta-precio-total").textContent =
    formatMoney(total);
  document.getElementById("boton-enviar-pedido").onclick = () =>
    showOrderConfirm(total);
};

const showOrderConfirm = (total) => {
  const container = document.getElementById("area-contenido-carrito");
  let itemsList = "";
  Object.entries(state.cart).forEach(([id, cantidad]) => {
    const item = state.menuData.items.find((i) => i.id == id);
    if (item) {
      itemsList += `<div class="flex justify-between items-center py-2"><span class="text-tema-texto flex-1 pr-2">${cantidad}x ${escapeHtml(getLocalizedText(item).name)}</span><span class="text-tema-suave font-medium whitespace-nowrap">${formatMoney(item.price * cantidad)}</span></div>`;
    }
  });
  let formHtml = "";
  if (state.takeaway) {
    formHtml = `
            <div class="tarjeta-carrito p-4 w-full text-left mb-6">
                <input type="text" id="input-nombre-pedido" class="w-full input-formulario rounded-xl px-4 py-3 mb-3" placeholder="${t("order_name")}">
                <input type="tel" id="input-telefono-pedido" class="w-full input-formulario rounded-xl px-4 py-3" placeholder="${t("order_phone")}">
            </div>
        `;
  }
  container.innerHTML = `
        <div class="flex flex-col items-center text-center mt-1 w-full">
            <div class="w-full text-center mb-1"><p class="text-tema-suave text-md">${t("total")}</p><p class="text-2xl font-bold text-tema-acento mb-2">${formatMoney(total)}</p></div>
            <div class="w-full text-left rounded-2xl px-4 py-2 mb-2 border">${itemsList}</div>
            ${formHtml}
        </div>
    `;
  const footer = document.getElementById("area-pie-carrito");
  footer.innerHTML = `
        <div class="flex space-x-3 w-full">
            <button class="flex-1 btn-secundario font-bold py-4 rounded-2xl text-lg" id="btn-modificar-pedido">${t("modify")}</button>
            <button class="flex-1 btn-primario font-bold py-4 rounded-2xl text-lg flex justify-center items-center" id="btn-confirmar-pedido">${t("confirm_order")}</button>
        </div>
    `;
  document.getElementById("btn-modificar-pedido").onclick = () =>
    renderCartModal();
  document.getElementById("btn-confirmar-pedido").onclick = () =>
    sendOrder(total);
};

const updateCartBadge = () => {
  const totalItems = Object.values(state.cart).reduce((a, b) => a + b, 0);
  const cartBtn = document.getElementById("pestaña-nav-carrito");
  const badge = document.getElementById("globo-notificacion-carrito");
  const navBar = document.querySelector("nav.nav-inferior-cristal");
  if (state.ordersAllowed) {
    cartBtn.classList.remove("hidden");
    cartBtn.classList.add("flex");
    if (totalItems > 0) {
      badge.textContent = totalItems;
      badge.classList.remove("hidden");
      badge.classList.add("flex");
    } else {
      badge.classList.add("hidden");
    }
  } else {
    cartBtn.classList.add("hidden");
  }
  if (
    !state.ordersAllowed &&
    state.menuData?.meta?.enable_video_feed === false
  ) {
    navBar.classList.add("hidden");
  } else {
    navBar.classList.remove("hidden");
  }
};

// =========================== CARRITO Y PERSISTENCIA ===========================
const loadCartFromStorage = () => {
  const stored = localStorage.getItem(`cesta_pedidos_${state.tableId}`);
  if (stored) {
    try {
      const parsed = JSON.parse(stored);
      let items = parsed.items || parsed;
      const timestamp = parsed.timestamp || 0;
      const expireHours =
        state.menuData.meta.limpiar_carrito_tras_hora ||
        CONFIG_UI.cartExpireHours;
      if (timestamp && Date.now() - timestamp > expireHours * 3600000)
        items = {};
      const newCart = {};
      for (let id in items) {
        if (state.menuData.items.some((p) => p.id == id))
          newCart[id] = items[id];
      }
      state.cart = newCart;
    } catch (e) {
      state.cart = {};
    }
  }
};

const saveCart = () => {
  localStorage.setItem(
    `cesta_pedidos_${state.tableId}`,
    JSON.stringify({ items: state.cart, timestamp: Date.now() }),
  );
};

const modifyQuantity = (platoId, delta) => {
  if (!state.ordersAllowed) return;
  const newQty = (state.cart[platoId] || 0) + delta;
  if (newQty <= 0) {
    const newCart = { ...state.cart };
    delete newCart[platoId];
    state.cart = newCart;
  } else {
    state.cart = { ...state.cart, [platoId]: newQty };
  }
  saveCart();
  if (state.menuData?.meta?.vibrar_al_enviar && navigator.vibrate)
    navigator.vibrate(CONFIG_UI.vibratePattern);
};

const sendOrder = async (total) => {
  let nombre = "",
    telefono = "";
  if (state.takeaway) {
    nombre = document.getElementById("input-nombre-pedido")?.value.trim() || "";
    telefono =
      document.getElementById("input-telefono-pedido")?.value.trim() || "";
    if (!nombre || !telefono) {
      alert(t("error_form"));
      return;
    }
  }
  const btn = document.getElementById("btn-confirmar-pedido");
  btn.disabled = true;
  btn.innerHTML = `<svg class="animate-spin -ml-1 mr-3 h-5 w-5 text-tema-texto inline-block" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg><span class="elemento-traducible" data-clave-traduccion="sending_order">${t("sending_order")}</span>`;

  const orderLang = state.menuData?.meta?.order_lang || "es";
  const sanitize = (txt) =>
    txt.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const itemsResume = Object.entries(state.cart)
    .map(([id, qty]) => {
      const item = state.menuData.items.find((i) => i.id == id);
      if (!item) return "";
      const name = item.i18n[orderLang]?.name || getLocalizedText(item).name;
      return `• ${qty}x ${sanitize(name)}`;
    })
    .filter(Boolean)
    .join("\n");
  const clientInfo = state.takeaway
    ? `🥡 TAKEAWAY\n👤 Nombre: ${sanitize(nombre)}\n📞 Tel: ${sanitize(telefono)}`
    : `🍽️ ${orderLang === "es" ? "MESA" : "TABLE"}: ${sanitize(state.tableId)}`;
  const msg = `<b>${clientInfo}</b>\n⏰ ${new Date().toLocaleTimeString()}\n\n${itemsResume}`;
  const url = state.menuData.meta.gas_webapp_url;
  if (!url) {
    alert("Falta configurar URL de envío");
    btn.disabled = false;
    btn.innerText = t("confirm_order");
    return;
  }
  try {
    const formData = new URLSearchParams();
    formData.append("mensaje", msg);
    const resp = await fetch(url, { method: "POST", body: formData });
    const contentType = resp.headers.get("content-type");
    if (
      !resp.ok ||
      (contentType && contentType.indexOf("application/json") === -1)
    )
      throw new Error("Error en Apps Script");
    const data = await resp.json();
    if (data.status === "error") throw new Error(data.error);

    state.cart = {};
    saveCart();
    updateCartBadge();
    const container = document.getElementById("area-contenido-carrito");
    container.innerHTML = `<div class="flex flex-col items-center justify-center h-full text-center py-20 px-4 entrada-tarjeta"><div class="w-24 h-24 bg-green-100 rounded-full flex items-center justify-center mb-6"><svg class="w-12 h-12 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M5 13l4 4L19 7"></path></svg></div><h2 class="text-2xl font-bold text-tema-texto mb-2 leading-tight">${t("success_msg")}</h2></div>`;
    const footer = document.getElementById("area-pie-carrito");
    footer.innerHTML = `<button id="btn-cerrar-exito" class="w-full btn-secundario font-bold py-4 rounded-2xl text-lg">${t("success_btn")}</button>`;
    document.getElementById("btn-cerrar-exito").onclick = () => {
      closeCartModal();
      renderDishList();
      if (state.currentView === "video") renderFeedVideo();
    };
  } catch (e) {
    console.error(e);
    alert(t("order_error") + "\n[Debug: " + e.message + "]");
    btn.disabled = false;
    btn.innerText = t("confirm_order");
  }
};

// =========================== VÍDEO FEED & OBSERVER ===========================
let videoObserver = null;
const setupVideoObservers = () => {
  if (videoObserver) videoObserver.disconnect();
  videoObserver = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        const container = entry.target;
        const video = container.querySelector(".elemento-video");
        const playOverlay = container.querySelector(
          ".superposicion-reproducir",
        );
        const poster = container.querySelector(".superposicion-poster");
        if (
          entry.isIntersecting &&
          entry.intersectionRatio > CONFIG_UI.videoIntersectionThreshold
        ) {
          container.classList.add("esta-activo");
          if (video) {
            video.preload = "auto";
            video.onplaying = () => {
              if (poster) poster.classList.add("desvanecer");
              if (playOverlay) {
                playOverlay.classList.add("hidden");
                playOverlay.style.display = "none";
              }
            };
            video.play().catch(() => {
              if (playOverlay) {
                playOverlay.classList.remove("hidden");
                playOverlay.classList.add("forzar-mostrar");
                playOverlay.style.display = "flex";
              }
            });
          }
          const catId = container.dataset.categoria;
          if (catId && state.activeVideoCategory !== catId) {
            state.activeVideoCategory = catId;
            state.activeCategory = catId;
            renderVideoTabs();
          }
        } else {
          container.classList.remove("esta-activo");
          if (video) video.pause();
          if (poster) poster.classList.remove("desvanecer");
          if (playOverlay) {
            playOverlay.classList.add("hidden");
            playOverlay.classList.remove("forzar-mostrar");
            playOverlay.style.display = "";
          }
        }
      });
    },
    { threshold: [CONFIG_UI.videoIntersectionThreshold] },
  );
  document
    .querySelectorAll(".contenedor-video")
    .forEach((el) => videoObserver.observe(el));
};

const scrollToVideoCategory = (catId) => {
  const target = document.querySelector(
    `.contenedor-video[data-categoria="${catId}"]`,
  );
  const scrollContainer = document.getElementById("area-scroll-videos");
  if (target && scrollContainer) {
    scrollContainer.style.scrollBehavior = "auto";
    target.scrollIntoView();
    scrollContainer.style.scrollBehavior = "smooth";
  }
};

const attachVideoEventDelegation = () => {
  document.querySelectorAll(".superposicion-reproducir").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      const video = btn.closest(".contenedor-video")?.querySelector("video");
      if (video) video.play();
      btn.classList.add("hidden");
      btn.style.display = "none";
    });
  });
  document.querySelectorAll("[data-expandir]").forEach((btn) => {
    btn.removeEventListener("click", expandHandler);
    btn.addEventListener("click", expandHandler);
  });
  document.querySelectorAll("[data-toast-alergenos]").forEach((el) => {
    el.removeEventListener("click", toastHandler);
    el.addEventListener("click", toastHandler);
  });
};

const expandHandler = (e) => {
  const btn = e.currentTarget;
  const parent = btn.closest(".interfaz-video");
  const desc = parent.querySelector(".texto-expandible");
  const alergenos = parent.querySelector("[data-toast-alergenos]");
  if (desc.classList.contains("expandido")) {
    desc.classList.remove("expandido");
    if (alergenos) {
      alergenos.classList.add("hidden");
      alergenos.classList.remove("flex");
    }
    btn.textContent = t("see_more");
  } else {
    desc.classList.add("expandido");
    if (alergenos) {
      alergenos.classList.remove("hidden");
      alergenos.classList.add("flex");
    }
    btn.textContent = t("see_less");
  }
};

const toastHandler = (e) => {
  const platoId = e.currentTarget.getAttribute("data-toast-alergenos");
  showToastAllergens(platoId);
};

// =========================== TOAST ALÉRGENOS ===========================
/* DISEÑO: Toast de alérgenos - styles.css (#toast-alergenos) */
const showToastAllergens = (platoId) => {
  const dish = state.menuData.items.find((i) => i.id == platoId);
  if (!dish || !dish.allergens.length) return;
  const container = document.getElementById("contenedor-iconos-toast");
  container.innerHTML = "";
  dish.allergens.forEach((al) => {
    container.innerHTML += `<div class="flex flex-col items-center p-2 rounded-xl w-16"><img src="${escapeHtml(al.icon)}" class="w-6 h-6 mb-1 icono-alergeno-tarjeta"><span class="text-[9px] text-tema-suave leading-tight text-center">${escapeHtml(al.name[state.lang])}</span></div>`;
  });
  document.getElementById("capa-cierre-toast").classList.remove("hidden");
  const toast = document.getElementById("toast-alergenos");
  toast.classList.add("mostrar");
  clearTimeout(state._toastTimeout);
  const timeoutMs = (state.menuData.meta.toast_timeout || 4) * 1000;
  state._toastTimeout = setTimeout(() => {
    toast.classList.remove("mostrar");
    document.getElementById("capa-cierre-toast").classList.add("hidden");
  }, timeoutMs);
};

// =========================== VISTAS Y NAVEGACIÓN ===========================
const switchView = (view) => {
  const navMenu = document.getElementById("pestaña-nav-menu");
  const navVideo = document.getElementById("pestaña-nav-video");
  const feedVideo = document.getElementById("contenedor-feed-videos");
  const cabecera = document.getElementById("cabecera-principal");
  const mainContainer = document.getElementById("contenedor-principal-platos");
  document.body.style.overflow = "";
  if (view === "menu") {
    navMenu.classList.add("activa");
    navVideo.classList.remove("activa");
    feedVideo.classList.remove("vista-visible");
    feedVideo.classList.add("vista-oculta");
    cabecera.classList.remove("vista-oculta");
    mainContainer.classList.remove("vista-oculta");
    cabecera.classList.add("vista-visible");
    mainContainer.classList.add("vista-visible");
    if (videoObserver) videoObserver.disconnect();
    document.querySelectorAll("video.elemento-video").forEach((v) => v.pause());
    state.activeCategory = state.activeVideoCategory;
  } else if (view === "video") {
    navMenu.classList.remove("activa");
    navVideo.classList.add("activa");
    cabecera.classList.remove("vista-visible");
    mainContainer.classList.remove("vista-visible");
    cabecera.classList.add("vista-oculta");
    mainContainer.classList.add("vista-oculta");
    feedVideo.classList.remove("vista-oculta");
    feedVideo.classList.add("vista-visible");
    state.activeVideoCategory = state.activeCategory;
    renderVideoTabs();
    renderFeedVideo();
    scrollToVideoCategory(state.activeCategory);
  }
};

const updateUrl = () => {
  const url = new URL(window.location.origin + window.location.pathname);
  url.searchParams.set("view", state.currentView);
  if (state.tableId !== "No") url.searchParams.set("mesa", state.tableId);
  url.hash = state.activeCategory;
  history.pushState(
    { view: state.currentView, category: state.activeCategory },
    "",
    url,
  );
};

// =========================== GESTOS SWIPE ===========================
let touchStartX = 0,
  touchStartY = 0;
const initSwipe = () => {
  document.addEventListener(
    "touchstart",
    (e) => {
      touchStartX = e.touches[0].clientX;
      touchStartY = e.touches[0].clientY;
    },
    { passive: true },
  );
  document.addEventListener(
    "touchend",
    (e) => {
      const modalDetalle = document.getElementById("capa-modal-detalle");
      const modalCarrito = document.getElementById("capa-modal-carrito");
      if (
        modalDetalle.classList.contains("mostrar") ||
        modalCarrito.classList.contains("mostrar")
      )
        return;
      const endX = e.changedTouches[0].clientX;
      const endY = e.changedTouches[0].clientY;
      const diffX = touchStartX - endX;
      const diffY = touchStartY - endY;
      if (Math.abs(diffY) > Math.abs(diffX)) return;
      const margin =
        state.menuData?.meta?.swipe_margen_seguridad || CONFIG_UI.swipeMargin;
      if (touchStartX < margin || touchStartX > window.innerWidth - margin)
        return;
      if (Math.abs(diffX) > CONFIG_UI.swipeMinDistance) {
        const categories = state.menuData.categories;
        const currentId =
          state.currentView === "menu"
            ? state.activeCategory
            : state.activeVideoCategory;
        const idx = categories.findIndex((c) => c.id === currentId);
        let newIdx = idx;
        if (diffX > 0 && idx < categories.length - 1) newIdx++;
        else if (diffX < 0 && idx > 0) newIdx--;
        if (newIdx !== idx) {
          const newCat = categories[newIdx].id;
          if (state.currentView === "menu") {
            state.activeCategory = newCat;
            const activeTab = document.querySelector(
              ".pestana-categoria.activa",
            );
            if (activeTab)
              activeTab.scrollIntoView({
                behavior: "smooth",
                inline: "center",
              });
          } else {
            state.activeVideoCategory = newCat;
            state.activeCategory = newCat;
            scrollToVideoCategory(newCat);
            const activeTab = document.querySelector(
              ".pestana-categoria-video.activa",
            );
            if (activeTab)
              activeTab.scrollIntoView({
                behavior: "smooth",
                inline: "center",
              });
          }
        }
      }
    },
    { passive: true },
  );
};

// =========================== MODALES Y POPSTATE ===========================
const openDetailModal = (platoId) => {
  renderDetailModal(platoId);
  const modal = document.getElementById("capa-modal-detalle");
  modal.classList.remove("hidden");
  modal.classList.add("mostrar");
  document.body.style.overflow = "hidden";
  history.pushState({ modal: "detail" }, "");
};

const closeDetailModal = (fromPop = false) => {
  const modal = document.getElementById("capa-modal-detalle");
  modal.classList.remove("mostrar");
  modal.classList.add("hidden");
  const video = modal.querySelector("video");
  if (video) video.pause();
  document.body.style.overflow = "";
  if (!fromPop) history.back();
};

const openCartModal = () => {
  renderCartModal();
  const modal = document.getElementById("capa-modal-carrito");
  modal.classList.add("mostrar");
  document.body.style.overflow = "hidden";
  history.pushState({ modal: "cart" }, "");
};

const closeCartModal = (fromPop = false) => {
  const modal = document.getElementById("capa-modal-carrito");
  modal.classList.remove("mostrar");
  document.body.style.overflow = "";
  if (!fromPop) history.back();
};

// =========================== EVENTOS GLOBALES (DELEGACIÓN) ===========================
const globalEventDelegation = () => {
  document.addEventListener("click", (e) => {
    const target = e.target.closest("[data-categoria-id]");
    if (target && target.closest("#contenedor-pestanas-categorias")) {
      const catId = target.getAttribute("data-categoria-id");
      if (catId && state.currentView === "menu") state.activeCategory = catId;
      else if (catId && state.currentView === "video") {
        state.activeVideoCategory = catId;
        state.activeCategory = catId;
        scrollToVideoCategory(catId);
      }
      return;
    }
    const addBtn = e.target.closest('[data-action="add"]');
    if (addBtn) {
      const id = addBtn.getAttribute("data-plato-id");
      if (id) modifyQuantity(id, 1);
      return;
    }
    const decBtn = e.target.closest('[data-action="decrement"]');
    if (decBtn) {
      const id = decBtn.getAttribute("data-plato-id");
      if (id) modifyQuantity(id, -1);
      return;
    }
    const incBtn = e.target.closest('[data-action="increment"]');
    if (incBtn) {
      const id = incBtn.getAttribute("data-plato-id");
      if (id) modifyQuantity(id, 1);
      return;
    }
    const cartDec = e.target.closest('[data-cart-action="decrement"]');
    if (cartDec) {
      const id = cartDec.getAttribute("data-plato-id");
      if (id) modifyQuantity(id, -1);
      return;
    }
    const cartInc = e.target.closest('[data-cart-action="increment"]');
    if (cartInc) {
      const id = cartInc.getAttribute("data-plato-id");
      if (id) modifyQuantity(id, 1);
      return;
    }
    const dishCard = e.target.closest(".tarjeta-plato");
    if (dishCard && state.currentView === "menu") {
      const id = dishCard.getAttribute("data-plato-id");
      if (id) openDetailModal(id);
      return;
    }
    const modalAction = e.target.closest("[data-modal-action]");
    if (
      modalAction &&
      document
        .getElementById("capa-modal-detalle")
        .classList.contains("mostrar")
    ) {
      const action = modalAction.getAttribute("data-modal-action");
      const id = modalAction.getAttribute("data-plato-id");
      if (action === "add") modifyQuantity(id, 1);
      else if (action === "increment") modifyQuantity(id, 1);
      else if (action === "decrement") modifyQuantity(id, -1);
      return;
    }
  });
};

// =========================== INICIALIZACIÓN ===========================
const init = async () => {
  const params = new URLSearchParams(window.location.search);
  const resp = await fetch("./menu-data.json");
  const data = await resp.json();
  state.menuData = data;
  const meta = data.meta;
  // Inyectar CSS variables
  const root = document.documentElement.style;
  root.setProperty(
    "--color-fondo-principal",
    meta.theme_background || "#000000",
  );
  root.setProperty("--color-texto-principal", meta.theme_text || "#ffffff");
  root.setProperty("--color-acento", meta.theme_primary || "#ffffff");
  root.setProperty(
    "--color-notificacion",
    meta.theme_notification || "#ef4444",
  );
  document.title = meta.restaurant || "Menú";
  if (meta.restaurant_logo) {
    const logo = document.getElementById("logo-restaurante-img");
    logo.src = meta.restaurant_logo;
    logo.classList.remove("hidden");
    document.getElementById("wrapper-icono-inicio").classList.add("hidden");
  } else {
    document.getElementById("wrapper-icono-inicio").classList.remove("hidden");
  }
  if (meta.enable_video_feed === false) {
    document.getElementById("pestaña-nav-video").classList.add("hidden");
    document.getElementById("pestaña-nav-menu").classList.add("hidden");
    const btnLista = document.getElementById("pestaña-nav-carrito");
    btnLista.classList.remove("w-full");
    btnLista.classList.add(
      "mx-auto",
      "w-1/2",
      "bg-fondo-add",
      "rounded-full",
      "py-1",
    );
  }
  state.tableId = params.has("mesa")
    ? params.get("mesa")
    : meta.default_table || "No";
  if (state.tableId === "No") {
    const mesaElem = document.getElementById("etiqueta-mesa-actual");
    if (mesaElem && mesaElem.parentElement)
      mesaElem.parentElement.classList.add("hidden");
  } else {
    document.getElementById("etiqueta-mesa-actual").textContent = state.tableId;
  }
  state.takeaway = !params.has("mesa");
  state.ordersAllowed = meta.allow_orders || state.tableId !== "No";
  state.lang = meta.default_lang || "es";
  state.activeCategory = data.categories[0]?.id || "";
  state.activeVideoCategory = state.activeCategory;

  applyTranslations();
  loadCartFromStorage();
  renderCategories();
  renderDishList();
  updateCartBadge();

  const initialView = params.get("view") || "menu";
  const hashCat = window.location.hash.slice(1);
  if (hashCat && data.categories.some((c) => c.id === hashCat))
    state.activeCategory = hashCat;
  state.currentView = initialView;

  // Eventos fijos
  document
    .getElementById("boton-selector-idioma")
    .addEventListener("click", () => {
      document
        .getElementById("panel-desplegable-idiomas")
        .classList.toggle("hidden");
    });
  document.querySelectorAll(".boton-opcion-idioma").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      state.lang = e.currentTarget.getAttribute("data-codigo-idioma");
      document
        .getElementById("panel-desplegable-idiomas")
        .classList.add("hidden");
    });
  });
  document.getElementById("boton-inicio").addEventListener("click", () => {
    const link = state.menuData?.meta?.restaurant_url;
    if (link && link.trim()) window.location.href = link;
    else if (state.menuData.categories[0]) {
      state.activeCategory = state.menuData.categories[0].id;
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  });
  document
    .getElementById("boton-cerrar-detalle")
    .addEventListener("click", () => closeDetailModal());
  document
    .getElementById("fondo-cierre-detalle")
    .addEventListener("click", () => closeDetailModal());
  document
    .getElementById("boton-cerrar-carrito")
    .addEventListener("click", () => closeCartModal());
  document
    .getElementById("fondo-cierre-carrito")
    .addEventListener("click", () => closeCartModal());
  document.getElementById("pestaña-nav-menu").addEventListener("click", () => {
    state.currentView = "menu";
  });
  document.getElementById("pestaña-nav-video").addEventListener("click", () => {
    if (meta.enable_video_feed !== false) state.currentView = "video";
  });
  document
    .getElementById("pestaña-nav-carrito")
    .addEventListener("click", () => openCartModal());
  document.getElementById("capa-cierre-toast").addEventListener("click", () => {
    document.getElementById("toast-alergenos").classList.remove("mostrar");
    document.getElementById("capa-cierre-toast").classList.add("hidden");
  });

  globalEventDelegation();
  initSwipe();

  window.addEventListener("popstate", (event) => {
    const modalDetalle = document.getElementById("capa-modal-detalle");
    const modalCarrito = document.getElementById("capa-modal-carrito");
    if (modalDetalle.classList.contains("mostrar")) {
      closeDetailModal(true);
      return;
    }
    if (modalCarrito.classList.contains("mostrar")) {
      closeCartModal(true);
      return;
    }
    const url = new URL(window.location);
    const view = url.searchParams.get("view") || "menu";
    const cat =
      url.hash.slice(1) ||
      (state.menuData ? state.menuData.categories[0]?.id : "");
    if (state.currentView !== view) state.currentView = view;
    if (state.activeCategory !== cat) state.activeCategory = cat;
  });
};

document.addEventListener("DOMContentLoaded", init);
