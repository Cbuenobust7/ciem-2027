#!/usr/bin/env bash
set -Eeuo pipefail

REMOTE_NAME="${REMOTE_NAME:-origin}"
BASE_BRANCH="${BASE_BRANCH:-main}"
DEPLOY_BRANCH="${DEPLOY_BRANCH:-ciem-pe-analitica-ciem}"
EXPECTED_ORIGIN="https://github.com/Cbuenobust7/ciem-2027.git"

die() {
    printf 'ERROR: %s\n' "$*" >&2
    exit 1
}

note() {
    printf '\n==> %s\n' "$*"
}

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(git -C "$SCRIPT_DIR/.." rev-parse --show-toplevel 2>/dev/null)" \
    || die "ejecuta este script desde un checkout Git del repositorio oficial"
cd "$REPO_ROOT"

[[ "$BASE_BRANCH" =~ ^[A-Za-z0-9][A-Za-z0-9._/-]*$ ]] \
    || die "BASE_BRANCH no es válido"
[[ "$DEPLOY_BRANCH" =~ ^[A-Za-z0-9][A-Za-z0-9._/-]*$ ]] \
    || die "DEPLOY_BRANCH no es válido"

for command_name in git node npm rsync sed grep tail awk cp chmod mktemp rmdir flock; do
    command -v "$command_name" >/dev/null || die "falta $command_name"
done
[[ "$EUID" -ne 0 ]] || die "ejecútalo como propietario de la aplicación, sin sudo"

ORIGIN_URL="$(git remote get-url "$REMOTE_NAME" 2>/dev/null)" \
    || die "no existe el remoto '$REMOTE_NAME'"
case "$ORIGIN_URL" in
    "$EXPECTED_ORIGIN"|"https://github.com/Cbuenobust7/ciem-2027" \
        |"git@github.com:Cbuenobust7/ciem-2027.git" \
        |"ssh://git@github.com/Cbuenobust7/ciem-2027.git")
        ;;
    *)
        die "el remoto '$REMOTE_NAME' no apunta a Cbuenobust7/ciem-2027"
        ;;
esac

CURRENT_BRANCH="$(git branch --show-current)"
[[ "$CURRENT_BRANCH" == "$BASE_BRANCH" || "$CURRENT_BRANCH" == "$DEPLOY_BRANCH" ]] \
    || die "branch actual '$CURRENT_BRANCH'; se requiere '$BASE_BRANCH' o '$DEPLOY_BRANCH'"
[[ -z "$(git status --porcelain --untracked-files=all)" ]] \
    || die "el checkout tiene cambios locales; guarda o limpia los cambios antes de continuar"

for git_state in MERGE_HEAD CHERRY_PICK_HEAD REVERT_HEAD rebase-apply rebase-merge; do
    [[ ! -e "$(git rev-parse --git-path "$git_state")" ]] \
        || die "hay una operación Git en curso: $git_state"
done

ENV_FILE="$REPO_ROOT/frontend/.env"
LIVE_DIST="$REPO_ROOT/frontend/dist"
[[ -f "$ENV_FILE" && ! -L "$ENV_FILE" ]] \
    || die "falta frontend/.env o no es un archivo regular"
[[ -d "$LIVE_DIST" && ! -L "$LIVE_DIST" && -s "$LIVE_DIST/index.html" ]] \
    || die "frontend/dist no existe o no contiene un index.html válido"

read_env_value() {
    sed -n "s/^$1=//p" "$ENV_FILE" | tail -n 1
}

GA_ID="${VITE_GA_MEASUREMENT_ID:-$(read_env_value VITE_GA_MEASUREMENT_ID)}"
CLARITY_ID="${VITE_CLARITY_PROJECT_ID:-$(read_env_value VITE_CLARITY_PROJECT_ID)}"

[[ "$GA_ID" =~ ^G-[A-Za-z0-9]+$ ]] \
    || die "configura un VITE_GA_MEASUREMENT_ID GA4 válido en el entorno o frontend/.env"
[[ -z "$CLARITY_ID" || "$CLARITY_ID" =~ ^[A-Za-z0-9]{10}$ ]] \
    || die "VITE_CLARITY_PROJECT_ID debe estar vacío o contener el ID real de 10 caracteres"

TEMP_ROOT="${TMPDIR:-/var/tmp}"
[[ -d "$TEMP_ROOT" && -w "$TEMP_ROOT" ]] \
    || die "TEMP_ROOT no existe o no es escribible: $TEMP_ROOT"

node -e 'const [a,b]=process.versions.node.split(".").map(Number);
         process.exit((a>22||(a===22&&b>=12)||(a===20&&b>=19))?0:1)' \
    || die "Node $(node -v) no cumple ^20.19.0 || >=22.12.0"

REMOTE_BASE_SHA="$(git ls-remote --heads "$REMOTE_NAME" "refs/heads/$BASE_BRANCH" | awk 'NR == 1 { print $1 }')" \
    || die "no se pudo consultar origin/$BASE_BRANCH"
REMOTE_DEPLOY_SHA="$(git ls-remote --heads "$REMOTE_NAME" "refs/heads/$DEPLOY_BRANCH" | awk 'NR == 1 { print $1 }')" \
    || die "no se pudo consultar origin/$DEPLOY_BRANCH"
[[ -n "$REMOTE_BASE_SHA" ]] || die "no existe origin/$BASE_BRANCH"
[[ -n "$REMOTE_DEPLOY_SHA" ]] || die "no existe origin/$DEPLOY_BRANCH; publica el branch antes de desplegar"

exec 9>"${TEMP_ROOT%/}/ciem-analytics-deploy.lock"
flock -n 9 || die "ya hay otro despliegue de analítica en curso"

note "Consultando las referencias publicadas"
git fetch --no-tags "$REMOTE_NAME" \
    "refs/heads/$BASE_BRANCH:refs/remotes/$REMOTE_NAME/$BASE_BRANCH" \
    "refs/heads/$DEPLOY_BRANCH:refs/remotes/$REMOTE_NAME/$DEPLOY_BRANCH"

BASE_SHA="$(git rev-parse "refs/remotes/$REMOTE_NAME/$BASE_BRANCH^{commit}")"
RELEASE_SHA="$(git rev-parse "refs/remotes/$REMOTE_NAME/$DEPLOY_BRANCH^{commit}")"
[[ "$BASE_SHA" == "$REMOTE_BASE_SHA" && "$RELEASE_SHA" == "$REMOTE_DEPLOY_SHA" ]] \
    || die "una rama remota cambió durante el preflight; vuelve a ejecutar"

if [[ "$CURRENT_BRANCH" == "$BASE_BRANCH" ]]; then
    [[ "$(git rev-parse HEAD)" == "$BASE_SHA" ]] \
        || die "HEAD no coincide con origin/$BASE_BRANCH; actualiza el checkout de producción primero"
else
    [[ "$(git rev-parse HEAD)" == "$RELEASE_SHA" ]] \
        || die "HEAD no coincide con origin/$DEPLOY_BRANCH; actualiza el checkout antes de continuar"
fi

git merge-base --is-ancestor "$BASE_SHA" "$RELEASE_SHA" \
    || die "el branch de despliegue no desciende del branch base; se rechaza el posible rollback"

for required_file in \
    frontend/src/lib/analytics.ts \
    frontend/src/components/Analytics.tsx \
    frontend/.env.example
do
    git cat-file -e "$RELEASE_SHA:$required_file" 2>/dev/null \
        || die "el commit publicado no contiene $required_file"
done

WORKTREE_DIR="$(mktemp -d "$TEMP_ROOT/ciem-analytics-worktree.XXXXXX")"
rmdir "$WORKTREE_DIR"

WORKTREE_ADDED=0
ROLLBACK_REQUIRED=0
BACKUP_DIR=""

finish() {
    local exit_code=$?
    trap - EXIT
    set +e

    if [[ "$exit_code" -ne 0 && "$ROLLBACK_REQUIRED" -eq 1 ]]; then
        printf '\nERROR: falló el despliegue; restaurando el frontend y frontend/.env\n' >&2
        cp -a "$BACKUP_DIR/frontend.env" "$ENV_FILE"
        local env_restore_code=$?
        rsync -a --delete "$BACKUP_DIR/dist/" "$LIVE_DIST/"
        local dist_restore_code=$?
        if [[ "$env_restore_code" -ne 0 || "$dist_restore_code" -ne 0 ]]; then
            printf 'ERROR: rollback incompleto. Conserva la copia en %s\n' "$BACKUP_DIR" >&2
        else
            printf 'Rollback automático completado. Copia conservada en %s\n' "$BACKUP_DIR" >&2
        fi
    fi

    if [[ "$WORKTREE_ADDED" -eq 1 ]]; then
        git -C "$REPO_ROOT" worktree remove --force "$WORKTREE_DIR" >/dev/null 2>&1
        if [[ "$?" -ne 0 ]]; then
            printf 'AVISO: elimina el worktree temporal manualmente: %s\n' "$WORKTREE_DIR" >&2
        fi
    fi

    if [[ "$exit_code" -ne 0 ]]; then
        printf 'Despliegue cancelado (código %s).\n' "$exit_code" >&2
    fi
    exit "$exit_code"
}
trap finish EXIT

note "Preparando build temporal desde $DEPLOY_BRANCH ($RELEASE_SHA)"
git worktree add --detach "$WORKTREE_DIR" "$RELEASE_SHA"
WORKTREE_ADDED=1
cp -a "$ENV_FILE" "$WORKTREE_DIR/frontend/.env"

upsert_analytics_id() {
    local file="$1"
    local key="$2"
    local value="$3"
    if grep -q "^${key}=" "$file"; then
        sed -i "s|^${key}=.*$|${key}=${value}|" "$file"
    else
        printf '%s=%s\n' "$key" "$value" >>"$file"
    fi
}

upsert_analytics_id "$WORKTREE_DIR/frontend/.env" VITE_GA_MEASUREMENT_ID "$GA_ID"
upsert_analytics_id "$WORKTREE_DIR/frontend/.env" VITE_CLARITY_PROJECT_ID "$CLARITY_ID"

(
    cd "$WORKTREE_DIR/frontend"
    npm ci --no-audit --no-fund
    VITE_GA_MEASUREMENT_ID="$GA_ID" \
        VITE_CLARITY_PROJECT_ID="$CLARITY_ID" \
        npm run build
)

STAGING_DIST="$WORKTREE_DIR/frontend/dist"
[[ -s "$STAGING_DIST/index.html" && -d "$STAGING_DIST/assets" ]] \
    || die "el build no produjo frontend/dist/index.html y assets"
grep -R -F -q -- "$GA_ID" "$STAGING_DIST/assets" \
    || die "el bundle no contiene el Measurement ID configurado"
if [[ -n "$CLARITY_ID" ]]; then
    grep -R -F -q -- "$CLARITY_ID" "$STAGING_DIST/assets" \
        || die "el bundle no contiene el Project ID configurado"
    grep -R -F -q -- "clarity.ms/tag/" "$STAGING_DIST/assets" \
        || die "el bundle no contiene el cargador de Clarity"
else
    note "Clarity queda desactivado: VITE_CLARITY_PROJECT_ID está vacío"
fi

BACKUP_DIR="$(mktemp -d "$TEMP_ROOT/ciem-analytics-backup.XXXXXX")"
chmod 700 "$BACKUP_DIR"
cp -a "$ENV_FILE" "$BACKUP_DIR/frontend.env"
cp -a "$LIVE_DIST" "$BACKUP_DIR/dist"
printf '%s\n' "$BASE_SHA" >"$BACKUP_DIR/base-commit"
printf '%s\n' "$RELEASE_SHA" >"$BACKUP_DIR/deployed-commit"

note "Publicando el build y actualizando IDs en frontend/.env"
ROLLBACK_REQUIRED=1
upsert_analytics_id "$ENV_FILE" VITE_GA_MEASUREMENT_ID "$GA_ID"
upsert_analytics_id "$ENV_FILE" VITE_CLARITY_PROJECT_ID "$CLARITY_ID"
rsync -a --delete "$STAGING_DIST/" "$LIVE_DIST/"

[[ -s "$LIVE_DIST/index.html" ]] || die "el index.html publicado está vacío"
grep -R -F -q -- "$GA_ID" "$LIVE_DIST/assets" \
    || die "el build publicado no contiene el Measurement ID configurado"
if [[ -n "$CLARITY_ID" ]]; then
    grep -R -F -q -- "$CLARITY_ID" "$LIVE_DIST/assets" \
        || die "el build publicado no contiene el Project ID configurado"
fi

ROLLBACK_REQUIRED=0
note "Despliegue completado. Backup: $BACKUP_DIR"
printf 'Rollback manual:\n'
printf '  rsync -a --delete %q %q\n' "$BACKUP_DIR/dist/" "$LIVE_DIST/"
printf '  cp -a %q %q\n' "$BACKUP_DIR/frontend.env" "$ENV_FILE"
printf 'No se cambió el branch del checkout ni se tocaron Nginx, Cloudflare o servicios del sistema.\n'
