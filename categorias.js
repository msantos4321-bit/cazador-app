// Preguntas sencillas por tipo de producto. Todo con botones grandes; nada que escribir.
// Cada pregunta: {clave, texto, opciones:[{valor, etiqueta, ayuda?}]}

const TAMANOS_TELE = [24, 32, 40, 43, 50, 55, 58, 65, 70, 75, 85];

const PRESUPUESTO = {
  clave: "nivel",
  texto: "¿Qué te importa más?",
  opciones: [
    { valor: "economica", etiqueta: "Que sea barata", ayuda: "Lo más económico que sí funcione bien" },
    { valor: "equilibrada", etiqueta: "Buena y a buen precio", ayuda: "Lo que más conviene por lo que cuesta" },
    { valor: "mejor", etiqueta: "La mejor", ayuda: "Aunque cueste más" },
  ],
};

/** Dónde se busca primero en cada categoría (el detalle y qué tiendas se leen solas: data/tiendas_por_categoria.json). */
export const TIENDAS_SUGERIDAS = {
  tele: "Amazon, Walmart, Costco, Best Buy, Liverpool",
  aspiradora: "Amazon, Walmart, tiendas oficiales de la marca",
  celular: "Amazon, Walmart, Mercado Libre, tiendas oficiales",
  computadora: "Amazon, Walmart, Costco, Best Buy, B&H",
  linea_blanca: "Home Depot, Costco, Walmart, Liverpool, Lowe's",
  audio: "Amazon, Walmart, Best Buy",
  hogar: "Amazon, Walmart, IKEA, Home Depot, Costco, Wayfair, Liverpool",
  ropa: "Nordstrom Rack, Amazon, Macy's, Kohl's, tiendas de la marca",
  otro: "Amazon, Walmart, Mercado Libre, Costco",
};

function tiendaFavorita(categoria) {
  const donde = TIENDAS_SUGERIDAS[categoria.id] || TIENDAS_SUGERIDAS.otro;
  const opciones = [{ valor: "cualquiera", etiqueta: "Me da igual", ayuda: `Busco primero en ${donde}` }];
  if (categoria.id === "ropa") {
    opciones.unshift({ valor: "descuento", etiqueta: "Tiendas de descuento", ayuda: "Nordstrom Rack, Saks Off 5th, TJ Maxx, outlets" });
  }
  return {
    clave: "tienda_favorita",
    tipo: "texto",
    texto: "¿Tienes alguna tienda favorita?",
    placeholder: categoria.id === "ropa" ? "Ej. Macy's, Nordstrom Rack" : "Ej. Costco, Liverpool",
    opciones,
  };
}

const LADO = {
  clave: "lado",
  texto: "¿Dónde la puedes comprar?",
  opciones: [
    { valor: "ambos", etiqueta: "En México o en Estados Unidos" },
    { valor: "mx", etiqueta: "Solo en México" },
    { valor: "us", etiqueta: "Solo en Estados Unidos" },
  ],
};

const PRENDAS = ["jean", "pantalon", "pantalón", "camisa", "playera", "blusa", "vestido", "falda", "short", "chamarra", "chaqueta",
  "abrigo", "sudadera", "sueter", "suéter", "pijama", "traje", "saco", "corbata", "calcet", "ropa interior", "brasier",
  "tenis", "zapato", "bota", "sandalia", "chancla", "gorra", "bolsa", "mochila", "cartera", "cinturon", "cinturón", "lentes"];
const CALZADO = ["tenis", "zapato", "bota", "sandalia", "chancla"];

const tiene = (texto, lista) => lista.some((p) => quitarAcentos(texto.toLowerCase()).includes(quitarAcentos(p)));
/** Palabra completa (para marcas cortas como "mg" o "vw" que aparecen dentro de otras palabras). */
const tieneMarca = (texto, lista) => lista.some((p) => new RegExp(`\\b${quitarAcentos(p)}\\b`).test(quitarAcentos(texto.toLowerCase())));

const MUEBLES = ["mueble", "sofa", "sofá", "sillon", "sillón", "sala", "comedor", "colchon", "colchón", "cama",
  "escritorio", "silla", "mesa", "librero", "closet", "cajonera", "buro", "buró", "tocador", "recamara", "recámara"];

const MARCAS_AUTO = ["toyota", "honda", "nissan", "ford", "chevrolet", "chevy", "mazda", "kia", "hyundai", "jeep",
  "dodge", "gmc", "volkswagen", "vw", "bmw", "mercedes", "audi", "tesla", "subaru", "lexus", "acura", "infiniti",
  "mitsubishi", "buick", "cadillac", "chrysler", "volvo", "seat", "suzuki", "mg"];

export const CATEGORIAS = [
  {
    id: "auto",
    nombre: "Auto",
    palabras: ["carro", "auto$", "autos$", "coche", "camioneta", "pickup", "troca", "sedan", "sedán", "suv$", "minivan", "copart",
      "seminuevo", ...MARCAS_AUTO.map((m) => m + "$")],
    preguntas: (texto) => [
      {
        clave: "estado",
        texto: "¿Nuevo o usado?",
        opciones: [
          { valor: "usado", etiqueta: "Usado o seminuevo", ayuda: "Lotes y agencias de los dos lados" },
          { valor: "nuevo", etiqueta: "Nuevo", ayuda: "Promociones de agencia" },
          { valor: "subasta", etiqueta: "De subasta (Copart)", ayuda: "Más barato, pero con daño y más trámite" },
        ],
      },
      tieneMarca(texto, MARCAS_AUTO) ? null : {
        clave: "modelo",
        tipo: "texto",
        texto: "¿Qué marca y modelo?",
        placeholder: "Ej. Toyota Corolla, Honda CR-V",
        opciones: [{ valor: "recomiendame", etiqueta: "Recomiéndame uno", ayuda: "Te propongo según lo que necesitas" }],
      },
      {
        clave: "uso",
        texto: "¿Para qué lo vas a usar más?",
        opciones: [
          { valor: "ciudad", etiqueta: "Para moverme en la ciudad", ayuda: "Que gaste poca gasolina" },
          { valor: "familia", etiqueta: "Para la familia", ayuda: "Espacio y seguridad" },
          { valor: "trabajo", etiqueta: "Para trabajo o carga" },
          { valor: "carretera", etiqueta: "Para carretera y viajes" },
        ],
      },
      {
        clave: "anios",
        texto: "¿De qué año, más o menos?",
        opciones: [
          { valor: "0-3", etiqueta: "Casi nuevo", ayuda: "De 3 años para acá" },
          { valor: "4-7", etiqueta: "De 4 a 7 años" },
          { valor: "8+", etiqueta: "De 8 años o más", ayuda: "Más barato" },
          { valor: "cualquiera", etiqueta: "Me da igual" },
        ],
      },
      {
        clave: "km",
        texto: "¿Cuántos kilómetros como máximo?",
        opciones: [
          { valor: "60000", etiqueta: "Menos de 60,000 km" },
          { valor: "120000", etiqueta: "Menos de 120,000 km" },
          { valor: "cualquiera", etiqueta: "Me da igual" },
        ],
      },
      {
        clave: "presupuesto",
        tipo: "texto",
        texto: "¿Cuánto quieres gastar como máximo?",
        placeholder: "Ej. 250,000 pesos o 15,000 dólares",
        opciones: [],
      },
      {
        clave: "zona",
        texto: "¿Dónde lo buscamos?",
        opciones: [
          { valor: "tj", etiqueta: "Tijuana, Rosarito y Tecate" },
          { valor: "bc", etiqueta: "Toda Baja California", ayuda: "Incluye Mexicali y Ensenada" },
          { valor: "sd", etiqueta: "San Diego y alrededores", ayuda: "Ojo: traerlo a México tiene trámite" },
          { valor: "ambos", etiqueta: "De los dos lados" },
        ],
      },
    ],
  },
  {
    id: "hogar",
    nombre: "Hogar",
    palabras: ["mueble", "sofa", "sofá", "sillon", "sillón", "comedor", "colchon", "colchón", "cama", "base de cama",
      "escritorio", "silla", "mesa", "librero", "closet", "cajonera", "buro", "buró", "cocina", "sarten", "sartén",
      "olla", "cuchillo", "vajilla", "licuadora", "cafetera", "freidora", "batidora", "tostador", "cortina", "tapete",
      "alfombra", "lampara", "lámpara", "decoracion", "decoración", "edredon", "edredón", "sabana", "sábana", "toalla",
      "jardin", "jardín", "asador", "parrilla", "herramienta", "taladro", "hogar", "casa"],
    preguntas: (texto) => !tiene(texto, MUEBLES) ? [] : [
      {
        clave: "cuarto",
        texto: "¿Para qué parte de la casa?",
        opciones: [
          { valor: "sala", etiqueta: "Sala o comedor" },
          { valor: "recamara", etiqueta: "Recámara" },
          { valor: "cocina", etiqueta: "Cocina" },
          { valor: "bano", etiqueta: "Baño" },
          { valor: "exterior", etiqueta: "Patio, jardín o cochera" },
        ],
      },
      {
        clave: "medidas",
        tipo: "texto",
        texto: "¿Tienes alguna medida o tamaño?",
        placeholder: "Ej. sofá de 3 plazas, colchón matrimonial, 2 metros",
        opciones: [{ valor: "no-importa", etiqueta: "No importa" }],
      },
      {
        clave: "armado",
        texto: "¿Te importa armarlo tú?",
        opciones: [
          { valor: "si", etiqueta: "No hay problema", ayuda: "Suele ser más barato" },
          { valor: "no", etiqueta: "Que venga armado o con instalación" },
        ],
      },
    ],
  },
  {
    id: "ropa",
    nombre: "Ropa y calzado",
    palabras: ["ropa", ...PRENDAS, "levi", "nike", "adidas", "puma", "under armour", "columbia", "calvin klein", "tommy"],
    preguntas: (texto) => [
      {
        clave: "para_quien",
        texto: "¿Para quién es la ropa?",
        opciones: [
          { valor: "hombre", etiqueta: "Hombre" },
          { valor: "mujer", etiqueta: "Mujer" },
          { valor: "nino", etiqueta: "Niño" },
          { valor: "nina", etiqueta: "Niña" },
        ],
      },
      tiene(texto, PRENDAS) ? null : {
        clave: "prenda",
        tipo: "texto",
        texto: "¿Qué prenda buscas?",
        placeholder: "Jeans, chamarra, tenis…",
        opciones: [],
      },
      {
        clave: "talla",
        tipo: "texto",
        texto: "¿Qué talla?",
        placeholder: tiene(texto, CALZADO) ? "Ej. 9 de EE. UU. o 27 de México" : "Ej. M, 32x32, 10",
        opciones: [{ valor: "no-se", etiqueta: "No sé todavía" }],
      },
      {
        clave: "marca",
        tipo: "texto",
        texto: "¿Alguna marca en especial?",
        placeholder: "Levi's, Nike, Columbia…",
        opciones: [{ valor: "cualquiera", etiqueta: "Me da igual" }],
      },
    ],
  },
  {
    id: "tele",
    nombre: "Televisión",
    palabras: ["tele", "televisi", "tv", "pantalla", "smart tv"],
    preguntas: (texto) => [preguntaTamano(texto), {
      clave: "uso",
      texto: "¿Para qué la van a usar más?",
      opciones: [
        { valor: "noticias", etiqueta: "Noticias, novelas y canales" },
        { valor: "peliculas", etiqueta: "Películas y deportes" },
        { valor: "juegos", etiqueta: "Videojuegos" },
      ],
    }],
  },
  {
    id: "aspiradora",
    nombre: "Aspiradora robot",
    palabras: ["aspiradora", "robot", "roomba", "trapeador"],
    preguntas: () => [{
      clave: "piso",
      texto: "¿Cómo es el piso?",
      opciones: [
        { valor: "duro", etiqueta: "Loseta, madera o cemento" },
        { valor: "alfombra", etiqueta: "Mucha alfombra o tapetes" },
        { valor: "mixto", etiqueta: "De los dos" },
      ],
    }, {
      clave: "trapea",
      texto: "¿También quieres que trapee?",
      opciones: [
        { valor: "si", etiqueta: "Sí, que trapee" },
        { valor: "no", etiqueta: "No, solo aspirar" },
      ],
    }, {
      clave: "mascotas",
      texto: "¿Hay mascotas en casa?",
      opciones: [
        { valor: "si", etiqueta: "Sí" },
        { valor: "no", etiqueta: "No" },
      ],
    }],
  },
  {
    id: "celular",
    nombre: "Celular",
    palabras: ["celular", "teléfono", "telefono", "iphone", "android", "samsung", "motorola", "xiaomi"],
    preguntas: () => [{
      clave: "sistema",
      texto: "¿Qué tipo de celular?",
      opciones: [
        { valor: "iphone", etiqueta: "iPhone" },
        { valor: "android", etiqueta: "Android (Samsung, Motorola…)" },
        { valor: "igual", etiqueta: "Me da igual" },
      ],
    }, {
      clave: "uso",
      texto: "¿Qué es lo más importante?",
      opciones: [
        { valor: "basico", etiqueta: "Llamadas, WhatsApp y fotos" },
        { valor: "camara", etiqueta: "Muy buena cámara" },
        { valor: "bateria", etiqueta: "Que dure mucho la pila" },
      ],
    }],
  },
  {
    id: "computadora",
    nombre: "Computadora",
    palabras: ["laptop", "computadora", "lap", "notebook", "macbook", "pc"],
    preguntas: () => [{
      clave: "uso",
      texto: "¿Para qué la vas a usar?",
      opciones: [
        { valor: "basico", etiqueta: "Internet, correo y escuela" },
        { valor: "trabajo", etiqueta: "Trabajo y muchas cosas abiertas" },
        { valor: "pesado", etiqueta: "Diseño, video o juegos" },
      ],
    }, {
      clave: "tipo",
      texto: "¿Laptop o de escritorio?",
      opciones: [
        { valor: "laptop", etiqueta: "Laptop" },
        { valor: "escritorio", etiqueta: "De escritorio" },
      ],
    }],
  },
  {
    id: "linea_blanca",
    nombre: "Electrodoméstico",
    palabras: ["refri", "refrigerador", "lavadora", "secadora", "estufa", "microondas", "minisplit", "aire acondicionado", "lavavajillas"],
    preguntas: () => [{
      clave: "personas",
      texto: "¿Para cuántas personas?",
      opciones: [
        { valor: "1-2", etiqueta: "1 o 2" },
        { valor: "3-4", etiqueta: "3 o 4" },
        { valor: "5+", etiqueta: "5 o más" },
      ],
    }],
  },
  {
    id: "audio",
    nombre: "Audio",
    palabras: ["audífono", "audifono", "bocina", "airpods", "barra de sonido"],
    preguntas: () => [{
      clave: "uso",
      texto: "¿Para qué los quieres?",
      opciones: [
        { valor: "diario", etiqueta: "Para todos los días" },
        { valor: "ejercicio", etiqueta: "Para hacer ejercicio" },
        { valor: "casa", etiqueta: "Para la casa o la tele" },
      ],
    }],
  },
];

export const GENERAL = { id: "otro", nombre: "Otro", palabras: [], preguntas: () => [] };

export function detectar(texto) {
  const t = quitarAcentos(texto.toLowerCase());
  for (const c of CATEGORIAS) {
    if (c.palabras.some((p) => new RegExp(`\\b${quitarAcentos(p.replace(/\$$/, ""))}${p.endsWith("$") ? "\\b" : ""}`).test(t))) return c;
  }
  return GENERAL;
}

export function preguntasPara(categoria, texto) {
  if (categoria.id === "auto") return categoria.preguntas(texto).filter(Boolean);  // trae su propio presupuesto y zona
  return [...categoria.preguntas(texto).filter(Boolean), PRESUPUESTO, tiendaFavorita(categoria), LADO];
}

/** Pulgadas que pidió (o null). "45 pulgadas", "45\"", "de 45". */
export function pulgadas(texto) {
  const m = texto.match(/(\d{2,3})\s*(?:"|''|”|pulg|pulgadas|in\b|pul\b)/i) || texto.match(/\bde\s+(\d{2,3})\b/i);
  return m ? Number(m[1]) : null;
}

/** Si el tamaño no existe (p. ej. 45"), ofrece los dos más cercanos con una explicación. */
function preguntaTamano(texto) {
  const p = pulgadas(texto);
  if (p && TAMANOS_TELE.includes(p)) return null; // ya lo dijo y sí existe
  if (p) {
    const abajo = [...TAMANOS_TELE].reverse().find((t) => t < p);
    const arriba = TAMANOS_TELE.find((t) => t > p);
    return {
      clave: "pulgadas",
      texto: `No fabrican teles de ${p} pulgadas. ¿Cuál prefieres?`,
      opciones: [abajo, arriba].filter(Boolean).map((t) => ({
        valor: String(t), etiqueta: `${t} pulgadas`, ayuda: t < p ? "Un poco más chica" : "Un poco más grande",
      })),
    };
  }
  return {
    clave: "pulgadas",
    texto: "¿De qué tamaño?",
    opciones: [
      { valor: "32", etiqueta: "Chica · 32\"", ayuda: "Recámara o cocina" },
      { valor: "43", etiqueta: "Mediana · 43\"", ayuda: "Recámara o sala chica" },
      { valor: "55", etiqueta: "Grande · 55\"", ayuda: "Sala" },
      { valor: "65", etiqueta: "Muy grande · 65\"", ayuda: "Sala amplia" },
    ],
  };
}

export function esLiga(texto) {
  return /^https?:\/\/\S+$/i.test(texto.trim());
}

export function quitarAcentos(s) {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "");
}

export { TAMANOS_TELE };

/** Sugerencias mientras escribe: frases completas listas para tocar. */
export const SUGERENCIAS = [
  "Televisión de 50 pulgadas", "Televisión de 55 pulgadas", "Televisión de 65 pulgadas",
  "Aspiradora robot que trapee", "Aspiradora inalámbrica",
  "Celular Samsung", "iPhone", "Audífonos inalámbricos", "Bocina bluetooth",
  "Laptop para la escuela", "Laptop para trabajo", "iPad",
  "Refrigerador", "Lavadora", "Microondas", "Minisplit",
  "Sofá de 3 plazas", "Colchón matrimonial", "Comedor de 4 sillas", "Escritorio", "Freidora de aire",
  "Cafetera", "Juego de sartenes", "Asador de gas", "Taladro",
  "Jeans Levi's 501", "Tenis para correr", "Chamarra de invierno", "Ropa de niño",
  "Toyota Corolla usado", "Honda CR-V usada", "Camioneta familiar usada", "Pickup usada", "Auto de subasta en Copart",
];

export function sugerir(texto, extras = []) {
  const t = quitarAcentos(texto.toLowerCase().trim());
  if (t.length < 2) return [];
  const palabras = t.split(/\s+/);
  const vistos = new Set();
  return [...extras, ...SUGERENCIAS]
    .filter((s) => {
      const n = quitarAcentos(s.toLowerCase());
      if (vistos.has(n) || n === t) return false;
      vistos.add(n);
      return palabras.every((p) => n.includes(p));
    })
    .slice(0, 6);
}
