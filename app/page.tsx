export default function LandingPage() {
  return (
    <main className="landing-shell">
      <div className="landing">
        <nav className="nav">
          <div className="nav-brand">
            <div className="logo">G</div>
            <span className="brand-name">Geeksy</span>
          </div>
          <div className="nav-links">
            <a href="https://github.com/7flash/geeksy" target="_blank" rel="noopener">GitHub</a>
            <a href="https://www.npmjs.com/package/geeksy" target="_blank" rel="noopener">npm</a>
            <a href="https://app.geeksy.xyz" className="btn-primary">Open App →</a>
          </div>
        </nav>

        <section className="hero">
          <div className="hero-badge">Open Source · Self-Hosted · Free</div>
          <h1>
            Your AI that actually<br />
            <span className="gradient-text">does things</span>
          </h1>
          <p className="hero-sub">
            Chat with an AI that writes code, runs scripts, schedules tasks,
            searches the web, and manages your automation — all from one interface.
          </p>
          <div className="hero-actions">
            <a href="https://app.geeksy.xyz" className="btn-hero">Open App</a>
            <div className="install-cmd">
              <code>npx geeksy</code>
              <button id="copy-install-btn" className="copy-btn" title="Copy">📋</button>
            </div>
          </div>
        </section>

        <section className="demo">
          <div className="terminal">
            <div className="terminal-bar">
              <span className="dot red" />
              <span className="dot yellow" />
              <span className="dot green" />
              <span className="terminal-title">Geeksy Chat</span>
            </div>
            <div className="terminal-body">
              <div className="chat-line user">
                <span className="role">You</span>
                <span>Give me a motivational quote every morning at 9am</span>
              </div>
              <div className="chat-line agent">
                <span className="role">Geeksy</span>
                <span>I&apos;ll set that up! Creating a script and scheduling it...</span>
              </div>
              <div className="chat-line tool">
                <span className="tool-badge">✏️ write_file</span>
                <span>scripts/morning-quote.ts</span>
                <span className="tool-status">✓ done</span>
              </div>
              <div className="chat-line tool">
                <span className="tool-badge">⏰ schedule</span>
                <span>cron: &quot;0 9 * * *&quot;</span>
                <span className="tool-status">✓ scheduled</span>
              </div>
              <div className="chat-line agent">
                <span className="role">Geeksy</span>
                <span>Done! You&apos;ll get a random motivational quote every morning at 9am. ☀️</span>
              </div>
            </div>
          </div>
        </section>

        <section className="features">
          <h2>Everything an AI assistant should be</h2>
          <div className="feature-grid">
            <div className="feature-card">
              <div className="feature-icon">🔧</div>
              <h3>Autonomous Execution</h3>
              <p>Reads files, writes code, runs commands, edits projects. Not just chat — real tool use with a planner that breaks tasks into objectives.</p>
            </div>
            <div className="feature-card">
              <div className="feature-icon">⏰</div>
              <h3>Task Scheduling</h3>
              <p>Schedule scripts and chat prompts with cron, intervals, or one-shot timers. State persistence built in via STATE_URL.</p>
            </div>
            <div className="feature-card">
              <div className="feature-icon">🌐</div>
              <h3>Web Search</h3>
              <p>Built-in web search and page fetching. The agent can look up documentation, current events, and APIs on the fly.</p>
            </div>
            <div className="feature-card">
              <div className="feature-icon">🧠</div>
              <h3>Semantic Memory</h3>
              <p>RAG-powered long-term memory using Gemini embeddings. Past conversations inform current answers automatically.</p>
            </div>
            <div className="feature-card">
              <div className="feature-icon">🤖</div>
              <h3>Multi-Provider</h3>
              <p>Gemini, Claude, GPT-4, DeepSeek, Qwen — switch models per conversation. Bring your own API keys.</p>
            </div>
            <div className="feature-card">
              <div className="feature-icon">📱</div>
              <h3>Telegram Bot</h3>
              <p>Connect a Telegram bot to chat with Geeksy from your phone. Same agent, same tools, any device.</p>
            </div>
          </div>
        </section>

        <section className="how">
          <h2>Three commands to your own AI</h2>
          <div className="steps">
            <div className="step">
              <div className="step-num">1</div>
              <div className="step-content">
                <h3>Install</h3>
                <code>npx geeksy</code>
                <p>One command. Bun-native, zero config. Runs on localhost:3737.</p>
              </div>
            </div>
            <div className="step">
              <div className="step-num">2</div>
              <div className="step-content">
                <h3>Add a key</h3>
                <p>Go to Settings → Models → paste your Gemini / OpenAI / Claude API key.</p>
              </div>
            </div>
            <div className="step">
              <div className="step-num">3</div>
              <div className="step-content">
                <h3>Chat</h3>
                <p>Ask it to do things. It writes scripts, runs them, schedules tasks, and remembers context.</p>
              </div>
            </div>
          </div>
        </section>

        <section className="stack">
          <h2>Built with</h2>
          <div className="stack-pills">
            <span className="pill">Bun</span>
            <span className="pill">TypeScript</span>
            <span className="pill">Melina.js</span>
            <span className="pill">smart-agent-ai</span>
            <span className="pill">jsx-ai</span>
            <span className="pill">SQLite</span>
            <span className="pill">SSE Streaming</span>
          </div>
        </section>

        <footer className="footer">
          <p>
            Made by <a href="https://github.com/7flash" target="_blank" rel="noopener">@7flash</a>
            {' '}·{' '}
            <a href="https://github.com/7flash/geeksy" target="_blank" rel="noopener">Source on GitHub</a>
          </p>
        </footer>
      </div>
    </main>
  )
}
