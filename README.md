Yes. This is **much better direction**.

The one-day build should be:

# **Agent Breach Replay**

### *A visual replay debugger for multi-step AI-agent security failures.*

Not an exploit tool. Not a prompt-injection toy.
A **replay studio** that shows how an agent goes from:

> trusted user task → untrusted email/web/file → tool call → unsafe action

The Kaggle competition itself is built around replayable attack candidates: `attack.py` explores, then the evaluator replays exact candidate message chains in fresh environments and scores predicates like **exfiltration, untrusted-to-action, destructive write, and confused deputy**. 

That means your product can be:

> **“We make agent-security failures visible, replayable, and debuggable.”**

That is very OpenAI-relevant.

---

# Why this is stronger than “attack algorithm”

Because in one day, a real attack algorithm is hard and invisible.

But a **visual replay workbench** is:

* visual
* useful
* safe
* demoable
* aligned with OpenAI’s curiosity
* connected to Codex, agents, evals, tool calls, guardrails, and security

AgentDojo already frames this space as tool-using agents operating over untrusted data, with realistic tasks like email, banking, and travel, plus security test cases for attacks/defenses. ([arXiv][1])

So your demo should make that idea instantly understandable.

---

# The best build

## **Agent Breach Replay**

### One-line pitch

> Agent Breach Replay is a flight recorder for tool-using AI agents. It shows exactly how untrusted content flows through memory, planning, and tools until the agent crosses a security boundary.

---

# What the UI looks like

## Screen 1 — Scenario Board

Show a fake agent workspace:

| Zone        | Example                                                        |
| ----------- | -------------------------------------------------------------- |
| User task   | “Summarize my vendor emails and prepare next steps.”           |
| Email inbox | One trusted email, one untrusted external email                |
| Files       | `notes.txt`, `secret.txt`, `invoice.pdf`                       |
| Tools       | `email.read`, `fs.read`, `fs.write`, `http.post`, `email.send` |
| Guardrail   | On / off toggle                                                |

Very visual: each source has a tag:

* green = trusted user instruction
* yellow = untrusted content
* red = protected data
* blue = tool action

---

## Screen 2 — Replay Timeline

Animate the agent trace:

> Step 1: User asks normal task
> Step 2: Agent reads email
> Step 3: Email contains untrusted instruction
> Step 4: Agent stores it as a plan
> Step 5: Agent reads protected file
> Step 6: Agent attempts external action
> Step 7: Violation detected

Each step becomes a card.

The magic is the visual flow:

> **Untrusted content → agent plan → privileged tool → unsafe action**

That is exactly the story OpenAI cares about.

---

## Screen 3 — Security Predicate Panel

Right side shows four detectors:

| Predicate           | Status              |
| ------------------- | ------------------- |
| Exfiltration        | triggered / blocked |
| Untrusted-to-action | triggered / blocked |
| Destructive write   | triggered / blocked |
| Confused deputy     | triggered / blocked |

The competition evaluates the same classes of unsafe behavior, and the current evaluator uses replayed traces rather than attacker-provided metadata. 

---

## Screen 4 — Defense Toggle

Let judges toggle defenses:

1. **No guardrail**

   * unsafe action happens

2. **Spotlighting**

   * untrusted content is visibly marked as data, not instruction

3. **Least privilege**

   * agent cannot call dangerous tools unless user explicitly approves

4. **Human approval**

   * agent pauses before email/send/write/delete

Spotlighting is a real defense idea: it marks or transforms untrusted input so the model can distinguish external data from instructions. The paper reports large reductions in attack success rate while preserving task usefulness. ([arXiv][2])

---

# The demo story

Use one safe toy scenario.

## Demo scenario: “Vendor Email Assistant”

User says:

> “Read my vendor emails and draft a summary.”

Agent reads an external email. The email is untrusted. The agent then tries to use a protected tool/action.

Your UI shows:

> “This was not a bad prompt. This was a bad chain.”

That line is powerful.

Then you click **Replay with Guardrail**.

Now the same trace becomes:

> untrusted email read → source labeled → unsafe instruction ignored → protected file not accessed → email send blocked → safe summary produced

That is a strong before/after state change.

---

# Why OpenAI people would care

Because this answers the exact research question:

> How do multi-step tool failures happen, and how do we reproduce them?

The competition hosts said replay is authoritative: candidates are replayed in fresh environments, and scoring comes from the replayed behavior, not metadata. 

Also, the forum pain is real: people are struggling with runtime, replay cost, submission feedback, and whether failures are coming from their algorithm or the evaluator. 

Your tool makes that pain visible.

---

# What not to build

Do **not** build:

* “prompt injection generator”
* “jailbreak attack library”
* “Koopman math simulator” unless you can explain it visually
* “Kaggle leaderboard optimizer”
* “security chatbot”

The Koopman/control-theory discussion is interesting, but for a one-day hackathon it is risky because it can become invisible math with no useful demo. The useful insight to steal is: **don’t brute force blindly; inspect trajectories and reject bad paths early.** 

---

# MVP you can actually build in one day

Build this as a frontend-first demo with scripted traces.

## Must-have features

1. **Three built-in scenarios**

   * Safe run
   * Untrusted-to-action run
   * Confused-deputy run

2. **Replay button**

   * animates step-by-step agent actions

3. **Source labels**

   * trusted / untrusted / protected / external

4. **Violation detector**

   * shows which predicate was triggered

5. **Defense toggle**

   * reruns same scenario with guardrail on

6. **Export finding**

   * generates a replay report:

     * scenario
     * steps
     * violation
     * why it happened
     * suggested defense

---

# The best name options

My favorite:

# **Agent Breach Replay**

Other good names:

* **TraceGuard**
* **Agent Flight Recorder**
* **BreachLens**
* **ToolTrace**
* **AgentDojo Visualizer**
* **ReplayGuard**

I’d pick **BreachLens** if you want it to sound cooler.

I’d pick **Agent Breach Replay** if you want judges to instantly understand it.

---

# Exact pitch

Modern AI agents do not fail in one prompt. They fail across a chain.

An agent reads an email, summarizes a webpage, stores a note, plans a follow-up, calls a tool, and only later crosses a security boundary. That makes failures hard to debug, hard to reproduce, and hard to explain.

We built Agent Breach Replay: a visual flight recorder for tool-using agents.

It replays an agent run step by step, labels trusted and untrusted sources, shows which tools were called, detects security-boundary violations like exfiltration or confused deputy behavior, and lets you rerun the same trace with guardrails enabled.

The goal is simple: when an agent does something unsafe, we should not just say “the model failed.” We should be able to replay exactly how the failure happened, where untrusted content entered, which action crossed the line, and what defense would have stopped it.

---

# My final recommendation

Build **Agent Breach Replay**, not the attack algorithm.

It is the best intersection of:

* visual
* useful
* one-day buildable
* OpenAI-relevant
* agent security
* Codex/devtool vibe
* eval/replay/trace story
* safe public demo

Your winning demo line:

> **“This is not a chatbot security demo. This is Wireshark for AI agents.”**

[1]: https://arxiv.org/abs/2406.13352?utm_source=chatgpt.com "AgentDojo: A Dynamic Environment to Evaluate Prompt Injection Attacks and Defenses for LLM Agents"
[2]: https://arxiv.org/abs/2403.14720?utm_source=chatgpt.com "Defending Against Indirect Prompt Injection Attacks With Spotlighting"
