import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import mongoose from "mongoose";
import { HumanMessage } from "@langchain/core/messages";

// Import compiled graphs from our workflows
import { conditionalRAGGraph, initRetrievers } from "./conditional workflow.js";
import { appGraph, appGraphParallel } from "./process.js";

dotenv.config();

const app = express();
app.use(cors({ origin: "http://localhost:5173" })); // Vite React frontend origin
app.use(express.json());

// Initialize MongoDB vector retrievers on server start
initRetrievers()
  .then(() => console.log("[RAG] Document Vector Retrievers initialized with MongoDB!"))
  .catch((err) => console.error("[RAG] Failed to initialize retrievers:", err.message));

// ==========================================
// 1. CONDITIONAL RAG ROUTE (College Assistant)
// ==========================================
app.post("/api/student-assistant", async (req, res) => {
  try {
    const { programme, message } = req.body;

    if (!message) {
      return res.status(400).json({ error: "message is required" });
    }

    console.log(`\n[API] Student Query: "${message}" | Programme: ${programme || "General"}`);

    const result = await conditionalRAGGraph.invoke({
      programme: programme || "Unknown",
      messages: [new HumanMessage(message)],
    });

    const lastMessage = result.messages[result.messages.length - 1];

    res.json({
      success: true,
      data: {
        programme: result.programme,
        query_type: result.query_type,
        retrieved_context: result.retrieved_context,
        reply: lastMessage.content,
      },
    });
  } catch (error) {
    console.error("Student Assistant error:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ==========================================
// 2. SEQUENTIAL PIPELINE ROUTE
// ==========================================
app.post("/api/pipeline/sequential", async (req, res) => {
  try {
    const { raw_input } = req.body;
    if (!raw_input) {
      return res.status(400).json({ error: "raw_input is required" });
    }

    const result = await appGraph.invoke({ raw_input });
    res.json({ success: true, data: result });
  } catch (error) {
    console.error("Sequential pipeline error:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ==========================================
// 3. PARALLEL PIPELINE ROUTE
// ==========================================
app.post("/api/pipeline/parallel", async (req, res) => {
  try {
    const { raw_input } = req.body;
    if (!raw_input) {
      return res.status(400).json({ error: "raw_input is required" });
    }

    const result = await appGraphParallel.invoke({ raw_input });
    res.json({ success: true, data: result });
  } catch (error) {
    console.error("Parallel pipeline error:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Connect Mongoose for app database
if (process.env.MONGODB_URI) {
  mongoose
    .connect(process.env.MONGODB_URI)
    .then(() => console.log("MongoDB Mongoose connected successfully!"))
    .catch((err) => console.error("MongoDB Connection Error:", err.message));
}

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Agent backend running on port ${PORT}`);
});
