import urllib.request
import json

url = "http://localhost:8000/api/v1/repos/analyze"
headers = {
    "Content-Type": "application/json",
    "X-API-Key": "dev-api-key-change-in-production"
}
data = {
    "repo_url": "https://github.com/KaranParmar19/Lantern.git",
    "branch": "main"
}

req = urllib.request.Request(
    url,
    data=json.dumps(data).encode("utf-8"),
    headers=headers,
    method="POST"
)

try:
    with urllib.request.urlopen(req) as res:
        print("STATUS CODE:", res.status)
        print("RESPONSE BODY:", res.read().decode("utf-8"))
except Exception as e:
    print("ERROR:", e)
    if hasattr(e, "read"):
        print("ERROR DETAILS:", e.read().decode("utf-8"))
