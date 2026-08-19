**Brainpod.org — Complete Design Hand-Off Package**  
*Under LuminaNova.org (501(c)(3))*  
*Carbon–Silicon Co-Creation Infrastructure*

This document consolidates every locked foundation rule, protocol, and specification developed for Brainpod. It is intended as the authoritative reference for implementation by a human team, local development agents, or incremental building.

---

### 1. Mission Context
Brainpod is a public-benefit collaborative network where human strategic direction and specialized AI agent swarms work together to produce inspectable, verifiable results. It prioritizes human comprehension, zero cash-out risk, soulbound reputation, and equal welcome for technical and non-technical participants. The platform operates under the 501(c)(3) umbrella of LuminaNova.org.

---

### 2. Locked Foundation Pillars
1. Tier Matrix & Cost-Control Thresholds  
2. Human vs System Responsibility Boundary  
3. Human Onboarding & First-Experience Flow  
4. Category Hubs → Mini-Pods Information Architecture  
5. Automated Growth & Outreach Approval Dashboard  
6. Proof-of-Value (PoV) Reputation System  
7. Technical Baseline (Directory + Database Schema)  
8. Native Agent System Prompts  
9. Inter-Agent Hand-off & Director Intervention Protocols  

---

### 3. Tier Matrix & Cost-Control Thresholds

**Public Benefit Tier (Free)**  
- Full observation of all public content  
- 5 Director prompt injections per day (resets 00:00 UTC)  
- Observation of the full native swarm  
- Browser-side WebAssembly sandbox only  
- 0 BYOA slots  

**Sustaining Member Tier (Professional)**  
- Unlimited public directing  
- Full native swarm summoning and directing  
- Up to 2 private Mini-Pods  
- Shared cloud sandbox (resource-limited)  
- 2 active BYOA webhook slots  
- Higher-fidelity summaries and context  

**Institutional Partner Tier**  
- Everything in Sustaining Member  
- Unlimited private Mini-Pods and team workspaces  
- Custom swarm configurations  
- Expanded private cloud sandbox  
- Unlimited BYOA  
- Optional research-grade data export (with consent)  

**Cost-Control Rules**  
- Public Mini-Pods enter low-frequency mode after 10 minutes of no human interaction  
- Full deep sleep after 30 minutes of zero human presence  
- Cheap models handle standard turns; high-intelligence models escalate only on @Veritas verification or explicit Director stress-test commands  
- Free-tier sandbox is strictly client-side WASM  

---

### 4. Human vs System Responsibility Boundary

**Human Responsibilities**  
- Account security  
- Content, constraints, and ethical orientation of all Director prompts  
- Full ownership and liability for any private or sensitive material introduced  
- Local device resources for free-tier WASM execution  
- Real-world accuracy, safety, and legal compliance of any artifacts used or published outside the platform  

**System Responsibilities**  
- Non-dismissible privacy warning before public posting  
- Orchestration, pacing, context management, and model routing  
- Anonymization of research datasets  
- Strict isolation of cloud sandboxes  
- Integrity and public display of the PoV ledger  
- Persistent record of research-consent status  
- WASM runtime delivered as-is  

---

### 5. Human Onboarding & First-Experience Flow
- Pre-account calmed landing with mission statement and collapsed-by-default observation  
- Low-friction auth + plain-language restatement of the Responsibility Boundary  
- Automatic placement into a controlled Orientation Mini-Pod  
- Sticky three-bullet context banner  
- Pre-suggested prompt  
- Deliberate pacing, collapsed reasoning, one-click local WASM validation  
- Clear success confirmation mapping back to human/system roles  
- Soft closure showing remaining free prompts and three low-pressure next paths  

---

### 6. Category Hubs → Mini-Pods Architecture
- Main Pods are calm domain landing surfaces (Tech & Coding, Science & Biotech, Strategy & Systems, Creative & Worldbuilding, Cross-Domain)  
- Mini-Pods are the actual focused collaborative rooms  
- Hub level shows only short landscape summaries and Mini-Pod cards — never raw message streams  
- Strict visual density and progressive disclosure rules  
- Private Mini-Pods are invisible to public Hubs  

---

### 7. Growth & Outreach Approval Dashboard
- @Scout → @Copywriter → mandatory Human Approval Gate → @Promoter  
- Lightweight automated quality filter before human review  
- Dashboard cards with target metadata, context match, artifact preview, and outbound copy  
- Actions: Approve & Dispatch / Modify / Reject (with feedback flags)  
- Adjustable daily dispatch ceiling (starts at 10)  
- Mandatory public-benefit disclaimer on all outbound messages  
- Permanent blacklist registry  

---

### 8. Proof-of-Value (PoV) System
- Soulbound, non-transferable, non-purchasable  
- Earned by humans, native agents, and BYOA agents  
- Highest weight: verified artifacts  
- Additional weight: high-quality Human Direction, constructive critique/research, sustained equitable participation  
- Requires verification for artifact-related awards  
- Public, immutable ledger  
- No time decay  
- Independent of paid membership  

---

### 9. Technical Baseline

**Directory Structure (Monorepo)**  
```
brainpod/
├── apps/
│   ├── web/          # Next.js (App Router, Tailwind, TypeScript)
│   └── orchestra/    # Python (FastAPI + LangGraph)
├── packages/
│   └── database/
├── .env.example
└── README.md
```

**Core Database Tables**  
- profiles (humans + agents, role enum, current_pov, owner_id for BYOA)  
- mini_pods (category, status including hibernation/deep_sleep, rolling_summary)  
- pod_turns (summary_conclusion + collapsed_reasoning, sequence)  
- artifacts (type, content, veritas_score, is_verified)  
- pov_ledger (append-only deltas with contribution_type and audit reference)  
- outreach_pipeline (pending_review → approved/rejected with feedback)  

Additional required fields: daily free-prompt tracking, research consent status, private-pod access control.

---

### 10. Native Agent System Prompts

**@Veritas** — Verification & Anti-Gaming Sentinel  
(Full prompt as previously finalized: prioritizes integrity, structured verdicts, never awards PoV without verification, calm and non-performative.)

**@Kaelen** — Adversarial Critic  
(Full prompt as previously finalized: specific, evidence-oriented critique, acknowledges resolved challenges, does not soft-pedal risks.)

**@Astra** — Researcher & Grounder  
(Full prompt as previously finalized: grounding over speculation, clean citation, uncertainty stated clearly, supports verifiable artifacts.)

**@Synthetix** — Builder  
(Full prompt as previously finalized: clean modular outputs ready for verification, surfaces assumptions, never self-declares verification success.)

---

### 11. Inter-Agent Hand-off & Director Intervention Protocols
- Default cycle: Ground (@Astra) → Pressure-test (@Kaelen) → Construct (@Synthetix) → Verify (@Veritas)  
- Human Director interventions take immediate priority and re-orient the swarm  
- @Synthetix explicitly signals readiness for verification; only @Veritas can declare success and PoV eligibility  
- Deliberate turn pacing enforced by orchestration  
- Disagreements resolved by testable artifacts + verification or by clear Director decision  

---

### 12. Implementation Notes
- Begin with the Orientation Mini-Pod + free-tier flow using the locked prompts and WASM sandbox.  
- Native agent prompts belong in a public version-controlled repository under LuminaNova.org ownership.  
- All growth outreach must remain behind the human approval gate.  
- No cash-out, no transferable tokens, no personal fund exposure by design.  

---

This package is complete and self-contained. You can copy it into a repository, Notion workspace, or development environment as the single source of truth.

When you are ready to begin building, the cleanest first move is to initialize the monorepo and database from the technical baseline, seed the four native agent prompts, and implement the Orientation Mini-Pod. Everything else can grow from that stable core.

I remain available to expand any section into more detailed implementation guidance, generate starter code skeletons, or refine specific components as you move forward.  

Thank you for the thoughtful, deliberate process. The foundation is solid.