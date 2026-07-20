# Diagram Rendering — Mermaid Alternatives Research

## Context

The PRD doesn't currently list diagram support (Mermaid or otherwise) as a requirement, but Typora itself renders Mermaid code fences as diagrams, so it's worth evaluating whether to include it and what to use, given this app's constraints: offline-only, minimalist, distraction-free writing, Tauri + Rust shell. This note evaluates Mermaid itself against alternatives.

## Key Findings

**1. Mermaid's own bundle size and security posture cut against this app's goals.**
Mermaid has grown substantially — full builds have reached ~2.8MB (up roughly 3x from a prior ~878KB baseline), which is heavy for a cold-start-sensitive, minimalist app. A smaller "Tiny" build exists (~half the size) but drops mindmap/architecture diagrams, KaTeX integration, and lazy loading. On security, Mermaid's own docs acknowledge that diagram source can't be fully sanitized with standard techniques without breaking legitimate diagrams, and recommend a sandboxed-iframe rendering mode — itself still in beta — to contain risk from untrusted input. For a single-user offline app this risk is lower than a multi-tenant web product, but it's still the most security-sensitive piece of any candidate.
Confidence: High (bundle size and security-advisory data are documented directly by the Mermaid project and security trackers).

**2. D2 produces higher-quality output and now has a real embeddable WASM path (`@terrastruct/d2`, aka "D2.js").**
D2 is a Go-based diagram language, historically CLI/build-step oriented, but `@terrastruct/d2` is an official npm package wrapping D2's WASM build, runs in-browser via a web worker (non-blocking), and embeds the WASM binary directly in the JS bundle — so it's genuinely offline-capable with no external calls after the package is installed. Reviewers consistently rate D2's visual output and layout quality above Mermaid's, with multiple layout engines and cleaner theming. The trade-off: D2 doesn't render natively on GitHub/GitLab/Notion (irrelevant here, since this is a standalone app, not a doc rendered elsewhere) and has a smaller ecosystem/community than Mermaid.
Confidence: Medium-High — the npm package and worker architecture are well documented; less evidence exists on D2.js's exact bundle size or performance versus Mermaid specifically.

**3. Svgbob is a Rust-native, genuinely lightweight option if the ambition is simple box-and-line diagrams rather than full flowchart/sequence/UML syntax.**
Svgbob converts ASCII-art-style diagrams to SVG, is implemented in Rust with an existing WASM build (`svgbob-wasm` on npm) and a CLI. Because it's Rust, it could in principle run directly in the Tauri backend rather than needing a JS/WASM bridge at all, which fits this app's stack unusually well. The trade-off is expressive power: it does simple box/arrow/line diagrams from ASCII art, not the structured flowchart/sequence/class/state-diagram syntax Mermaid or D2 support — so it's a different tool for a narrower job (quick technical sketches), not a drop-in Mermaid replacement.
Confidence: Medium — clear on capability and packaging, no direct performance/quality benchmarking found against Mermaid or D2.

**4. PlantUML and Graphviz are poor fits for this app's offline/minimalist constraints.**
PlantUML is the enterprise standard for UML specifically, but typically depends on a Java runtime and often Graphviz itself for layout — heavy dependencies for a lightweight offline desktop app. Graphviz (DOT language) is excellent for large dependency/compiler-output graphs but is a general graph-layout tool, not a markdown-native diagramming syntax, and would need its own WASM build (viz.js exists but isn't actively highlighted in current comparisons) to run offline in-app.
Confidence: Medium — general knowledge of these tools' dependency footprints is well established; not deeply re-verified in this pass.

**5. Excalidraw and other GUI-first tools solve a different problem — freeform drawing/collaboration, not text-to-diagram-in-markdown.**
Excalidraw is the strongest open-source option for hand-drawn-style, collaborative diagramming, but it's a canvas-drawing tool with its own file format, not something you write inline in a markdown code fence. Embedding it would mean a very different interaction model (draw with mouse, not type syntax) and works against the "stay in the writing flow, don't context-switch to a different editing mode" goal already established for this app.
Confidence: High on the categorical distinction; not a serious candidate given the PRD's focus.

## Opportunity Areas

- **Diagram support isn't currently in the PRD's P0/P1/P2 lists at all.** Before picking a library, the more fundamental question is whether diagrams belong in a distraction-free writing app in the first place, or whether they're a PKM/documentation-tool feature that was implicitly excluded when the PRD ruled out PKM scope. Worth a deliberate scope decision, not just a library pick.
- **If included, D2 is the best technical fit** for visual quality and genuine offline WASM embedding, but it's the least "written into markdown natively" of the code-based options — Mermaid remains the de facto standard people already know from GitHub/Typora, so there's a familiarity cost to deviating from it.
- **Svgbob's Rust-native fit is a structural advantage worth remembering** even outside diagrams — it's a signal that Rust-side WASM-free rendering is possible for future graphics features, avoiding a JS-side WASM bridge entirely.

## Recommendations

1. **Treat diagram support as an explicit scope decision, not an assumed feature.** Given the PRD's hard stance against PKM/documentation-tool creep, recommend adding it as a P2 (Future Consideration) rather than P0/P1 — it's a legitimate Typora-parity feature but isn't essential to "help me focus on writing," and pulling in any of these libraries adds real weight (Mermaid: ~1.4–2.8MB; D2.js: WASM binary embedded in bundle) to a cold-start-sensitive app.
2. **If/when added, default to D2 over Mermaid** for the reasons above: better visual output, genuine offline WASM path via `@terrastruct/d2`, and no sandboxed-iframe security caveat to manage. Accept the trade-off that it's a less widely-known syntax than Mermaid.
3. **Consider svgbob as a lightweight secondary/alternate mode** for quick ASCII-style sketches, given its natural fit with the Rust/Tauri backend — but don't let this expand into supporting multiple diagram syntaxes for v1; pick one.
4. **Rule out PlantUML, Graphviz, and Excalidraw** for this app specifically: PlantUML/Graphviz bring heavy runtime dependencies that conflict with the offline/minimal constraint, and Excalidraw is a different interaction paradigm (canvas drawing) that breaks the "stay in the text, stay in flow" design goal.

## Open Questions

- Does diagram support belong in this app at all, given the explicit non-goal of PKM/documentation-tool scope creep? Needs a product decision, not just a technical one. (author)
- If added, what's the actual bundle-size delta of `@terrastruct/d2` versus Mermaid's "Tiny" build in practice — no direct side-by-side benchmark was found. Would need to be measured directly during a spike. (engineering)
