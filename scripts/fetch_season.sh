#!/usr/bin/env bash
# Download all "Гонщик года" race pages from timing.batyrshin.name for given championship filters.
# Usage: scripts/fetch_season.sh 16 14   (t=16 → ГГ2026 list, t=14 → ГГ2025 list)
set -euo pipefail
B=https://timing.batyrshin.name
mkdir -p data/heats
for t in "$@"; do
  curl -sS "$B/heats?t=$t" | grep -oE 'href="/tracks/[a-z]+/heats/[0-9]+"><strong[^>]*>(<i[^>]*></i>)?[^<]+' \
    | sed -E 's#href="/tracks/([a-z]+)/heats/([0-9]+)".*>([^>]+)$#\1\t\2\t\3#'
done | grep -i 'онщик' | sort -u > data/heats.tsv
while IFS=$'\t' read -r track id name; do
  f=data/heats/$track-$id.html
  [ -s "$f" ] || { curl -sS -o "$f" "$B/tracks/$track/heats/$id"; sleep 0.3; }
done < data/heats.tsv
echo "$(wc -l < data/heats.tsv) heats in data/heats"
