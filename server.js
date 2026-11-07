const express = require("express");
const cors = require("cors");
const { rateLimit } = require("express-rate-limit");
const { createClient } = require("@supabase/supabase-js");
require("dotenv").config();

const {
  SUPABASE_URL,
  SUPABASE_ANON_KEY,
  SUPABASE_SERVICE_ROLE_KEY,
  FRONTEND_URL,
} = process.env;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error("Supabase Environment Variables Missing!");
  process.exit(1);
}

// সেশন সার্ভারে সংরক্ষণ হবে না, তাই এক ব্যবহারকারীর লগইন অন্যের কাজে মিশে যাবে না
const opts = {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
};
// ডেটাবেসের সব কাজ। এই key শুধু সার্ভারে থাকবে, ফ্রন্টএন্ডে কখনো যাবে না।
const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, opts);
// শুধু ওটিপি লগইনের জন্য
const supabaseAuth = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, opts);

const app = express();
app.set("trust proxy", 1); // Render-এর প্রক্সির পেছনে সঠিক IP পেতে

if (!FRONTEND_URL) {
  console.warn("FRONTEND_URL সেট করা নেই: সব ওয়েবসাইট থেকে অ্যাক্সেস খোলা আছে।");
}
app.use(
  cors({
    origin: FRONTEND_URL ? FRONTEND_URL.split(",").map((s) => s.trim()) : true,
  })
);
app.use(express.json({ limit: "20kb" }));

const limiter = (max) =>
  rateLimit({
    windowMs: 10 * 60 * 1000,
    limit: max,
    message: { error: "অনেকবার চেষ্টা হয়েছে, ১০ মিনিট পরে আবার চেষ্টা করুন।" },
  });

// নম্বর ফরম্যাট (+88 অটো যোগ করবে)
function formatPhoneNumber(phone) {
  if (!phone) return phone;
  let clean = String(phone).trim().replace(/[\s-]/g, "");
  if (!clean.startsWith("+")) {
    if (clean.startsWith("880")) clean = "+" + clean;
    else if (clean.startsWith("0")) clean = "+88" + clean;
    else clean = "+880" + clean;
  }
  return clean;
}
const BD_PHONE = /^\+8801[3-9]\d{8}$/;

// লগইন করা ব্যবহারকারী চেনা
async function requireUser(req, res, next) {
  try {
    const m = (req.headers.authorization || "").match(/^Bearer (.+)$/);
    if (!m) return res.status(401).json({ error: "আগে লগইন করুন" });
    const { data, error } = await supabaseAdmin.auth.getUser(m[1]);
    if (error || !data.user) {
      return res.status(401).json({ error: "সেশন শেষ, আবার লগইন করুন" });
    }
    req.user = data.user;
    next();
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "সার্ভারে সমস্যা হয়েছে" });
  }
}

// শুধু অ্যাডমিন (profiles টেবিলের role = 'admin')
async function requireAdmin(req, res, next) {
  const { data } = await supabaseAdmin
    .from("profiles")
    .select("role")
    .eq("id", req.user.id)
    .maybeSingle();
  if (!data || data.role !== "admin") {
    return res.status(403).json({ error: "এই কাজের অনুমতি নেই" });
  }
  next();
}

app.get("/", (req, res) => res.send("Probit BD Backend is Running!"));
app.get("/api/health", (req, res) => res.json({ status: "OK", project: "Probit BD" }));

// ডেটাবেস চেক: শুধু অ্যাডমিন দেখতে পারবে
app.get("/api/db-check", requireUser, requireAdmin, async (req, res) => {
  const { error } = await supabaseAdmin.from("profiles").select("id").limit(1);
  if (error) return res.status(500).json({ status: "FAILED", message: error.message });
  res.json({ status: "CONNECTED", database: "Supabase" });
});

// ওটিপি পাঠানো (শুধু বাংলাদেশি নম্বর, বারবার চেষ্টা সীমিত)
app.post("/api/send-otp", limiter(5), async (req, res) => {
  try {
    const phone = formatPhoneNumber(req.body.phone);
    if (!BD_PHONE.test(phone || "")) {
      return res.status(400).json({ error: "সঠিক বাংলাদেশি মোবাইল নম্বর দিন" });
    }
    const { error } = await supabaseAuth.auth.signInWithOtp({ phone });
    if (error) return res.status(400).json({ error: error.message });
    res.json({ message: "ওটিপি পাঠানো হয়েছে" });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "সার্ভারে সমস্যা হয়েছে" });
  }
});

// ওটিপি ভেরিফাই
app.post("/api/verify-otp", limiter(10), async (req, res) => {
  try {
    const phone = formatPhoneNumber(req.body.phone);
    const token = String(req.body.token || "").trim();
    if (!BD_PHONE.test(phone || "") || !token) {
      return res.status(400).json({ error: "নম্বর এবং ওটিপি উভয়ই প্রয়োজন" });
    }
    const { data, error } = await supabaseAuth.auth.verifyOtp({
      phone,
      token,
      type: "sms",
    });
    if (error) return res.status(400).json({ error: error.message });
    res.json({ message: "লগইন সফল হয়েছে", session: data.session, user: data.user });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "সার্ভারে সমস্যা হয়েছে" });
  }
});

// আমার তথ্য ও ভূমিকা (user বা admin)
app.get("/api/me", requireUser, async (req, res) => {
  const { data } = await supabaseAdmin
    .from("profiles")
    .select("*")
    .eq("id", req.user.id)
    .maybeSingle();
  res.json({ id: req.user.id, phone: req.user.phone, role: (data && data.role) || "user" });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, "0.0.0.0", () => console.log("Probit BD running on port " + PORT));