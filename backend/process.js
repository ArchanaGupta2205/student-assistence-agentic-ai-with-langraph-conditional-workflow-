import { Annotation, StateGraph, START, END } from "@langchain/langgraph";
import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import dotenv from "dotenv";

dotenv.config();

// Initialize the shared Gemini Model
const llm = new ChatGoogleGenerativeAI({
  model: "gemini-3.5-flash",
  apiKey: process.env.GEMINI_API_KEY,
  temperature: 0.2,
});

/* =========================================================================
   1. SEQUENTIAL WORKFLOW (Editor -> Scriptwriter -> Translator)
========================================================================= */



/* export const AgentState = new StateSchema({
  userMessage: z.string().default(""),
  aiResponse: z.string().default(""),
  task: z.string().default(""),
  isCompleted: z.boolean().default(false),
}); */

// 1. Pipeline State Definition (Stores data as it passes through each stage)
export const PipelineState = Annotation.Root({
  raw_input: Annotation({ default: () => "" }),
  edited_text: Annotation({ default: () => "" }),
  script_text: Annotation({ default: () => "" }),
  final_output: Annotation({ default: () => "" }),
});

export const editor_node = async (state) => {
  console.log("\n--- [Sequential Stage 1] Executing Editor Node ---");
  const prompt = `You are an expert copyeditor. Clean up the following raw text. Fix any grammatical errors, spelling mistakes, and smooth out the transition flow, while keeping the core message intact. Return only the edited text.\n\nRaw Text:\n${state.raw_input}`;
  const response = await llm.invoke(prompt);
  const content = typeof response.content === "string" ? response.content.trim() : response.content;
  return { edited_text: content };
};

export const scriptwriter_node = async (state) => {
  console.log("\n--- [Sequential Stage 2] Executing Scriptwriter Node ---");
  const prompt = `You are a charismatic YouTube content creator. Take this edited text and transform it into a highly engaging, punchy, conversational video script hook. Make it sound like a real person speaking passionately. Return only the script content.\n\nEdited Text:\n${state.edited_text}`;
  const response = await llm.invoke(prompt);
  const content = typeof response.content === "string" ? response.content.trim() : response.content;
  return { script_text: content };
};

export const translator_node = async (state) => {
  console.log("\n--- [Sequential Stage 3] Executing Hinglish Translator Node ---");
  const prompt = `You are an expert content localizer for the Indian market. Take the following script and convert it into natural, flowing 'Hinglish'. Do not simply translate it sentence-by-sentence or repeat information. Alternating comfortably between Hindi and English phrases just like an intellectual tech educator would speak naturally on a live stream. Keep the energy high. Return only the final Hinglish text.\n\nScript:\n${state.script_text}`;
  const response = await llm.invoke(prompt);
  const content = typeof response.content === "string" ? response.content.trim() : response.content;
  return { final_output: content };
};

const seqWorkflow = new StateGraph(PipelineState)
  .addNode("editor", editor_node)
  .addNode("scriptwriter", scriptwriter_node)
  .addNode("translator", translator_node)
  .addEdge(START, "editor")
  .addEdge("editor", "scriptwriter")
  .addEdge("scriptwriter", "translator")
  .addEdge("translator", END);

export const appGraph = seqWorkflow.compile();

/* =========================================================================
   2. PARALLEL WORKFLOW (Editor, Scriptwriter, Translator run in parallel -> Aggregator)
========================================================================= */

export const ParallelState = Annotation.Root({
  raw_input: Annotation({ default: () => "" }),
  editor_output: Annotation({ default: () => "" }),
  scriptwriter_output: Annotation({ default: () => "" }),
  translator_output: Annotation({ default: () => "" }),
  final_aggregated_output: Annotation({ default: () => "" }),
});

export const parallel_editor_node = async (state) => {
  console.log("\n--- [Parallel Agent 1] Editor executing in parallel...");
  const prompt = `You are an expert copyeditor. Clean up the following raw text, fix grammar, and return the edited text:\n\n${state.raw_input}`;
  const response = await llm.invoke(prompt);
  const content = typeof response.content === "string" ? response.content.trim() : response.content;
  return { editor_output: content };
};

export const parallel_scriptwriter_node = async (state) => {
  console.log("\n--- [Parallel Agent 2] Scriptwriter executing in parallel...");
  const prompt = `You are a YouTube creator. Transform this raw text into a punchy, engaging video script hook:\n\n${state.raw_input}`;
  const response = await llm.invoke(prompt);
  const content = typeof response.content === "string" ? response.content.trim() : response.content;
  return { scriptwriter_output: content };
};

export const parallel_translator_node = async (state) => {
  console.log("\n--- [Parallel Agent 3] Translator executing in parallel...");
  const prompt = `Convert the following text into casual, tech-style Hinglish for Indian youth:\n\n${state.raw_input}`;
  const response = await llm.invoke(prompt);
  const content = typeof response.content === "string" ? response.content.trim() : response.content;
  return { translator_output: content };
};

export const aggregator_node = async (state) => {
  console.log("\n--- [Aggregator Agent 4] Combining all 3 parallel results...");
  const prompt = `You are a senior executive editor. Combine these 3 perspectives into one cohesive, polished report:

Edited Text: ${state.editor_output}
Script Text: ${state.scriptwriter_output}
Hinglish Note: ${state.translator_output}

Return the final aggregated output:`;

  const response = await llm.invoke(prompt);
  const content = typeof response.content === "string" ? response.content.trim() : response.content;
  return { final_aggregated_output: content };
};

const parWorkflow = new StateGraph(ParallelState)
  .addNode("parallel_editor", parallel_editor_node)
  .addNode("parallel_scriptwriter", parallel_scriptwriter_node)
  .addNode("parallel_translator", parallel_translator_node)
  .addNode("aggregator", aggregator_node)

  // Fan-out: start all 3 parallel branches at once
  .addEdge(START, "parallel_editor")
  .addEdge(START, "parallel_scriptwriter")
  .addEdge(START, "parallel_translator")

  // Fan-in: wait for all 3 branches before running aggregator
  .addEdge("parallel_editor", "aggregator")
  .addEdge("parallel_scriptwriter", "aggregator")
  .addEdge("parallel_translator", "aggregator")
  .addEdge("aggregator", END);

export const appGraphParallel = parWorkflow.compile();
