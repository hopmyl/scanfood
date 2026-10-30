#!/usr/bin/env python3
"""Ставит секрет MIRROR_TOKEN в репо hopmyl/scanfood (нужен Actions-автодеплой зеркала).
Токен читается из git remote (не печатается). Шифрование: libsodium sealed box."""
import base64
import json
import re
import subprocess
import sys
import urllib.request
from nacl import encoding, public

REPO = "hopmyl/scanfood"
SECRET_NAME = "MIRROR_TOKEN"

def api(path: str, token: str, method: str = "GET", payload: dict | None = None):
    req = urllib.request.Request(
        f"https://api.github.com{path}",
        method=method,
        data=json.dumps(payload).encode() if payload is not None else None,
        headers={
            "Authorization": f"token {token}",
            "Accept": "application/vnd.github+json",
            "Content-Type": "application/json",
        },
    )
    try:
        with urllib.request.urlopen(req) as r:
            body = r.read().decode()
            return r.status, (json.loads(body) if body else {})
    except urllib.error.HTTPError as e:
        return e.code, json.loads(e.read().decode() or "{}")

url = subprocess.run(
    ["git", "remote", "get-url", "origin"], capture_output=True, text=True, cwd="/home/z/my-project"
).stdout.strip()
m = re.search(r"https://([^@]+)@", url)
if not m:
    sys.exit("токен не найден в remote")
token = m.group(1)

st, pk = api(f"/repos/{REPO}/actions/secrets/public-key", token)
if st != 200:
    sys.exit(f"public-key: {st} {pk}")
pk_obj = public.PublicKey(pk["key"].encode(), encoding.Base64Encoder())
sealed = public.SealedBox(pk_obj).encrypt(token.encode())

st, resp = api(
    f"/repos/{REPO}/actions/secrets/{SECRET_NAME}",
    token,
    method="PUT",
    payload={"encrypted_value": base64.b64encode(sealed).decode(), "key_id": pk["key_id"]},
)
print(f"PUT secret: HTTP {st}" if st in (201, 204) else f"PUT secret FAIL: {st} {resp}")

st, lst = api(f"/repos/{REPO}/actions/secrets", token)
names = [s["name"] for s in lst.get("secrets", [])]
print("секреты в репо:", names)
