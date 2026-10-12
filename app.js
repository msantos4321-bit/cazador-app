import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/+esm";
import { SUPABASE_URL, SUPABASE_KEY, BOT_TELEGRAM } from "./config.js";
import { detectar, preguntasPara, esLiga, quitarAcentos, sugerir } from "./categorias.js";

const db = createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession: true, detectSessionInUrl: true } });
const $app = document.getElementById("app");
let usuario = null;

// ---------- utilidades ----------
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const pesos = (v) => (v == null ? "—" : "$" + Math.round(Number(v)).toLocaleString("es-MX"));
const dolares = (v) => "US$" + Number(v).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
function precio(valor, moneda, mxn) {
  if (valor == null) return "Sin precio hoy";
  if ((moneda || "").toUpperCase() === "USD") return `${dolares(valor)}${mxn ? ` <span class="suave">≈ ${pesos(mxn)}</span>` : ""}`;
  return pesos(valor);
}
const SEMAFORO = {
  "Comprar ya": { clase: "verde", texto: "Cómprala ya" },
  "Precio justo": { clase: "amarillo", texto: "Buen precio" },
  "No comprar": { clase: "rojo", texto: "Espérate" },
  "Vigilando": { clase: "gris", texto: "Vigilando" },
  "Sin datos": { clase: "gris", texto: "Buscando precio" },
};
const insignia = (v) => {
  const s = SEMAFORO[v] || SEMAFORO["Sin datos"];
  return `<span class="insignia ${s.clase}">${s.texto}</span>`;
};
/** La investigación corre una vez al día a las 6:52 pm de Tijuana. */
function cuandoLlega(creado) {
  const tj = (d) => new Date(d.toLocaleString("en-US", { timeZone: "America/Tijuana" }));
  const ahora = tj(new Date()), pedido = tj(creado ? new Date(creado) : new Date());
  const corte = new Date(pedido); corte.setHours(18, 45, 0, 0);
  const dia = new Date(pedido); if (pedido > corte) dia.setDate(dia.getDate() + 1);
  const hoy = ahora.toDateString() === dia.toDateString();
  const manana = new Date(ahora); manana.setDate(manana.getDate() + 1);
  const cuando = hoy ? "hoy" : manana.toDateString() === dia.toDateString() ? "mañana" : "en cuanto se revise";
  const minutos = (ahora - pedido) / 60000;
  if (minutos < 45) return "Ya estoy buscando: las opciones llegan en unos 15 minutos";
  return `Si no llegan pronto, a más tardar ${cuando} como a las 7 de la noche`;
}
const NIVEL = { economica: "La económica", equilibrada: "La que más conviene", mejor: "La mejor" };
function diasPara(fecha) {
  if (!fecha) return null;
  return Math.ceil((new Date(fecha + "T23:59:00") - new Date()) / 86400000);
}
function aviso(texto, tipo = "") {
  const d = document.createElement("div");
  d.className = `aviso ${tipo}`;
  d.textContent = texto;
  document.body.appendChild(d);
  setTimeout(() => d.remove(), 4000);
}
function pintar(html) {
  $app.innerHTML = html;
  window.scrollTo(0, 0);
  const h = $app.querySelector("h1");
  if (h) h.setAttribute("tabindex", "-1"), h.focus({ preventScroll: true });
}
const ICONOS = {
  lista: `<svg viewBox="0 0 24 24" width="26" height="26" aria-hidden="true"><path d="M4 6h16M4 12h16M4 18h10" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>`,
  buscar: `<svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true"><circle cx="11" cy="11" r="6.5" fill="none" stroke="currentColor" stroke-width="2.2"/><path d="M16 16l4.5 4.5" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/></svg>`,
  ajustes: `<svg viewBox="0 0 24 24" width="26" height="26" aria-hidden="true"><circle cx="12" cy="8" r="3.5" fill="none" stroke="currentColor" stroke-width="2"/><path d="M5 20c1-3.6 3.8-5.5 7-5.5s6 1.9 7 5.5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>`,
};
const barra = (activa) => `
  <nav class="barra" aria-label="Secciones">
    <a href="#/hoy" class="${activa === "hoy" ? "activa" : ""}">${ICONOS.lista}Mi lista</a>
    <a href="#/agregar" class="grande">${ICONOS.buscar}Buscar algo</a>
    <a href="#/ajustes" class="${activa === "ajustes" ? "activa" : ""}">${ICONOS.ajustes}Ajustes</a>
  </nav>`;

/** Tamaño de letra (se guarda en este teléfono). */
function leerLetra() { try { return localStorage.getItem("letra") || "normal"; } catch { return "normal"; } }
function ponerLetra(v) {
  document.documentElement.dataset.letra = v;
  try { localStorage.setItem("letra", v); } catch {}
}
document.documentElement.dataset.letra = leerLetra();

// ---------- entrar ----------
function pantallaEntrar(correo = "") {
  pintar(`
    <main class="entrar">
      <p class="ceja">Cazador de Ofertas</p>
      <h1>Compra al mejor precio, sin estar revisando.</h1>
      <p class="suave">Escribe tu correo y te mandamos un mensaje para entrar. No necesitas contraseña.</p>
      <form id="f-correo" class="pila">
        <label for="correo">Tu correo</label>
        <input id="correo" type="email" inputmode="email" autocomplete="email" required value="${esc(correo)}" placeholder="nombre@gmail.com">
        <button class="boton principal" type="submit">Mandarme el correo</button>
      </form>
    </main>`);
  document.getElementById("f-correo").onsubmit = async (e) => {
    e.preventDefault();
    const correo = document.getElementById("correo").value.trim();
    const boton = e.target.querySelector("button");
    boton.disabled = true; boton.textContent = "Mandando…";
    const { error } = await db.auth.signInWithOtp({ email: correo, options: { emailRedirectTo: location.origin + location.pathname } });
    if (error) {
      boton.disabled = false; boton.textContent = "Mandarme el correo";
      return aviso(error.status === 429 ? "Espera un minuto y vuelve a intentar." : "No se pudo mandar el código. Revisa el correo.", "error");
    }
    pantallaCodigo(correo);
  };
}

function pantallaCodigo(correo) {
  pintar(`
    <main class="entrar">
      <p class="ceja">Revisa tu correo</p>
      <h1>Abre el correo que te mandamos</h1>
      <p>Llegó a <b>${esc(correo)}</b>. Ábrelo <b>en este mismo teléfono</b> y toca el botón del mensaje (puede decir “Log In” o “Confirm your mail”). Con eso entras.</p>
      <p class="suave">Si no aparece, búscalo en "Spam" o "Promociones". Si el correo trae un código de 6 números, escríbelo aquí:</p>
      <form id="f-codigo" class="pila">
        <label for="codigo">Código de 6 números</label>
        <input id="codigo" inputmode="numeric" autocomplete="one-time-code" pattern="[0-9]{6}" maxlength="6" required class="codigo" placeholder="••••••">
        <button class="boton principal" type="submit">Entrar</button>
        <button class="boton" type="button" id="otro">Usar otro correo</button>
      </form>
    </main>`);
  const input = document.getElementById("codigo");
  input.addEventListener("input", () => { if (input.value.length === 6) input.form.requestSubmit(); });
  document.getElementById("otro").onclick = () => pantallaEntrar(correo);
  document.getElementById("f-codigo").onsubmit = async (e) => {
    e.preventDefault();
    const { error } = await db.auth.verifyOtp({ email: correo, token: input.value.trim(), type: "email" });
    if (error) { input.value = ""; return aviso("Ese código no es correcto o ya venció. Intenta otra vez.", "error"); }
    location.hash = "#/hoy";
  };
}

// ---------- piezas comunes ----------
const ICONO_BOLSA = `<svg viewBox="0 0 24 24" width="28" height="28" aria-hidden="true"><path d="M6 8h12l-1 11a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2z" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/><path d="M9 8V7a3 3 0 0 1 6 0v1" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>`;
const foto = (src, clase = "miniatura") => src
  ? `<img class="${clase}" src="${esc(src)}" alt="" loading="lazy" referrerpolicy="no-referrer" onerror="this.outerHTML='<span class=&quot;${clase} vacia&quot;>${ICONO_BOLSA.replace(/"/g, "&quot;")}</span>'">`
  : `<span class="${clase} vacia">${ICONO_BOLSA}</span>`;
const esqueleto = (titulo, n = 3) => `<main><p class="ceja">${esc(titulo)}</p><div class="esqueleto titulo-esq"></div>${"<div class='esqueleto tarjeta-esq'></div>".repeat(n)}</main>`;

/** Compartir por WhatsApp (o el menú del teléfono) con foto/precio/liga. */
function compartirBoton(texto, url) {
  return `<button class="boton chico compartir" data-texto="${esc(texto)}" data-url="${esc(url || "")}">Mandar a la familia</button>`;
}
function activarCompartir() {
  document.querySelectorAll(".compartir").forEach((b) => (b.onclick = async () => {
    const texto = b.dataset.texto, url = b.dataset.url;
    if (navigator.share) { try { await navigator.share({ title: "Cazador de Ofertas", text: texto, url: url || undefined }); return; } catch (e) { if (e.name === "AbortError") return; } }
    window.open(`https://wa.me/?text=${encodeURIComponent(url ? `${texto}\n${url}` : texto)}`, "_blank");
  }));
}

/** Franquicia de residentes de la frontera al cruzar por tierra: US$150 por persona al día (artículos personales). */
function notaFranquicia(o) {
  if ((o.moneda || "").toUpperCase() !== "USD" || o.precio_hoy == null) return "";
  return o.precio_hoy <= 150
    ? `<p class="franquicia ok">Si lo cruzas por la garita, cabe en tu franquicia de US$150 por persona al día.</p>`
    : `<p class="franquicia">Pasa de la franquicia de US$150 por persona al día: al cruzarlo hay que declararlo y pagar impuestos.</p>`;
}

/** Temporadas de ofertas 2026 (fechas fijas del calendario comercial). */
const TEMPORADAS = [
  { nombre: "Buen Fin", inicio: "2026-11-13", fin: "2026-11-17" },
  { nombre: "Black Friday", inicio: "2026-11-27", fin: "2026-11-27" },
  { nombre: "Cyber Monday", inicio: "2026-11-30", fin: "2026-11-30" },
];
function proximaTemporada() {
  const hoy = new Date(new Date().toLocaleString("en-US", { timeZone: "America/Tijuana" })); hoy.setHours(0, 0, 0, 0);
  for (const t of TEMPORADAS) {
    const ini = new Date(t.inicio + "T00:00:00"), fin = new Date(t.fin + "T23:59:00");
    if (hoy <= fin) {
      const dias = Math.round((ini - hoy) / 86400000);
      return { ...t, dias, enCurso: dias <= 0 };
    }
  }
  return null;
}

// ---------- mi lista ----------
function fechaHoy() {
  const t = new Date().toLocaleDateString("es-MX", { weekday: "long", day: "numeric", month: "long", timeZone: "America/Tijuana" });
  return t.charAt(0).toUpperCase() + t.slice(1);
}
async function pantallaHoy() {
  pintar(esqueleto("Mi lista") + barra("hoy"));
  const desde = new Date(Date.now() - 90 * 86400000).toISOString();
  const [segs, sols, perfil] = await Promise.all([
    db.from("seguimientos")
      .select("id,para,precio_objetivo,precio_justo_max,no_comprar,fecha_limite,lado,producto_id,productos(nombre,moneda_referencia,imagen,ligas),veredictos(*)")
      .eq("activo", true).order("creado"),
    db.from("solicitudes").select("id,texto,estado,actualizado,creado")
      .in("estado", ["pendiente", "buscando", "lista", "sin_resultado"]).order("creado", { ascending: false }),
    db.from("perfiles").select("nombre").eq("id", usuario.id).single(),
  ]);
  if (segs.error) return pintar(`<main><h1>No se pudo cargar</h1><p class="suave">Revisa tu internet y vuelve a abrir.</p><button class="boton principal" onclick="location.reload()">Intentar otra vez</button></main>${barra("hoy")}`);
  const lista = segs.data.map((s) => ({ ...s, v: Array.isArray(s.veredictos) ? s.veredictos[0] : s.veredictos }));
  // Precio más bajo de los últimos 90 días de cada producto
  const ids = [...new Set(lista.map((s) => s.producto_id))];
  const minimos = {};
  if (ids.length) {
    const { data: ps } = await db.from("precios").select("producto_id,precio_mxn").in("producto_id", ids).gte("fecha", desde);
    for (const r of ps || []) if (r.precio_mxn != null) minimos[r.producto_id] = Math.min(minimos[r.producto_id] ?? Infinity, Number(r.precio_mxn));
  }
  const orden = { "Comprar ya": 0, "Precio justo": 1, "Vigilando": 2, "Sin datos": 3, "No comprar": 4 };
  lista.sort((a, b) => (orden[a.v?.veredicto] ?? 3) - (orden[b.v?.veredicto] ?? 3));
  const ofertas = lista.filter((s) => s.v?.veredicto === "Comprar ya" && s.v.mejor_url);
  const oferta = ofertas[0];
  const nombre = (perfil.data?.nombre || "").split(/[.\s]/)[0];
  const saludo = nombre ? `Hola, ${esc(nombre.charAt(0).toUpperCase() + nombre.slice(1))}` : "Hola";
  const listas = (sols.data || []).filter((s) => s.estado === "lista").length;

  const heroe = oferta ? `
    <a class="heroe" href="#/producto/${oferta.id}">
      <div class="heroe-fila">${foto(oferta.productos?.imagen, "miniatura grande")}
        <div><p class="ceja">Hoy sí conviene comprar</p><h2>${esc(oferta.productos?.nombre || "")}</h2></div></div>
      <p class="precio">${precio(oferta.v.mejor_precio, oferta.v.mejor_moneda)}</p>
      <p>en ${esc(oferta.v.mejor_tienda)}${oferta.v.mejor_moneda === "USD" ? ` · ≈ ${pesos(oferta.v.mejor_precio_mxn)}` : ""}</p>
      <span class="boton claro">Ver detalles</span>
    </a>` : "";

  const t = proximaTemporada();
  const temporada = t ? `<div class="aviso-temporada"><span>${t.enCurso ? `<b>Hoy es ${esc(t.nombre)}.</b> Revisamos tus precios más seguido.` : `<b>${esc(t.nombre)}</b> en ${t.dias} ${t.dias === 1 ? "día" : "días"}. Ahí suelen bajar los precios: no compres caro antes.`}</span></div>` : "";

  const solicitudes = (sols.data || []).map((s) => {
    const lista = s.estado === "lista";
    const sin = s.estado === "sin_resultado";
    return `<a class="tarjeta solicitud ${lista ? "lista" : sin ? "" : "buscando"}" href="#/solicitud/${s.id}">
      <span class="ceja">${lista ? "¡Ya están tus opciones!" : sin ? "No encontré algo bueno" : `<span class="punto"></span>Buscando opciones…`}</span>
      <span class="titulo">“${esc(s.texto)}”</span>
      <span class="suave">${lista ? "Toca para elegir." : sin ? "Toca para ver por qué." : `${cuandoLlega(s.creado)}. Te aviso por Telegram.`}</span>
    </a>`;
  }).join("");

  const tarjetas = lista.map((s) => {
    const faltan = diasPara(s.fecha_limite);
    const min = minimos[s.producto_id];
    return `<a class="tarjeta producto" href="#/producto/${s.id}">
      ${foto(s.productos?.imagen)}
      <span class="producto-info">
        <span class="titulo dos-lineas">${esc(s.productos?.nombre || "Producto")}</span>
        <span class="precio-linea">${s.v?.mejor_precio != null ? precio(s.v.mejor_precio, s.v.mejor_moneda) : `<span class="suave">Todavía sin precio</span>`}</span>
        ${insignia(s.v?.veredicto)}
        <span class="suave pequeno">${s.v?.mejor_tienda ? esc(s.v.mejor_tienda) : ""}${min && min !== Infinity ? ` · más bajo en 90 días: ${pesos(min)}` : ""}</span>
        ${s.para || (faltan != null && faltan >= 0) ? `<span class="suave pequeno">${s.para ? `Para ${esc(s.para)}` : ""}${s.para && faltan != null && faltan >= 0 ? " · " : ""}${faltan != null && faltan >= 0 ? `faltan ${faltan} días` : ""}</span>` : ""}
      </span>
    </a>`;
  }).join("");

  const chips = [ofertas.length ? `<span class="chip-resumen verde">${ofertas.length} para comprar</span>` : "",
    listas ? `<span class="chip-resumen azul">${listas} con opciones nuevas</span>` : "",
    lista.length ? `<span class="chip-resumen">${lista.length} vigilando</span>` : ""].join("");

  pintar(`
    <main>
      <p class="ceja">${esc(fechaHoy())}</p>
      <h1>${saludo}</h1>
      ${chips ? `<div class="resumen">${chips}</div>` : ""}
      ${temporada}
      ${heroe}
      ${solicitudes}
      ${tarjetas ? `<h2 class="seccion">Lo que vigilo</h2>${tarjetas}` : ""}
      ${!tarjetas && !solicitudes ? `<section class="vacio">${ICONO_BOLSA}<p><b>Todavía no vigilas nada.</b></p><p class="suave">Toca <b>Buscar algo</b> y escribe lo que quieres comprar, como lo dirías en voz alta.</p><a class="boton principal" href="#/agregar">Buscar algo</a></section>` : ""}
      <p class="suave pequeno centro">Revisamos los precios solos todos los días.</p>
    </main>${barra("hoy")}`);
}

// ---------- detalle ----------
async function pantallaProducto(id) {
  pintar(`<main><a class="volver" href="#/hoy">‹ Mi lista</a><div class="esqueleto foto-esq"></div><div class="esqueleto tarjeta-esq"></div></main>`);
  const { data: s, error } = await db.from("seguimientos")
    .select("*,productos(*),veredictos(*)").eq("id", id).single();
  if (error || !s) return pintar(`<main><a class="volver" href="#/hoy">‹ Mi lista</a><h1>No encontré este producto</h1></main>`);
  const v = Array.isArray(s.veredictos) ? s.veredictos[0] : s.veredictos;
  const p = s.productos;
  const desde = new Date(Date.now() - 90 * 86400000).toISOString();
  const { data: hist } = await db.from("precios").select("fecha,precio_mxn").eq("producto_id", p.id).gte("fecha", desde).order("fecha");
  const usd = p.moneda_referencia === "USD";
  const umbral = (x) => (x == null ? "—" : usd ? dolares(x) : pesos(x));
  const tiendas = (v?.detalle || []).map((t) => {
    const notas = [t.pais === "us" ? "EE. UU." : "México", t.disponible === false ? "agotado" : "", t.inflado ? "subió antes del descuento" : "", t.vendedor_dudoso ? "vendedor no confiable" : ""].filter(Boolean).join(" · ");
    const mejor = v.mejor_url && t.url === v.mejor_url;
    return `<li class="${mejor ? "mejor" : ""}">
      <span><a href="${esc(t.url)}" target="_blank" rel="noopener">${esc(t.tienda)}</a><span class="suave pequeno">${esc(notas)}</span></span>
      <span class="num">${t.error ? `<span class="suave pequeno">${esc(t.error)}</span>` : precio(t.precio, t.moneda, t.real_mxn)}</span>
    </li>`;
  }).join("");
  const liga = v?.mejor_url || (p.ligas || [])[0];
  const textoCompartir = `${p.nombre}${v?.mejor_precio != null ? ` — ${v.mejor_moneda === "USD" ? dolares(v.mejor_precio) : pesos(v.mejor_precio)} en ${v.mejor_tienda}` : ""}`;

  pintar(`
    <main>
      <a class="volver" href="#/hoy">‹ Mi lista</a>
      ${p.imagen ? `<img class="foto-detalle" src="${esc(p.imagen)}" alt="${esc(p.nombre)}" referrerpolicy="no-referrer" onerror="this.remove()">` : ""}
      <p class="ceja">${s.para ? `Para ${esc(s.para)}` : "Vigilando"}</p>
      <h1 class="h1-producto">${esc(p.nombre)}</h1>
      <section class="tarjeta">
        <span class="cabeza"><span class="titulo">Hoy</span>${insignia(v?.veredicto)}</span>
        <p class="precio-grande">${v?.mejor_precio != null ? precio(v.mejor_precio, v.mejor_moneda, v.mejor_precio_mxn) : "Sin precio"}</p>
        <p class="suave">${esc(v?.razon || "Todavía no revisamos este producto. La siguiente revisión es esta madrugada.")}</p>
        ${v?.mejor_moneda === "USD" ? notaFranquicia({ moneda: "USD", precio_hoy: v.mejor_precio }) : ""}
        ${liga ? `<a class="boton principal" href="${esc(liga)}" target="_blank" rel="noopener">${v?.mejor_tienda ? `Ir a ${esc(v.mejor_tienda)}` : "Ver en la tienda"} ↗</a>` : ""}
        ${compartirBoton(textoCompartir, liga)}
      </section>
      <section class="tarjeta pila">
        <span class="titulo">Avísame si baja a…</span>
        <p class="suave">Te mando un Telegram cuando llegue a este precio o menos.</p>
        <form id="f-meta" class="fila-meta">
          <span class="moneda">${usd ? "US$" : "$"}</span>
          <input id="meta" inputmode="decimal" value="${s.precio_objetivo ?? ""}" aria-label="Precio meta">
          <button class="boton principal" type="submit">Guardar</button>
        </form>
      </section>
      ${grafica(hist || [])}
      <section class="tarjeta">
        <span class="titulo">Cómo leemos el precio</span>
        <ul class="umbrales">
          <li><span>${insignia("Comprar ya")}</span><span>${umbral(s.precio_objetivo)} o menos</span></li>
          <li><span>${insignia("Precio justo")}</span><span>hasta ${umbral(s.precio_justo_max)}</span></li>
          <li><span>${insignia("No comprar")}</span><span>${umbral(s.no_comprar)} o más</span></li>
        </ul>
      </section>
      ${tiendas ? `<section class="tarjeta"><span class="titulo">Tiendas</span><ul class="tiendas">${tiendas}</ul></section>` : ""}
      <button class="boton" id="dejar">Ya no vigilar este producto</button>
    </main>${barra("")}`);
  activarCompartir();
  document.getElementById("f-meta").onsubmit = async (e) => {
    e.preventDefault();
    const valor = Number(String(document.getElementById("meta").value).replace(/[^0-9.]/g, ""));
    if (!valor) return aviso("Escribe un precio, por ejemplo 300.");
    const cambios = { precio_objetivo: valor };
    if (s.precio_justo_max != null && s.precio_justo_max < valor) cambios.precio_justo_max = valor;
    const { error } = await db.from("seguimientos").update(cambios).eq("id", s.id);
    if (error) return aviso("No se pudo guardar.", "error");
    aviso(`Listo: te aviso cuando baje a ${usd ? dolares(valor) : pesos(valor)} o menos.`);
    pantallaProducto(id);
  };
  document.getElementById("dejar").onclick = async () => {
    if (!confirm("¿Dejar de vigilar este producto?")) return;
    const { error } = await db.from("seguimientos").update({ activo: false }).eq("id", s.id);
    if (error) return aviso("No se pudo. Intenta otra vez.", "error");
    aviso("Listo, ya no lo vigilamos.");
    location.hash = "#/hoy";
  };
}

function grafica(filas) {
  const porDia = new Map();
  for (const f of filas) {
    if (f.precio_mxn == null) continue;
    const d = f.fecha.slice(0, 10);
    porDia.set(d, Math.min(porDia.get(d) ?? Infinity, Number(f.precio_mxn)));
  }
  const pts = [...porDia.values()];
  if (pts.length < 2) return `<section class="tarjeta"><span class="titulo">Cómo se ha movido</span><p class="suave">Necesitamos unos días de precios para dibujar la gráfica.</p></section>`;
  const lo = Math.min(...pts), hi = Math.max(...pts), r = hi - lo || 1, w = 320, h = 90;
  const linea = pts.map((p, i) => `${(i * w / (pts.length - 1)).toFixed(1)},${(h - 8 - (p - lo) / r * (h - 16)).toFixed(1)}`).join(" ");
  return `<section class="tarjeta">
    <span class="titulo">Cómo se ha movido (mejor precio de cada día)</span>
    <svg viewBox="0 0 ${w} ${h}" width="100%" height="${h}" role="img" aria-label="Precio de ${pesos(pts[0])} a ${pesos(pts.at(-1))}" preserveAspectRatio="none">
      <defs><linearGradient id="relleno" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="var(--oro)" stop-opacity=".22"/><stop offset="1" stop-color="var(--oro)" stop-opacity="0"/></linearGradient></defs>
      <polygon points="0,${h} ${linea} ${w},${h}" fill="url(#relleno)"/>
      <polyline points="${linea}" fill="none" stroke="var(--tinta)" stroke-width="2" stroke-linejoin="round" stroke-linecap="round" vector-effect="non-scaling-stroke"/></svg>
    <span class="suave pequeno">Más bajo: ${pesos(lo)} · Más alto: ${pesos(hi)} · ${pts.length} días</span>
  </section>`;
}

// ---------- buscar algo ----------
let flujo = null; // {texto, categoria, preguntas, paso, respuestas}

function pantallaAgregar() {
  flujo = null;
  pintar(`
    <main>
      <a class="volver" href="#/hoy">‹ Mi lista</a>
      <p class="ceja">Buscar algo</p>
      <h1>¿Qué quieres comprar?</h1>
      <p class="suave">Escríbelo como lo dirías en voz alta. También puedes pegar la liga de una tienda o de un anuncio de auto (Marketplace, Copart…) para que te diga si el precio es bueno.</p>
      <form id="f-que" class="pila">
        <div class="con-microfono">
          <textarea id="que" rows="2" required placeholder="Una televisión de 50 pulgadas"></textarea>
          <button type="button" id="mic" class="microfono" aria-label="Decirlo con la voz" hidden>🎤</button>
        </div>
        <ul id="sugerencias" class="sugerencias" role="listbox" aria-label="Sugerencias" hidden></ul>
        <button class="boton principal" type="submit">Siguiente</button>
      </form>
      <p class="ceja">Ejemplos</p>
      <div class="chips">
        ${["Televisión de 50 pulgadas", "Aspiradora robot que trapee", "Jeans Levi's 501", "Camioneta familiar usada"].map((e) => `<button type="button" class="chip">${e}</button>`).join("")}
      </div>
    </main>${barra("agregar")}`);
  const que = document.getElementById("que");
  document.querySelectorAll(".chip").forEach((c) => (c.onclick = () => { que.value = c.textContent; que.focus(); }));
  // Sugerencias mientras escribe: lo que ya vigilamos, sus búsquedas recientes y frases comunes
  const lista = document.getElementById("sugerencias");
  let extras = [];
  Promise.all([
    db.from("productos").select("nombre").eq("activo", true),
    db.from("solicitudes").select("texto").order("creado", { ascending: false }).limit(10),
  ]).then(([p, s]) => { extras = [...(s.data || []).map((x) => x.texto), ...(p.data || []).map((x) => x.nombre)]; });
  que.addEventListener("input", () => {
    const ops = esLiga(que.value) ? [] : sugerir(que.value, extras);
    lista.hidden = !ops.length;
    const t = que.value.trim();
    lista.innerHTML = ops.map((o) => {
      const i = quitarAcentos(o.toLowerCase()).indexOf(quitarAcentos(t.toLowerCase()));
      const html = i >= 0 ? `${esc(o.slice(0, i))}<span class="ya">${esc(o.slice(i, i + t.length))}</span><b>${esc(o.slice(i + t.length))}</b>` : `<b>${esc(o)}</b>`;
      return `<li><button type="button" class="sugerencia" data-v="${esc(o)}">${html}</button></li>`;
    }).join("");
    lista.querySelectorAll(".sugerencia").forEach((b) => (b.onclick = () => {
      que.value = b.dataset.v; lista.hidden = true; document.getElementById("f-que").requestSubmit();
    }));
  });
  activarMicrofono(que);
  document.getElementById("f-que").onsubmit = (e) => {
    e.preventDefault();
    const texto = que.value.trim();
    if (!texto) return;
    if (esLiga(texto)) {
      flujo = { texto, categoria: { id: "liga", nombre: "Liga" }, preguntas: [], paso: 0, respuestas: {} };
      return pantallaParaQuien();
    }
    const categoria = detectar(texto);
    flujo = { texto, categoria, preguntas: preguntasPara(categoria, texto), paso: 0, respuestas: {} };
    pantallaPregunta();
  };
}

function activarMicrofono(campo) {
  const Reco = window.SpeechRecognition || window.webkitSpeechRecognition;
  const boton = document.getElementById("mic");
  if (!Reco || !boton) return;
  boton.hidden = false;
  boton.onclick = () => {
    const r = new Reco();
    r.lang = "es-MX";
    r.interimResults = false;
    boton.classList.add("escuchando");
    r.onresult = (e) => { campo.value = e.results[0][0].transcript; };
    r.onend = () => boton.classList.remove("escuchando");
    r.onerror = () => { boton.classList.remove("escuchando"); aviso("No te escuché. Intenta otra vez o escríbelo."); };
    r.start();
  };
}

function pantallaPregunta() {
  const { preguntas, paso } = flujo;
  if (paso >= preguntas.length) return pantallaParaQuien();
  const q = preguntas[paso];
  const puntos = preguntas.map((_, i) => `<span class="${i <= paso ? "lleno" : ""}"></span>`).join("");
  pintar(`
    <main>
      <button class="volver" id="atras">‹ Atrás</button>
      <p class="ceja">${esc(flujo.categoria.nombre !== "Otro" ? flujo.categoria.nombre : "“" + flujo.texto + "”")}</p>
      <div class="puntos" aria-label="Pregunta ${paso + 1} de ${preguntas.length}">${puntos}</div>
      <h1>${esc(q.texto)}</h1>
      <div class="opciones">
        ${q.opciones.map((o) => `<button class="opcion" data-v="${esc(o.valor)}"><span>${esc(o.etiqueta)}</span>${o.ayuda ? `<span class="suave">${esc(o.ayuda)}</span>` : ""}</button>`).join("")}
      </div>
      ${q.tipo === "texto" ? `
      <form id="f-texto" class="pila">
        ${q.opciones.length ? `<label for="respuesta">O escríbelo</label>` : ""}
        <input id="respuesta" autocomplete="off" placeholder="${esc(q.placeholder || "")}" value="${esc(flujo.respuestas[q.clave] && !q.opciones.some((o) => o.valor === flujo.respuestas[q.clave]) ? flujo.respuestas[q.clave] : "")}">
        <button class="boton principal" type="submit">Siguiente</button>
      </form>` : ""}
    </main>`);
  const formTexto = document.getElementById("f-texto");
  if (formTexto) formTexto.onsubmit = (e) => {
    e.preventDefault();
    const valor = document.getElementById("respuesta").value.trim();
    if (!valor) return aviso(q.opciones.length ? "Escribe algo o toca una de las opciones." : "Escribe tu respuesta para seguir.");
    flujo.respuestas[q.clave] = valor;
    flujo.paso++;
    pantallaPregunta();
  };
  document.getElementById("atras").onclick = () => {
    if (flujo.paso === 0) return pantallaAgregar();
    flujo.paso--; pantallaPregunta();
  };
  document.querySelectorAll(".opcion").forEach((b) => (b.onclick = () => {
    flujo.respuestas[q.clave] = b.dataset.v;
    flujo.paso++;
    pantallaPregunta();
  }));
}

function pantallaParaQuien() {
  pintar(`
    <main>
      <button class="volver" id="atras">‹ Atrás</button>
      <p class="ceja">Último paso</p>
      <h1>¿Para quién es?</h1>
      <form id="f-quien" class="pila">
        <div class="opciones">
          <button type="button" class="opcion" data-v="">Para mí</button>
        </div>
        <label for="quien">O escribe para quién</label>
        <input id="quien" placeholder="Mi papá, mi nieta…" autocomplete="off">
        <button class="boton principal" type="submit">Buscar opciones</button>
      </form>
    </main>`);
  document.getElementById("atras").onclick = () => {
    if (!flujo.preguntas.length) return pantallaAgregar();
    flujo.paso = flujo.preguntas.length - 1; pantallaPregunta();
  };
  const enviar = async (para) => {
    const fila = {
      texto: flujo.texto,
      categoria: flujo.categoria.id,
      respuestas: flujo.respuestas,
      para: para || null,
      lado: flujo.respuestas.lado || { tj: "mx", bc: "mx", sd: "us" }[flujo.respuestas.zona] || "ambos",
    };
    const { data, error } = await db.from("solicitudes").insert(fila).select("id").single();
    if (error) return aviso("No se pudo guardar. Revisa tu internet.", "error");
    location.hash = `#/solicitud/${data.id}`;
  };
  document.querySelector('.opcion[data-v=""]').onclick = () => enviar(null);
  document.getElementById("f-quien").onsubmit = (e) => { e.preventDefault(); enviar(document.getElementById("quien").value.trim()); };
}

// ---------- opciones de una búsqueda ----------
async function pantallaSolicitud(id) {
  const { data: s, error } = await db.from("solicitudes").select("*").eq("id", id).single();
  if (error || !s) return pintar(`<main><a class="volver" href="#/hoy">‹ Mi lista</a><h1>No encontré esta búsqueda</h1></main>`);

  if (s.estado === "pendiente" || s.estado === "buscando") {
    const conocidos = await yaVigilados(s.texto, s.categoria);
    pintar(`
      <main>
        <a class="volver" href="#/hoy">‹ Mi lista</a>
        <p class="ceja">Buscando</p>
        <h1>Listo, ya estoy buscando tus mejores opciones</h1>
        <section class="tarjeta">
          <span class="titulo">“${esc(s.texto)}”</span>
          <p class="suave">Reviso modelos, precios en México y Estados Unidos, y si el descuento es real. ${cuandoLlega(s.creado)}; te aviso por Telegram. Puedes cerrar la app.</p>
        </section>
        ${conocidos}
        <a class="boton principal" href="#/hoy">Volver a mi lista</a>
        <button class="boton" id="cancelar">Ya no lo busques</button>
      </main>`);
    activarVigilar(s);
    document.getElementById("cancelar").onclick = async () => {
      await db.from("solicitudes").update({ estado: "cancelada" }).eq("id", s.id);
      location.hash = "#/hoy";
    };
    return;
  }

  const tarjeta = (o, i, recomendada) => `
    <section class="tarjeta opcion-final ${recomendada ? "destacada" : ""}">
      ${o.imagen ? `<a class="foto-grande" href="${esc(o.url || "#")}" target="_blank" rel="noopener"><img src="${esc(o.imagen)}" alt="${esc(o.nombre)}" loading="lazy" referrerpolicy="no-referrer" onerror="this.closest('a').remove()"></a>` : ""}
      ${recomendada ? `<span class="ceja">Recomendada</span>` : ""}
      <span class="cabeza"><span class="titulo">${esc(o.nombre)}</span>${o.veredicto ? insignia(o.veredicto) : ""}</span>
      <p class="precio-grande">${o.precio_hoy != null ? precio(o.precio_hoy, o.moneda, o.precio_mxn) : "Sin precio hoy"}</p>
      ${o.tienda ? `<p class="suave pequeno">en ${esc(o.tienda)} · ${(o.moneda || "").toUpperCase() === "MXN" ? "México" : "Estados Unidos"}</p>` : ""}
      <p>${esc(o.por_que || "")}</p>
      ${notaFranquicia(o)}
      ${s.estado === "lista" && o.producto_id ? `<button class="boton principal vigilar" data-i="${i}">Vigilar esta</button>` : ""}
      <div class="fila-botones">
        ${o.url ? `<a class="boton chico" href="${esc(o.url)}" target="_blank" rel="noopener">Ver en la tienda ↗</a>` : ""}
        ${compartirBoton(`Mira esta opción: ${o.nombre}${o.precio_hoy != null ? ` · ${precio(o.precio_hoy, o.moneda)}` : ""}${o.tienda ? ` en ${o.tienda}` : ""}`, o.url)}
      </div>
      ${(s.opciones || []).length > 1 ? `<label class="comparar"><input type="checkbox" class="cmp" value="${i}"> Comparar</label>` : ""}
    </section>`;
  const opciones = (s.opciones || []).map((o, i) => ({ o, i }));
  let yaRecomendada = false;
  const ops = ["economica", "equilibrada", "mejor"].map((n) => {
    const grupo = opciones.filter(({ o }) => o.nivel === n);
    if (!grupo.length) return "";
    return `<h2 class="nivel">${esc(NIVEL[n])}</h2>` + grupo.map(({ o, i }) => {
      const rec = n === "equilibrada" && !yaRecomendada;
      if (rec) yaRecomendada = true;
      return tarjeta(o, i, rec);
    }).join("");
  }).join("");

  const otraVez = s.estado === "lista" || s.estado === "sin_resultado" || s.estado === "elegida" ? `
      <section class="tarjeta pila">
        <span class="titulo">¿Quieres verlo de otra forma?</span>
        <p class="suave">Busco otra vez con tus mismas respuestas. Llega en unos 15 minutos.</p>
        ${s.lado !== "mx" ? `<button class="boton refinar" data-r="mx">Solo en México</button>` : ""}
        ${s.lado !== "us" ? `<button class="boton refinar" data-r="us">Solo en Estados Unidos</button>` : ""}
        <button class="boton refinar" data-r="mas_baratas">Más baratas</button>
        <button class="boton refinar" data-r="otras_marcas">Otras marcas</button>
      </section>` : "";

  pintar(`
    <main>
      <a class="volver" href="#/hoy">‹ Mi lista</a>
      <p class="ceja">${s.estado === "elegida" ? "Ya elegiste" : s.estado === "sin_resultado" ? "Búsqueda" : "Tus opciones"}</p>
      <h1>“${esc(s.texto)}”</h1>
      ${s.nota ? `<p class="nota">${esc(s.nota)}</p>` : ""}
      ${ops || `<p class="suave">No encontré opciones buenas esta vez.</p>`}
      <div id="comparacion"></div>
      ${otraVez}
      ${s.estado === "lista" ? `<button class="boton" id="ninguna">Ninguna me convence</button>` : ""}
    </main>
    <div class="barra-comparar" id="barra-cmp" hidden><span id="cmp-n"></span><button class="boton principal chico" id="ver-cmp">Ver lado a lado</button></div>
    ${barra("")}`);
  activarCompartir();
  activarComparar(s);
  document.querySelectorAll(".refinar").forEach((b) => (b.onclick = async () => {
    const r = b.dataset.r;
    const lado = r === "mx" || r === "us" ? r : s.lado;
    const etiqueta = { mx: "solo México", us: "solo Estados Unidos", mas_baratas: "más baratas", otras_marcas: "otras marcas" }[r];
    b.disabled = true; b.textContent = "Buscando…";
    const { data, error } = await db.from("solicitudes").insert({
      texto: `${s.texto} · ${etiqueta}`, categoria: s.categoria, para: s.para, lado,
      respuestas: { ...(s.respuestas || {}), lado, refinar: r, antes: s.id },
    }).select("id").single();
    if (error) { b.disabled = false; return aviso("No se pudo. Intenta otra vez.", "error"); }
    location.hash = `#/solicitud/${data.id}`;
  }));
  activarVigilar(s);
  const ninguna = document.getElementById("ninguna");
  if (ninguna) ninguna.onclick = async () => {
    await db.from("solicitudes").update({ estado: "cancelada" }).eq("id", s.id);
    aviso("Entendido. Puedes buscar otra cosa cuando quieras.");
    location.hash = "#/hoy";
  };
}

/** Comparar 2 o 3 opciones lado a lado. */
function activarComparar(s) {
  const marcas = [...document.querySelectorAll(".cmp")];
  const barraC = document.getElementById("barra-cmp"), n = document.getElementById("cmp-n");
  if (!marcas.length || !barraC) return;
  const elegidas = () => marcas.filter((m) => m.checked).map((m) => s.opciones[Number(m.value)]);
  marcas.forEach((m) => (m.onchange = () => {
    if (elegidas().length > 3) { m.checked = false; return aviso("Puedes comparar hasta 3 a la vez."); }
    m.closest(".tarjeta").classList.toggle("marcada", m.checked);
    const k = elegidas().length;
    barraC.hidden = k < 2;
    n.textContent = k === 1 ? "Elige otra para comparar" : `${k} elegidas`;
  }));
  document.getElementById("ver-cmp").onclick = () => {
    const os = elegidas();
    const fila = (titulo, f) => `<tr><th scope="row">${titulo}</th>${os.map((o) => `<td>${f(o)}</td>`).join("")}</tr>`;
    const mxn = (o) => o.precio_mxn ?? ((o.moneda || "").toUpperCase() === "MXN" ? o.precio_hoy : null);
    const minimo = Math.min(...os.map((o) => mxn(o) ?? Infinity));
    document.getElementById("comparacion").innerHTML = `
      <section class="tarjeta pila" id="tabla-cmp" tabindex="-1">
        <span class="titulo">Lado a lado</span>
        <div class="tabla-desliza"><table class="comparar-tabla">
          <thead><tr><th></th>${os.map((o) => `<th scope="col">${foto(o.imagen)}<span>${esc(o.nombre)}</span></th>`).join("")}</tr></thead>
          <tbody>
            ${fila("Precio", (o) => `${o.precio_hoy != null ? precio(o.precio_hoy, o.moneda, o.precio_mxn) : "—"}${mxn(o) != null && mxn(o) === minimo ? `<br><span class="insignia verde">La más barata</span>` : ""}`)}
            ${fila("Nivel", (o) => esc(NIVEL[o.nivel] || ""))}
            ${fila("Tienda", (o) => esc(o.tienda || "—") + `<br><span class="suave pequeno">${(o.moneda || "").toUpperCase() === "MXN" ? "México" : "Estados Unidos"}</span>`)}
            ${fila("¿Conviene hoy?", (o) => (o.veredicto ? insignia(o.veredicto) : "—"))}
            ${fila("Al cruzar", (o) => (o.moneda || "").toUpperCase() !== "USD" ? "No aplica" : o.precio_hoy <= 150 ? "Cabe en la franquicia" : "Hay que declararlo")}
            ${fila("Por qué", (o) => `<span class="pequeno">${esc(o.por_que || "—")}</span>`)}
          </tbody>
        </table></div>
      </section>`;
    barraC.hidden = true;
    const t = document.getElementById("tabla-cmp");
    t.scrollIntoView({ behavior: "smooth", block: "start" }); t.focus({ preventScroll: true });
  };
}

/** Productos del catálogo que ya vigilamos y se parecen a lo que pidió: se pueden elegir al instante. */
async function yaVigilados(texto, categoria) {
  const { data } = await db.from("productos").select("id,nombre,categoria,palabras_clave").eq("activo", true);
  const palabras = quitarAcentos(texto.toLowerCase()).split(/\W+/).filter((p) => p.length >= 4);
  const parecidos = (data || []).filter((p) => {
    const t = quitarAcentos(`${p.nombre} ${p.categoria || ""} ${(p.palabras_clave || []).join(" ")}`.toLowerCase());
    return (categoria && p.categoria === categoria) || palabras.some((w) => t.includes(w));
  });
  if (!parecidos.length) return "";
  return `<p class="ceja">Mientras tanto, ya vigilamos estos</p>` + parecidos.map((p) => `
    <section class="tarjeta"><span class="titulo">${esc(p.nombre)}</span>
      <button class="boton vigilar" data-producto="${esc(p.id)}">Vigilar este también</button></section>`).join("");
}

function activarVigilar(s) {
  document.querySelectorAll(".vigilar").forEach((b) => (b.onclick = async () => {
    const o = b.dataset.i != null ? s.opciones[Number(b.dataset.i)] : { producto_id: b.dataset.producto };
    b.disabled = true; b.textContent = "Guardando…";
    const { data: p } = await db.from("productos").select("*").eq("id", o.producto_id).single();
    const fila = {
      usuario: usuario.id,
      producto_id: o.producto_id,
      para: s.para,
      lado: s.lado || "ambos",
      precio_objetivo: o.objetivo ?? p?.sugerido_objetivo ?? null,
      precio_justo_max: o.justo_max ?? p?.sugerido_justo_max ?? null,
      no_comprar: o.no_comprar ?? p?.sugerido_no_comprar ?? null,
      fecha_limite: o.fecha_limite ?? null,
      activo: true,
    };
    const { error } = await db.from("seguimientos").upsert(fila, { onConflict: "usuario,producto_id" });
    if (error) { b.disabled = false; b.textContent = "Vigilar esta"; return aviso("No se pudo guardar. Intenta otra vez.", "error"); }
    if (b.dataset.i != null) await db.from("solicitudes").update({ estado: "elegida" }).eq("id", s.id);
    aviso("¡Listo! Ya la vigilamos. Te avisamos cuando convenga comprar.");
    location.hash = "#/hoy";
  }));
}

// ---------- ajustes ----------
async function pantallaAjustes() {
  const { data: perfil } = await db.from("perfiles").select("*").eq("id", usuario.id).single();
  const conectado = !!perfil?.telegram_chat_id;
  pintar(`
    <main>
      <p class="ceja">Ajustes</p>
      <h1>Tus datos</h1>
      <form id="f-nombre" class="tarjeta pila">
        <label for="nombre">¿Cómo te llamas?</label>
        <input id="nombre" value="${esc(perfil?.nombre || "")}" autocomplete="name">
        <button class="boton" type="submit">Guardar</button>
      </form>
      <section class="tarjeta pila">
        <span class="titulo">Avisos por Telegram</span>
        ${conectado
          ? `<p><span class="insignia verde">Conectado</span></p><p class="suave">Te llegan los avisos de tus productos.</p>`
          : `<p class="suave">Toca el botón, se abre Telegram y le das a <b>Iniciar</b>. Con eso quedas conectado (tarda hasta una hora en confirmarse).</p>
             <button class="boton principal" id="telegram">Conectar Telegram</button>`}
      </section>
      <section class="tarjeta pila">
        <span class="titulo">Tamaño de la letra</span>
        <div class="segmentos" role="radiogroup" aria-label="Tamaño de la letra">
          <button class="segmento" role="radio" data-letra="normal" aria-checked="${leerLetra() === "normal"}">Normal</button>
          <button class="segmento grande-a" role="radio" data-letra="grande" aria-checked="${leerLetra() === "grande"}">Grande</button>
        </div>
      </section>
      <section class="tarjeta pila">
        <span class="titulo">Ponla en tu pantalla de inicio</span>
        <p class="suave"><b>iPhone:</b> en Safari toca Compartir ⬆︎ y luego "Agregar a inicio".<br><b>Android:</b> en Chrome toca ⋮ y luego "Agregar a la pantalla principal".</p>
      </section>
      <p class="suave pequeno">Entraste como ${esc(usuario.email)}</p>
      <button class="boton" id="salir">Salir</button>
    </main>${barra("ajustes")}`);
  document.querySelectorAll(".segmento").forEach((b) => (b.onclick = () => {
    ponerLetra(b.dataset.letra);
    document.querySelectorAll(".segmento").forEach((x) => x.setAttribute("aria-checked", String(x === b)));
  }));
  document.getElementById("f-nombre").onsubmit = async (e) => {
    e.preventDefault();
    const { error } = await db.from("perfiles").update({ nombre: document.getElementById("nombre").value.trim() }).eq("id", usuario.id);
    aviso(error ? "No se pudo guardar." : "Guardado.", error ? "error" : "");
  };
  const tg = document.getElementById("telegram");
  if (tg) tg.onclick = async () => {
    let codigo = perfil?.codigo_telegram;
    if (!codigo) {
      codigo = Array.from(crypto.getRandomValues(new Uint8Array(6)), (b) => "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"[b % 32]).join("");
      const { error } = await db.from("perfiles").update({ codigo_telegram: codigo }).eq("id", usuario.id);
      if (error) return aviso("No se pudo preparar la conexión.", "error");
    }
    location.href = `https://t.me/${BOT_TELEGRAM}?start=${codigo}`;
  };
  document.getElementById("salir").onclick = async () => { await db.auth.signOut(); location.hash = ""; arrancar(); };
}

// ---------- rutas ----------
async function enrutar() {
  if (!usuario) return pantallaEntrar();
  const [, ruta, id] = (location.hash || "#/hoy").split("/");
  if (ruta === "producto" && id) return pantallaProducto(id);
  if (ruta === "agregar") return pantallaAgregar();
  if (ruta === "solicitud" && id) return pantallaSolicitud(id);
  if (ruta === "ajustes") return pantallaAjustes();
  return pantallaHoy();
}

async function arrancar() {
  const { data } = await db.auth.getSession();
  usuario = data.session?.user || null;
  enrutar();
}

db.auth.onAuthStateChange((_evento, sesion) => {
  const antes = usuario?.id;
  usuario = sesion?.user || null;
  if (antes !== usuario?.id) enrutar();
});
window.addEventListener("hashchange", enrutar);
if ("serviceWorker" in navigator) navigator.serviceWorker.register("sw.js").catch(() => {});
arrancar();
