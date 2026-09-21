// Motor del bot de pedidos por WhatsApp.
//
// Independiente del transporte (Meta Cloud API, Baileys, simulador):
// recibe { telefono, texto } y devuelve una lista de respuestas en texto
// plano. El adaptador de cada transporte se encarga de enviarlas
// (texto simple, listas o botones interactivos).
//
// Flujo: ¿empresa o particular? -> (empresa: deriva a un asesor humano) ->
// [registro si no está: nombre -> dirección -> lo registra] ->
// [elegir sucursal si tiene varias] -> catálogo numerado -> número ->
// cantidad -> ¿algo más? (SI/NO) -> resumen -> SI confirma y crea el pedido.
const pool = require('../config/db');
const Producto = require('../models/Producto');
const Pedido = require('../models/Pedido');
const Direccion = require('../models/Direccion');
const User = require('../models/user');
const { extractCoordsFromText } = require('./urlResolver');

const SESSION_TIMEOUT_MS = 15 * 60 * 1000;

// Estado inicial: esperar definición de empresa/particular
const SESSION_WELCOME = 'WELCOME';
// Estado al derivar a un asesor humano (empresa)
const SESSION_HANDOFF = 'HANDOFF';

// telefono (dígitos) -> { state, cart, catalog, pendingProduct,
//   addresses, address, regName, pendingCoords, isParticular, lastActive }
const sessions = new Map();

function digitsOnly(value) {
  return (value || '').toString().replace(/\D/g, '');
}

function newSession() {
  return {
    state: 'WELCOME',
    cart: [],
    catalog: [],
    pendingProduct: null,
    addresses: [],
    address: null,
    regName: null,
    pendingCoords: null,
    addressRef: null,
    regExtra: null,
    isParticular: null,
    lastActive: Date.now(),
  };
}

function getSession(telefono) {
  const now = Date.now();
  let session = sessions.get(telefono);
  if (session && now - session.lastActive > SESSION_TIMEOUT_MS) {
    sessions.delete(telefono);
    session = undefined;
  }
  if (!session) {
    session = newSession();
    sessions.set(telefono, session);
  }
  session.lastActive = now;
  return session;
}

function resetSession(telefono) {
  sessions.delete(telefono);
}

async function findClientByPhone(telefono) {
  const clean = digitsOnly(telefono);
  const tail = clean.slice(-8);
  if (tail.length < 8) return null;
  const { rows } = await pool.query(
    `SELECT id, nombre, telefono
     FROM usuarios
     WHERE tipo_usuario = 'cliente'
       AND activado = true
       AND COALESCE(su, false) = false`
  );
  return (
    rows.find((r) => digitsOnly(r.telefono).slice(-8) === tail) || null
  );
}

async function getAddresses(clientId) {
  const rows = await Direccion.getByUserId(clientId);
  return (rows || []).map((d) => ({
    id: d.id,
    nombre: (d.nombre || '').toString().trim(),
    direccion: (d.direccion || '').toString().trim(),
    latitud: d.latitud ?? null,
    longitud: d.longitud ?? null,
    info_extra: (d.info_extra || '').toString().trim(),
  }));
}

function addressLabel(addr) {
  if (!addr) return 'Sin dirección';
  const direccion = (addr.direccion || '').trim();
  if (addr.nombre && direccion && String(addr.nombre).trim() === direccion) {
    return addr.nombre;
  }
  const name = addr.nombre ? `${addr.nombre} - ` : '';
  return `${name}${direccion || 'Sin dirección'}`;
}

function addressListText(addresses) {
  const lines = addresses.map(
    (a, i) => `${i + 1}. ${addressLabel(a)}`
  );
  return (
    '¿A qué sucursal enviamos el pedido?\n' +
    lines.join('\n') +
    '\n\nRespondé con el NÚMERO de la sucursal.'
  );
}

async function loadCatalog() {
  const productos = await Producto.getAll();
  return productos
    .filter((p) => Number(p.cantidad) > 0)
    .sort((a, b) => Number(a.idproducto) - Number(b.idproducto))
    .map((p) => ({
      id: Number(p.idproducto),
      nombre: p.nombre,
      precio: Number(p.preciounitario),
      stock: Number(p.cantidad),
    }));
}

function formatPrice(value) {
  return `Bs ${Number(value || 0).toFixed(2)}`;
}

function catalogText(catalog) {
  const lines = catalog.map(
    (p, i) => `${i + 1}. ${p.nombre} - ${formatPrice(p.precio)}`
  );
  return (
    'Este es nuestro catálogo:\n' +
    lines.join('\n') +
    '\n\nRespondé con el NÚMERO del producto que querés pedir.'
  );
}

function cartTotal(cart) {
  return cart.reduce((sum, item) => sum + item.precio * item.cantidad, 0);
}

function summaryText(cart, address) {
  const lines = cart.map(
    (item) =>
      `- ${item.cantidad}x ${item.nombre} - ${formatPrice(
        item.precio * item.cantidad
      )}`
  );
  return (
    'Tu pedido:\n' +
    lines.join('\n') +
    `\nTotal: ${formatPrice(cartTotal(cart))}` +
    `\nEnvío a: ${addressLabel(address)}` +
    '\n\nRespondé SI para confirmar o NO para cancelar.'
  );
}

function isYes(text) {
  return ['si', 'sí', 'sii', 'confirmar', 'confirmo', 'ok', 'dale'].includes(
    text
  );
}

function isNo(text) {
  return ['no', 'cancelar', 'cancelo', 'n'].includes(text);
}

function isGreeting(text) {
  return ['hola', 'buenas', 'buenos dias', 'buenas tardes', 'buenas noches', 'menu', 'menú', 'pedido', 'pedir', 'empezar', 'inicio'].includes(text);
}

function isEmpresaText(text) {
  return ['empresa', 'compañia', 'compañía', 'empresarial', 'negocio', 'organization', 'comercio'].includes(text);
}

function isParticularText(text) {
  return ['particular', 'personal', 'individual', 'persona', 'cliente'].includes(text);
}

// Lleva al cliente al catálogo, pasando por selección de sucursal
// si tiene más de una dirección.
async function goToCatalog(session, client) {
  session.catalog = await loadCatalog();
  if (!session.catalog.length) {
    session.state = 'IDLE';
    return {
      respuestas: ['Por el momento no tenemos productos con stock.'],
      estado: 'IDLE',
    };
  }
  session.addresses = await getAddresses(client.id);
  if (session.addresses.length > 1) {
    session.address = null;
    session.state = 'ADDRESS';
    return { respuestas: [addressListText(session.addresses)], estado: 'ADDRESS' };
  }
  session.address = session.addresses[0] || null;
  session.state = 'MENU';
  return { respuestas: [catalogText(session.catalog)], estado: 'MENU' };
}

// Crea el cliente + su dirección y lo deja en el catálogo.
// coords: { latitud, longitud } o null. Si hay coords, `nombre` es la
// referencia que dio el cliente; la dirección en texto usa esa misma
// referencia (sin concatenar coordenadas, que van a latitud/longitud).
// Los datos extra de ubicación (nombre del edificio, color del portón,
// etc.) van en session.regExtra y se guardan en info_extra.
async function finishRegistration(session, telefono, { nombre, direccion, coords }) {
  const created = await User.create({
    nombre: session.regName,
    telefono,
    email: `whatsapp.${telefono}@bluice.bo`,
    password: '',
    activado: true,
    tipo_usuario: 'cliente',
    email_confirm: true,
  });
  const infoParts = [];
  if (coords) infoParts.push('Coordenadas por GPS');
  if (session.regExtra) infoParts.push(`Indicaciones: ${session.regExtra}`);
  const dir = await Direccion.create({
    usuario_id: created.id,
    direccion,
    latitud: coords ? coords.latitud : null,
    longitud: coords ? coords.longitud : null,
    info_extra: infoParts.length ? infoParts.join(' | ') : 'Registrada por WhatsApp',
    nombre: nombre || 'Principal',
  });
  session.address = {
    id: dir.id,
    nombre: dir.nombre || 'Principal',
    direccion: dir.direccion,
    latitud: dir.latitud ?? null,
    longitud: dir.longitud ?? null,
    info_extra: (dir.info_extra || '').toString().trim(),
  };
  session.regName = null;
  session.pendingCoords = null;
  session.addressRef = null;
  session.regExtra = null;
  session.catalog = await loadCatalog();
  session.state = 'MENU';
  return {
    respuestas: [
      `Listo ${created.nombre}, ya estás registrado!`,
      catalogText(session.catalog),
    ],
    estado: 'MENU',
  };
}

function validCoords(ubicacion) {
  if (!ubicacion) return null;
  const lat = Number(ubicacion.latitud);
  const lng = Number(ubicacion.longitud);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null;
  return { latitud: lat, longitud: lng };
}

// ubicacion (opcional): { latitud, longitud } de un mensaje de ubicación
// compartida de WhatsApp (lo mapea el adaptador de cada transporte).
async function handleIncoming(telefonoRaw, textoRaw, ubicacion) {
  const telefono = digitsOnly(telefonoRaw);
  const texto = (textoRaw || '').toString().trim().toLowerCase();

  if (!telefono) {
    return { respuestas: ['No pude identificar tu número.'], estado: 'IDLE' };
  }

  const session = getSession(telefono);

  // "cancelar" funciona en cualquier momento.
  if (texto === 'cancelar') {
    resetSession(telefono);
    return {
      respuestas: ['Pedido cancelado. Escribí HOLA cuando quieras pedir.'],
      estado: 'IDLE',
    };
  }

  const client = await findClientByPhone(telefono);

  // ---- Pregunta inicial: ¿empresa o particular? (aplica a todos) ----
  if (session.state === 'WELCOME') {
    if (isEmpresaText(texto)) {
      session.isParticular = false;
      session.state = 'HANDOFF';
      return {
        respuestas: [
          'Gracias por escribirnos. Como sos empresa, vamos a derivar tu pedido con un asesor humano.',
          'En breve un asesor se va a comunicar con vos por este mismo chat.',
        ],
        estado: 'HANDOFF',
        transferir_a_humano: true,
      };
    }
    if (isParticularText(texto)) {
      session.isParticular = true;
      if (!client) {
        session.state = 'REGISTER_NAME';
        return {
          respuestas: [
            'Hola! Soy el asistente de Blu Ice. Veo que tu número no está registrado.',
            '¿Cuál es tu nombre?',
          ],
          estado: 'REGISTER_NAME',
        };
      }
      const next = await goToCatalog(session, client);
      return {
        respuestas: ['Hola! Soy el asistente de Blu Ice.', ...next.respuestas],
        estado: next.estado,
      };
    }
    return {
      respuestas: [
        'Hola! Soy el asistente de Blu Ice.',
        'Para poder ayudarte, decime primero: ¿sos una EMPRESA o un PARTICULAR?',
      ],
      estado: 'WELCOME',
    };
  }

  // ---- Número derivado a un asesor humano (empresa) ----
  if (session.state === 'HANDOFF') {
    return {
      respuestas: [
        'Tu consulta ya fue derivada a un asesor. Esperá su mensaje por este mismo chat.',
      ],
      estado: 'HANDOFF',
    };
  }

  // ---- Número NO registrado: registro guiado en el chat ----
  if (!client) {
    // Ubicación compartida (con o sin texto): pide el nombre de referencia.
    const shared = validCoords(ubicacion);
    if (shared && (session.state === 'REGISTER_ADDRESS' || session.state === 'IDLE')) {
      session.pendingCoords = shared;
      session.state = 'REGISTER_ADDRESS_REF';
      return {
        respuestas: ['Ubicación recibida! ¿Cómo llamamos a esta dirección? (ej: Sucursal Norte)'],
        estado: 'REGISTER_ADDRESS_REF',
      };
    }

    if (session.state === 'REGISTER_ADDRESS_REF') {
      const referencia = (textoRaw || '').toString().trim();
      if (referencia.length < 2) {
        return {
          respuestas: ['Decime un nombre corto para esta dirección (ej: Casa, Sucursal Norte).'],
          estado: 'REGISTER_ADDRESS_REF',
        };
      }
      session.addressRef = referencia;
      session.state = 'REGISTER_ADDRESS_EXTRA';
      return {
        respuestas: [
          `Perfecto, esta dirección será: ${referencia}`,
          'Para que el conductor te encuentre fácil, decime una referencia extra: nombre del edificio, color del portón, piso/departamento o alguna particularidad.',
          'Si no tenés ninguna, respondé NO.',
        ],
        estado: 'REGISTER_ADDRESS_EXTRA',
      };
    }

    if (session.state === 'REGISTER_ADDRESS_EXTRA') {
      const extraRaw = (textoRaw || '').toString().trim().toLowerCase();
      const skip = [
        'no', 'n', 'nada', 'ninguna', 'ninguno', 'ninguna referencia',
        'no tengo', 'no hay', 'no tengo ninguna', 'no se', 'sin referencias',
        'ok', 'ya',
      ].includes(extraRaw);
      session.regExtra = skip ? null : (textoRaw || '').toString().trim();
      try {
        return await finishRegistration(session, telefono, {
          nombre: session.addressRef,
          direccion: session.addressRef,
          coords: session.pendingCoords,
        });
      } catch (err) {
        console.error('Error registrando cliente de WhatsApp:', err);
        return {
          respuestas: ['No pude registrarte, probá de nuevo en unos minutos.'],
          estado: 'REGISTER_ADDRESS_EXTRA',
        };
      }
    }

    if (session.state === 'REGISTER_ADDRESS') {
      // Acepta link de Google Maps, coordenadas sueltas o texto.
      const coords = await extractCoordsFromText(textoRaw);
      if (coords) {
        session.pendingCoords = coords;
        session.state = 'REGISTER_ADDRESS_REF';
        return {
          respuestas: ['Ubicación recibida! ¿Cómo llamamos a esta dirección? (ej: Sucursal Norte)'],
          estado: 'REGISTER_ADDRESS_REF',
        };
      }
      const direccion = (textoRaw || '').toString().trim();
      if (direccion.length < 5) {
        return {
          respuestas: ['Mandame tu ubicación, un link de Google Maps o tu dirección en texto (calle y número).'],
          estado: 'REGISTER_ADDRESS',
        };
      }
      try {
        return await finishRegistration(session, telefono, {
          nombre: 'Principal',
          direccion,
          coords: null,
        });
      } catch (err) {
        console.error('Error registrando cliente de WhatsApp:', err);
        return {
          respuestas: ['No pude registrarte, probá de nuevo en unos minutos.'],
          estado: 'REGISTER_ADDRESS',
        };
      }
    }

    if (session.state === 'REGISTER_NAME') {
      const nombre = (textoRaw || '').toString().trim();
      if (nombre.length < 2) {
        return {
          respuestas: ['Decime tu nombre, por favor.'],
          estado: 'REGISTER_NAME',
        };
      }
      session.regName = nombre;
      session.state = 'REGISTER_ADDRESS';
      return {
        respuestas: [
          `Hola ${nombre}! Pasame tu dirección de entrega: podés compartir tu ubicación, pegar un link de Google Maps o escribirla en texto (calle y número).`,
        ],
        estado: 'REGISTER_ADDRESS',
      };
    }

    session.state = 'REGISTER_NAME';
    return {
      respuestas: [
        'Hola! Soy el asistente de Blu Ice. Veo que tu número no está registrado.',
        '¿Cuál es tu nombre?',
      ],
      estado: 'REGISTER_NAME',
    };
  }

  // ---- Cliente registrado ----

  if (session.state === 'ADDRESS') {
    const n = parseInt(texto, 10);
    if (!Number.isInteger(n) || n < 1 || n > session.addresses.length) {
      return {
        respuestas: [
          `Elegí un número del 1 al ${session.addresses.length}.`,
          addressListText(session.addresses),
        ],
        estado: 'ADDRESS',
      };
    }
    session.address = session.addresses[n - 1];
    session.catalog = await loadCatalog();
    session.state = 'MENU';
    return {
      respuestas: [
        `Perfecto, enviamos a: ${addressLabel(session.address)}.`,
        catalogText(session.catalog),
      ],
      estado: 'MENU',
    };
  }

  if (session.state === 'IDLE' || isGreeting(texto)) {
    session.cart = [];
    session.pendingProduct = null;
    session.address = null;
    if (session.state === 'IDLE') {
      const next = await goToCatalog(session, client);
      return {
        respuestas: [`Hola ${client.nombre}! Soy el asistente de Blu Ice.`, ...next.respuestas],
        estado: next.estado,
      };
    }
    return goToCatalog(session, client);
  }

  if (session.state === 'MENU') {
    const n = parseInt(texto, 10);
    if (!Number.isInteger(n) || n < 1 || n > session.catalog.length) {
      return {
        respuestas: [
          `Elegí un número del 1 al ${session.catalog.length}.`,
          catalogText(session.catalog),
        ],
        estado: 'MENU',
      };
    }
    session.pendingProduct = session.catalog[n - 1];
    session.state = 'QTY';
    return {
      respuestas: [
        `Elegiste: ${session.pendingProduct.nombre} (${formatPrice(
          session.pendingProduct.precio
        )}). ¿Qué cantidad querés? (stock: ${session.pendingProduct.stock})`,
      ],
      estado: 'QTY',
    };
  }

  if (session.state === 'QTY') {
    const qty = parseInt(texto, 10);
    const product = session.pendingProduct;
    if (!Number.isInteger(qty) || qty <= 0) {
      return {
        respuestas: ['Ingresá una cantidad válida (número mayor a 0).'],
        estado: 'QTY',
      };
    }
    // Revalida stock por si cambió mientras tanto.
    const fresh = (await loadCatalog()).find((p) => p.id === product.id);
    if (!fresh || fresh.stock < qty) {
      session.pendingProduct = null;
      session.state = 'MENU';
      return {
        respuestas: [
          `Solo quedan ${fresh ? fresh.stock : 0} de ${product.nombre}. Elegí otro producto o cantidad.`,
          catalogText(session.catalog),
        ],
        estado: 'MENU',
      };
    }
    session.cart.push({ ...product, cantidad: qty });
    session.pendingProduct = null;
    session.state = 'MORE';
    return {
      respuestas: [
        `Agregado: ${qty}x ${product.nombre}. ¿Querés agregar otro producto? Respondé SI o NO.`,
      ],
      estado: 'MORE',
    };
  }

  if (session.state === 'MORE') {
    if (isYes(texto)) {
      session.catalog = await loadCatalog();
      session.state = 'MENU';
      return { respuestas: [catalogText(session.catalog)], estado: 'MENU' };
    }
    if (isNo(texto)) {
      if (!session.cart.length) {
        resetSession(telefono);
        return {
          respuestas: ['No hay nada en el pedido. Escribí HOLA para empezar.'],
          estado: 'IDLE',
        };
      }
      session.state = 'CONFIRM';
      return {
        respuestas: [summaryText(session.cart, session.address)],
        estado: 'CONFIRM',
      };
    }
    return {
      respuestas: ['Respondé SI para agregar otro producto o NO para ver el resumen.'],
      estado: 'MORE',
    };
  }

  if (session.state === 'CONFIRM') {
    if (isNo(texto)) {
      resetSession(telefono);
      return {
        respuestas: ['Pedido cancelado. Escribí HOLA cuando quieras pedir.'],
        estado: 'IDLE',
      };
    }
    if (!isYes(texto)) {
      return {
        respuestas: ['Respondé SI para confirmar el pedido o NO para cancelar.'],
        estado: 'CONFIRM',
      };
    }

    // Confirmado: crea el pedido con la misma lógica de la app.
    try {
      const addr = session.address || (await getAddresses(client.id))[0] || {};
      const infoExtra = addr.info_extra
        ? `Pedido por WhatsApp (bot) | ${addr.info_extra}`
        : 'Pedido por WhatsApp (bot)';
      const pedido = await Pedido.create({
        usuario_id: client.id,
        direccion_id: addr.id || null,
        direccion: addr.direccion || '',
        latitud: addr.latitud || null,
        longitud: addr.longitud || null,
        info_extra: infoExtra,
        estado: 'pendiente',
        productos: session.cart.map((item) => ({
          producto_id: item.id,
          cantidad: item.cantidad,
        })),
      });
      const total = cartTotal(session.cart);
      resetSession(telefono);
      return {
        respuestas: [
          `Listo ${client.nombre}! Tu pedido N° ${pedido.nro_pedido || pedido.id} fue registrado por ${formatPrice(total)}. Te avisaremos cuando esté en camino.`,
        ],
        estado: 'IDLE',
        pedido_id: pedido.id,
      };
    } catch (err) {
      if (err.code === 'STOCK_INSUFICIENTE') {
        session.catalog = await loadCatalog();
        session.cart = [];
        session.state = 'MENU';
        return {
          respuestas: [
            'Uy, se quedó sin stock uno de los productos mientras confirmabas. Armemos el pedido de nuevo:',
            catalogText(session.catalog),
          ],
          estado: 'MENU',
        };
      }
      console.error('Error creando pedido desde WhatsApp:', err);
      return {
        respuestas: [
          'Hubo un problema registrando tu pedido. Probá de nuevo en unos minutos o escribinos.',
        ],
        estado: 'CONFIRM',
      };
    }
  }

  resetSession(telefono);
  return {
    respuestas: ['Escribí HOLA para empezar tu pedido.'],
    estado: 'IDLE',
  };
}

module.exports = { handleIncoming, resetSession };
