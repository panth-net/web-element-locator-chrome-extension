#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

VERSION="$(python3 - <<'PY'
import json
from pathlib import Path

print(json.loads(Path("manifest.json").read_text())["version"])
PY
)"

DIST_DIR="$ROOT/dist"
STAGE_DIR="$DIST_DIR/webstore-package"
ZIP_PATH="$DIST_DIR/web-element-locator-${VERSION}.zip"

rm -rf "$STAGE_DIR" "$ZIP_PATH"
mkdir -p "$STAGE_DIR/icons" "$DIST_DIR"

runtime_files=(
  manifest.json
  service_worker.js
  content.js
  popup.html
  popup.css
  popup.js
)

for file in "${runtime_files[@]}"; do
  cp "$file" "$STAGE_DIR/$file"
done

cp icons/icon16.png "$STAGE_DIR/icons/icon16.png"
cp icons/icon24.png "$STAGE_DIR/icons/icon24.png"
cp icons/icon32.png "$STAGE_DIR/icons/icon32.png"
cp icons/icon48.png "$STAGE_DIR/icons/icon48.png"
cp icons/icon128.png "$STAGE_DIR/icons/icon128.png"

python3 - <<'PY'
import json
import sys
from pathlib import Path

root = Path("dist/webstore-package")
manifest = json.loads((root / "manifest.json").read_text())

paths = [
    manifest["background"]["service_worker"],
    manifest["action"]["default_popup"],
]
paths.extend(manifest["icons"].values())
paths.extend(manifest["action"]["default_icon"].values())

missing = [path for path in paths if not (root / path).is_file()]
if missing:
    print("Missing manifest-referenced files:", ", ".join(missing), file=sys.stderr)
    sys.exit(1)

forbidden_names = {
    ".gitignore",
    "LICENSE",
    "README.md",
    "docs",
    "scripts",
    "tests",
}
included = {path.relative_to(root).parts[0] for path in root.rglob("*") if path.is_file()}
forbidden = sorted(included & forbidden_names)
if forbidden:
    print("Forbidden files included:", ", ".join(forbidden), file=sys.stderr)
    sys.exit(1)
PY

(
  cd "$STAGE_DIR"
  zip -qr -X "$ZIP_PATH" .
)

echo "Created $ZIP_PATH"
unzip -l "$ZIP_PATH"
