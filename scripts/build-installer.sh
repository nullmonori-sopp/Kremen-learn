#!/usr/bin/env bash
# Build a native self-extracting, offline Linux installer.
set -euo pipefail
task_root=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)
payload_dir=${1:-}
output_file=${2:-"$task_root/artifacts/Kremen-Learn-0.1.0-linux-x86_64.run"}
task_temp=$(mktemp -d "${TMPDIR:-/tmp}/kremen-installer.XXXXXX")
trap 'rm -rf -- "$task_temp"' EXIT

if [[ -z "$payload_dir" ]]; then
  payload_dir="$task_temp/payload"
  mkdir -p -- "$payload_dir"
  app_binary="$task_root/src-tauri/target/release/kremen-learn"
  if [[ ! -x "$app_binary" ]]; then
    printf '%s\n' 'Build the desktop release first: npm run package' >&2
    exit 1
  fi
  cp -- "$app_binary" "$payload_dir/kremen-learn"
  cp -R -- "$task_root/src-tauri/resources/toolchain" "$payload_dir/toolchain"
  cp -R -- "$task_root/content" "$payload_dir/content"
  cp -- "$task_root/LICENSE" "$task_root/toolchain.lock.json" "$payload_dir/"
  cp -R -- "$task_root/src-tauri/resources/legal" "$payload_dir/legal"
  if [[ -f "$task_root/src-tauri/icons/icon.png" ]]; then
    cp -- "$task_root/src-tauri/icons/icon.png" "$payload_dir/icon.png"
  fi
fi

for task_required in kremen-learn toolchain/bin/kremen toolchain/runtime/kremen_rt.h content/catalog.json; do
  if [[ ! -f "$payload_dir/$task_required" ]]; then
    printf 'Payload is missing %s\n' "$task_required" >&2
    exit 1
  fi
done
if [[ ! -x "$payload_dir/kremen-learn" || ! -x "$payload_dir/toolchain/bin/kremen" ]]; then
  printf '%s\n' 'Application and compiler must be executable.' >&2
  exit 1
fi
# The native reader intentionally rejects symlinks and all special file types.
if [[ -n $(find "$payload_dir" ! -type f ! -type d -print -quit) ]]; then
  printf '%s\n' 'Installer payload can only contain regular files and directories.' >&2
  exit 1
fi
tar --format=ustar --sort=name --mtime=@0 --owner=0 --group=0 --numeric-owner \
  -cf "$task_temp/payload.tar" -C "$payload_dir" .
task_size=$(wc -c < "$task_temp/payload.tar")
task_digest=$(sha256sum "$task_temp/payload.tar")
task_digest=${task_digest%% *}
"${CXX:-g++}" -std=c++17 -O2 -Wall -Wextra -Wpedantic -Werror \
  "-DKREMEN_PAYLOAD_SIZE=$task_size" "-DKREMEN_PAYLOAD_SHA256=\"$task_digest\"" \
  "$task_root/installer/installer.cpp" -ldl -o "$task_temp/installer"
mkdir -p -- "$(dirname -- "$output_file")"
cat "$task_temp/installer" "$task_temp/payload.tar" > "$output_file"
chmod 0755 -- "$output_file"
"$output_file" --verify
(cd -- "$(dirname -- "$output_file")" && sha256sum -- "$(basename -- "$output_file")") > "$output_file.sha256"
printf '\nInstaller: %s\n' "$output_file"
