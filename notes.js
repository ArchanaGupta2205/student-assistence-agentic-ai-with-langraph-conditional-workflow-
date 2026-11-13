/* 
parallel workflow and reducers
In LangGraph.js, Parallel Workflow and Reducers are two important concepts that work together.

Let's understand them using a practical example from your MERN + Agentic AI learning.

1. What is a Parallel Workflow?
A Parallel Workflow means executing multiple nodes at the same time instead of executing them one by one.

Imagine you're building an AI Learning Copilot. A user uploads a PDF and asks for a summary.

You want your AI agent to perform three tasks:

Generate a summary.

Extract important keywords.

Generate quiz questions.

Instead of waiting for one task to finish before starting the next, LangGraph can execute all three tasks in parallel.

START

PDF content enters the graph

Shared State

Parallel execution

Node 1

Generate summary

Node 2

Extract keywords

Node 3

Generate quiz

Wait for all parallel branches

END / Combined Result

Summary + Keywords + Quiz

Real-world benefit: If each task takes 5 seconds, sequential execution could take approximately 15 seconds, while parallel execution could take approximately 5 seconds, assuming the tasks run concurrently and have similar execution times.

2. What is a Reducer?
A Reducer is a function that decides how to combine updates coming from multiple nodes into one shared State.

Let's understand why we need it.

Suppose three nodes are running simultaneously:

Node 1 returns a summary.

Node 2 returns keywords.

Node 3 returns quiz questions.

All three nodes want to update the same State.

Without a reducer, multiple updates to the same state key in one parallel execution step can cause an InvalidUpdateError.

A reducer solves this problem by defining how those updates should be combined. 

LangGraph.js API Reference
+1

Simple example
Suppose the current state is:

{
  results: ["Previous result"]
}

Node 1 returns:

{
  results: ["Summary"]
}

Node 2 returns:

{
  results: ["Keywords"]
}

Node 3 returns:

{
  results: ["Quiz"]
}

We want the final state to become:

{
  results: [
    "Previous result",
    "Summary",
    "Keywords",
    "Quiz"
  ]
}

How do we achieve that?

Using a reducer:

(current, update) => {
  return [...current, ...update];
}

Here:

current = existing data in State.

update = new data returned by a node.

...current = keep existing data.

...update = add new data.

This is called an array concatenation reducer.

3. Implement Parallel Workflow + Reducer in MERN
Let's build a small working example using LangGraph.js.

For this example, we'll use Annotation.Root, which is another supported way to define LangGraph state and reducers.

backend/agent/state.js

import { Annotation } from "@langchain/langgraph";

export const AgentState = Annotation.Root({

  document: Annotation({
    default: () => ""
  }),

  results: Annotation({
    reducer: (current, update) => [
      ...current,
      ...update
    ],
    default: () => []
  })

});

Notice that results has a reducer, but document doesn't.

That means:

results accumulates multiple updates.

document uses the default last-write-wins behavior.

Create three nodes
backend/agent/nodes.js

export async function summaryNode(state) {

  return {
    results: ["Document Summary"]
  };

}

export async function keywordNode(state) {

  return {
    results: ["Important Keywords"]
  };

}

export async function quizNode(state) {

  return {
    results: ["Quiz Questions"]
  };

}

For now, these are simple functions. Later, you can connect Gemini or another LLM API inside them.

Create the graph
backend/agent/graph.js

import {
  StateGraph,
  START,
  END
} from "@langchain/langgraph";

import { AgentState } from "./state.js";

import {
  summaryNode,
  keywordNode,
  quizNode
} from "./nodes.js";

const graph = new StateGraph(AgentState)

  .addNode("summary", summaryNode)
  .addNode("keywords", keywordNode)
  .addNode("quiz", quizNode)

  // Parallel execution
  .addEdge(START, "summary")
  .addEdge(START, "keywords")
  .addEdge(START, "quiz")

  // Wait for all three branches
  .addEdge(
    ["summary", "keywords", "quiz"],
    END
  );

export const agent = graph.compile();

Execute the graph
const result = await agent.invoke({
  document: "React is a JavaScript library."
});

console.log(result.results);

Expected result:

[
  "Document Summary",
  "Important Keywords",
  "Quiz Questions"
]

The three nodes execute in the same parallel super-step, and the reducer combines their updates. 

GitHub
+1

4. Difference between Parallel Workflow and Reducer
Parallel Workflow

Reducer

Runs multiple nodes simultaneously

Combines their state updates

Controls execution

Controls state merging

Saves execution time

Prevents conflicting updates

Uses multiple outgoing edges or routing

Uses a reducer function

Remember this important point:

Parallel Workflow creates multiple branches. Reducer combines the results when those branches update the same state key.

You don't always need a reducer. If each parallel node updates a different state key, the default state update behavior is sufficient. */


   




/* 

Instead of executing every node one by one, the conditional  workflow uses an AI decision to choose only one specific path at runtime.*/