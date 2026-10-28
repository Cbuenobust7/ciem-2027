# Renombrado del árbol raíz a `masterclean-connect`

> **Documento interno de operación.** No forma parte del índice ni del ZIP de
> compradores (misma regla que `MIGRACION-SERVIDOR.md` y el plan técnico).
>
> **Estado: runbook sin ejecutar.** Escrito el 2026-10-10 verificando cada
> consumidor por inspección directa del servidor.

## 1. Objetivo y estrategia

Renombrar `/home/carlos/marketplace-starter` a `/home/carlos/masterclean-connect`
**sin caída de servicio**, dejando un **symlink puente** con el nombre antiguo
mientras se actualizan los consumidores y retirándolo al final.

Es viable sin ventana porque el `mv` es un renombrado dentro del mismo sistema de
archivos (`/dev/mapper/ubuntu--vg-ubuntu--lv`), es decir instantáneo y sin copia
de datos. Con el symlink en su sitio, nginx, systemd, el bind mount y la GUI
siguen resolviendo la ruta antigua desde el primer segundo.

## 2. Inventario de consumidores (verificado)

### 2.1 systemd — 9 líneas en 4 unidades

| Unidad | Líneas con la ruta | Usuario | Qué hace |
|---|---|---|---|
| `mastercleanconnect.service` | 3 (`Documentation`, `WorkingDirectory`, `ExecStart`) | `agenteai` | **Producción**: gunicorn en `127.0.0.1:8017` |
| `dshweb.service` | 2 (`WorkingDirectory`, `ExecStart`) | `agenteai` | `manage.py runserver 0.0.0.0:8098` |
| `dshweb-agente.service` | 2 (`WorkingDirectory`, `ExecStart`) | `agenteai` | `dsh web --port 3080` |
| `code-server-agente2.service` | 2 (`WorkingDirectory`, `ExecStart`) | `agente2` | code-server con la carpeta del proyecto |

### 2.2 nginx — 9 líneas en 3 archivos

| Archivo | Contenido |
|---|---|
| `sites-available/marketplace` (habilitado) | `root` + 2 `alias` (`staticfiles`, `media`) |
| `sites-available/mastercleanconnect.ciem.pe` (habilitado) | `root` + 2 `alias` |
| `sites-available/mastercleanconnect.ciem.pe.bak` | copia de trabajo, no servida |

### 2.3 Bind mounts — 3 puntos, **solo 1 persistente**

| Punto de montaje | Origen | ¿Persistente? |
|---|---|---|
| `/srv/sftp-agenteai/marketplace-starter` | `/home/carlos/marketplace-starter` | **Sí** (`/etc/fstab:16`) |
| `/srv/sftp-agente/marketplace` | `/home/carlos/marketplace-starter` | **No** (montaje manual) |
| `/srv/chroot-agenteai/marketplace` | `/home/carlos/marketplace-starter` | **No** (montaje manual) |

Los dos no persistentes desaparecen al reiniciar: si deben sobrevivir, hay que
añadirlos a `/etc/fstab` en la Fase 4.

### 2.4 GUI DSH

`/home/agenteai/.dsh/storages/workspace.json` guarda el workspace «marketplace»
con `path: /home/carlos/marketplace-starter`. Es el único consumidor que **puedo
actualizar sin root**.

### 2.5 Dentro del proyecto — 180 archivos

La mayoría son documentación y guiones (`docs/`, `deploy/`, `HANDOFF.md`,
`MIGRACION-SERVIDOR.md`). Se actualizan en la Fase 6 con un `sed` acotado.

## 3. Trampas conocidas (leer antes de ejecutar)

1. **El nombre en el frontend NO es una ruta.** Son dos claves de
   `localStorage` de Zustand:
   - `frontend/src/stores/auth.ts:59` → `name: 'marketplace-starter-auth'`
   - `frontend/src/stores/providerAccount.ts:24` → `name: 'marketplace-starter-provider'`

   **No se tocan en el renombrado.** Son identificadores internos invisibles para
   el usuario, y cambiarlos **cerraría la sesión de todos los usuarios** (su
   token guardado quedaría en una clave que la app ya no lee). Si algún día se
   renombran, debe ser un cambio versionado y asumiendo ese cierre de sesión
   global.
2. **`ciem-marketplace-starter-demo` NO se toca.** El `sed` del nombre es
   peligroso: la cadena `marketplace-starter` es subcadena de
   `ciem-marketplace-starter-demo`, que es el árbol del demo (`demo.ciem.pe`,
   `marketplace-starter-demo.service`). Los `sed` de este runbook usan la ruta
   completa, nunca el nombre suelto.
3. **`marketplace.ciem.pe` es de otro proyecto** (`ciem-creatorhub`, puerto
   8079). No aparece en este runbook.
4. **`package-lock.json`** contiene la cadena; es cosmético y no rompe nada.
5. **`rm` sobre el symlink borra el enlace, no el destino.** Aun así, en la Fase
   7 se verifica con `ls -ld` antes de dar nada por hecho.

## 4. Procedimiento

### Fase 0 — Preflight (sin cambios)

```bash
cd /home/carlos/marketplace-starter
git status --short --branch      # debe estar limpio y sincronizado con origin/main
git log --oneline -1

# Respaldo de TODO lo que se va a modificar
sudo tar czf /root/rename-masterclean-$(date +%F).tgz \
  /etc/fstab \
  /etc/nginx/sites-available/marketplace \
  /etc/nginx/sites-available/mastercleanconnect.ciem.pe \
  /etc/systemd/system/mastercleanconnect.service \
  /etc/systemd/system/dshweb.service \
  /etc/systemd/system/dshweb-agente.service \
  /etc/systemd/system/code-server-agente2.service

# Respaldo lógico de la base (independiente del renombrado)
sudo -u postgres pg_dump marketplace_starter | gzip > /root/marketplace_starter-$(date +%F).sql.gz
```

### Fase 1 — Mover y poner el puente (instantáneo)

```bash
cd /home/carlos
sudo mv marketplace-starter masterclean-connect
sudo ln -s masterclean-connect marketplace-starter      # puente temporal
ls -ld marketplace-starter masterclean-connect
```

A partir de aquí todo sigue funcionando por el enlace. **No hay caída.**

### Fase 2 — nginx (canónico)

```bash
sudo sed -i 's|/home/carlos/marketplace-starter|/home/carlos/masterclean-connect|g' \
  /etc/nginx/sites-available/marketplace \
  /etc/nginx/sites-available/mastercleanconnect.ciem.pe
sudo nginx -t && sudo systemctl reload nginx

curl -s -o /dev/null -w '%{http_code}\n' -H 'Host: mastercleanconnect.ciem.pe' http://127.0.0.1/
```

### Fase 3 — systemd

```bash
for u in mastercleanconnect.service dshweb.service dshweb-agente.service code-server-agente2.service; do
  sudo sed -i 's|/home/carlos/marketplace-starter|/home/carlos/masterclean-connect|g' \
    "/etc/systemd/system/$u"
done
sudo systemctl daemon-reload
sudo systemctl restart mastercleanconnect.service dshweb.service dshweb-agente.service
sudo systemctl restart code-server-agente2.service
systemctl is-active mastercleanconnect.service dshweb.service dshweb-agente.service code-server-agente2.service
```

### Fase 4 — Bind mounts

```bash
# El persistente: actualizar fstab y remontar
sudo sed -i 's|^/home/carlos/marketplace-starter |/home/carlos/masterclean-connect |' /etc/fstab
grep marketplace /etc/fstab
sudo systemctl daemon-reload
sudo umount /srv/sftp-agenteai/marketplace-starter
sudo mount /srv/sftp-agenteai/marketplace-starter

# Los dos manuales: desmontar y volver a montar desde el origen nuevo
sudo umount /srv/sftp-agente/marketplace /srv/chroot-agenteai/marketplace
sudo mount --bind /home/carlos/masterclean-connect /srv/sftp-agente/marketplace
sudo mount --bind /home/carlos/masterclean-connect /srv/chroot-agenteai/marketplace

findmnt -o TARGET,SOURCE | grep -E 'sftp|chroot'
```

Si los dos manuales deben persistir tras un reinicio, añade a `/etc/fstab`:

```fstab
/home/carlos/masterclean-connect /srv/sftp-agente/marketplace        none bind 0 0
/home/carlos/masterclean-connect /srv/chroot-agenteai/marketplace    none bind 0 0
```

### Fase 5 — GUI DSH (sin root)

```bash
python3 - <<'PY'
import json, pathlib
p = pathlib.Path.home() / '.dsh/storages/workspace.json'
d = json.loads(p.read_text())
for w in d['tables']['workspaces'].values():
    if w['path'] == '/home/carlos/marketplace-starter':
        w['path'] = '/home/carlos/masterclean-connect'
p.write_text(json.dumps(d, indent=2, ensure_ascii=False))
print('workspace.json actualizado')
PY
```

### Fase 6 — Referencias dentro del proyecto

```bash
cd /home/carlos/masterclean-connect
grep -rl '/home/carlos/marketplace-starter' \
  --include='*.md' --include='*.sh' --include='*.service' --include='*.conf' --include='*.example' . \
  | grep -v node_modules | grep -v '/venv/' | grep -v '/dist/'
# Revisar la lista y aplicar el reemplazo solo a esos archivos:
#   sed -i 's|/home/carlos/marketplace-starter|/home/carlos/masterclean-connect|g' <archivos>
```

**No incluir** `frontend/src/stores/auth.ts` ni `providerAccount.ts` (§3.1).

### Fase 7 — Retirar el puente (solo tras verificar)

```bash
ls -ld /home/carlos/marketplace-starter          # debe ser un symlink
sudo rm /home/carlos/marketplace-starter         # borra el enlace, NO el destino
ls -ld /home/carlos/marketplace-starter 2>&1     # "No such file or directory"
ls -ld /home/carlos/masterclean-connect          # el árbol sigue ahí
```

## 5. Verificación final

```bash
systemctl is-active mastercleanconnect.service
curl -s -o /dev/null -w '%{http_code}\n' -H 'Host: mastercleanconnect.ciem.pe' http://127.0.0.1/
curl -s -o /dev/null -w '%{http_code}\n' -H 'Host: mastercleanconnect.ciem.pe' http://127.0.0.1/api/listings/
curl -s -o /dev/null -w '%{http_code}\n' -H 'Host: mastercleanconnect.ciem.pe' http://127.0.0.1/admin/login/
curl -s -o /dev/null -w '%{http_code}\n' https://mastercleanconnect.ciem.pe/
findmnt -o TARGET,SOURCE | grep -E 'sftp|chroot'
git -C /home/carlos/masterclean-connect status --short --branch
```

Esperado: servicio `active`; `/`, `/api/listings/` y `/admin/login/` en **200**;
los tres bind mounts apuntando a `masterclean-connect`; árbol limpio y
sincronizado. Y en el navegador, la GUI debe abrir el workspace sin errores.

## 6. Rollback

```bash
sudo rm /home/carlos/marketplace-starter              # el symlink, si existe
sudo mv /home/carlos/masterclean-connect /home/carlos/marketplace-starter
sudo tar xzf /root/rename-masterclean-<fecha>.tgz -C /    # restaura nginx, systemd y fstab
sudo systemctl daemon-reload
sudo systemctl restart mastercleanconnect.service dshweb.service dshweb-agente.service
sudo systemctl reload nginx
```

## 7. Riesgos

| Riesgo | Mitigación |
|---|---|
| Reinicio del servidor entre la Fase 1 y la 4 | El symlink deja las rutas antiguas resolviendo; el `mv` ya está hecho y es coherente |
| Olvidar el bind mount persistente | La Fase 4 lo actualiza en `/etc/fstab`; verificar con `findmnt` |
| `sed` que toque `ciem-marketplace-starter-demo` | Todos los `sed` usan la ruta completa, nunca el nombre suelto |
| Cierre de sesión masivo | No se renombran las claves de `localStorage` (§3.1) |
| Otro agente con el `cwd` dentro del árbol | El symlink mantiene la ruta válida; su `cwd` real pasa a `masterclean-connect` |
