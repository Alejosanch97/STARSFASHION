# ✦ Stars Fashion · Barbería VIP

Plataforma mobile-first para **barberos, dueño y clientes** de Stars Fashion.
React + Vite + Recharts en el front, **Google Apps Script + Google Sheets** como backend (sin CORS).

## Rutas
| Ruta | Quién | Qué |
|---|---|---|
| `/` | Equipo | Login (sin landing) |
| `/app` | Barberos | Próximo cliente, día, semana, avisos |
| `/app/agenda` | Barberos | Línea de tiempo por día + vista mes. Toca un hueco para agendar ahí |
| `/app/nueva` | Barberos | Agendar personalmente (clientes de WhatsApp) |
| `/app/analisis` | Barberos / Dueño | Ingresos, llave vs efectivo, top servicios, horas pico, **top 3 de la semana** |
| `/app/perfil` · `/app/horario` · `/app/bloqueos` | Barberos | Perfil (estrellas, descripción, foto), horario + **almuerzo flexible**, congelar horas |
| `/app/club` | Admin / Dueño | Tarjetas de sellos, entregar sorpresa |
| `/app/equipo` · `/app/servicios` | Dueño | Turnos de hoy y ocupación; precios y servicios |
| `/app/control` | Super admin | Crear barberos rápido, cuentas, ajustes del negocio |
| `/clientes` | Clientes | Linktree VIP: reservar, WhatsApp, ubicación, horario, barberos, servicios |
| `/clientes/reservar` · `/mis-citas` · `/club` | Clientes | Reserva en 4 pasos, reprogramar/cancelar + mensajes, tarjeta de 10 sellos |

## Roles (columna `Rol` en la hoja Users, se combinan con coma)
- `barber` — atiende y ve su agenda
- `admin` — barbero admin: además mueve/cancela citas de otros barberos
- `owner` — dueño: análisis económico de toda la barbería, top 3, equipo, servicios
- `superadmin` — control total (crear cuentas, ajustes, relay push)

## Puesta en marcha
1. **Modo demo** (solo para mostrar a otros negocios): `VITE_DEMO=true` en `.env` y sin `VITE_SCRIPT_URL`. En producción déjalo vacío.
2. **Backend real**: crea una Google Sheet → Extensiones → Apps Script → pega `backend/Code.gs` (y `appsscript.json`) → ejecuta `setupStars()` → (opcional) `seedDemoData()` → Implementar como Aplicación web (Ejecutar como: Yo · Acceso: Cualquier usuario).
3. Copia la URL `/exec` en `.env` → `VITE_SCRIPT_URL=...` (o en `src/config.js`).
4. Usuario inicial: `super@starsfashion.co` / `Stars2026*` (cámbialo en Users o desde la app).

## Cómo funciona lo importante
- **Disponibilidad**: `src/lib/slots.js` y `checkSlot_` en `Code.gs` son la misma lógica. El servidor revalida con `LockService` → nunca hay doble reserva.
- **Almuerzo flexible**: el barbero define ventana (ej. 12–3 pm) y duración (60 min). Los clientes pueden reservar dentro, pero siempre queda libre un hueco para almorzar.
- **Optimistic first**: todo se pinta al instante desde el cache del celular; el badge del encabezado muestra *Guardando… / Sincronizado / Sin señal · en cola*. Sin internet, los cambios quedan en una bandeja y se suben solos.
- **Sello automático**: cuando el barbero toca **Llegó · iniciar**, al terminar la hora del servicio un reloj (`tick`, cada 5 min) cierra la cita y pone el sello. Si cierra antes con *Finalizar y cobrar* (llave/efectivo + propina), el sello se pone en ese momento. En el sello 8 sale **SORPRESA**.
- **Notificaciones push**: `api/push.js` es una Vercel Function que firma y envía los push. Variables en Vercel: `VITE_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `PUSH_SECRET`. En la hoja Config: `Push_Relay_URL = https://TU-APP.vercel.app/api/push` y `Push_Relay_Secret = PUSH_SECRET`. Prueba con `testPush()` en Apps Script. En iPhone hay que abrir la app desde *Agregar a inicio*.
- **Correos (pendiente)**: `src/lib/email.js` ya llama a EmailJS; solo faltan las llaves en `.env`.

Hecho con ✦ por Nébula Estudio.
