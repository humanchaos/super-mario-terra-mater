import express from "express";

const app = express();
const PORT = process.env.PORT || 3000;
const CATALOG = "https://catalog.maap.eo.esa.int/catalogue/";

app.use(express.json({ limit: "1mb" }));
app.use(
  express.static("public", {
    etag: false,
    maxAge: 0,
    setHeaders: (res) => {
      res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
      res.setHeader("Pragma", "no-cache");
      res.setHeader("Expires", "0");
    }
  })
);

app.get("/api/collections", async (req, res) => {
  try {
    const resp = await fetch(`${CATALOG}collections`, {
      headers: { accept: "application/json" }
    });
    if (!resp.ok) {
      res.status(resp.status).json({ error: "Failed to load collections" });
      return;
    }
    const data = await resp.json();
    const q = (req.query.q || "").toString().toLowerCase();
    if (!q) {
      res.json(data);
      return;
    }
    const filtered = {
      ...data,
      collections: (data.collections || []).filter((c) => {
        const hay = `${c.id} ${(c.title || "")} ${(c.description || "")}`.toLowerCase();
        return hay.includes(q);
      })
    };
    res.json(filtered);
  } catch (err) {
    res.status(500).json({ error: "Collections request failed" });
  }
});

app.get("/api/queryables/:collectionId", async (req, res) => {
  try {
    const { collectionId } = req.params;
    const resp = await fetch(`${CATALOG}collections/${collectionId}/queryables`, {
      headers: { accept: "application/json" }
    });
    if (!resp.ok) {
      res.status(resp.status).json({ error: "Failed to load queryables" });
      return;
    }
    const data = await resp.json();
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: "Queryables request failed" });
  }
});

app.post("/api/search", async (req, res) => {
  try {
    const body = req.body || {};
    const payload = {
      limit: Math.min(Number(body.limit || 50), 200)
    };
    if (Array.isArray(body.collections) && body.collections.length > 0) {
      payload.collections = body.collections;
    }
    if (typeof body.datetime === "string" && body.datetime.trim()) {
      payload.datetime = body.datetime.trim();
    }
    if (Array.isArray(body.bbox) && body.bbox.length === 4) {
      payload.bbox = body.bbox.map(Number);
    }
    if (typeof body.filter === "string" && body.filter.trim()) {
      payload.filter = body.filter.trim();
      payload.filter_lang = "cql2-text";
    }
    if (Array.isArray(body.sortby) && body.sortby.length > 0) {
      payload.sortby = body.sortby;
    }
    const resp = await fetch(`${CATALOG}search`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        accept: "application/json"
      },
      body: JSON.stringify(payload)
    });
    if (!resp.ok) {
      const text = await resp.text();
      res.status(resp.status).json({ error: "Search failed", detail: text });
      return;
    }
    const data = await resp.json();
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: "Search request failed" });
  }
});

app.listen(PORT, () => {
  console.log(`Super Mario Terra Mater running on http://localhost:${PORT}`);
});
