-- schema.sql
-- Tabla de licitaciones publicas para el CRM industrial de Sigmart (Supabase).
-- Ejecutar en el SQL Editor del proyecto Supabase INDUSTRIAL (el mismo de Laura).

create table if not exists licitaciones_publicas (
  id bigint generated always as identity primary key,
  proceso_id bigint not null unique,           -- id de COMPRASAL (clave de dedup)
  codigo_proceso text not null,                -- ej. 3223-2026-P0032
  nombre_proceso text not null,
  institucion text,
  forma_contratacion text,                     -- Licitacion competitiva, Subasta Inversa, etc.
  estado_actual text,
  fecha_limite_ofertas timestamptz,            -- el dato critico para reaccionar
  tags_detectados text[],                      -- que palabra clave lo encontro
  relevante boolean not null default false,    -- veredicto de Claude
  division text,                               -- CALDERAS | LAVANDERIA | QUIMICOS_PLAGAS | OTRAS_OPORTUNIDADES
  prioridad text,                              -- alta | media | baja
  razon_clasificacion text,
  raw jsonb,                                   -- respuesta completa del API por si acaso
  -- Seguimiento comercial (lo llena el equipo humano)
  estado_seguimiento text not null default 'nueva',  -- nueva | en_revision | participando | descartada | ganada | perdida
  notas text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_licitaciones_relevante
  on licitaciones_publicas (relevante, prioridad)
  where relevante = true;

create index if not exists idx_licitaciones_fecha_limite
  on licitaciones_publicas (fecha_limite_ofertas)
  where relevante = true;

-- Trigger de updated_at (mismo patron que el resto del CRM)
create or replace function set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_licitaciones_updated_at on licitaciones_publicas;
create trigger trg_licitaciones_updated_at
  before update on licitaciones_publicas
  for each row execute function set_updated_at();

-- Vista: oportunidades activas ordenadas por urgencia
create or replace view v_licitaciones_activas as
select
  codigo_proceso,
  nombre_proceso,
  institucion,
  division,
  prioridad,
  forma_contratacion,
  fecha_limite_ofertas,
  estado_seguimiento,
  fecha_limite_ofertas - now() as tiempo_restante
from licitaciones_publicas
where relevante = true
  and estado_seguimiento not in ('descartada', 'ganada', 'perdida')
  and (fecha_limite_ofertas is null or fecha_limite_ofertas > now())
order by fecha_limite_ofertas asc nulls last;
