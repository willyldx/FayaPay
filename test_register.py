import urllib.request
import json
import time

# Use timestamp to ensure unique email
unique_email = f"test{int(time.time())}@kadryza.test"

data = json.dumps({
    "name": "TestMerchant",
    "email": unique_email,
    "password": "password123"
}).encode()

print(f"Testing with email: {unique_email}")

req = urllib.request.Request(
    "http://127.0.0.1:8080/v1/auth/register",
    data=data,
    headers={"Content-Type": "application/json"},
    method="POST"
)

try:
    resp = urllib.request.urlopen(req)
    print("SUCCESS:", resp.read().decode())
except urllib.error.HTTPError as e:
    print("ERROR", e.code, e.read().decode())
