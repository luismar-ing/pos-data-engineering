# Guía de specs (SDD)

## Qué es una spec aquí

Una spec es la fuente de verdad de **una funcionalidad**. El código implementa la spec; si el código y la spec difieren, se corrige uno de los dos de forma explícita (nunca se deja la diferencia).

Cada spec vive en su carpeta:

```
docs/specs/NNN-slug/
  spec.md    # QUÉ y POR QUÉ  (sin detalles de implementación)
  plan.md    # CÓMO           (diseño técnico, archivos, contratos, pruebas)
  tasks.md   # PASOS          (checklist ordenada y verificable)
```

Plantillas en [`_template/`](_template/).

## Ciclo de vida

```
Draft ──► Approved ──► In Progress ──► Done
  │                         │
  └──► Rejected             └──► Blocked (indicar motivo y de qué depende)
```

| Estado | Significa | Quién lo cambia |
|---|---|---|
| Draft | `spec.md` en redacción; puede tener preguntas abiertas | Autor |
| Approved | `spec.md` sin preguntas abiertas, `plan.md` y `tasks.md` revisados | Usuario |
| In Progress | Hay tareas en curso | Al empezar la 1.ª tarea |
| Blocked | No se puede avanzar | Cualquiera, con motivo |
| Done | Quality gates cumplidos (ver `CONSTITUTION.md`) | Usuario |
| Rejected | Se descarta; se deja la carpeta con el motivo | Usuario |

El estado se refleja en tres lugares: cabecera de `spec.md`, [`README.md`](README.md) de specs y `PROGRESS.md`.

## Paso a paso

### 1. Redactar `spec.md`
- Partir del problema del usuario, no de la solución.
- Escribir **historias de usuario** y **criterios de aceptación** verificables (formato Dado / Cuando / Entonces).
- Listar requisitos funcionales numerados (`RF-1`, `RF-2`…) y no funcionales (`RNF-1`…).
- Declarar explícitamente lo que queda **fuera de alcance**.
- Todo lo dudoso va a **Preguntas abiertas**. Una spec con preguntas abiertas no puede pasar a Approved.
- Prohibido en `spec.md`: nombres de archivos, librerías o SQL concreto (eso va en `plan.md`).

### 2. Redactar `plan.md`
- Cómo se cumple cada RF (tabla de trazabilidad RF → componente).
- Archivos a crear o modificar, por repo.
- Cambios de esquema (SQLite y/o Postgres) y su migración.
- Contratos HTTP nuevos o cambiados (y copiarlos a `ARCHITECTURE.md` al terminar).
- Estrategia de pruebas: qué se prueba automáticamente y qué a mano.
- Verificar contra `CONSTITUTION.md`; si algo choca, escribir un ADR primero.

### 3. Redactar `tasks.md`
- Tareas pequeñas (≤ ½ día), ordenadas, cada una con un resultado verificable.
- Prefijo por repo: `[app]`, `[backend]`, `[docs]`.
- Marcar dependencias: `(depende de T3)`.
- La última tarea siempre es cerrar la spec (docs + quality gates).

### 4. Implementar
- Una rama por spec: `spec/NNN-slug`.
- Marcar `[x]` en `tasks.md` al terminar cada tarea, en el mismo commit que el código.
- Si durante la implementación algo de la spec resulta incorrecto: **parar, corregir `spec.md`/`plan.md`, y anotarlo en la sección "Cambios" de la spec**.

### 5. Cerrar
- Verificar criterios de aceptación uno por uno.
- Actualizar `ARCHITECTURE.md` (contratos, modelo de datos), `PROGRESS.md`, `DEVLOG.md`, `TECH_DEBT.md`.
- Cambiar estado a Done.

## Cómo trabajar con Claude en este flujo

Prompts útiles:
- *"Redacta la spec.md de SPEC-005 siguiendo la guía; deja en Preguntas abiertas todo lo que no esté claro."*
- *"SPEC-005 spec aprobada. Genera plan.md y tasks.md."*
- *"Implementa las tareas T1–T3 de SPEC-005 y marca tasks.md."*
- *"Cierra SPEC-005: verifica criterios y actualiza PROGRESS, DEVLOG y ARCHITECTURE."*

## Numeración

- Specs: `SPEC-NNN`, carpeta `NNN-slug-en-kebab-case`. No se reutilizan números.
- Requisitos: `RF-n` / `RNF-n` dentro de cada spec; referencia externa `SPEC-005/RF-2`.
- Tareas: `T1`, `T2`… dentro de cada spec.
