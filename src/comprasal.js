// src/comprasal.js
// Cliente del API publico de COMPRASAL (El Salvador)
// Endpoint verificado: /api/v1/publico/obtener/procesos/disponibles

const BASE_URL =
  'https://www.comprasal.gob.sv/api/v1/publico/obtener/procesos/disponibles';

// Palabras clave por division de Sigmart.
// El buscador de COMPRASAL filtra por coincidencia en el nombre del proceso.
const TAGS = [
  // Division industrial (HURST / CIB Unigas)
  'calderas',
  'caldera',
  'caldera de vapor',
  'calderas de vapor',
  'generador de vapor',
  'generadores de vapor',
  'quemador industrial',
  'quemadores industriales',
  'mantenimiento de calderas',
  'reparacion de calderas',
  'casa de maquinas',
  // Division lavanderia (Tecnitramo)
  'lavanderia industrial',
  'equipo de lavanderia',
  'lavadora industrial',
  'secadora industrial',
  'planchador industrial',
  // Division quimicos / plagas
  'fumigacion',
  'control de plagas',
  'manejo integrado de plagas',
  'equipos de fumigacion',
  'tratamiento de agua',
  'tratamiento de agua de calderas',
  'control de vectores',
];

const HEADERS = {
  Accept: 'application/json',
  'User-Agent':
    'SigmartGroup-Monitor/1.0 (monitoreo de convocatorias publicas; contacto: info@sigmartgroup.com)',
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function fetchTag(tag, page = 1, perPage = 50) {
  const url = new URL(BASE_URL);
  url.searchParams.append('tags[]', tag);
  url.searchParams.append('page', String(page));
  url.searchParams.append('per_page', String(perPage));

  const res = await fetch(url, { headers: HEADERS });
  if (!res.ok) {
    throw new Error(`COMPRASAL respondio ${res.status} para tag "${tag}"`);
  }
  const data = await res.json();
  // El API puede devolver un array directo o un objeto paginado { data: [...] }
  return Array.isArray(data) ? data : data.data || [];
}

/**
 * Consulta todos los tags y devuelve procesos unicos (deduplicados por id).
 * Pausa de 1.5s entre peticiones para no estresar el portal.
 */
async function fetchAllProcesos() {
  const map = new Map();
  const errores = [];

  for (const tag of TAGS) {
    try {
      const procesos = await fetchTag(tag);
      for (const p of procesos) {
        if (!map.has(p.id)) {
          map.set(p.id, { ...p, _tags: [tag] });
        } else {
          map.get(p.id)._tags.push(tag);
        }
      }
    } catch (err) {
      errores.push({ tag, error: err.message });
      console.error(`[comprasal] Error en tag "${tag}":`, err.message);
    }
    await sleep(1500);
  }

  return { procesos: [...map.values()], errores };
}

/**
 * Extrae la fecha limite de recepcion de ofertas (el dato critico).
 */
function fechaLimiteOfertas(proceso) {
  const etapas = proceso.etapas || [];
  const recepcion = etapas.find((e) =>
    /recepci[oó]n de ofertas/i.test(e.nombre || '')
  );
  return recepcion ? recepcion.fecha_hora_fin : null;
}

/**
 * Normaliza un proceso del API al formato que guardamos en Supabase.
 */
function normalizar(proceso) {
  return {
    proceso_id: proceso.id,
    codigo_proceso: proceso.codigo_proceso,
    nombre_proceso: proceso.nombre_proceso,
    institucion: proceso.institucion,
    forma_contratacion: proceso.forma_contratacion,
    estado_actual: proceso.estado_actual,
    estado_proceso: proceso.estado_proceso,
    fecha_limite_ofertas: fechaLimiteOfertas(proceso),
    tags_detectados: proceso._tags || [],
    actividades: (proceso.actividades || [])
      .map((a) => a.a && a.a.nombre)
      .filter(Boolean),
    raw: proceso,
  };
}

module.exports = { fetchAllProcesos, normalizar, TAGS };
