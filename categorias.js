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

function tiendaFavorita(categoria) {
  const opciones = [{ valor: "cualquiera", etiqueta: "Me da igual", ayuda: "Busco en las tiendas que más convengan" }];
  if (categoria.id === "ropa") {
    opciones.unshift({ valor: "descuento", etiqueta: "Tiendas de descuento", ayuda: "Nordstrom Rack, Saks Off 5th, TJ Maxx, outlets" });
  }
  return {
    clave: "tienda_favorita",
    tipo: "texto",
    texto: "¿Tienes alguna tienda favorita?",
    placeholder: "Ej. Macy's, Nordstrom Rack",
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

export const CATEGORIAS = [
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
    if (c.palabras.some((p) => new RegExp(`\\b${quitarAcentos(p)}`).test(t))) return c;
  }
  return GENERAL;
}

export function preguntasPara(categoria, texto) {
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
