# Memoria de security-auditor

- El historial de auditorías vive en `references/security/audit-log.md`; esta memoria solo guarda excepciones y decisiones aceptadas.
- La línea base está en `specs/13-auth-registro-login.md`, `specs/14-security-hardening.md` y `references/security/security-checklist.md`.

## Excepciones aceptadas (no reportar como hallazgo)

- `auth_leaked_password_protection`: solo existe en plan Pro; el proyecto está en Free (comprobado 2026-11-24). Mitigación: longitud mínima 8 y regla de caracteres. Reportar solo si cambia el plan.
- Insert público de `scores` para invitados (`user_id is null`): decisión de SPEC 13, sin anti-trampas. No se exige cuenta para guardar puntuación.
- Usernames no únicos y sin tabla `profiles`: decisión de SPEC 13; `scores.user_id` identifica la cuenta.
- Sin CSP: con `cacheComponents` exige nonces y puede romper hidratación, Supabase u OAuth (SPEC 14).
- Sin CAPTCHA en el registro: solo el límite de Supabase (5 cada 5 minutos por IP, compartido con sign-ins).
- `Permissions-Policy` no incluye `gamepad` a propósito: los mandos lo necesitan.
