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

// ==========================================
// নতুন যুক্ত করা কোড: ওটিপি পাঠানোর এপিআই
// ==========================================
app.post("/api/send-otp", async (req, res) => {
  try {
    const { phone } = req.body; // ফ্রন্টএন্ড থেকে পাঠানো ফোন নম্বর

    if (!phone) {
      return res.status(400).json({ error: "ফোন নম্বর দেওয়া বাধ্যতামূলক" });
    }

    // Supabase দিয়ে ওটিপি পাঠানো (টেস্ট নম্বর হলে আসল SMS যাবে না)
    const { data, error } = await supabase.auth.signInWithOtp({
      phone: phone,
    });

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    res.json({ message: "ওটিপি সফলভাবে প্রসেস করা হয়েছে", data });

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ==========================================
// নতুন যুক্ত করা কোড: ওটিপি ভেরিফাই করার এপিআই
// ==========================================
app.post("/api/verify-otp", async (req, res) => {
  try {
    const { phone, token } = req.body; // ফ্রন্টএন্ড থেকে নম্বর এবং ওটিপি কোড

    if (!phone || !token) {
      return res.status(400).json({ error: "নম্বর এবং ওটিপি উভয়ই প্রয়োজন" });
    }

    // ওটিপি ভেরিফাই করা (লগইন বা রিসেট সেশন তৈরি হবে)
    const { data, error } = await supabase.auth.verifyOtp({
      phone: phone,
      token: token,
      type: "sms", // ফোন লগইনের জন্য টাইপ হবে sms
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
