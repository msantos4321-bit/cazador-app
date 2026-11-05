// Lógica de la lista al instante: precio total en pesos, etiquetas, accesorios, filtros y orden.
// Sin nada del navegador para poder probarla con node (tests/ofertas.test.mjs).

export const IMPUESTO_CA = 0.0775;   // impuesto de venta en San Diego (aprox.; Chula Vista es un poco más)
export const FRANQUICIA_USD = 150;   // por persona al día, residentes de la franja fronteriza (cruce por tierra)

const sin = (t) => String(t ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

// Tiendas grandes con garantía y devoluciones claras (por nombre como lo muestra Google)
const CONFIABLES = [
  "walmart", "best buy", "target", "costco", "sam's club", "sams club", "home depot", "lowe's", "lowes", "liverpool",
  "coppel", "sears", "sanborns", "palacio de hierro", "elektra", "bodega aurrera", "office depot", "officemax",
  "chedraui", "soriana", "la comer", "suburbia", "apple", "samsung", "lg", "sony", "dell", "lenovo", "hp", "motorola",
  "xiaomi store", "dreame", "roborock", "ecovacs", "irobot", "shark", "dyson", "nordstrom", "macy's", "kohl's",
  "jcpenney", "ikea", "wayfair", "newegg", "b&h", "adorama", "staples", "dick's", "academy", "nike", "adidas",
  "amazon.com", "amazon.com.mx", "amazon", "telcel", "at&t", "steren", "radioshack", "cyberpuerta", "ddtech", "claro shop",
];
// Donde venden muchos terceros: puede estar bien, pero hay que revisar al vendedor
const MARKETPLACES = ["mercado libre", "mercadolibre", "ebay", "walmart - ", "aliexpress", "temu", "shein", "wish",
  "linio", "facebook", "poshmark", "mercari", "offerup", "back market", "swappa", "claro shop - "];
const ACCESORIOS = /\b(funda|case|cover|protector|mica|cargador|charger|cable|repuesto|refacci|replacement|filtro|filter|cepillo|brush|bolsa(s)? de|bags?\b|soporte|mount|base para|control remoto de repuesto|kit de|accesorio|accessor|compatible|para (?:la |el )?(?:aspiradora|tele|television|laptop|iphone|samsung))/;

export function tipoTienda(nombre) {
  const n = sin(nombre);
  if (MARKETPLACES.some((m) => n.includes(m))) return "marketplace";
  if (CONFIABLES.some((c) => n === c || n.startsWith(c + " ") || n.startsWith(c + ".") || n === c.replace(/'/g, ""))) return "confiable";
  return "otra";
}

/** Quita de la frase lo que no es el producto: para quién, presupuesto, dónde, "quiero un…". */
export function consultaLimpia(texto) {
  let t = ` ${String(texto ?? "")} `;
  const quitar = [
    /\b(quiero|quisiera|busco|necesito|me gustar[ií]a|ando buscando|buscame|b[uú]scame|comprar|encuentra(me)?)\b/gi,
    /\bpara (mi |el |la |mis )?(pap[aá]|mam[aá]|hij[oa]s?|espos[oa]|niet[oa]s?|abuel[oa]|suegr[oa]|herman[oa]|novi[oa]|casa|regalo|navidad)(?=[\s,.;]|$)/gi,
    /\b(que )?(no pase de|menos de|hasta|m[aá]ximo|no m[aá]s de|presupuesto de|de unos|como de)\s*\$?\s*[\d.,]+\s*(mil|k)?\s*(pesos|d[oó]lares|usd|dlls|dls)?(?=[\s,.;]|$)/gi,
    /\b(en|de|del) (m[eé]xico|tijuana|estados unidos|san diego|usa|ee ?uu|otro lado)(?=[\s,.;]|$)/gi,
    /\b(que sea )?(barat[oa]s?|econ[oó]mic[oa]s?|bueno y barato)(?=[\s,.;]|$)/gi,
    /[,.;:!¿?¡]+/g,
  ];
  for (const re of quitar) t = t.replace(re, " ");
  t = t.replace(/^\s*(un|una|unos|unas|el|la|los|las)\s+/i, " ").replace(/\s+/g, " ").trim();
  return t || String(texto ?? "").trim();
}

/** "8,000 pesos" / "300 dólares" (lo que deja entender()) → {monto, moneda}. */
export function presupuestoDe(valor) {
  if (!valor || valor === "sin-limite") return null;
  const m = String(valor).replace(/,/g, "").match(/([\d.]+)\s*(mil)?\s*(pesos|d[oó]lares)?/i);
  if (!m) return null;
  let monto = Number(m[1]); if (m[2]) monto *= 1000;
  return { monto, moneda: /d[oó]lar/i.test(m[3] || "") ? "USD" : "MXN" };
}

/** Precio total en pesos: precio + envío (+ impuesto de California si es de EE. UU.). */
export function total(o, tc) {
  const usd = o.moneda === "USD";
  const f = usd ? tc : 1;
  const envio = o.envio ?? 0;
  const impuesto = usd ? (o.precio + envio) * IMPUESTO_CA : 0;
  const total_usd = usd ? o.precio + envio + impuesto : null;
  return {
    total_mxn: Math.round((o.precio + envio + impuesto) * f),
    precio_mxn: Math.round(o.precio * f),
    envio_mxn: Math.round(envio * f),
    impuesto_mxn: Math.round(impuesto * f),
    envio_desconocido: o.envio == null,
    pasa_franquicia: usd && total_usd > FRANQUICIA_USD,
    descuento: o.antes && o.antes > o.precio ? Math.round((1 - o.precio / o.antes) * 100) : null,
  };
}

/** ¿Es un accesorio o repuesto que no pidió? (palabras de accesorio, o mucho más barato que lo normal). */
export function esAccesorio(o, consulta, mediana) {
  const t = sin(o.titulo);
  const q = sin(consulta);
  if (ACCESORIOS.test(t) && !ACCESORIOS.test(q)) return true;
  return Boolean(mediana && o.precio_mxn_ref < mediana * 0.2);
}

const palabras = (t) => sin(t).replace(/[^a-z0-9 ]+/g, " ").split(/\s+/).filter((p) => p.length > 1);

/** Junta respuestas de México y EE. UU. y les pone precio total, etiquetas y grupo del mismo modelo. */
export function preparar(listas, tc, consulta) {
  const todas = listas.flat().map((o, i) => {
    const t = total(o, tc);
    return { ...o, ...t, i, tipo_tienda: tipoTienda(o.tienda), precio_mxn_ref: t.precio_mxn };
  });
  const precios = todas.map((o) => o.precio_mxn_ref).sort((a, b) => a - b);
  const mediana = precios.length ? precios[Math.floor(precios.length / 2)] : 0;
  for (const o of todas) o.accesorio = esAccesorio(o, consulta, mediana);
  // Mismo modelo: las primeras 7 palabras del título iguales (sin marca de tienda)
  const grupos = new Map();
  for (const o of todas) {
    const k = palabras(o.titulo).slice(0, 7).join(" ");
    o.grupo = k;
    grupos.set(k, (grupos.get(k) || 0) + 1);
  }
  for (const o of todas) o.en_tiendas = grupos.get(o.grupo);
  return todas;
}

/** Aplica los filtros de la pantalla y ordena por precio total. Marca la más barata. */
export function filtrar(todas, f = {}) {
  let r = todas.filter((o) => !o.accesorio || f.accesorios);
  if (f.lado === "mx" || f.lado === "us") r = r.filter((o) => o.pais === f.lado);
  if (f.nuevo) r = r.filter((o) => o.estado === "nuevo");
  if (f.confiables) r = r.filter((o) => o.tipo_tienda === "confiable");
  if (f.tope) r = r.filter((o) => o.total_mxn <= f.tope);
  const orden = f.orden || "precio";
  r = [...r].sort(orden === "calificacion"
    ? (a, b) => (b.calificacion ?? 0) - (a.calificacion ?? 0) || a.total_mxn - b.total_mxn
    : (a, b) => a.total_mxn - b.total_mxn);
  // El mismo modelo solo una vez (la oferta más barata), salvo que pida ver todas
  if (!f.repetidos) {
    const vistos = new Set();
    r = r.filter((o) => (vistos.has(o.grupo) ? false : vistos.add(o.grupo)));
  }
  const barata = r.reduce((m, o) => (m && m.total_mxn <= o.total_mxn ? m : o), null);
  return r.map((o) => ({ ...o, mas_barata: o === barata }));
}

export const cuantosAccesorios = (todas) => todas.filter((o) => o.accesorio).length;
