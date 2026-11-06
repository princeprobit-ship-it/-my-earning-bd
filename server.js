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

// Server Start
const PORT = process.env.PORT || 3000;

app.listen(PORT, "0.0.0.0", () => {
  console.log("Probit BD running on port " + PORT);
});