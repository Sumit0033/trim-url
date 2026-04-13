require("dotenv").config();

const express = require("express");
const path = require("path");
const crypto = require("crypto");
const {
  createLink,
  deleteLink,
  getAllLinks,
  getLinkByShortCode,
  incrementClicks,
  shortCodeExists,
} = require("./lib/database");

const app = express();
const port = Number(process.env.PORT || 3000);
const baseUrl = (process.env.BASE_URL || `http://localhost:${port}`).replace(/\/$/, "");

app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));

app.use(express.urlencoded({ extended: false }));
app.use(express.static(path.join(__dirname, "public")));

function normalizeUrl(input) {
  const trimmed = input.trim();
  if (!trimmed) {
    return null;
  }

  const hasProtocol = /^[a-zA-Z][a-zA-Z\d+\-.]*:\/\//.test(trimmed);
  const withProtocol = hasProtocol ? trimmed : `https://${trimmed}`;

  try {
    const parsed = new URL(withProtocol);
    const hostname = parsed.hostname.toLowerCase();

    if (parsed.protocol !== "https:") {
      return null;
    }

    if (!isAllowedHostname(hostname)) {
      return null;
    }

    return parsed.toString();
  } catch {
    return null;
  }
}

function isIpv4Address(hostname) {
  return /^\d{1,3}(\.\d{1,3}){3}$/.test(hostname);
}

function isPrivateIpv4(hostname) {
  const parts = hostname.split(".").map(Number);

  if (parts.some((part) => Number.isNaN(part) || part < 0 || part > 255)) {
    return true;
  }

  if (parts[0] === 10 || parts[0] === 127) {
    return true;
  }

  if (parts[0] === 169 && parts[1] === 254) {
    return true;
  }

  if (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) {
    return true;
  }

  if (parts[0] === 192 && parts[1] === 168) {
    return true;
  }

  return false;
}

function isAllowedHostname(hostname) {
  if (!hostname || hostname.length > 253) {
    return false;
  }

  if (hostname === "localhost" || hostname.endsWith(".localhost")) {
    return false;
  }

  if (hostname === "0.0.0.0") {
    return false;
  }

  if (hostname.includes(":")) {
    return false;
  }

  if (isIpv4Address(hostname)) {
    return !isPrivateIpv4(hostname);
  }

  if (!hostname.includes(".")) {
    return false;
  }

  const labels = hostname.split(".");

  return labels.every((label) => {
    if (!label || label.length > 63) {
      return false;
    }

    if (!/^[a-z0-9-]+$/i.test(label)) {
      return false;
    }

    return !label.startsWith("-") && !label.endsWith("-");
  });
}

async function generateShortCode() {
  for (let attempt = 0; attempt < 10; attempt += 1) {
    const shortCode = crypto.randomBytes(4).toString("base64url").slice(0, 6);

    if (!(await shortCodeExists(shortCode))) {
      return shortCode;
    }
  }

  throw new Error("Unable to generate a unique short code. Please try again.");
}

async function loadDashboardData() {
  const links = await getAllLinks();

  return links.map((link) => ({
    ...link,
    shortUrl: `${baseUrl}/${link.shortCode}`,
  }));
}

app.get("/", async (req, res, next) => {
  try {
    const links = await loadDashboardData();

    res.render("index", {
      baseUrl,
      createdLink: null,
      errorMessage: null,
      formValues: { originalUrl: "" },
      links,
    });
  } catch (error) {
    next(error);
  }
});

app.post("/shorten", async (req, res, next) => {
  const formValues = {
    originalUrl: req.body.originalUrl || "",
  };

  const normalizedUrl = normalizeUrl(formValues.originalUrl);

  try {
    if (!normalizedUrl) {
      const links = await loadDashboardData();
      return res.status(400).render("index", {
        baseUrl,
        createdLink: null,
        errorMessage: "Enter a valid public HTTPS URL. Local, private, malformed, and insecure destinations are not allowed.",
        formValues,
        links,
      });
    }

    const shortCode = await generateShortCode();
    const createdLink = await createLink({
      originalUrl: normalizedUrl,
      shortCode,
    });
    const links = await loadDashboardData();

    return res.status(201).render("index", {
      baseUrl,
      createdLink: {
        ...createdLink,
        shortUrl: `${baseUrl}/${createdLink.shortCode}`,
      },
      errorMessage: null,
      formValues: { originalUrl: "" },
      links,
    });
  } catch (error) {
    return next(error);
  }
});

app.post("/links/:id/delete", async (req, res, next) => {
  try {
    await deleteLink(Number(req.params.id));
    res.redirect("/");
  } catch (error) {
    next(error);
  }
});

app.get("/:shortCode", async (req, res, next) => {
  try {
    const link = await getLinkByShortCode(req.params.shortCode);

    if (!link) {
      return res.status(404).render("not-found", {
        attemptedCode: req.params.shortCode,
      });
    }

    await incrementClicks(link.id);
    return res.redirect(link.originalUrl);
  } catch (error) {
    return next(error);
  }
});

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).render("error", {
    message: "Something broke on the server. Please try again.",
  });
});

module.exports = app;
