#!/bin/sh
# Arbiter invariant suite — run from the repo root or tests/: sh tests/run_all.sh
cd "$(dirname "$0")"
fail=0
for f in *.cjs; do
  echo "== $f =="
  node "$f" || fail=1
done
[ $fail -eq 0 ] && echo "ALL SUITES GREEN" || echo "FAILURES PRESENT"
exit $fail
