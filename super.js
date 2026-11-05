// "¿Es buen precio?" en la tienda: tamaños, precio por litro/kilo, semáforo y lista del súper.
// Sin nada del navegador para probarla con node (tests/ofertas.test.mjs).

const sin = (t) => String(t ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

export const TIENDAS_MX = ["Walmart", "Soriana", "Calimax", "Smart & Final", "Costco", "Sam's Club", "Ley", "Bodega Aurrera",
  "Chedraui", "Oxxo", "Farmacia"];
export const TIENDAS_US = ["Walmart", "Target", "Costco", "Smart & Final", "Vons", "Food 4 Less", "Home Depot", "Best Buy"];

/** Nombre de cadena tal como lo dice Google ("Walmart.com.mx", "Soriana Súper") → la cadena. */
export function cadenaDe(nombre) {
  const n = sin(nombre);
  const todas = [...new Set([...TIENDAS_MX, ...TIENDAS_US, "HEB", "La Comer", "Amazon", "Mercado Libre", "Liverpool", "Coppel"])];
  return todas.find((c) => n.includes(sin(c).replace(/'/g, "")) || n.includes(sin(c))) || String(nombre ?? "").trim();
}

/** "1 L" → {valor:1000, unidad:"ml"}; "1.5 kg" → 1500 g; "6 x 355 ml" → 2130 ml; "12 piezas" → 12 pz. */
export function cantidadBase(texto) {
  const t = sin(texto).replace(/,/g, ".");
  const m = t.match(/(?:(\d+)\s*-?\s*(?:x|pack(?: de)?|paquete(?: de)?)\s*)?(\d+(?:\.\d+)?)\s*(kg|kilos?|g|gr|gramos?|l|lt|litros?|ml|mililitros?|oz|fl oz|lb|pzas?|piezas?|pz|unidades|ct|count)\b/);
  if (!m) return null;
  const veces = m[1] ? Number(m[1]) : 1;
  let valor = Number(m[2]) * veces;
  const u = m[3];
  if (/^(kg|kilo)/.test(u)) return { valor: valor * 1000, unidad: "g" };
  if (/^(g|gr|gramo)/.test(u)) return { valor, unidad: "g" };
  if (/^(l|lt|litro)/.test(u)) return { valor: valor * 1000, unidad: "ml" };
  if (/^(ml|mililitro)/.test(u)) return { valor, unidad: "ml" };
  if (u === "fl oz" || u === "oz") return { valor: valor * (u === "oz" && /\bfl\b/.test(t) ? 29.57 : 28.35), unidad: u === "oz" && !/\bfl\b/.test(t) ? "g" : "ml" };
  if (u === "lb") return { valor: valor * 453.6, unidad: "g" };
  return { valor, unidad: "pz" };
}

/** Precio por litro, por kilo o por pieza (para comparar paquetes de distinto tamaño). */
export function porUnidad(precio, cantidad) {
  const c = typeof cantidad === "string" ? cantidadBase(cantidad) : cantidad;
  if (!c || !c.valor || !precio) return null;
  if (c.unidad === "ml") return { valor: (precio / c.valor) * 1000, texto: "por litro" };
  if (c.unidad === "g") return { valor: (precio / c.valor) * 1000, texto: "por kilo" };
  return { valor: precio / c.valor, texto: "por pieza" };
}

/** Lo que se compara: el precio por unidad si los dos tamaños se conocen y son del mismo tipo; si no, el precio. */
function comparable(a, b) {
  const ca = cantidadBase(a.cantidad), cb = cantidadBase(b.cantidad);
  if (ca && cb && ca.unidad === cb.unidad && Math.abs(ca.valor - cb.valor) / ca.valor > 0.02) {
    return [porUnidad(a.precio, ca).valor, porUnidad(b.precio, cb).valor, true];
  }
  return [a.precio, b.precio, false];
}

/**
 * Semáforo del súper.
 * aqui: {precio, tienda, cantidad}; otros: [{tienda, precio, cantidad, fuente, fecha}] (mismas moneda).
 * Devuelve {color, titulo, detalle, mejor, ahorro, pct, posicion}.
 */
export function veredictoSuper(aqui, otros) {
  const demas = otros.filter((o) => o.precio > 0 && sin(cadenaDe(o.tienda)) !== sin(cadenaDe(aqui.tienda)));
  if (!demas.length) {
    return { color: "gris", titulo: "Aún no tengo con qué comparar", detalle: "Guardé este precio. La próxima vez que alguien de la familia lo escanee en otra tienda, ya podré decirte dónde conviene.", mejor: null };
  }
  let mejor = null, mejorAqui = null, mejorOtro = Infinity, porTamano = false;
  for (const o of demas) {
    const [va, vo, unidad] = comparable(aqui, o);
    if (vo < mejorOtro) { mejorOtro = vo; mejorAqui = va; mejor = o; porTamano = unidad; }
  }
  const pct = Math.round((1 - mejorOtro / mejorAqui) * 100);
  const mas_baratas = demas.filter((o) => { const [va, vo] = comparable(aqui, o); return vo < va * 0.98; }).length;
  const ahorro = porTamano ? null : Math.round((aqui.precio - mejor.precio) * 100) / 100;
  if (pct <= 2) {
    return { color: "verde", titulo: "¡Buen precio! Cómpralo aquí", pct: -pct, mejor, ahorro: 0,
      detalle: pct < -2 ? `Aquí está ${Math.abs(pct)} % más barato que en ${cadenaDe(mejor.tienda)}.` : `Es de lo más barato que conozco (${demas.length + 1} tiendas comparadas).` };
  }
  if (pct <= 10) {
    return { color: "amarillo", titulo: "Precio normal", pct, mejor, ahorro,
      detalle: `En ${cadenaDe(mejor.tienda)} está ${pct} % más barato${ahorro ? ` (ahorras $${ahorro.toFixed(2)})` : ""}. Si no te queda de camino, cómpralo aquí.` };
  }
  return { color: "rojo", titulo: `Está caro aquí: ${pct} % más`, pct, mejor, ahorro,
    detalle: `En ${cadenaDe(mejor.tienda)} cuesta ${porTamano ? "menos por litro/kilo" : `$${mejor.precio.toFixed(2)}`}${ahorro ? `: ahorras $${ahorro.toFixed(2)}` : ""}.${mas_baratas > 1 ? ` Hay ${mas_baratas} tiendas más baratas.` : ""}` };
}

/** Precios en línea que sí son ese producto: tienen la marca y el tamaño. El más barato por cadena. */
export function preciosEnLinea(resultados, ficha) {
  const marca = sin(ficha?.marca || "").split(/\s+/)[0];
  const cant = cantidadBase(ficha?.cantidad || ficha?.nombre || "");
  const mejores = new Map();
  for (const r of resultados || []) {
    const t = sin(r.titulo);
    if (marca && marca.length > 2 && !t.includes(marca)) continue;
    const c = cantidadBase(r.titulo);
    if (cant && c && (c.unidad !== cant.unidad || Math.abs(c.valor - cant.valor) / cant.valor > 0.05)) continue;
    if (r.estado && r.estado !== "nuevo") continue;
    const cadena = cadenaDe(r.tienda);
    const previo = mejores.get(sin(cadena));
    if (!previo || r.precio < previo.precio) {
      mejores.set(sin(cadena), { tienda: cadena, precio: r.precio, cantidad: c ? r.titulo : ficha?.cantidad, fuente: "en línea", moneda: r.moneda, imagen: r.imagen });
    }
  }
  return [...mejores.values()].sort((a, b) => a.precio - b.precio);
}

/**
 * ¿En qué tienda sale más barata toda la lista?
 * articulos: [{id, piezas}]; precios: {id: [{tienda, precio}]} → [{tienda, total, tiene, faltan}] (la mejor primero).
 */
export function mejorTiendaLista(articulos, precios) {
  const tiendas = new Map();
  for (const a of articulos) {
    const vistos = new Map();
    for (const p of precios[a.id] || []) {
      const c = cadenaDe(p.tienda);
      if (!vistos.has(c) || p.precio < vistos.get(c)) vistos.set(c, p.precio);
    }
    for (const [c, precio] of vistos) {
      const t = tiendas.get(c) || { tienda: c, total: 0, tiene: 0 };
      t.total += precio * (a.piezas || 1);
      t.tiene += 1;
      tiendas.set(c, t);
    }
  }
  return [...tiendas.values()]
    .map((t) => ({ ...t, total: Math.round(t.total * 100) / 100, faltan: articulos.length - t.tiene }))
    .sort((a, b) => (a.faltan - b.faltan) || (a.total - b.total));
}

/** "hace 2 días", "hoy", "ayer". */
export function haceCuanto(fecha, ahora = Date.now()) {
  const d = Math.floor((ahora - new Date(fecha).getTime()) / 86400000);
  return d <= 0 ? "hoy" : d === 1 ? "ayer" : d < 30 ? `hace ${d} días` : `hace ${Math.round(d / 30)} ${Math.round(d / 30) === 1 ? "mes" : "meses"}`;
}
