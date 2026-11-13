import { Annotation, StateGraph, START, END } from "@langchain/langgraph";
import { HumanMessage, AIMessage } from "@langchain/core/messages";
import { ChatGoogleGenerativeAI, GoogleGenerativeAIEmbeddings } from "@langchain/google-genai";
import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";
import { PDFParse } from "pdf-parse";
import { MongoClient } from "mongodb";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import readline from "readline/promises";
import { stdin as input, stdout as output } from "process";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/* =========================================================================
   CONDITIONAL RAG WORKFLOW WITH MONGODB VECTOR STORAGE & EMBEDDINGS
   - 1. Embedding Model: GoogleGenerativeAIEmbeddings (text-embedding-004)
   - 2. Vector Storage: Stores chunks + 768-dim vector embeddings in MongoDB
   - 3. Semantic Vector Search: Cosine similarity search over MongoDB vectors
   - 4. Classifier Node: Dynamically routes to 'academic', 'fee', or 'general'
   - 5. Specialized RAG Nodes: Retrieves top-k semantically relevant chunks
   - 6. Response Node: Synthesizes final answer grounded in retrieved context
========================================================================= */

// 1. Initialize Gemini LLM & Vector Embeddings Model
const llm = new ChatGoogleGenerativeAI({
  model: "gemini-3.5-flash",
  apiKey: process.env.GEMINI_API_KEY,
  temperature: 0.2,
});

const embeddings = new GoogleGenerativeAIEmbeddings({
  model: "gemini-embedding-001",
  apiKey: process.env.GEMINI_API_KEY,
});

// 2. MongoDB Client Setup
const mongoUri = process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/agentic_ai";
const client = new MongoClient(mongoUri);

// Mathematical Cosine Similarity helper for Vector Search
function cosineSimilarity(vecA, vecB) {
  if (!vecA || !vecB || !Array.isArray(vecA) || !Array.isArray(vecB) || vecA.length === 0 || vecB.length === 0) return 0;
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < vecA.length; i++) {
    dotProduct += vecA[i] * (vecB[i] || 0);
    normA += vecA[i] * vecA[i];
    normB += (vecB[i] || 0) * (vecB[i] || 0);
  }
  if (normA === 0 || normB === 0) return 0;
  const result = dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
  return isNaN(result) ? 0 : result;
}

// Helper: Ingest PDF, compute Vector Embeddings, and save into MongoDB
async function buildMongoVectorRetriever(pdfPath, docType, db) {
  const collection = db.collection("college_vectors");

  // Check if vector embeddings already exist in MongoDB for this document
  const existingCount = await collection.countDocuments({ doc_type: docType });

  if (existingCount === 0) {
    console.log(`\n[Vector Store] Ingesting & Embedding: ${path.basename(pdfPath)}...`);

    // A. Parse text from PDF
    const parser = new PDFParse({ url: pdfPath });
    await parser.load();
    const pdfData = await parser.getText();

    // B. Chunk the text into passages
    const splitter = new RecursiveCharacterTextSplitter({
      chunkSize: 600,
      chunkOverlap: 80,
    });
    const chunks = await splitter.splitText(pdfData.text);

    console.log(`[Vector Store] Generating 768-dim embeddings for ${chunks.length} chunks via Gemini...`);
    console.log(chunks);
    
    // C. Generate Vector Embeddings for all chunks
    const chunkVectors = await embeddings.embedDocuments(chunks);

    // D. Store Chunk Text + Embedding Vector in MongoDB
    const docs = chunks.map((chunk, index) => ({
      doc_type: docType,
      chunk_index: index,
      text: chunk,
      embedding: chunkVectors[index], // Array of 768 numbers [0.012, -0.045, ...]
      source: path.basename(pdfPath),
      createdAt: new Date(),
    }));

    await collection.insertMany(docs);
    console.log(`[MongoDB] Stored ${docs.length} vectors for ${docType} in collection 'college_vectors'!`);
  } else {
    console.log(`[MongoDB] Found ${existingCount} cached vector embeddings for ${docType}`);
  }

  // Return Vector Retriever with Semantic Similarity Search
  return {
    invoke: async (query) => {
      console.log(`[Vector Search] Embedding query and searching MongoDB vectors for: "${query}"...`);

      // 1. Embed the incoming student query
      const queryVector = await embeddings.embedQuery(query);

      // 2. Fetch all document vectors of this type from MongoDB
      const storedDocs = await collection.find({ doc_type: docType }).toArray();

      // 3. Compute Cosine Similarity between Query Vector and each Document Vector
      const scoredDocs = storedDocs.map((doc) => ({
        text: doc.text,
        score: cosineSimilarity(queryVector, doc.embedding),
      }));

      // 4. Sort by highest similarity score (Top 3 most relevant chunks)
      scoredDocs.sort((a, b) => b.score - a.score);
      const topResults = scoredDocs.slice(0, 3);

      console.log(`[Vector Search] Top match similarity score: ${topResults[0]?.score.toFixed(4)}`);
      return topResults.map((r) => ({ pageContent: r.text }));
    },
  };
}

let academic_retriever;
let fee_retriever;

export async function initRetrievers() {
  if (!academic_retriever || !fee_retriever) {
    await client.connect();
    const db = client.db();

    const academicPdfPath = path.join(__dirname, "documents", "academic_handbook.pdf");
    const feePdfPath = path.join(__dirname, "documents", "fee_structure.pdf");

    academic_retriever = await buildMongoVectorRetriever(academicPdfPath, "academic", db);
    fee_retriever = await buildMongoVectorRetriever(feePdfPath, "fee", db);
  }
}

// --- Step 2: State Definition ---
export const State = Annotation.Root({
  programme: Annotation({
    default: () => "Unknown",
  }),
  messages: Annotation({
    reducer: (prev, next) => prev.concat(next),
    default: () => [],
  }),
  query_type: Annotation({
    default: () => "",
  }),
  retrieved_context: Annotation({
    default: () => "",
  }),
});

// --- Step 3: Nodes Generation ---

// Node A: Classifier Node
export async function classifier_node(state) {
  console.log("\n--- [Step 1] Executing Classifier Node ---");
  const last_message = state.messages[state.messages.length - 1].content;

  const prompt = `Classify the following student query into exactly one category: 'academic', 'fee', or 'general'.

Use 'academic' for questions about attendance, exams, grading, credits, promotion, course structure, summer training, or degree requirements.
Use 'fee' for questions about tuition, payment, refund, late charges, scholarships, or any money-related topic.
Use 'general' for greetings, casual talk, or anything not related to the college rules or fee.

Query: ${last_message}

Return only one word: academic, fee, or general.`;

  const response = await llm.invoke(prompt);
  let category = (typeof response.content === "string" ? response.content.trim() : response.content).toLowerCase();

  if (category.includes("academic")) {
    category = "academic";
  } else if (category.includes("fee")) {
    category = "fee";
  } else {
    category = "general";
  }

  console.log(`-> Classified as: [${category}]`);
  return { query_type: category };
}

// Node B: Academic Vector RAG Node
export async function academic_rag_node(state) {
  console.log("\n--- [Step 2A] Executing Academic Vector Search (MongoDB) ---");
  const query = state.messages[state.messages.length - 1].content;
  const docs = await academic_retriever.invoke(query);
  const context = docs.map((doc) => doc.pageContent).join("\n\n");
  return { retrieved_context: context };
}

// Node C: Fee Vector RAG Node
export async function fee_rag_node(state) {
  console.log("\n--- [Step 2B] Executing Fee Vector Search (MongoDB) ---");
  const query = state.messages[state.messages.length - 1].content;
  const docs = await fee_retriever.invoke(query);
  const context = docs.map((doc) => doc.pageContent).join("\n\n");
  return { retrieved_context: context };
}

// Node D: General Node
export async function general_node(state) {
  console.log("\n--- [Step 2C] Executing General Node (No Retrieval Needed) ---");
  return { retrieved_context: "NO_RETRIEVAL_NEEDED" };
}

// Node E: Response Generator Node
export async function response_node(state) {
  console.log("\n--- [Step 3] Executing Response Generator Node ---");
  const programme = state.programme || "Unknown";
  const context = state.retrieved_context;
  const query = state.messages[state.messages.length - 1].content;

  let prompt = "";
  if (context === "NO_RETRIEVAL_NEEDED") {
    prompt = `You are a friendly college assistant talking to a ${programme} student. Answer this question using your own general knowledge:\n\n${query}`;
  } else {
    prompt = `You are a college assistant helping a ${programme} student. Use the following context retrieved from the official college vector store in MongoDB to answer the question accurately. If the context mentions specific figures for different programmes, highlight the one relevant to ${programme} if possible.

Context:
${context}

Question: ${query}

Give a clear, friendly, and precise answer.`;
  }

  const response = await llm.invoke(prompt);
  const content = typeof response.content === "string" ? response.content.trim() : response.content;
  return { messages: [new AIMessage(content)] };
}

// --- Step 4: Build StateGraph with Conditional Edges ---
const workflow = new StateGraph(State)
  .addNode("classifier", classifier_node)
  .addNode("academic_rag", academic_rag_node)
  .addNode("fee_rag", fee_rag_node)
  .addNode("general", general_node)
  .addNode("response", response_node)

  .addEdge(START, "classifier")

  .addConditionalEdges("classifier", (state) => state.query_type, {
    academic: "academic_rag",
    fee: "fee_rag",
    general: "general",
  })

  .addEdge("academic_rag", "response")
  .addEdge("fee_rag", "response")
  .addEdge("general", "response")

  .addEdge("response", END);

export const conditionalRAGGraph = workflow.compile();

// --- Interactive Student Assistant Console Loop ---
async function runInteractiveAssistant() {
  await initRetrievers();

  const rl = readline.createInterface({ input, output });

  console.log("\n=========================================");
  console.log("welcome to the College assistant \n\n");
  console.log("which programe are you in ");
  console.log("1. BCA");
  console.log("2. BBA");
  console.log("3. B.com (H)");

  const choice = await rl.question("\nEnter 1, 2 or 3: ");

  const programme_map = {
    "1": "BCA",
    "2": "BBA",
    "3": "B.Com (H)",
  };

  const student_programme = programme_map[choice.trim()] || "BCA";

  console.log(`\nGreat! You're set as a ${student_programme} student.`);
  console.log("Ask any question regarding academics, attendance, exams, or fees.\nType 'exit' or 'quit' to end the chat.\n");

  while (true) {
    const user_query = await rl.question("You: ");

    if (["exit", "quit"].includes(user_query.trim().toLowerCase())) {
      console.log("\nGoodbye! Have a great day.");
      break;
    }

    if (!user_query.trim()) continue;

    try {
      const result = await conditionalRAGGraph.invoke({
        programme: student_programme,
        messages: [new HumanMessage(user_query)],
      });

      const reply = result.messages[result.messages.length - 1].content;
      console.log(`\nAssistant : ${reply}\n`);
    } catch (err) {
      console.error("\nError generating response:", err.message, "\n");
    }
  }

  rl.close();
}

if (process.argv[1] && process.argv[1].endsWith("conditional workflow.js")) {
  runInteractiveAssistant().catch((err) => console.error("Pipeline Error:", err));
}
