# Luma Workspace

Aplicación de productividad construida con React y Vite. Incluye agenda semanal con bloques arrastrables, tareas, proyectos, editor de notas por bloques y espacios colaborativos sincronizados con Supabase.

## Colaboración

Cada usuario puede crear varios espacios o unirse mediante un enlace de invitación. El horario, los eventos, las tareas, los proyectos, las notas y las páginas se sincronizan en tiempo real. Los archivos se guardan en un bucket privado de Supabase Storage.

- Propietario: administra y edita el espacio.
- Editor: modifica contenido, crea invitaciones y gestiona archivos.
- Lector: consulta contenido y descarga archivos sin modificar datos.

## Desarrollo

```bash
pnpm install
pnpm dev
```

## Supabase

1. Crea o conecta un proyecto de Supabase.
2. Ejecuta, en orden, todas las migraciones de `supabase/migrations`.
3. Copia `.env.example` a `.env.local` y completa la URL del proyecto y la clave pública `anon`.
4. Añade la URL publicada de la aplicación a las URL permitidas de Supabase Auth.

Todas las tablas colaborativas y el almacenamiento utilizan Row Level Security para que cada usuario solo acceda a los espacios donde es miembro.

## Producción

```bash
pnpm build
```

El resultado se genera en `build/`.

## Despliegue

El proyecto está preparado para desplegarse en Vercel desde la rama `main`.
