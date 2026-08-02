from playwright.sync_api import sync_playwright
with sync_playwright() as p:
    b=p.chromium.launch(args=["--use-gl=angle","--use-angle=swiftshader","--enable-unsafe-swiftshader"])
    pg=b.new_page(viewport={"width":1200,"height":760})
    errs=[]
    pg.on("pageerror", lambda e: errs.append("PAGEERROR: "+str(e)))
    pg.on("console", lambda m: errs.append(m.type+": "+m.text) if m.type in ("error","warning") else None)
    pg.goto("http://127.0.0.1:8777/meet-the-processor/", wait_until="networkidle")
    pg.wait_for_function("window.__die !== undefined", timeout=90000)
    for t in [0.05,0.2,0.35,0.45,0.55,0.65,0.72,0.78,0.86,0.888,0.94,0.966,0.99]:
        pg.evaluate("(t)=>window.__die.seek(t)", t)
        pg.wait_for_timeout(400)
    pg.wait_for_timeout(1200)
    print("stages:", pg.evaluate("document.querySelector('.cap-of').textContent"))
    print("issues:", errs if errs else "none")
    b.close()
