#!/bin/sh
set -eu
root=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
make -C "$root/vendor/kremen"
mkdir -p "$root/src-tauri/resources/toolchain/bin" "$root/src-tauri/resources/toolchain/runtime"
cp "$root/vendor/kremen/build/kremen" "$root/src-tauri/resources/toolchain/bin/kremen"
cp "$root/vendor/kremen/runtime/kremen_rt.h" "$root/src-tauri/resources/toolchain/runtime/kremen_rt.h"
cp "$root/vendor/kremen/LICENSE" "$root/src-tauri/resources/toolchain/LICENSE"
"$root/src-tauri/resources/toolchain/bin/kremen" --version
