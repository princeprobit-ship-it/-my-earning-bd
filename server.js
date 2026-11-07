const express = require("express");
const cors = require("cors");
const { createClient } = require("@supabase/supabase-js");
require("dotenv").config();

const app = express();

app.use(cors());
app.use(express.json());

// Supabase Connection
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Supabase Environment Variables Missing!");
  process.exit(1);
}

const supabase = createClient(
  supabaseUrl,
  supabaseKey
);

// নম্বর ফরম্যাট করার ফাংশন (+88 অটো যোগ করবে)
function formatPhoneNumber(phone) {
  if (!phone) return phone;
  let cleanPhone = phone.trim();
  if (!cleanPhone.startsWith("+")) {
    if (cleanPhone.startsWith("880")) {
      cleanPhone = "+" + cleanPhone;
    } else if (cleanPhone.startsWith("0")) {
      cleanPhone = "+88" + cleanPhone;
    } else {
      cleanPhone = "+880" + cleanPhone;
    }
  }
  return cleanPhone;
}

// Home Route
app.get("/", (req, res) => {
  res.send("Probit BD Backend is Running!");
});

// Health Check
app.get("/api/health", (req, res) => {
  res.json({
    status: "OK",
    project: "Probit BD"
  });
});

// Database Check
app.get("/api/db-check", async (req, res) => {
  try {
    const { data, error } = await supabase
      .from("profiles")
      .select("id")
      .limit(1);

    if (error) {
      return res.status(500).json({
        status: "FAILED",
        message: error.message
      });
    }

    res.json({
      status: "CONNECTED",
      database: "Supabase",
      project: "Probit BD"
    });

  } catch (error) {
    res.status(500).json({
      status: "ERROR",
      message: error.message
    });
  }
});

// ওটিপি পাঠানোর এপিআই (ফরম্যাটেড নম্বর সহ)
app.post("/api/send-otp", async (req, res) => {
  try {
    let { phone } = req.body;

    if (!phone) {
      return res.status(400).json({ error: "ফোন নম্বর দেওয়া বাধ্যতামূলক" });
    }

    const formattedPhone = formatPhoneNumber(phone);

    const { data, error } = await supabase.auth.signInWithOtp({
      phone: formattedPhone,
    });

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    res.json({ message: "ওটিপি সফলভাবে প্রসেস করা হয়েছে", data });

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ওটিপি ভেরিফাই করার এপিআই (ফরম্যাটেড নম্বর সহ)
app.post("/api/verify-otp", async (req, res) => {
  try {
    let { phone, token } = req.body;

    if (!phone || !token) {
      return res.status(400).json({ error: "নম্বর এবং ওটিপি উভয়ই প্রয়োজন" });
    }

    const formattedPhone = formatPhoneNumber(phone);

    const { data, error } = await supabase.auth.verifyOtp({
      phone: formattedPhone,
      token: token,
      type: "sms",
    });

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    res.json({ message: "লগইন সফল হয়েছে", session: data.session, user: data.user });

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Server Start
const PORT = process.env.PORT || 3000;

app.listen(PORT, "0.0.0.0", () => {
  console.log("Probit BD running on port " + PORT);
});
