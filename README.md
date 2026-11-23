# 🎓 Student Assistance — Agentic AI with LangGraph (Conditional RAG Workflow)

A full-stack **MERN** application that uses **LangGraph.js** to build an intelligent, multi-agent student assistant with **Conditional Routing** and **Retrieval-Augmented Generation (RAG)** powered by **Google Gemini** and **MongoDB**.

The agent dynamically classifies every student query into one of three categories — **Academic**, **Fee**, or **General** — and routes it to the appropriate RAG pipeline that searches relevant PDF documents stored as vector embeddings in MongoDB.

---

## 🏗️ Architecture

```
                                 ┌── (academic) ──> [ Academic RAG Node ] ──┐
[ Student Query ] ──> [ Classifier Node ] ──┼── (fee)      ──> [ Fee RAG Node ]      ──┼──> [ Response Node ] ──> Answer
                                 └── (general)  ──> [ General Node ]       ──┘
```

### How It Works

1. **Classifier Node**: Sends the student's question to Gemini, which categorizes it as `academic`, `fee`, or `general`.
2. **Conditional Edge (`.addConditionalEdges`)**: LangGraph dynamically routes to **only one** specialized node based on the classification.
3. **RAG Nodes**: Embeds the query using `gemini-embedding-001`, performs cosine similarity search against PDF chunk vectors stored in MongoDB, and retrieves the top 3 most relevant passages.
4. **Response Node**: Combines the retrieved context with the student's programme and question, then prompts Gemini to generate a grounded, accurate answer.
5. **General Node**: Skips database retrieval entirely for greetings or casual conversation.

---

## 🧠 Tech Stack

| Layer | Technology |
| :--- | :--- |
| **Frontend** | React.js (Vite) |
| **Backend** | Node.js, Express.js |
| **AI Framework** | LangGraph.js (`@langchain/langgraph`) |
| **LLM** | Google Gemini 3.5 Flash (Free Tier) |
| **Embeddings** | Google `gemini-embedding-001` (3072-dim vectors) |
| **Vector Store** | MongoDB (local) — stores PDF chunks + vector embeddings |
| **Database** | MongoDB (Mongoose for app data) |
| **PDF Parsing** | `pdf-parse`, `pdf-lib` |

---

## 📁 Project Structure

```
├── backend/
│   ├── conditional workflow.js   # Main LangGraph Conditional RAG workflow
│   ├── process.js                # Sequential & Parallel workflow examples
│   ├── server.js                 # Express server with API routes
│   ├── generate_pdfs.js          # Script to generate sample PDF documents
│   ├── documents/
│   │   ├── academic_handbook.pdf # Multi-page academic rules & regulations
│   │   └── fee_structure.pdf     # Multi-page fee structure & scholarships
│   ├── package.json
│   └── .env                      # API keys (not committed)
│
├── frontend/
│   ├── src/
│   │   ├── App.jsx               # React chat UI with route badges & context viewer
│   │   ├── main.jsx              # React entry point
│   │   └── index.css             # Dark theme glassmorphic styles
│   ├── index.html
│   ├── vite.config.js            # Vite config with API proxy to backend
│   └── package.json
│
├── notes.js                      # Learning notes on LangGraph concepts
├── .gitignore
└── README.md
```

---

## 🚀 Getting Started

### Prerequisites

- **Node.js** v18+ installed
- **MongoDB** installed locally (Community Edition)
- **Gemini API Key** from [Google AI Studio](https://aistudio.google.com/app/apikey) (free, no credit card)

### 1. Clone the Repository

```bash
git clone https://github.com/ArchanaGupta2205/student-assistence-agentic-ai-with-langraph-conditional-workflow-.git
cd student-assistence-agentic-ai-with-langraph-conditional-workflow-
```

### 2. Setup Backend

```bash
cd backend
npm install
```

Create a `.env` file inside `backend/`:

```env
GEMINI_API_KEY=AIzaSy...your_api_key_here
MONGODB_URI=mongodb://127.0.0.1:27017/agentic_ai
PORT=5000
```

### 3. Start MongoDB

Make sure your local MongoDB service is running:

```bash
# Windows (run as Administrator)
net start MongoDB

# Or open services.msc → find "MongoDB Server" → Start
```

### 4. Generate Sample PDFs (if needed)

```bash
cd backend
node generate_pdfs.js
```

### 5. Setup Frontend

```bash
cd frontend
npm install
```

### 6. Run the Application

**Terminal 1 — Backend:**
```bash
cd backend
npm run dev
```

**Terminal 2 — Frontend:**
```bash
cd frontend
npm run dev
```

Open **http://localhost:5173** in your browser.

---

## ✨ Features

- **Dynamic Conditional Routing** — LangGraph classifies queries and routes to the correct RAG pipeline at runtime
- **Vector Embeddings in MongoDB** — PDF chunks stored with 3072-dimensional Gemini embeddings
- **Cosine Similarity Search** — Semantic search finds the most relevant document passages
- **Programme-Aware Responses** — Answers are customized based on the student's selected programme (BCA, BBA, B.Com, B.Tech)
- **Route Badges** — UI shows which path (Academic / Fee / General) each query took
- **Context Viewer** — Expandable accordion shows the exact grounded PDF context from MongoDB
- **Workflow Visualizer** — Live step indicator showing the active LangGraph node
- **Interactive CLI Mode** — Run `node "conditional workflow.js"` for a terminal-based chat

---

## 📊 Workflow Types Implemented

| Workflow | File | Description |
| :--- | :--- | :--- |
| **Sequential** | `process.js` | Editor → Scriptwriter → Translator (linear pipeline) |
| **Parallel** | `process.js` | 3 agents run simultaneously, results aggregated |
| **Conditional RAG** | `conditional workflow.js` | Dynamic routing based on AI classification + MongoDB vector search |

---

## 🔑 API Endpoints

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `POST` | `/api/student-assistant` | Main conditional RAG endpoint (programme, message) |
| `POST` | `/api/pipeline/sequential` | Sequential workflow (raw_input) |
| `POST` | `/api/pipeline/parallel` | Parallel workflow (raw_input) |

---

## 📄 Sample Queries to Test

| Query | Expected Route |
| :--- | :--- |
| *"What is the minimum attendance required for exams?"* | 🔵 Academic |
| *"How much is the tuition fee for BCA?"* | 🟢 Fee |
| *"What are the scholarship criteria?"* | 🟢 Fee |
| *"What is the passing CGPA for graduation?"* | 🔵 Academic |
| *"Hello, how are you?"* | 🟣 General |

---

## 🛠️ Built With

- [LangGraph.js](https://github.com/langchain-ai/langgraphjs) — Stateful multi-agent orchestration
- [Google Gemini](https://aistudio.google.com/) — LLM + Embedding model (free tier)
- [MongoDB](https://www.mongodb.com/) — Document + Vector storage
- [React](https://react.dev/) — Frontend UI
- [Express](https://expressjs.com/) — Backend API
- [pdf-lib](https://pdf-lib.js.org/) — PDF generation
- [pdf-parse](https://www.npmjs.com/package/pdf-parse) — PDF text extraction

---

## 👩‍💻 Author

**Archana Gupta**
- GitHub: [@ArchanaGupta2205](https://github.com/ArchanaGupta2205)
