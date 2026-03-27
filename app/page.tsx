export default function LandingPage() {
  return (
    <>
      <main className="landing-shell">
        <div className="landing landing-wide">
          <nav className="nav nav-marketing">
            <div className="nav-brand"><div className="logo">G</div><span className="brand-name">Geeksy</span></div>
            <div className="nav-links">
              <a href="#gravity-story">Gravity</a>
              <a href="#market">GKSY</a>
              <a href="#problem">Problem</a>
              <a href="#jsx-ai">jsx-ai</a>
              <a href="#agent">smart-agent</a>
              <a href="#geeksy">geeksy</a>
              <a href="#hardware">hardware</a>
              <a href="#network">network</a>
              <a href="https://github.com/7flash/geeksy" target="_blank" rel="noopener">GitHub</a>
              <a href="https://app.geeksy.xyz" className="btn-primary">Open App →</a>
            </div>
          </nav>

          <section className="hero gravity-hero" id="gravity-story">
            <div className="gravity-hero-copy">
              <div className="hero-badge">Cosmic Gravity · Wallet-Native · Live</div>
              <h1>Own GKSY.<br /><span className="gradient-text">Accumulate gravity.</span></h1>
              <p className="hero-sub">Gravity score follows one simple rule: <code>gravity += current GKSY balance × current USD price</code> every minute. Connect Phantom, see where you rank, and spin the cosmic wheel weighted by real gravity.</p>
              <div className="gravity-hero-actions">
                <button className="btn-hero" id="hero-connect-wallet-btn">Connect Phantom</button>
                <button className="wheel-secondary-btn" id="hero-spin-wheel-btn">Spin the Wheel</button>
              </div>
              <div className="gravity-formula-card">
                <div className="market-card-label">How gravity accrues</div>
                <div className="gravity-formula">gravity += balance × priceUsd</div>
                <p>Updated every minute from live GKSY holder balances and current market price.</p>
              </div>
            </div>
            <div className="gravity-hero-panel" id="gravity-hero-root" />
          </section>
        </div>
      </main>

      <section className="section" id="market">
        <div className="section-label">Live Token Data</div>
        <h2>GKSY Market Snapshot</h2>
        <p className="section-desc">Track the current token price, market activity, and the gravity leaderboard side by side. The dashboard above is the live entry point; everything below explains the larger Geeksy world around it.</p>
        <div id="market-root" />
      </section>

      <section className="section" id="problem">
        <div className="section-label">The Problem</div>
        <h2>You Don&apos;t Own Your AI</h2>
        <p className="section-desc">ChatGPT, Claude, Cursor, Copilot — they all share the same architecture: your prompts go to their servers, their models process them, they charge you monthly. Your code, your conversations, your business logic — stored on infrastructure you don&apos;t control.</p>
        <div className="problem-grid">
          <div className="problem-card"><div className="problem-icon">💸</div><h3>$20-400/month</h3><p>Every AI tool charges a subscription. Use three tools? That&apos;s $60-1200/year just for API access to models you could run locally.</p></div>
          <div className="problem-card"><div className="problem-icon">🔓</div><h3>Your Data, Their Servers</h3><p>Every prompt, every file you share with AI, every conversation — processed and stored on infrastructure you don&apos;t control.</p></div>
          <div className="problem-card"><div className="problem-icon">🔒</div><h3>Vendor Lock-in</h3><p>Build workflows inside their products and your investment stays trapped in their ecosystem.</p></div>
          <div className="problem-card"><div className="problem-icon">⚡</div><h3>Rate Limits & Downtime</h3><p>Hit your cap during a critical task? Too bad. The AI you pay for decides when you&apos;ve had enough.</p></div>
        </div>
        <div className="solution-banner"><h3>Our answer: build every layer yourself.</h3><p>Five open-source layers. From the JSX prompt interface down to custom PCB hardware. Each layer works standalone. Together, they&apos;re a complete AI stack that runs on your terms.</p></div>
      </section>

      <section className="section" id="jsx-ai">
        <div className="section-label">Layer 1 · LLM Interface</div>
        <h2>jsx-ai — Prompts Are Components</h2>
        <p className="section-desc">The Vercel AI SDK gives you <code>generateText()</code> with JSON tool schemas. LangChain gives you 47 abstractions for a simple prompt. We give you JSX. Your prompts become composable, testable, reusable components — exactly like React components, but for LLMs.</p>
        <div className="compare-grid">
          <div className="compare-card theirs"><div className="compare-label theirs-label">❌ Vercel AI SDK / LangChain</div><h3>JSON schemas, 20+ lines per tool</h3><p>Tools defined as deeply nested JSON objects with provider-specific configs and lots of boilerplate.</p></div>
          <div className="compare-card ours"><div className="compare-label ours-label">✓ jsx-ai — 3 lines per tool</div><h3>JSX components, works everywhere</h3><p>Tools are components. Import them, compose them, share them across projects. Auto-detect provider from model name.</p></div>
        </div>
        <div className="features">
          <div className="feature"><div className="feature-icon">🔌</div><h3>5 Providers, Zero Config</h3><p>Gemini, OpenAI, Anthropic, DeepSeek, Qwen. Just change the model string.</p></div>
          <div className="feature"><div className="feature-icon">🧩</div><h3>Composable Like React</h3><p>Build prompt components and reuse them anywhere.</p></div>
          <div className="feature"><div className="feature-icon">📐</div><h3>5 Encoding Strategies</h3><p>Native function calling, XML, NLT, natural language, hybrid.</p></div>
        </div>
      </section>

      <section className="section" id="agent">
        <div className="section-label">Layer 2 · Agent Framework</div>
        <h2>smart-agent — Autonomous, Not Assistive</h2>
        <p className="section-desc">Pi agent, Claude Code, and Cursor are assistants — you type, they respond, you approve. smart-agent is an autonomous agent — you define what &quot;done&quot; means, and it works until it gets there.</p>
        <div className="compare-grid three-col">
          <div className="compare-card theirs"><div className="compare-label theirs-label">❌ Pi Agent / Claude Code</div><h3>Human-in-the-loop, one-shot</h3><ul className="compare-list"><li>You approve each tool call</li><li>No concept of objectives</li><li>Can&apos;t run overnight</li></ul></div>
          <div className="compare-card theirs"><div className="compare-label theirs-label">❌ OpenClaw / AutoGPT</div><h3>Loops but no validation</h3><ul className="compare-list"><li>Runs autonomously but can&apos;t verify results</li><li>No skill files</li><li>Spins in circles when stuck</li></ul></div>
          <div className="compare-card ours"><div className="compare-label ours-label">✓ smart-agent</div><h3>Autonomous + Validated</h3><ul className="compare-list"><li><strong>Objectives</strong> with validate()</li><li><strong>Skills</strong> via markdown files</li><li><strong>Parallel tools</strong> and streaming events</li></ul></div>
        </div>
      </section>

      <section className="section" id="geeksy">
        <div className="section-label">Layer 3 · Personal AI OS</div>
        <h2>geeksy — Your AI, On Your Machine</h2>
        <p className="section-desc">ChatGPT is a web app. Claude is a web app. They store your history on their servers. Geeksy is a local-first AI assistant that runs on your machine, stores everything in SQLite on your disk, and works with any model provider.</p>
        <div className="compare-grid three-col">
          <div className="compare-card theirs"><div className="compare-label theirs-label">❌ ChatGPT / Claude.ai</div><h3>Cloud-hosted chat interface</h3><ul className="compare-list"><li>Your conversations stored on their servers</li><li>Subscriptions and rate limits</li><li>No scheduling or autonomy</li></ul></div>
          <div className="compare-card theirs"><div className="compare-label theirs-label">❌ OpenClaw / Open WebUI</div><h3>Self-hosted but limited</h3><ul className="compare-list"><li>Docker-heavy</li><li>Still mostly chat UI</li><li>No heartbeat or background work</li></ul></div>
          <div className="compare-card ours"><div className="compare-label ours-label">✓ geeksy</div><h3>Local AI OS with autonomy</h3><ul className="compare-list"><li><strong>One command</strong>: <code>npx geeksy</code></li><li><strong>Local SQLite</strong></li><li><strong>Heartbeat + scheduling</strong></li><li><strong>Secrets vault</strong></li><li><strong>Telegram bridge</strong></li></ul></div>
        </div>
      </section>

      <section className="section" id="hardware">
        <div className="section-label">Layer 4 · Smart Hardware</div>
        <h2>The Speaker That Runs Your AI</h2>
        <p className="section-desc">Alexa sends every word to Amazon. Google Home sends every word to Google. Our smart speaker runs an AllWinner T527 SoC with a Gowin FPGA and 4-mic array on an open-source PCB. The AI runs on the device.</p>
        <div className="compare-grid">
          <div className="compare-card theirs"><div className="compare-label theirs-label">❌ Alexa / Google Home / Siri</div><h3>Always listening, always uploading</h3><ul className="compare-list"><li>Every wake word goes to their cloud</li><li>Proprietary hardware</li><li>Locked ecosystem</li></ul></div>
          <div className="compare-card ours"><div className="compare-label ours-label">✓ MY-SPACE Smart Speaker</div><h3>Open hardware, private inference</h3><ul className="compare-list"><li>T527 SoC + GW2A-18 FPGA</li><li>4× MEMS microphones + ES8388 codec</li><li>Open-source PCB and BOM</li></ul></div>
        </div>
      </section>

      <section className="section" id="network">
        <div className="section-label">Layer 5 · The Endgame</div>
        <h2>Decentralized Inference Network</h2>
        <p className="section-desc">A mesh network of speakers where inference is free because you own the hardware. No API fees. No subscriptions. No one sees your data.</p>
        <div className="vision-grid">
          <div><h3 style={{ fontSize: '22px', fontWeight: 700, marginBottom: '16px' }}>How Weight Sharding Works</h3><p style={{ color: 'var(--text2)', lineHeight: '1.8', marginBottom: '24px' }}>A 7B parameter model can be split across multiple speakers. Each device loads specific transformer layers and only sees tensor activations — not your words.</p><div className="math-box"><div className="math-row"><span>1 speaker</span><span>→ 1-3B model</span></div><div className="math-row"><span>4 speakers</span><span>→ 7B model</span></div><div className="math-row"><span>10 speakers</span><span>→ 30B model</span></div><div className="math-row"><span>20 speakers</span><span>→ 70B model</span></div></div></div>
          <div className="vision-diagram"><h3>🌐 Inference Mesh</h3><div className="vision-nodes"><div className="vision-node active">Speaker A<br/><span style={{ fontSize: '10px', color: 'var(--green)' }}>layers 0-7</span></div><div className="vision-node active">Speaker B<br/><span style={{ fontSize: '10px', color: 'var(--green)' }}>layers 8-15</span></div><div className="vision-node active">Speaker C<br/><span style={{ fontSize: '10px', color: 'var(--green)' }}>layers 16-23</span></div><div className="vision-node active">Speaker D<br/><span style={{ fontSize: '10px', color: 'var(--green)' }}>layers 24-31</span></div><div className="vision-node">Speaker E<br/><span style={{ fontSize: '10px' }}>redundancy</span></div><div className="vision-node">Speaker F<br/><span style={{ fontSize: '10px' }}>redundancy</span></div></div><p style={{ marginTop: '20px', fontSize: '13px', color: 'var(--text2)' }}>7B model · 4 speakers · 0 cloud · ∞ privacy</p></div>
        </div>
      </section>

      <section className="section" id="compare">
        <div className="section-label">Full Comparison</div>
        <h2>How We Compare</h2>
        <div className="comparison-table-wrap"><table className="comparison-table"><thead><tr><th>Feature</th><th>ChatGPT / Claude.ai</th><th>Pi Agent / Claude Code</th><th>OpenClaw / Open WebUI</th><th className="highlight-col">Geeksy Stack</th></tr></thead><tbody><tr><td>Data Privacy</td><td className="bad">❌ Cloud-stored</td><td className="bad">❌ Cloud API calls</td><td className="ok">⚠️ Self-hosted option</td><td className="good">✅ Local-only SQLite</td></tr><tr><td>Cost</td><td className="bad">$20-200/mo</td><td className="bad">$20-100/mo API</td><td className="ok">Free + API costs</td><td className="good">✅ Free (BYO API key or local LLM)</td></tr><tr><td>Autonomous Execution</td><td className="bad">❌ Chat only</td><td className="bad">❌ Approval per step</td><td className="bad">❌ Chat only</td><td className="good">✅ Objective-driven loop</td></tr><tr><td>Background Tasks</td><td className="bad">❌ None</td><td className="bad">❌ None</td><td className="bad">❌ None</td><td className="good">✅ Heartbeat + cron</td></tr><tr><td>Mobile Access</td><td className="ok">App (cloud)</td><td className="bad">❌ Terminal only</td><td className="bad">❌ Desktop browser</td><td className="good">✅ Telegram bot + Web</td></tr></tbody></table></div>
      </section>

      <section className="section" id="waterfall">
        <div className="section-label">Architecture</div>
        <h2>Async Agents Waterfall Model</h2>
        <p className="section-desc">Our smart-agent framework uses an asynchronous waterfall model that allows multiple agents to work on different aspects of a problem simultaneously, then converge their results for optimal outcomes.</p>
        <div className="waterfall-diagram"><div className="waterfall-stage"><div className="stage-header"><span className="stage-number">1</span><h3>Problem Analysis</h3></div><p>Analyzes requirements, constraints, and success criteria</p><div className="agent-tag">Analyzer Agent</div></div><div className="waterfall-arrow">↓</div><div className="waterfall-stage"><div className="stage-header"><span className="stage-number">2</span><h3>Research & Planning</h3></div><p>Gathers information, explores solutions, creates execution plan</p><div className="agent-tags"><div className="agent-tag">Research Agent</div><div className="agent-tag">Planner Agent</div></div></div><div className="waterfall-arrow">↓</div><div className="parallel-stages"><div className="waterfall-stage parallel"><div className="stage-header"><span className="stage-number">3</span><h3>Implementation</h3></div><p>Executes the planned solution with multiple specialized agents</p><div className="agent-tags"><div className="agent-tag">Coder Agent</div><div className="agent-tag">Tester Agent</div><div className="agent-tag">Reviewer Agent</div></div></div><div className="waterfall-stage parallel"><div className="stage-header"><span className="stage-number">3</span><h3>Validation</h3></div><p>Verifies correctness, performance, and compliance</p><div className="agent-tags"><div className="agent-tag">Validator Agent</div><div className="agent-tag">Security Agent</div></div></div></div><div className="waterfall-arrow">↓</div><div className="waterfall-stage final"><div className="stage-header"><span className="stage-number">5</span><h3>Verification</h3></div><p>Final validation against original objectives and requirements</p><div className="agent-tag">Quality Agent</div></div></div>
      </section>

      <section className="section" id="start">
        <div className="section-label">Get Started</div>
        <h2>Try It Right Now</h2>
        <div className="start-grid"><div className="start-card"><h3>jsx-ai</h3><p>Composable prompts for any LLM</p><div className="code-block" style={{ marginBottom: '12px' }}><pre>npm install jsx-ai</pre></div><a href="https://www.npmjs.com/package/jsx-ai" className="start-link">npm →</a></div><div className="start-card"><h3>smart-agent</h3><p>Autonomous agent with objectives</p><div className="code-block" style={{ marginBottom: '12px' }}><pre>npm install smart-agent-ai</pre></div><a href="https://www.npmjs.com/package/smart-agent-ai" className="start-link">npm →</a></div><div className="start-card"><h3>geeksy</h3><p>Local-first AI assistant</p><div className="code-block" style={{ marginBottom: '12px' }}><pre>npx geeksy</pre></div><a href="https://www.npmjs.com/package/geeksy" className="start-link">npm →</a></div></div>
      </section>

      <footer className="footer"><div className="footer-links"><a href="https://github.com/7flash">GitHub</a><a href="https://www.npmjs.com/package/jsx-ai">jsx-ai</a><a href="https://www.npmjs.com/package/smart-agent-ai">smart-agent</a><a href="https://www.npmjs.com/package/geeksy">geeksy</a></div><p>Built with Melina.js · Every layer open source · © 2026 geeksy.xyz</p></footer>
    </>
  )
}
