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
  return `Las opciones llegan ${cuando} como a las 7 de la noche`;
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
const barra = (activa) => `
  <nav class="barra" aria-label="Secciones">
    <a href="#/hoy" class="${activa === "hoy" ? "activa" : ""}"><span aria-hidden="true">◉</span>Mi lista</a>
    <a href="#/agregar" class="grande"><span aria-hidden="true">＋</span>Buscar algo</a>
    <a href="#/ajustes" class="${activa === "ajustes" ? "activa" : ""}"><span aria-hidden="true">⚙</span>Ajustes</a>
  </nav>`;

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

// ---------- mi lista ----------
async function pantallaHoy() {
  pintar(`<main><p class="ceja">Mi lista</p><h1>Cargando…</h1></main>${barra("hoy")}`);
  const [segs, sols] = await Promise.all([
    db.from("seguimientos")
      .select("id,para,precio_objetivo,precio_justo_max,no_comprar,fecha_limite,lado,producto_id,productos(nombre,moneda_referencia),veredictos(*)")
      .eq("activo", true).order("creado"),
    db.from("solicitudes").select("id,texto,estado,actualizado,creado")
      .in("estado", ["pendiente", "buscando", "lista", "sin_resultado"]).order("creado", { ascending: false }),
  ]);
  if (segs.error) return pintar(`<main><h1>No se pudo cargar</h1><p class="suave">Revisa tu internet y vuelve a abrir.</p></main>${barra("hoy")}`);
  const lista = segs.data.map((s) => ({ ...s, v: Array.isArray(s.veredictos) ? s.veredictos[0] : s.veredictos }));
  const orden = { "Comprar ya": 0, "Precio justo": 1, "Vigilando": 2, "Sin datos": 3, "No comprar": 4 };
  lista.sort((a, b) => (orden[a.v?.veredicto] ?? 3) - (orden[b.v?.veredicto] ?? 3));
  const oferta = lista.find((s) => s.v?.veredicto === "Comprar ya" && s.v.mejor_url);

  const heroe = oferta ? `
    <section class="heroe">
      <p class="ceja">Hoy sí conviene</p>
      <h2>${esc(oferta.productos?.nombre || "")}</h2>
      <p class="precio">${precio(oferta.v.mejor_precio, oferta.v.mejor_moneda)}</p>
      <p>en ${esc(oferta.v.mejor_tienda)}${oferta.v.mejor_moneda === "USD" ? ` · ≈ ${pesos(oferta.v.mejor_precio_mxn)}` : ""}</p>
      <a class="boton claro" href="#/producto/${oferta.id}">Ver detalles</a>
    </section>` : "";

  const solicitudes = (sols.data || []).map((s) => {
    const lista = s.estado === "lista";
    const sin = s.estado === "sin_resultado";
    return `<a class="tarjeta solicitud ${lista ? "lista" : ""}" href="#/solicitud/${s.id}">
      <span class="ceja">${lista ? "¡Ya están tus opciones!" : sin ? "No encontré algo bueno" : "Buscando opciones…"}</span>
      <span class="titulo">“${esc(s.texto)}”</span>
      <span class="suave">${lista ? "Toca para elegir una." : sin ? "Toca para ver por qué." : `${cuandoLlega(s.creado)}. Te aviso por Telegram.`}</span>
    </a>`;
  }).join("");

  const tarjetas = lista.map((s) => {
    const faltan = diasPara(s.fecha_limite);
    return `<a class="tarjeta producto" href="#/producto/${s.id}">
      <span class="cabeza"><span class="titulo">${esc(s.productos?.nombre || "Producto")}</span>${insignia(s.v?.veredicto)}</span>
      <span class="precio-linea">${s.v?.mejor_precio != null ? `${precio(s.v.mejor_precio, s.v.mejor_moneda, s.v.mejor_precio_mxn)} <span class="suave">en ${esc(s.v.mejor_tienda)}</span>` : `<span class="suave">Todavía sin precio</span>`}</span>
      <span class="suave pequeno">${s.para ? `Para ${esc(s.para)}` : ""}${s.para && faltan != null ? " · " : ""}${faltan != null && faltan >= 0 ? `faltan ${faltan} días` : ""}</span>
    </a>`;
  }).join("");

  pintar(`
    <main>
      <p class="ceja">Mi lista</p>
      <h1>${oferta ? "Hay algo que conviene" : lista.length ? "Todo bajo control" : "Empecemos"}</h1>
      ${heroe}
      ${solicitudes}
      ${tarjetas || (!solicitudes ? `<section class="vacio"><p>Todavía no vigilas nada.</p><p class="suave">Toca <b>Buscar algo</b> y escribe lo que quieres comprar, como lo dirías en voz alta.</p><a class="boton principal" href="#/agregar">Buscar algo</a></section>` : "")}
      <p class="suave pequeno centro">Revisamos los precios solos, varias veces al día.</p>
    </main>${barra("hoy")}`);
}

// ---------- detalle ----------
async function pantallaProducto(id) {
  pintar(`<main><a class="volver" href="#/hoy">‹ Mi lista</a><h1>Cargando…</h1></main>`);
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

  pintar(`
    <main>
      <a class="volver" href="#/hoy">‹ Mi lista</a>
      <p class="ceja">${s.para ? `Para ${esc(s.para)}` : "Vigilando"}</p>
      <h1>${esc(p.nombre)}</h1>
      <section class="tarjeta">
        <span class="cabeza"><span class="titulo">Hoy</span>${insignia(v?.veredicto)}</span>
        <p class="precio-grande">${v?.mejor_precio != null ? precio(v.mejor_precio, v.mejor_moneda, v.mejor_precio_mxn) : "Sin precio"}</p>
        <p class="suave">${esc(v?.razon || "Todavía no revisamos este producto. La siguiente revisión es en unas horas.")}</p>
        ${v?.mejor_url ? `<a class="boton principal" href="${esc(v.mejor_url)}" target="_blank" rel="noopener">Ir a ${esc(v.mejor_tienda)}</a>` : ""}
      </section>
      ${grafica(hist || [])}
      <section class="tarjeta">
        <span class="titulo">Precios que buscamos</span>
        <ul class="umbrales">
          <li><span>${insignia("Comprar ya")}</span><span>${umbral(s.precio_objetivo)} o menos</span></li>
          <li><span>${insignia("Precio justo")}</span><span>hasta ${umbral(s.precio_justo_max)}</span></li>
          <li><span>${insignia("No comprar")}</span><span>${umbral(s.no_comprar)} o más</span></li>
        </ul>
      </section>
      ${tiendas ? `<section class="tarjeta"><span class="titulo">Tiendas</span><ul class="tiendas">${tiendas}</ul></section>` : ""}
      <button class="boton" id="dejar">Ya no vigilar este producto</button>
    </main>`);
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
    <svg viewBox="0 0 ${w} ${h}" width="100%" height="${h}" role="img" aria-label="Precio de ${pesos(pts[0])} a ${pesos(pts.at(-1))}">
      <polyline points="${linea}" fill="none" stroke="var(--acento)" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"/></svg>
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
        <h1>Listo, ya estoy buscando las 3 mejores opciones</h1>
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

  const ops = (s.opciones || []).map((o, i) => `
    <section class="tarjeta opcion-final ${o.nivel === "equilibrada" ? "destacada" : ""}">
      <span class="ceja">${esc(NIVEL[o.nivel] || o.nivel || "")}${o.nivel === "equilibrada" ? " · recomendada" : ""}</span>
      <span class="cabeza"><span class="titulo">${esc(o.nombre)}</span>${o.veredicto ? insignia(o.veredicto) : ""}</span>
      <p class="precio-grande">${o.precio_hoy != null ? precio(o.precio_hoy, o.moneda, o.precio_mxn) : "Sin precio hoy"}</p>
      ${o.tienda ? `<p class="suave pequeno">en ${esc(o.tienda)}</p>` : ""}
      <p>${esc(o.por_que || "")}</p>
      ${s.estado === "lista" && o.producto_id ? `<button class="boton principal vigilar" data-i="${i}">Vigilar esta</button>` : ""}
    </section>`).join("");

  pintar(`
    <main>
      <a class="volver" href="#/hoy">‹ Mi lista</a>
      <p class="ceja">${s.estado === "elegida" ? "Ya elegiste" : s.estado === "sin_resultado" ? "Búsqueda" : "Tus opciones"}</p>
      <h1>“${esc(s.texto)}”</h1>
      ${s.nota ? `<p class="nota">${esc(s.nota)}</p>` : ""}
      ${ops || `<p class="suave">No encontré opciones buenas esta vez.</p>`}
      ${s.estado === "lista" ? `<button class="boton" id="ninguna">Ninguna me convence</button>` : ""}
    </main>${barra("")}`);
  activarVigilar(s);
  const ninguna = document.getElementById("ninguna");
  if (ninguna) ninguna.onclick = async () => {
    await db.from("solicitudes").update({ estado: "cancelada" }).eq("id", s.id);
    aviso("Entendido. Puedes buscar otra cosa cuando quieras.");
    location.hash = "#/hoy";
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
          ? `<p>✅ Conectado. Te llegan los avisos de tus productos.</p>`
          : `<p class="suave">Toca el botón, se abre Telegram y le das a <b>Iniciar</b>. Con eso quedas conectado (tarda hasta una hora en confirmarse).</p>
             <button class="boton principal" id="telegram">Conectar Telegram</button>`}
      </section>
      <section class="tarjeta pila">
        <span class="titulo">Ponla en tu pantalla de inicio</span>
        <p class="suave"><b>iPhone:</b> en Safari toca Compartir ⬆︎ y luego "Agregar a inicio".<br><b>Android:</b> en Chrome toca ⋮ y luego "Agregar a la pantalla principal".</p>
      </section>
      <p class="suave pequeno">Entraste como ${esc(usuario.email)}</p>
      <button class="boton" id="salir">Salir</button>
    </main>${barra("ajustes")}`);
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
