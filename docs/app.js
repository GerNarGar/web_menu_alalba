/**
 * ==========================================================================
 * SISTEMA CENTRAL DEL MENÚ DIGITAL (Patrón Módulo Estructurado)
 * ==========================================================================
 */

// 📦 ESTADO GLOBAL DE LA APLICACIÓN
const EstadoApp = {
  datosMenu: null,
  idiomaActual: "es",
  categoriaActiva: "entrantes",
  categoriaVideoActiva: "entrantes",
  cestaPedidos: {},
  identificadorMesa: "No",
  pedidosPermitidos: false,
  modoParaLlevar: false,
  vistaActual: "menu",
  temporizadorToast: null,
  observadoresInterseccion: [],
};

// 🌍 SISTEMA DE INTERNACIONALIZACIÓN (i18n)
const Traductor = {
  diccionario: {
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
  },
  obtenerTexto(clave) {
    return this.diccionario[EstadoApp.idiomaActual][clave] || clave;
  },
  aplicarTraduccionesDOM() {
    document.querySelectorAll(".elemento-traducible").forEach((nodo) => {
      const clave = nodo.getAttribute("data-clave-traduccion");
      if (nodo.tagName === "INPUT") nodo.placeholder = this.obtenerTexto(clave);
      else nodo.textContent = this.obtenerTexto(clave);
    });
  },
  extraerTextoPlato(objetoPlato) {
    return objetoPlato.i18n[EstadoApp.idiomaActual] || objetoPlato.i18n.es;
  },
};

// 🎨 GESTOR DE INTERFAZ Y RENDERIZADO (Seguro contra XSS)
const InterfazDOM = {
  crearNodo(etiqueta, clases = "", texto = null, atributos = {}) {
    const elemento = document.createElement(etiqueta);
    if (clases) elemento.className = clases;
    if (texto) elemento.textContent = texto;
    for (const [clave, valor] of Object.entries(atributos))
      elemento.setAttribute(clave, valor);
    return elemento;
  },

  inyectarVariablesCSS(configuracionMetadatos) {
    const raizCSS = document.documentElement.style;
    raizCSS.setProperty(
      "--color-fondo-principal",
      configuracionMetadatos.theme_background || "#000000",
    );
    raizCSS.setProperty(
      "--color-texto-principal",
      configuracionMetadatos.theme_text || "#ffffff",
    );
    raizCSS.setProperty(
      "--color-acento",
      configuracionMetadatos.theme_primary || "#ffffff",
    );
    raizCSS.setProperty(
      "--color-notificacion",
      configuracionMetadatos.theme_notification || "#ef4444",
    );
  },

  formatearMoneda(valorNumerico) {
    const numero = parseFloat(valorNumerico);
    const cadenaNumerica = isNaN(numero)
      ? valorNumerico
      : numero % 1 === 0
        ? numero.toString()
        : numero.toFixed(2).replace(".", ",");
    const simbolo = EstadoApp.datosMenu?.meta?.currency || "€";
    const posicion = EstadoApp.datosMenu?.meta?.currency_position || "derecha";
    return posicion === "izquierda"
      ? `${simbolo} ${cadenaNumerica}`
      : `${cadenaNumerica} ${simbolo}`;
  },

  alternarVisibilidadElemento(idElemento, mostrar) {
    const elemento = document.getElementById(idElemento);
    if (!elemento) return;
    if (mostrar) {
      elemento.classList.remove("hidden");
      elemento.classList.add("flex");
    } else {
      elemento.classList.add("hidden");
      elemento.classList.remove("flex");
    }
  },

  renderizarNavegacionCategorias() {
    const contenedorPestanas = document.getElementById(
      "contenedor-pestanas-categorias",
    );
    contenedorPestanas.innerHTML = "";
    EstadoApp.datosMenu.categories.forEach((categoria) => {
      const boton = this.crearNodo(
        "button",
        `pestana-categoria flex-1 text-center whitespace-nowrap px-3 py-2 rounded-full text-sm font-medium transition-colors ${categoria.id === EstadoApp.categoriaActiva ? "activa" : ""}`,
        categoria.label[EstadoApp.idiomaActual],
      );
      boton.addEventListener("click", () =>
        ControladorApp.cambiarCategoriaPrincipal(categoria.id),
      );
      contenedorPestanas.appendChild(boton);
    });
  },

  construirControlCantidad(idPlato, cantidadActual) {
    const fragmento = document.createDocumentFragment();
    if (!EstadoApp.pedidosPermitidos) return fragmento;

    if (cantidadActual > 0) {
      const plantilla = document
        .getElementById("plantilla-control-cantidad")
        .content.cloneNode(true);
      plantilla.querySelector(".etiqueta-cantidad").textContent =
        cantidadActual;
      plantilla
        .querySelector(".boton-restar")
        .addEventListener("click", (e) => {
          e.stopPropagation();
          GestorCarrito.modificarCantidad(idPlato, -1);
        });
      plantilla.querySelector(".boton-sumar").addEventListener("click", (e) => {
        e.stopPropagation();
        GestorCarrito.modificarCantidad(idPlato, 1);
      });
      fragmento.appendChild(plantilla);
    } else {
      const plantilla = document
        .getElementById("plantilla-boton-agregar")
        .content.cloneNode(true);
      const botonAgregar = plantilla.querySelector(".btn-agregar");
      botonAgregar.textContent = Traductor.obtenerTexto("add");
      botonAgregar.addEventListener("click", (e) => {
        e.stopPropagation();
        GestorCarrito.modificarCantidad(idPlato, 1);
      });
      fragmento.appendChild(plantilla);
    }
    return fragmento;
  },

  renderizarListaPlatos() {
    const contenedorPrincipal = document.getElementById(
      "contenedor-principal-platos",
    );
    contenedorPrincipal.innerHTML = "";
    const platosCategoria = EstadoApp.datosMenu.items.filter(
      (plato) => plato.category === EstadoApp.categoriaActiva && plato.image,
    );

    if (platosCategoria.length === 0)
      return this.alternarVisibilidadElemento("mensaje-estado-vacio", true);
    this.alternarVisibilidadElemento("mensaje-estado-vacio", false);

    const plantillaTarjeta = document.getElementById("plantilla-tarjeta-plato");

    platosCategoria.forEach((plato, indice) => {
      const nodoClonado = plantillaTarjeta.content.cloneNode(true);
      const textosLocales = Traductor.extraerTextoPlato(plato);

      nodoClonado.querySelector(".nodo-titulo-plato").textContent =
        textosLocales.name;
      nodoClonado.querySelector(".nodo-precio-plato").textContent =
        this.formatearMoneda(plato.price);

      const imagenPlato = nodoClonado.querySelector(".nodo-imagen-plato");
      imagenPlato.setAttribute("src", plato.image);
      imagenPlato.setAttribute("draggable", "false");
      imagenPlato.setAttribute("oncontextmenu", "return false;");
      imagenPlato.addEventListener(
        "error",
        () => (imagenPlato.style.display = "none"),
      );

      if (plato.is_chef_choice)
        nodoClonado
          .querySelector(".nodo-etiqueta-chef")
          .classList.remove("hidden");

      const contenedorAlergenos = nodoClonado.querySelector(
        ".nodo-contenedor-alergenos",
      );
      plato.allergens.forEach((al) => {
        contenedorAlergenos.appendChild(
          this.crearNodo(
            "img",
            "w-6 h-6 rounded-full icono-alergeno-tarjeta p-1",
            null,
            { src: al.icon, title: al.name[EstadoApp.idiomaActual] },
          ),
        );
      });

      const contenedorControles = nodoClonado.querySelector(
        ".contenedor-controles-cantidad",
      );
      contenedorControles.appendChild(
        this.construirControlCantidad(
          plato.id,
          EstadoApp.cestaPedidos[plato.id] || 0,
        ),
      );
      contenedorControles.setAttribute("data-plato-control", plato.id);

      const tarjetaEntera = nodoClonado.querySelector(".tarjeta-plato");
      tarjetaEntera.style.setProperty(
        "--retraso",
        `${Math.min(indice * 0.05, 0.3)}s`,
      );
      tarjetaEntera.addEventListener("click", () =>
        ControladorApp.abrirDetallePlato(plato.id),
      );

      contenedorPrincipal.appendChild(nodoClonado);
    });
  },

  actualizarTarjetaEspecifica(idPlato) {
    document
      .querySelectorAll(`[data-plato-control="${idPlato}"]`)
      .forEach((contenedor) => {
        contenedor.innerHTML = "";
        contenedor.appendChild(
          this.construirControlCantidad(
            idPlato,
            EstadoApp.cestaPedidos[idPlato] || 0,
          ),
        );
      });
  },
};

// GESTOR DE CARRITO Y PEDIDOS
const GestorCarrito = {
  inicializar() {
    const datosGuardados = localStorage.getItem(
      `cesta_pedidos_${EstadoApp.identificadorMesa}`,
    );
    EstadoApp.cestaPedidos = {};
    if (datosGuardados) {
      try {
        const jsonParseado = JSON.parse(datosGuardados);
        let itemsRecuperados = jsonParseado.items || jsonParseado;
        let marcaTiempo = jsonParseado.timestamp || 0;
        if (
          marcaTiempo > 0 &&
          Date.now() - marcaTiempo >
            (EstadoApp.datosMenu.meta.limpiar_carrito_tras_hora || 1) * 3600000
        )
          itemsRecuperados = {};
        for (let idClave in itemsRecuperados) {
          if (EstadoApp.datosMenu.items.some((p) => p.id == idClave))
            EstadoApp.cestaPedidos[idClave] = itemsRecuperados[idClave];
        }
      } catch (error) {
        EstadoApp.cestaPedidos = {};
      }
    }
    this.refrescarInsigniasGlobales();
  },

  guardarEnMemoria() {
    localStorage.setItem(
      `cesta_pedidos_${EstadoApp.identificadorMesa}`,
      JSON.stringify({ items: EstadoApp.cestaPedidos, timestamp: Date.now() }),
    );
  },

  modificarCantidad(idPlato, variacionNumerica) {
    if (!EstadoApp.pedidosPermitidos) return;
    if (variacionNumerica > 0) {
      EstadoApp.cestaPedidos[idPlato] =
        (EstadoApp.cestaPedidos[idPlato] || 0) + 1;
      if (EstadoApp.datosMenu?.meta?.vibrar_al_enviar && navigator.vibrate)
        navigator.vibrate([100, 50, 100]);
    } else {
      if (EstadoApp.cestaPedidos[idPlato]) EstadoApp.cestaPedidos[idPlato]--;
      if (EstadoApp.cestaPedidos[idPlato] <= 0)
        delete EstadoApp.cestaPedidos[idPlato];
    }

    this.guardarEnMemoria();
    this.refrescarInsigniasGlobales();
    InterfazDOM.actualizarTarjetaEspecifica(idPlato);

    if (
      !document
        .getElementById("capa-modal-detalle")
        .classList.contains("hidden")
    ) {
      ControladorApp.renderizarBarraInferiorModal(idPlato);
    }
    if (
      !document
        .getElementById("capa-modal-carrito")
        .classList.contains("hidden")
    ) {
      ControladorApp.renderizarCarrito();
    }
  },

  refrescarInsigniasGlobales() {
    const totalItems = Object.values(EstadoApp.cestaPedidos).reduce(
      (suma, cant) => suma + cant,
      0,
    );
    const botonNavCarrito = document.getElementById("pestaña-nav-carrito");
    const globoNotificacion = document.getElementById(
      "globo-notificacion-carrito",
    );
    const navBar = document.querySelector("nav.nav-inferior-cristal");

    if (EstadoApp.pedidosPermitidos) {
      botonNavCarrito.classList.remove("hidden");
      botonNavCarrito.classList.add("flex");
      if (totalItems > 0) {
        globoNotificacion.textContent = totalItems;
        globoNotificacion.classList.remove("hidden");
        globoNotificacion.classList.add("flex");
      } else {
        globoNotificacion.classList.add("hidden");
      }
    } else {
      botonNavCarrito.classList.add("hidden");
    }

    // Ocultar la barra inferior si NO hay pedidos y el video está desactivado
    if (
      !EstadoApp.pedidosPermitidos &&
      EstadoApp.datosMenu?.meta?.enable_video_feed === false
    ) {
      navBar.classList.add("hidden");
    } else {
      navBar.classList.remove("hidden");
    }
  },
};
// 👆 GESTOR DE SWIPE (Gestos táctiles horizontales)
const GestorGestos = {
  startX: 0,
  startY: 0,
  iniciar() {
    document.addEventListener(
      "touchstart",
      (e) => {
        this.startX = e.touches[0].clientX;
        this.startY = e.touches[0].clientY;
      },
      { passive: true },
    );

    document.addEventListener(
      "touchend",
      (e) => {
        // Bloquear si hay modales abiertos
        if (
          document
            .getElementById("capa-modal-detalle")
            .classList.contains("mostrar") ||
          document
            .getElementById("capa-modal-carrito")
            .classList.contains("mostrar")
        )
          return;

        const endX = e.changedTouches[0].clientX;
        const endY = e.changedTouches[0].clientY;
        const diffX = this.startX - endX;
        const diffY = this.startY - endY;

        // Si fue un scroll vertical normal, no hacemos nada
        if (Math.abs(diffY) > Math.abs(diffX)) return;

        const margenSeguridad =
          EstadoApp.datosMenu?.meta?.swipe_margen_seguridad || 30;
        const anchoPantalla = window.innerWidth;

        // Respetar márgenes de los bordes para no chocar con el "atrás" de Android/iOS
        if (
          this.startX < margenSeguridad ||
          this.startX > anchoPantalla - margenSeguridad
        )
          return;

        if (Math.abs(diffX) > 50) {
          this.cambiarCategoria(diffX > 0 ? "siguiente" : "anterior");
        }
      },
      { passive: true },
    );
  },

  cambiarCategoria(direccion) {
    const categorias = EstadoApp.datosMenu.categories;
    const catActualId =
      EstadoApp.vistaActual === "menu"
        ? EstadoApp.categoriaActiva
        : EstadoApp.categoriaVideoActiva;
    const indiceActual = categorias.findIndex((c) => c.id === catActualId);

    if (indiceActual === -1) return;

    let nuevoIndice = indiceActual;
    if (direccion === "siguiente" && indiceActual < categorias.length - 1)
      nuevoIndice++;
    else if (direccion === "anterior" && indiceActual > 0) nuevoIndice--;

    if (nuevoIndice !== indiceActual) {
      const nuevaCat = categorias[nuevoIndice].id;
      if (EstadoApp.vistaActual === "menu") {
        ControladorApp.cambiarCategoriaPrincipal(nuevaCat);
        const tab = document.querySelector(".pestana-categoria.activa");
        if (tab)
          tab.scrollIntoView({
            behavior: "smooth",
            inline: "center",
            block: "nearest",
          });
      } else {
        ControladorApp.desplazarAVideo(nuevaCat);
        const tab = document.querySelector(".pestana-categoria-video.activa");
        if (tab)
          tab.scrollIntoView({
            behavior: "smooth",
            inline: "center",
            block: "nearest",
          });
      }
    }
  },
};

// 🚀 CONTROLADOR PRINCIPAL (Orquestador)
const ControladorApp = {
  obtenerURLActualizada(vistaDestino, categoriaDestino) {
    const url = new URL(window.location.origin + window.location.pathname);
    url.searchParams.set("view", vistaDestino);
    if (EstadoApp.identificadorMesa !== "No") {
      url.searchParams.set("mesa", EstadoApp.identificadorMesa);
    }
    url.hash = categoriaDestino;
    return url.toString();
  },

  async iniciarAplicacion() {
    try {
      const parametrosURL = new URLSearchParams(window.location.search);
      const respuestaRed = await fetch("./menu-data.json");
      EstadoApp.datosMenu = await respuestaRed.json();

      const metadatos = EstadoApp.datosMenu.meta;
      InterfazDOM.inyectarVariablesCSS(metadatos);
      document.title = metadatos.restaurant || "Menú";

      if (metadatos.restaurant_logo) {
        const imgLogo = document.getElementById("logo-restaurante-img");
        imgLogo.src = metadatos.restaurant_logo;
        imgLogo.classList.remove("hidden");
      } else {
        document
          .getElementById("wrapper-icono-inicio")
          .classList.remove("hidden");
      }

      if (metadatos.enable_video_feed === false) {
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

      EstadoApp.identificadorMesa = parametrosURL.has("mesa")
        ? parametrosURL.get("mesa")
        : metadatos.default_table || "No";

      // Ocultar la etiqueta "Mesa" si es "No"
      if (EstadoApp.identificadorMesa === "No") {
        const nodoMesa = document.getElementById("etiqueta-mesa-actual");
        if (nodoMesa && nodoMesa.parentElement)
          nodoMesa.parentElement.classList.add("hidden");
      } else {
        document.getElementById("etiqueta-mesa-actual").textContent =
          EstadoApp.identificadorMesa;
      }

      EstadoApp.modoParaLlevar = !parametrosURL.has("mesa");
      EstadoApp.pedidosPermitidos =
        metadatos.allow_orders || EstadoApp.identificadorMesa !== "No";
      EstadoApp.idiomaActual = metadatos.default_lang || "es";

      this.configurarSelectorIdioma(EstadoApp.idiomaActual);
      Traductor.aplicarTraduccionesDOM();
      GestorCarrito.inicializar();
      this.vincularEventosEstaticos();
      GestorGestos.iniciar();

      const vistaInicial = parametrosURL.get("view") || "menu";
      const hashNavegacion = window.location.hash.slice(1);
      if (
        hashNavegacion &&
        EstadoApp.datosMenu.categories.some((c) => c.id === hashNavegacion)
      ) {
        EstadoApp.categoriaActiva = hashNavegacion;
      } else if (EstadoApp.datosMenu.categories.length > 0) {
        EstadoApp.categoriaActiva = EstadoApp.datosMenu.categories[0].id;
      }

      history.replaceState(
        { vista: vistaInicial, categoria: EstadoApp.categoriaActiva },
        "",
        this.obtenerURLActualizada(vistaInicial, EstadoApp.categoriaActiva),
      );
      this.cambiarVista(vistaInicial, true);
    } catch (errorFatal) {
      console.error(errorFatal);
      document.getElementById("contenedor-principal-platos").innerHTML =
        '<div class="text-center py-20 texto-secundario">Error de conexión.</div>';
    }
  },

  configurarSelectorIdioma(codigoIdioma) {
    EstadoApp.idiomaActual = codigoIdioma;
    const mapaBanderas = { es: "🇪🇸", en: "🇬🇧", fr: "🇫🇷" };
    document.getElementById("icono-bandera-idioma").textContent =
      mapaBanderas[codigoIdioma] || "🇪🇸";
    document.getElementById("texto-codigo-idioma").textContent =
      codigoIdioma.toUpperCase();
    document
      .getElementById("panel-desplegable-idiomas")
      .classList.add("hidden");

    Traductor.aplicarTraduccionesDOM();
    InterfazDOM.renderizarNavegacionCategorias();
    if (EstadoApp.vistaActual === "menu") InterfazDOM.renderizarListaPlatos();
    else if (EstadoApp.vistaActual === "video") this.renderizarPestanasVideo();
  },

  vincularEventosEstaticos() {
    document
      .getElementById("boton-selector-idioma")
      .addEventListener("click", () =>
        document
          .getElementById("panel-desplegable-idiomas")
          .classList.toggle("hidden"),
      );
    document.querySelectorAll(".boton-opcion-idioma").forEach((boton) => {
      boton.addEventListener("click", (e) =>
        this.configurarSelectorIdioma(
          e.currentTarget.getAttribute("data-codigo-idioma"),
        ),
      );
    });

    document.getElementById("boton-inicio").addEventListener("click", () => {
      const link = EstadoApp.datosMenu?.meta?.restaurant_url;
      if (link && link.trim() !== "") {
        window.location.href = link;
      } else {
        const primeraCategoria = EstadoApp.datosMenu.categories[0]?.id;
        if (primeraCategoria) {
          this.cambiarCategoriaPrincipal(primeraCategoria);
          window.scrollTo({ top: 0, behavior: "smooth" });
        }
      }
    });

    document
      .getElementById("boton-cerrar-detalle")
      .addEventListener("click", () => this.cerrarModalDetalle());
    document
      .getElementById("fondo-cierre-detalle")
      .addEventListener("click", () => this.cerrarModalDetalle());
    document
      .getElementById("boton-cerrar-carrito")
      .addEventListener("click", () => this.cerrarModalCarrito());
    document
      .getElementById("fondo-cierre-carrito")
      .addEventListener("click", () => this.cerrarModalCarrito());

    document
      .getElementById("pestaña-nav-menu")
      .addEventListener("click", () => this.cambiarVista("menu"));
    document
      .getElementById("pestaña-nav-video")
      .addEventListener("click", () => this.cambiarVista("video"));
    document
      .getElementById("pestaña-nav-carrito")
      .addEventListener("click", () => this.abrirModalCarrito());

    document
      .getElementById("capa-cierre-toast")
      .addEventListener("click", () => this.ocultarToastAlergenos());
  },

  cambiarVista(nombreVista, desdePopState = false) {
    if (EstadoApp.vistaActual === nombreVista && !desdePopState) return;
    if (
      nombreVista === "video" &&
      EstadoApp.datosMenu?.meta?.enable_video_feed === false
    )
      return;

    EstadoApp.vistaActual = nombreVista;

    const navMenu = document.getElementById("pestaña-nav-menu");
    const navVideo = document.getElementById("pestaña-nav-video");
    const feedVideo = document.getElementById("contenedor-feed-videos");
    const cabeceraMenu = document.getElementById("cabecera-principal");
    const contPrincipal = document.getElementById(
      "contenedor-principal-platos",
    );

    // Fix: Forzar reset de scroll en el body por si un modal se quedó a medias
    document.body.style.overflow = "";

    if (nombreVista === "menu") {
      navMenu.classList.add("activa");
      navVideo.classList.remove("activa");
      feedVideo.classList.remove("vista-visible");
      feedVideo.classList.add("vista-oculta");
      cabeceraMenu.classList.remove("vista-oculta");
      contPrincipal.classList.remove("vista-oculta");
      cabeceraMenu.classList.add("vista-visible");
      contPrincipal.classList.add("vista-visible");

      EstadoApp.observadoresInterseccion.forEach((obs) => obs.disconnect());
      EstadoApp.observadoresInterseccion = [];
      document
        .querySelectorAll("video.elemento-video")
        .forEach((v) => v.pause());

      this.cambiarCategoriaPrincipal(
        EstadoApp.categoriaVideoActiva,
        true,
        desdePopState,
      );
    } else if (nombreVista === "video") {
      navMenu.classList.remove("activa");
      navVideo.classList.add("activa");
      cabeceraMenu.classList.remove("vista-visible");
      contPrincipal.classList.remove("vista-visible");
      cabeceraMenu.classList.add("vista-oculta");
      contPrincipal.classList.add("vista-oculta");
      feedVideo.classList.remove("vista-oculta");
      feedVideo.classList.add("vista-visible");

      EstadoApp.categoriaVideoActiva = EstadoApp.categoriaActiva;
      this.renderizarPestanasVideo();
      this.renderizarFeedVideo();
      this.desplazarAVideo(EstadoApp.categoriaActiva);
    }

    if (!desdePopState) {
      history.pushState(
        { vista: nombreVista, categoria: EstadoApp.categoriaActiva },
        "",
        this.obtenerURLActualizada(nombreVista, EstadoApp.categoriaActiva),
      );
    }
  },

  cambiarCategoriaPrincipal(
    idCategoria,
    omitirAnimacion = false,
    desdePopState = false,
  ) {
    if (EstadoApp.categoriaActiva === idCategoria && !omitirAnimacion) return;
    window.scrollTo({ top: 0, behavior: "instant" });
    EstadoApp.categoriaActiva = idCategoria;
    InterfazDOM.renderizarNavegacionCategorias();
    InterfazDOM.renderizarListaPlatos();

    if (!desdePopState) {
      // Usamos replaceState para no saturar el historial al hacer scroll/click de categorias
      history.replaceState(
        { vista: EstadoApp.vistaActual, categoria: idCategoria },
        "",
        this.obtenerURLActualizada(EstadoApp.vistaActual, idCategoria),
      );
    }
  },

  // ----------------------------------------------------------------------------------
  // MODAL DETALLE DE PLATO
  // ----------------------------------------------------------------------------------
  abrirDetallePlato(idPlato) {
    const objetoPlato = EstadoApp.datosMenu.items.find((p) => p.id === idPlato);
    if (!objetoPlato) return;

    const contModal = document.getElementById("area-contenido-detalle");
    contModal.innerHTML = "";
    const textos = Traductor.extraerTextoPlato(objetoPlato);

    const usaVideo =
      EstadoApp.datosMenu.meta.modal_uses_video && objetoPlato.video;
    const contImagen = InterfazDOM.crearNodo(
      "div",
      "relative h-96 bg-black rounded-b-[2rem] overflow-hidden " +
        (usaVideo ? "cursor-pointer" : ""),
    );

    const imgModal = InterfazDOM.crearNodo(
      "img",
      "absolute inset-0 w-full h-full object-cover transition-opacity duration-300",
      null,
      {
        src: objetoPlato.image,
        draggable: "false",
        oncontextmenu: "return false;",
      },
    );
    imgModal.style.webkitTouchCallout = "none";
    imgModal.style.userSelect = "none";
    contImagen.appendChild(imgModal);

    if (usaVideo) {
      // Se ha quitado bg-black/30, añadido drop-shadow al icono y movido a la izquierda (right-0.5)
      const btnPlay = InterfazDOM.crearNodo(
        "div",
        "absolute inset-0 flex items-center justify-center transition-opacity duration-300",
      );
      btnPlay.innerHTML = `<div class="w-16 h-16 rounded-full bg-white/20 backdrop-blur-md flex items-center justify-center border border-white/30 text-white shadow-xl"><svg class="w-8 h-8 drop-shadow-lg relative right-0.25" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg></div>`;
      contImagen.appendChild(btnPlay);

      // Vídeo en bucle y sin controles nativos (simula un GIF de alta calidad)
      const videoModal = InterfazDOM.crearNodo(
        "video",
        "w-full h-full object-cover hidden",
        null,
        {
          src: objetoPlato.video.src,
          playsinline: "true",
          loop: "true",
          oncontextmenu: "return false;",
          disablePictureInPicture: "true",
          controlsList: "nodownload",
        },
      );
      contImagen.appendChild(videoModal);

      contImagen.addEventListener("click", () => {
        imgModal.style.opacity = "0";
        btnPlay.style.opacity = "0";
        setTimeout(() => {
          imgModal.classList.add("hidden");
          btnPlay.classList.add("hidden");
          videoModal.classList.remove("hidden");
          videoModal.play();
        }, 300);
      });
    } else {
      imgModal.style.pointerEvents = "none";
    }

    const cuerpoInfo = InterfazDOM.crearNodo("div", "px-6 py-6 pb-2");
    cuerpoInfo.appendChild(
      InterfazDOM.crearNodo(
        "h1",
        "text-3xl font-bold texto-principal mb-2",
        textos.name,
      ),
    );

    const filaPrecio = InterfazDOM.crearNodo(
      "div",
      "flex items-center justify-between mb-6",
    );
    filaPrecio.appendChild(
      InterfazDOM.crearNodo(
        "span",
        "text-2xl font-bold texto-acento",
        InterfazDOM.formatearMoneda(objetoPlato.price),
      ),
    );

    if (objetoPlato.is_chef_choice) {
      const divChef = InterfazDOM.crearNodo("div", "etiqueta-chef-detalle");
      divChef.innerHTML = `<svg class="icono-sugerencia-chef" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M17 21a1 1 0 0 0 1-1v-5.35c0-.457.316-.844.727-1.041a4 4 0 0 0-2.134-7.589a5 5 0 0 0-9.186 0a4 4 0 0 0-2.134 7.588c.411.198.727.585.727 1.041V20a1 1 0 0 0 1 1ZM6 17h12"/></svg><span class="ml-1">${Traductor.obtenerTexto("chef_suggestion")}</span>`;
      filaPrecio.appendChild(divChef);
    }
    cuerpoInfo.appendChild(filaPrecio);
    cuerpoInfo.appendChild(
      InterfazDOM.crearNodo(
        "p",
        "texto-secundario text-lg leading-relaxed mb-6 text-left",
        textos.description,
      ),
    );

    if (objetoPlato.allergens.length > 0) {
      const contAlergenos = InterfazDOM.crearNodo("div", "mb-8");
      contAlergenos.appendChild(
        InterfazDOM.crearNodo(
          "h3",
          "text-sm font-medium texto-secundario uppercase tracking-wider mb-3",
          Traductor.obtenerTexto("allergens"),
        ),
      );
      const gridAlergenos = InterfazDOM.crearNodo(
        "div",
        "flex flex-wrap gap-2",
      );
      objetoPlato.allergens.forEach((al) => {
        // Corregido padding: px-4 py-2
        const badge = InterfazDOM.crearNodo(
          "div",
          "flex items-center space-x-2 icono-alergeno-modal px-2 py-1 rounded-full borde-estandar",
        );
        badge.appendChild(
          InterfazDOM.crearNodo("img", "w-5 h-5", null, {
            src: al.icon,
            oncontextmenu: "return false;",
            draggable: "false",
          }),
        );
        badge.appendChild(
          InterfazDOM.crearNodo(
            "span",
            "text-sm texto-secundario pr-1",
            al.name[EstadoApp.idiomaActual],
          ),
        );
        gridAlergenos.appendChild(badge);
      });
      contAlergenos.appendChild(gridAlergenos);
      cuerpoInfo.appendChild(contAlergenos);
    }

    contModal.appendChild(contImagen);
    contModal.appendChild(cuerpoInfo);

    let barraInf = document.getElementById("barra-dinamica-detalle");
    if (!barraInf) {
      barraInf = InterfazDOM.crearNodo(
        "div",
        "fixed bottom-0 left-0 right-0 cabecera-cristal border-t borde-estandar p-4 z-10",
      );
      barraInf.id = "barra-dinamica-detalle";
      document
        .querySelector("#capa-modal-detalle .modal-contenido-deslizante")
        .appendChild(barraInf);
    }
    this.renderizarBarraInferiorModal(idPlato);

    const capaBase = document.getElementById("capa-modal-detalle");
    capaBase.classList.remove("hidden");
    capaBase.classList.add("mostrar");
    document.getElementById("area-contenido-detalle").scrollTop = 0;
    document.body.style.overflow = "hidden";
    history.pushState({ modalOcupado: true }, "");
  },

  renderizarBarraInferiorModal(idPlato) {
    const barraInf = document.getElementById("barra-dinamica-detalle");
    if (!barraInf) return;
    barraInf.innerHTML = "";
    const objetoPlato = EstadoApp.datosMenu.items.find((p) => p.id === idPlato);
    if (!objetoPlato || !EstadoApp.pedidosPermitidos) return;

    const cantidad = EstadoApp.cestaPedidos[idPlato] || 0;

    if (cantidad > 0) {
      const divLayout = InterfazDOM.crearNodo(
        "div",
        "flex items-center justify-between",
      );
      const stepper = InterfazDOM.crearNodo(
        "div",
        "flex items-center justify-between space-x-2 btn-secundario rounded-full px-3 py-2 h-14 w-40",
      );

      const btnRestar = InterfazDOM.crearNodo(
        "button",
        "w-10 h-10 flex items-center justify-center texto-principal text-2xl font-bold rounded-full",
        "−",
      );
      btnRestar.onclick = () => GestorCarrito.modificarCantidad(idPlato, -1);
      const labelCant = InterfazDOM.crearNodo(
        "span",
        "text-2xl font-bold texto-principal text-center flex-1",
        cantidad.toString(),
      );
      const btnSumar = InterfazDOM.crearNodo(
        "button",
        "w-10 h-10 flex items-center justify-center texto-principal text-2xl font-bold rounded-full",
        "+",
      );
      btnSumar.onclick = () => GestorCarrito.modificarCantidad(idPlato, 1);

      stepper.appendChild(btnRestar);
      stepper.appendChild(labelCant);
      stepper.appendChild(btnSumar);

      const divTotal = InterfazDOM.crearNodo("div", "text-right");
      divTotal.appendChild(
        InterfazDOM.crearNodo(
          "div",
          "texto-secundario text-sm",
          Traductor.obtenerTexto("total"),
        ),
      );
      divTotal.appendChild(
        InterfazDOM.crearNodo(
          "div",
          "text-2xl font-bold texto-principal",
          InterfazDOM.formatearMoneda(objetoPlato.price * cantidad),
        ),
      );

      divLayout.appendChild(stepper);
      divLayout.appendChild(divTotal);
      barraInf.appendChild(divLayout);
    } else {
      const btnAgregar = InterfazDOM.crearNodo(
        "button",
        "w-full h-14 btn-primario font-bold rounded-full text-lg transition-transform",
      );
      btnAgregar.textContent = `${Traductor.obtenerTexto("add")} • ${InterfazDOM.formatearMoneda(objetoPlato.price)}`;
      btnAgregar.onclick = () => GestorCarrito.modificarCantidad(idPlato, 1);
      barraInf.appendChild(btnAgregar);
    }
  },

  cerrarModalDetalle(desdePopState = false) {
    const modal = document.getElementById("capa-modal-detalle");
    modal.classList.remove("mostrar");
    modal.classList.add("hidden");

    const videoEnModal = modal.querySelector("video");
    if (videoEnModal) videoEnModal.pause();

    document.body.style.overflow = "";
    if (!desdePopState) history.back();
  },

  // ----------------------------------------------------------------------------------
  // CARRITO DE COMPRA Y PEDIDOS
  // ----------------------------------------------------------------------------------
  abrirModalCarrito() {
    this.renderizarCarrito();
    const modal = document.getElementById("capa-modal-carrito");
    modal.classList.add("mostrar");
    document.body.style.overflow = "hidden";
    history.pushState({ modalOcupado: true }, "");
  },

  cerrarModalCarrito(desdePopState = false) {
    const modal = document.getElementById("capa-modal-carrito");
    modal.classList.remove("mostrar");
    document.body.style.overflow = "";
    if (!desdePopState) history.back();
  },

  renderizarCarrito() {
    const contenedor = document.getElementById("area-contenido-carrito");
    contenedor.innerHTML = "";

    // Evita bugs visuales si el usuario canceló una confirmación y volvió al carrito
    const areaPie = document.getElementById("area-pie-carrito");
    areaPie.innerHTML = `<div class="flex justify-between items-center mb-4"><span class="texto-secundario elemento-traducible" data-clave-traduccion="total">${Traductor.obtenerTexto("total")}</span><span id="etiqueta-precio-total" class="text-2xl font-bold texto-principal">0.00</span></div><button id="boton-enviar-pedido" class="w-full btn-primario font-bold py-4 rounded-2xl text-lg flex justify-center items-center"><span class="elemento-traducible" data-clave-traduccion="complete_order">${Traductor.obtenerTexto("complete_order")}</span></button>`;

    const itemsEnCarrito = Object.entries(EstadoApp.cestaPedidos)
      .map(([id, cant]) => ({
        item: EstadoApp.datosMenu.items.find((i) => i.id == id),
        cantidad: cant,
      }))
      .filter((obj) => obj.item);

    if (itemsEnCarrito.length === 0) {
      contenedor.appendChild(
        InterfazDOM.crearNodo(
          "div",
          "flex flex-col items-center justify-center h-full texto-secundario text-lg",
          Traductor.obtenerTexto("empty_menu"),
        ),
      );
      areaPie.classList.add("hidden");
      return;
    }

    areaPie.classList.remove("hidden");
    let precioTotalCarrito = 0;

    itemsEnCarrito.forEach(({ item, cantidad }) => {
      precioTotalCarrito += item.price * cantidad;
      const info = Traductor.extraerTextoPlato(item);

      const divFila = InterfazDOM.crearNodo(
        "div",
        "flex gap-4 tarjeta-carrito p-4 mb-3",
      );
      divFila.appendChild(
        InterfazDOM.crearNodo(
          "img",
          "w-20 h-20 object-cover rounded-xl fondo-principal flex-shrink-0",
          null,
          { src: item.image, oncontextmenu: "return false;" },
        ),
      );

      const divDatos = InterfazDOM.crearNodo(
        "div",
        "flex-1 flex flex-col justify-between",
      );
      const divTitulos = InterfazDOM.crearNodo("div");
      divTitulos.appendChild(
        InterfazDOM.crearNodo(
          "h3",
          "font-semibold texto-principal mb-1 leading-tight",
          info.name,
        ),
      );
      divTitulos.appendChild(
        InterfazDOM.crearNodo(
          "p",
          "texto-acento font-bold",
          InterfazDOM.formatearMoneda(item.price),
        ),
      );
      divDatos.appendChild(divTitulos);

      const divControles = InterfazDOM.crearNodo(
        "div",
        "flex items-center justify-between mt-2",
      );
      const stepper = InterfazDOM.crearNodo(
        "div",
        "flex items-center space-x-3 btn-secundario rounded-full px-2 py-1",
      );

      const btnRestar = InterfazDOM.crearNodo(
        "button",
        "w-8 h-8 flex items-center justify-center texto-principal font-bold rounded-full",
        "−",
      );
      btnRestar.onclick = () => GestorCarrito.modificarCantidad(item.id, -1);
      const spanCant = InterfazDOM.crearNodo(
        "span",
        "texto-principal font-semibold w-4 text-center",
        cantidad.toString(),
      );
      const btnSumar = InterfazDOM.crearNodo(
        "button",
        "w-8 h-8 flex items-center justify-center texto-principal font-bold rounded-full",
        "+",
      );
      btnSumar.onclick = () => GestorCarrito.modificarCantidad(item.id, 1);

      stepper.appendChild(btnRestar);
      stepper.appendChild(spanCant);
      stepper.appendChild(btnSumar);
      divControles.appendChild(stepper);
      divControles.appendChild(
        InterfazDOM.crearNodo(
          "span",
          "texto-principal font-bold",
          InterfazDOM.formatearMoneda(item.price * cantidad),
        ),
      );

      divDatos.appendChild(divControles);
      divFila.appendChild(divDatos);
      contenedor.appendChild(divFila);
    });

    document.getElementById("etiqueta-precio-total").textContent =
      InterfazDOM.formatearMoneda(precioTotalCarrito);

    const btn = document.getElementById("boton-enviar-pedido");
    btn.onclick = () => this.mostrarConfirmacionPedido(precioTotalCarrito);
  },

  mostrarConfirmacionPedido(totalPedido) {
    const contenedor = document.getElementById("area-contenido-carrito");
    contenedor.innerHTML = "";

    const divResumen = InterfazDOM.crearNodo(
      "div",
      "flex flex-col items-center text-center mt-1 w-full",
    );

    // Total y precio arriba
    const divTotalTop = InterfazDOM.crearNodo("div", "w-full text-center mb-1");
    divTotalTop.appendChild(
      InterfazDOM.crearNodo(
        "p",
        "texto-secundario text-md",
        Traductor.obtenerTexto("total"),
      ),
    );
    divTotalTop.appendChild(
      InterfazDOM.crearNodo(
        "p",
        "text-2xl font-bold texto-acento mt-1",
        InterfazDOM.formatearMoneda(totalPedido),
      ),
    );
    divResumen.appendChild(divTotalTop);

    // Lista de platos abajo
    const divLista = InterfazDOM.crearNodo(
      "div",
      "w-full text-left bg-fondo-secundario rounded-2xl p-4 mb-2 border borde-estandar",
    );

    Object.entries(EstadoApp.cestaPedidos).forEach(([id, cantidad]) => {
      const item = EstadoApp.datosMenu.items.find((i) => i.id == id);
      if (item) {
        const fila = InterfazDOM.crearNodo(
          "div",
          "flex justify-between items-center py-2 border-b borde-estandar last:border-0",
        );
        const nombrePlato = InterfazDOM.crearNodo(
          "span",
          "texto-principal flex-1 pr-2",
          `${cantidad}x ${Traductor.extraerTextoPlato(item).name}`,
        );
        const precioPlato = InterfazDOM.crearNodo(
          "span",
          "texto-secundario font-medium whitespace-nowrap",
          InterfazDOM.formatearMoneda(item.price * cantidad),
        );
        fila.appendChild(nombrePlato);
        fila.appendChild(precioPlato);
        divLista.appendChild(fila);
      }
    });
    divResumen.appendChild(divLista);

    // Formulario para llevar
    if (EstadoApp.modoParaLlevar) {
      const divForm = InterfazDOM.crearNodo(
        "div",
        "tarjeta-carrito p-4 w-full text-left mb-6",
      );
      divForm.appendChild(
        InterfazDOM.crearNodo(
          "input",
          "w-full input-formulario rounded-xl px-4 py-3 mb-3",
          null,
          {
            type: "text",
            id: "input-nombre-pedido",
            placeholder: Traductor.obtenerTexto("order_name"),
          },
        ),
      );
      divForm.appendChild(
        InterfazDOM.crearNodo(
          "input",
          "w-full input-formulario rounded-xl px-4 py-3",
          null,
          {
            type: "tel",
            id: "input-telefono-pedido",
            placeholder: Traductor.obtenerTexto("order_phone"),
          },
        ),
      );
      divResumen.appendChild(divForm);
    }

    contenedor.appendChild(divResumen);

    // Reconstruir Pie con Modificar / Enviar
    const areaPie = document.getElementById("area-pie-carrito");
    areaPie.innerHTML = "";

    const divBotones = InterfazDOM.crearNodo("div", "flex space-x-3 w-full");

    const btnModificar = InterfazDOM.crearNodo(
      "button",
      "flex-1 btn-secundario font-bold py-4 rounded-2xl text-lg",
      Traductor.obtenerTexto("modify"),
    );
    btnModificar.onclick = () => this.renderizarCarrito(); // RenderizarCarrito restaura el pie original

    const btnEnviar = InterfazDOM.crearNodo(
      "button",
      "flex-1 btn-primario font-bold py-4 rounded-2xl text-lg flex justify-center items-center",
      Traductor.obtenerTexto("confirm_order"),
    );
    btnEnviar.onclick = () => this.enviarPedidoFinal(totalPedido, btnEnviar);

    divBotones.appendChild(btnModificar);
    divBotones.appendChild(btnEnviar);
    areaPie.appendChild(divBotones);
  },

  async enviarPedidoFinal(totalPedido, botonDOM) {
    let nombre = "",
      telefono = "";
    if (EstadoApp.modoParaLlevar) {
      const inputNombre = document.getElementById("input-nombre-pedido");
      const inputTel = document.getElementById("input-telefono-pedido");
      nombre = inputNombre ? inputNombre.value.trim() : "";
      telefono = inputTel ? inputTel.value.trim() : "";
      if (!nombre || !telefono) {
        alert(Traductor.obtenerTexto("error_form"));
        return;
      }
    }

    botonDOM.disabled = true;
    botonDOM.innerHTML = `<svg class="animate-spin -ml-1 mr-3 h-5 w-5 texto-principal inline-block" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg><span class="elemento-traducible" data-clave-traduccion="sending_order">${Traductor.obtenerTexto("sending_order")}</span>`;

    if (EstadoApp.datosMenu?.meta?.vibrar_al_enviar && navigator.vibrate)
      navigator.vibrate(40);

    const idiomaComanda = EstadoApp.datosMenu?.meta?.order_lang || "es";
    const sanitizarHtml = (texto) =>
      texto.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

    const resumenItems = Object.entries(EstadoApp.cestaPedidos)
      .map(([id, cantidad]) => {
        const i = EstadoApp.datosMenu.items.find((x) => x.id == id);
        if (!i) return "";
        const nombrePlato =
          i.i18n[idiomaComanda]?.name || Traductor.extraerTextoPlato(i).name;
        return `• ${cantidad}x ${sanitizarHtml(nombrePlato)}`;
      })
      .filter(Boolean)
      .join("\n");

    const etiquetaMesa = idiomaComanda === "es" ? "MESA" : "TABLE";
    const clienteDestino = EstadoApp.modoParaLlevar
      ? `🥡 TAKEAWAY\n👤 Nombre: ${sanitizarHtml(nombre)}\n📞 Tel: ${sanitizarHtml(telefono)}`
      : `🍽️ ${etiquetaMesa}: ${sanitizarHtml(EstadoApp.identificadorMesa)}`;

    // Eliminamos el cálculo del precio por seguridad (se gestiona en TPV)
    const textoTelegram = `<b>${clienteDestino}</b>\n⏰ ${new Date().toLocaleTimeString()}\n\n${resumenItems}`;

    const urlGas = EstadoApp.datosMenu.meta.gas_webapp_url;

    if (!urlGas) {
      alert("Falta configurar la URL de envío en Google Sheets.");
      botonDOM.disabled = false;
      botonDOM.innerText = Traductor.obtenerTexto("confirm_order");
      return;
    }

    try {
      const formData = new URLSearchParams();
      formData.append("mensaje", textoTelegram);

      const response = await fetch(urlGas, { method: "POST", body: formData });
      const contentType = response.headers.get("content-type");
      if (
        !response.ok ||
        (contentType && contentType.indexOf("application/json") === -1)
      ) {
        throw new Error("Fallo de despliegue en Google Apps Script.");
      }

      const resData = await response.json();
      if (resData.status === "error") throw new Error(resData.error);

      // --- ÉXITO: PANTALLA DE AGRADECIMIENTO ---
      EstadoApp.cestaPedidos = {};
      GestorCarrito.guardarEnMemoria();
      GestorCarrito.refrescarInsigniasGlobales();

      const contenedor = document.getElementById("area-contenido-carrito");
      contenedor.innerHTML = `
        <div class="flex flex-col items-center justify-center h-full text-center py-20 px-4 entrada-tarjeta">
           <div class="w-24 h-24 bg-green-100 rounded-full flex items-center justify-center mb-6">
               <svg class="w-12 h-12 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M5 13l4 4L19 7"></path></svg>
           </div>
           <h2 class="text-2xl font-bold texto-principal mb-2 leading-tight">${Traductor.obtenerTexto("success_msg")}</h2>
        </div>
      `;

      const areaPie = document.getElementById("area-pie-carrito");
      areaPie.innerHTML = `<button id="btn-cerrar-exito" class="w-full btn-secundario font-bold py-4 rounded-2xl text-lg">${Traductor.obtenerTexto("success_btn")}</button>`;

      document.getElementById("btn-cerrar-exito").onclick = () => {
        this.cerrarModalCarrito();
        InterfazDOM.renderizarListaPlatos();
        if (EstadoApp.vistaActual === "video") this.renderizarFeedVideo();
      };
    } catch (e) {
      console.error("Fallo crítico en envío:", e.message);
      alert(
        Traductor.obtenerTexto("order_error") + "\n[Debug: " + e.message + "]",
      );
      botonDOM.disabled = false;
      botonDOM.innerText = Traductor.obtenerTexto("confirm_order");
    }
  },

  // ----------------------------------------------------------------------------------
  // MODO FEED DE VIDEO
  // ----------------------------------------------------------------------------------
  renderizarPestanasVideo() {
    const contenedor = document.getElementById("contenedor-pestanas-video");
    contenedor.innerHTML = "";
    EstadoApp.datosMenu.categories.forEach((categoria) => {
      const boton = InterfazDOM.crearNodo(
        "button",
        `pestana-categoria-video flex-1 text-center whitespace-nowrap px-3 py-2 rounded-full text-xs font-medium transition-colors ${categoria.id === EstadoApp.categoriaVideoActiva ? "activa" : ""}`,
        categoria.label[EstadoApp.idiomaActual],
      );
      boton.addEventListener("click", () => this.desplazarAVideo(categoria.id));
      contenedor.appendChild(boton);
    });
  },

  desplazarAVideo(idCategoria) {
    const areaScroll = document.getElementById("area-scroll-videos");
    const primerVideo = document.querySelector(
      `.contenedor-video[data-categoria="${idCategoria}"]`,
    );
    if (primerVideo && areaScroll) {
      areaScroll.style.scrollBehavior = "auto";
      primerVideo.scrollIntoView();
      areaScroll.style.scrollBehavior = "smooth";
    }
  },

  renderizarFeedVideo() {
    const contenedor = document.getElementById("area-scroll-videos");
    contenedor.innerHTML = "";

    const ordenCategorias = EstadoApp.datosMenu.categories.map((c) => c.id);
    const platosVideo = EstadoApp.datosMenu.items
      .filter((item) => item.image)
      .sort(
        (a, b) =>
          ordenCategorias.indexOf(a.category) -
          ordenCategorias.indexOf(b.category),
      );

    if (platosVideo.length === 0) {
      contenedor.appendChild(
        InterfazDOM.crearNodo(
          "div",
          "flex items-center justify-center h-full texto-secundario",
          Traductor.obtenerTexto("empty_menu"),
        ),
      );
      return;
    }

    platosVideo.forEach((item) => {
      const info = Traductor.extraerTextoPlato(item);
      const divContenedorVideo = InterfazDOM.crearNodo(
        "div",
        "contenedor-video",
        null,
        { "data-id": item.id, "data-categoria": item.category },
      );

      if (item.video) {
        divContenedorVideo.innerHTML += `<video class="elemento-video" src="${item.video.src}" loop playsinline muted preload="none" oncontextmenu="return false;" disablePictureInPicture controlsList="nodownload"></video>`;
        divContenedorVideo.innerHTML += `<img class="superposicion-poster" src="${item.video.poster}" alt="" oncontextmenu="return false;">`;
        divContenedorVideo.innerHTML += `<div class="superposicion-reproducir hidden"><svg class="w-16 h-16 texto-principal opacity-80" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg></div>`;
      } else {
        divContenedorVideo.innerHTML += `<img class="img-respaldo" src="${item.image}" alt="" oncontextmenu="return false;">`;
      }

      divContenedorVideo.innerHTML += `<div class="gradiente-video absolute bottom-0 left-0 right-0 h-[55%] z-[3] pointer-events-none"></div>`;

      const divInterfaz = InterfazDOM.crearNodo("div", "interfaz-video");
      const divInfo = InterfazDOM.crearNodo("div", "mb-4");

      if (item.is_chef_choice) {
        const divChef = InterfazDOM.crearNodo(
          "div",
          "inline-flex items-center space-x-1 py-0.5 rounded-md etiqueta-chef-video mb-1",
        );
        divChef.innerHTML = `<svg class="icono-sugerencia-chef" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M17 21a1 1 0 0 0 1-1v-5.35c0-.457.316-.844.727-1.041a4 4 0 0 0-2.134-7.589a5 5 0 0 0-9.186 0a4 4 0 0 0-2.134 7.588c.411.198.727.585.727 1.041V20a1 1 0 0 0 1 1ZM6 17h12"/></svg><span class="text-xs font-semibold">${Traductor.obtenerTexto("chef_suggestion")}</span>`;
        divInfo.appendChild(divChef);
      }

      divInfo.appendChild(
        InterfazDOM.crearNodo(
          "h3",
          "text-2xl font-bold texto-principal mb-1 leading-tight drop-shadow-lg",
          info.name,
        ),
      );

      const divPrecioControles = InterfazDOM.crearNodo(
        "div",
        "flex justify-between items-center mb-2",
      );
      divPrecioControles.appendChild(
        InterfazDOM.crearNodo(
          "p",
          "text-xl font-bold texto-acento drop-shadow-md",
          InterfazDOM.formatearMoneda(item.price),
        ),
      );
      const divControles = InterfazDOM.crearNodo(
        "div",
        "flex items-center contenedor-controles-cantidad",
        null,
        { "data-plato-control": item.id },
      );
      divControles.appendChild(
        InterfazDOM.construirControlCantidad(
          item.id,
          EstadoApp.cestaPedidos[item.id] || 0,
        ),
      );
      divPrecioControles.appendChild(divControles);
      divInfo.appendChild(divPrecioControles);

      const parrafoDesc = InterfazDOM.crearNodo(
        "div",
        "texto-expandible texto-principal text-sm leading-relaxed mb-1 drop-shadow-md",
        info.description,
      );
      divInfo.appendChild(parrafoDesc);

      let contAlergenos = null;
      if (item.allergens.length > 0) {
        contAlergenos = InterfazDOM.crearNodo(
          "div",
          "hidden flex-wrap w-full gap-2 mt-2 mb-2 p-2 -ml-2 rounded-xl active:bg-white/10 transition-colors cursor-pointer",
        );
        contAlergenos.onclick = () => this.mostrarToastAlergenos(item.id);
        item.allergens.forEach((al) => {
          contAlergenos.appendChild(
            InterfazDOM.crearNodo(
              "img",
              "w-7 h-7 rounded-full bg-black/40 p-1 pointer-events-none",
              null,
              { src: al.icon, oncontextmenu: "return false;" },
            ),
          );
        });
        divInfo.appendChild(contAlergenos);
      }

      const btnExpandir = InterfazDOM.crearNodo(
        "button",
        "texto-secundario text-xs font-medium mb-1 drop-shadow-md",
        Traductor.obtenerTexto("see_more"),
      );
      btnExpandir.onclick = () => {
        if (parrafoDesc.classList.contains("expandido")) {
          parrafoDesc.classList.remove("expandido");
          if (contAlergenos) {
            contAlergenos.classList.add("hidden");
            contAlergenos.classList.remove("flex");
          }
          btnExpandir.textContent = Traductor.obtenerTexto("see_more");
        } else {
          parrafoDesc.classList.add("expandido");
          if (contAlergenos) {
            contAlergenos.classList.remove("hidden");
            contAlergenos.classList.add("flex");
          }
          btnExpandir.textContent = Traductor.obtenerTexto("see_less");
        }
      };
      divInfo.appendChild(btnExpandir);

      divInterfaz.appendChild(divInfo);
      divContenedorVideo.appendChild(divInterfaz);
      contenedor.appendChild(divContenedorVideo);
    });

    contenedor
      .querySelectorAll(".superposicion-reproducir")
      .forEach((boton) => {
        boton.addEventListener("click", (e) => {
          const video = e.currentTarget.parentElement.querySelector("video");
          if (video) video.play();
          e.currentTarget.classList.add("hidden");
          e.currentTarget.style.display = "none";
        });
      });

    this.configurarObservadoresVideo();
  },

  configurarObservadoresVideo() {
    EstadoApp.observadoresInterseccion.forEach((obs) => obs.disconnect());
    EstadoApp.observadoresInterseccion = [];

    const observador = new IntersectionObserver(
      (entradas) => {
        entradas.forEach((entrada) => {
          const contenedor = entrada.target;
          const video = contenedor.querySelector(".elemento-video");
          const superposicion = contenedor.querySelector(
            ".superposicion-reproducir",
          );
          const poster = contenedor.querySelector(".superposicion-poster");

          if (entrada.isIntersecting && entrada.intersectionRatio > 0.6) {
            contenedor.classList.add("esta-activo");

            if (video) {
              video.preload = "auto";
              video.onplaying = () => {
                if (poster) poster.classList.add("desvanecer");
                if (superposicion) {
                  superposicion.classList.add("hidden");
                  superposicion.style.display = "none";
                }
              };

              const promesa = video.play();
              if (promesa !== undefined) {
                promesa
                  .then(() => {
                    if (superposicion) {
                      superposicion.classList.add("hidden");
                      superposicion.style.display = "none";
                    }
                  })
                  .catch(() => {
                    if (superposicion) {
                      superposicion.classList.remove("hidden");
                      superposicion.classList.add("forzar-mostrar");
                      superposicion.style.display = "flex";
                    }
                  });
              }
            }

            const idCat = contenedor.dataset.categoria;
            if (EstadoApp.categoriaVideoActiva !== idCat) {
              EstadoApp.categoriaVideoActiva = idCat;
              EstadoApp.categoriaActiva = idCat;
              this.renderizarPestanasVideo();
            }
          } else {
            contenedor.classList.remove("esta-activo");
            if (video) video.pause();
            if (poster) poster.classList.remove("desvanecer");
            if (superposicion) {
              superposicion.classList.add("hidden");
              superposicion.classList.remove("forzar-mostrar");
              superposicion.style.display = "";
            }
          }
        });
      },
      { threshold: [0.6] },
    );

    document
      .querySelectorAll(".contenedor-video")
      .forEach((c) => observador.observe(c));
    EstadoApp.observadoresInterseccion.push(observador);
  },

  // ----------------------------------------------------------------------------------
  // TOAST ALÉRGENOS
  // ----------------------------------------------------------------------------------
  mostrarToastAlergenos(idPlato) {
    const plato = EstadoApp.datosMenu.items.find((i) => i.id == idPlato);
    if (!plato || !plato.allergens.length) return;

    const contIconos = document.getElementById("contenedor-iconos-toast");
    contIconos.innerHTML = "";

    plato.allergens.forEach((al) => {
      const div = InterfazDOM.crearNodo(
        "div",
        "flex flex-col items-center p-2 rounded-xl w-16",
      );
      div.appendChild(
        InterfazDOM.crearNodo(
          "img",
          "w-6 h-6 mb-1 icono-alergeno-tarjeta",
          null,
          { src: al.icon },
        ),
      );
      div.appendChild(
        InterfazDOM.crearNodo(
          "span",
          "text-[9px] texto-secundario leading-tight text-center",
          al.name[EstadoApp.idiomaActual],
        ),
      );
      contIconos.appendChild(div);
    });

    document.getElementById("capa-cierre-toast").classList.remove("hidden");
    document.getElementById("toast-alergenos").classList.add("mostrar");

    clearTimeout(EstadoApp.temporizadorToast);
    EstadoApp.temporizadorToast = setTimeout(
      () => this.ocultarToastAlergenos(),
      (EstadoApp.datosMenu.meta.toast_timeout || 4) * 1000,
    );
  },

  ocultarToastAlergenos() {
    clearTimeout(EstadoApp.temporizadorToast);
    document.getElementById("toast-alergenos").classList.remove("mostrar");
    document.getElementById("capa-cierre-toast").classList.add("hidden");
  },
};

// CAPTURA ESTRICTA DEL NAVEGADOR
window.addEventListener("popstate", (eventoState) => {
  const modalDetalle = document.getElementById("capa-modal-detalle");
  const modalCarrito = document.getElementById("capa-modal-carrito");

  if (modalDetalle && modalDetalle.classList.contains("mostrar")) {
    ControladorApp.cerrarModalDetalle(true);
    return;
  } else if (modalCarrito && modalCarrito.classList.contains("mostrar")) {
    ControladorApp.cerrarModalCarrito(true);
    return;
  }

  const url = new URL(window.location);
  const vistaUrl = url.searchParams.get("view") || "menu";
  const catUrl =
    url.hash.slice(1) ||
    (EstadoApp.datosMenu ? EstadoApp.datosMenu.categories[0]?.id : "entrantes");

  if (EstadoApp.vistaActual !== vistaUrl)
    ControladorApp.cambiarVista(vistaUrl, true);
  if (EstadoApp.categoriaActiva !== catUrl)
    ControladorApp.cambiarCategoriaPrincipal(catUrl, true, true);
});

// Autoinicialización
document.addEventListener("DOMContentLoaded", () =>
  ControladorApp.iniciarAplicacion(),
);
