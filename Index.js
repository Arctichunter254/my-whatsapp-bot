const { default: makeWASocket, useMultiFileAuthState, DisconnectReason } = require("@whiskeysockets/baileys");
const pino = require("pino");
const express = require("express");
const app = express();
app.use(express.urlencoded({ extended: true }));

let sock = null;
let lastCode = "";

async function start(phone) {
  const { state, saveCreds } = await useMultiFileAuthState("auth");
  sock = makeWASocket({
    logger: pino({ level: "silent" }),
    printQRInTerminal: false,
    auth: state,
    browser: ["Bot", "Chrome", "1.0"]
  });
  sock.ev.on("creds.update", saveCreds);

  if (!sock.authState.creds.registered) {
    try {
      const code = await sock.requestPairingCode(phone);
      lastCode = code;
      console.log("PAIRING CODE:", code);
    } catch (e) {
      lastCode = "Failed: " + e.message;
    }
  }

  sock.ev.on("connection.update", (u) => {
    if (u.connection === "open") console.log("Bot Connected!");
    if (u.connection === "close") {
      const should = u.lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;
      if (should) start(phone);
    }
  });

  sock.ev.on("messages.upsert", async ({ messages }) => {
    const m = messages[0];
    if (!m.message || m.key.fromMe) return;
    const text = m.message.conversation || m.message.extendedTextMessage?.text || "";
    if (text.toLowerCase() === "hi" || text.toLowerCase() === "hello") {
      await sock.sendMessage(m.key.remoteJid, { text: "Hello! Bot is online ✅" });
    }
  });
}

app.get("/", (req, res) => {
  res.send(`<h2>Enter your WhatsApp number</h2>
  <form method="POST" action="/pair">
  <input name="phone" placeholder="254143084357" style="font-size:20px;padding:10px" />
  <button style="font-size:20px;padding:10px">Get Code</button>
  </form>
  <h1>${lastCode ? "CODE: " + lastCode : ""}</h1>`);
});

app.post("/pair", async (req, res) => {
  const phone = req.body.phone.replace(/\D/g, "");
  lastCode = "Wait 5 seconds...";
  start(phone);
  setTimeout(() => res.redirect("/"), 5000);
});

app.listen(10000, () => console.log("Server on 10000"));
