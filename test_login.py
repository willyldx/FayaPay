import urllib.request
import json

BASE = "https://api-kadryza.spencerai.tech/v1"

def post(path, data, token=None):
    body = json.dumps(data).encode()
    headers = {"Content-Type": "application/json"}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    req = urllib.request.Request(BASE + path, data=body, headers=headers, method="POST")
    try:
        resp = urllib.request.urlopen(req)
        return resp.status, json.loads(resp.read())
    except urllib.error.HTTPError as e:
        return e.code, json.loads(e.read())

def get(path, token):
    headers = {"Authorization": f"Bearer {token}"}
    req = urllib.request.Request(BASE + path, headers=headers, method="GET")
    try:
        resp = urllib.request.urlopen(req)
        return resp.status, json.loads(resp.read())
    except urllib.error.HTTPError as e:
        return e.code, json.loads(e.read())

# Test login avec le compte créé (willyldx66@gmail.com)
print("=== Test LOGIN ===")
code, resp = post("/auth/login", {"email": "willyldx66@gmail.com", "password": "Spencer@66"})
print(f"Status: {code}")

if code == 200:
    token = resp.get("token")
    expires = resp.get("expires_at")
    merchant = resp.get("merchant", {})
    print(f"Token: {token[:40]}...")
    print(f"Expires: {expires}")
    print(f"Merchant: {merchant.get('name')} ({merchant.get('email')})")

    print("\n=== Test GET /auth/me avec token ===")
    code2, profile = get("/auth/me", token)
    print(f"Status: {code2}")
    print(f"Profile: {profile}")
else:
    print(f"Erreur: {resp}")
