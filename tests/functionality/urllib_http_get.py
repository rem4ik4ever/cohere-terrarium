from pyodide.http import pyfetch

resp = await pyfetch("https://httpbin.org/get", method="GET")
data = await resp.bytes()
print("status:", resp.status)
print("length:", len(data))
assert resp.status == 200 and len(data) > 0

