from pyodide.http import pyfetch

resp = await pyfetch("https://httpbin.org/get", method="GET")
text = await resp.string()
print("status:", resp.status)
print("length:", len(text))
assert resp.status == 200 and len(text) > 0

