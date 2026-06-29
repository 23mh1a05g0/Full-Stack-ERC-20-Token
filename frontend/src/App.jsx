// frontend/src/App.jsx
import { useState, useEffect, useCallback, useRef } from "react";
import "./index.css";
import {
  getProvider,
  getBalance,
  canClaim,
  getRemainingAllowance,
  getLastClaimAt,
  requestTokens,
  getContractAddresses,
} from "./utils/contracts.js";
import "./utils/eval.js"; // registers window.__EVAL__

// ── Helpers ─────────────────────────────────────────────────────────────────
function shortAddr(addr) {
  return addr ? `${addr.slice(0, 6)}…${addr.slice(-4)}` : "";
}

function fmtCountdown(secs) {
  if (secs <= 0) return "00:00:00";
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const s = secs % 60;
  return [h, m, s].map((v) => String(v).padStart(2, "0")).join(":");
}

const COOLDOWN = 24 * 60 * 60; // 24 hours in seconds

// ── Toast hook ───────────────────────────────────────────────────────────────
function useToasts() {
  const [toasts, setToasts] = useState([]);
  const add = useCallback((msg, type = "info") => {
    const id = Date.now();
    setToasts((t) => [...t, { id, msg, type }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 5000);
  }, []);
  return { toasts, add };
}

// ── Main App ─────────────────────────────────────────────────────────────────
export default function App() {
  const [account, setAccount] = useState(null);
  const [balance, setBalance] = useState("—");
  const [eligible, setEligible] = useState(false);
  const [remaining, setRemaining] = useState("1000");
  const [cooldownSecs, setCooldownSecs] = useState(0);
  const [claiming, setClaiming] = useState(false);
  const { toasts, add: addToast } = useToasts();
  const timerRef = useRef(null);

  // ── Refresh on-chain state ─────────────────────────────────────────────────
  const refresh = useCallback(async (addr) => {
    if (!addr) return;
    try {
      const [bal, eligible_, remaining_, lastAt_] = await Promise.all([
        getBalance(addr),
        canClaim(addr),
        getRemainingAllowance(addr),
        getLastClaimAt(addr),
      ]);
      setBalance(parseFloat(bal).toFixed(2));
      setEligible(eligible_);
      setRemaining(parseFloat(remaining_).toFixed(0));

      const lastAt = Number(lastAt_); // BigInt → number (seconds)
      const now = Math.floor(Date.now() / 1000);
      const elapsed = now - lastAt;
      const left = lastAt === 0 ? 0 : Math.max(0, COOLDOWN - elapsed);
      setCooldownSecs(left);
    } catch (err) {
      console.error("refresh error", err);
    }
  }, []);

  // ── Countdown ticker ──────────────────────────────────────────────────────
  useEffect(() => {
    clearInterval(timerRef.current);
    if (cooldownSecs > 0) {
      timerRef.current = setInterval(() => {
        setCooldownSecs((s) => {
          if (s <= 1) {
            clearInterval(timerRef.current);
            if (account) refresh(account);
            return 0;
          }
          return s - 1;
        });
      }, 1000);
    }
    return () => clearInterval(timerRef.current);
  }, [cooldownSecs, account, refresh]);

  // ── Wallet event listeners ────────────────────────────────────────────────
  useEffect(() => {
    if (!window.ethereum) return;
    const onAccounts = (accs) => {
      const addr = accs[0] || null;
      setAccount(addr);
      if (addr) refresh(addr);
    };
    window.ethereum.on("accountsChanged", onAccounts);
    window.ethereum.on("chainChanged", () => window.location.reload());
    return () => {
      window.ethereum.removeListener("accountsChanged", onAccounts);
    };
  }, [refresh]);

  // ── Connect wallet ────────────────────────────────────────────────────────
  async function handleConnect() {
    if (!window.ethereum) {
      addToast("MetaMask not found. Please install it.", "error");
      return;
    }
    try {
      const accs = await window.ethereum.request({ method: "eth_requestAccounts" });
      const addr = accs[0];
      setAccount(addr);
      await refresh(addr);
      addToast("Wallet connected!", "success");
    } catch (err) {
      addToast(err.message || "Connection failed", "error");
    }
  }

  // ── Claim tokens ──────────────────────────────────────────────────────────
  async function handleClaim() {
    if (!account || !eligible || claiming) return;
    setClaiming(true);
    addToast("Sending transaction…", "info");
    try {
      await requestTokens();
      addToast("🎉 100 FTK claimed successfully!", "success");
      await refresh(account);
    } catch (err) {
      const msg =
        err?.reason ||
        err?.data?.message ||
        err?.message ||
        "Transaction failed";
      addToast(msg, "error");
    } finally {
      setClaiming(false);
    }
  }

  // ── Cooldown progress (0→100 as cooldown counts down) ────────────────────
  const progressPct = cooldownSecs > 0 ? ((COOLDOWN - cooldownSecs) / COOLDOWN) * 100 : 100;

  const { tokenAddress, faucetAddress } = getContractAddresses();

  return (
    <div className="app-wrapper">
      {/* ── Header ──────────────────────────────────────────────────── */}
      <header className="header glass">
        <div className="header-logo">
          <div className="logo-icon">⛽</div>
          <div>
            <div className="header-title">Token Faucet</div>
            <div className="header-subtitle">ERC-20 · Sepolia Testnet</div>
          </div>
        </div>
        <div className="network-badge">
          <span className="network-dot" />
          Sepolia
        </div>
      </header>

      {/* ── Hero ────────────────────────────────────────────────────── */}
      <section className="hero">
        <h1>
          Claim Free <span className="gradient-text">FTK Tokens</span>
        </h1>
        <p>
          Get 100 FTK every 24 hours with a lifetime limit of 1,000 tokens.
          Connect your MetaMask wallet to start claiming.
        </p>
        <div style={{ display: "flex", gap: "10px", justifyContent: "center", flexWrap: "wrap" }}>
          <span className="tag tag-blue">100 FTK / claim</span>
          <span className="tag tag-purple">24h cooldown</span>
          <span className="tag tag-green">1,000 FTK lifetime</span>
        </div>
      </section>

      {/* ── Main card ───────────────────────────────────────────────── */}
      <main className="card glass">
        {!account ? (
          /* ── Not connected ── */
          <div className="connect-section">
            <div className="wallet-icon-wrap">🦊</div>
            <h2 style={{ fontSize: "1.3rem", fontWeight: 700 }}>Connect Your Wallet</h2>
            <p style={{ color: "var(--text-muted)", fontSize: "0.9rem" }}>
              Connect MetaMask to check your balance and claim free tokens.
            </p>
            <button id="btn-connect" className="btn btn-primary btn-lg" onClick={handleConnect}>
              Connect MetaMask
            </button>
          </div>
        ) : (
          /* ── Connected ── */
          <div>
            {/* Account row */}
            <div className="connected-header">
              <div className="account-info">
                <div className="account-avatar">👤</div>
                <div>
                  <div className="account-label">Connected</div>
                  <div className="account-address">{shortAddr(account)}</div>
                </div>
              </div>
              <span className={`tag ${eligible ? "tag-green" : "tag-red"}`}>
                {eligible ? "✓ Eligible" : "⏳ On Cooldown"}
              </span>
            </div>

            {/* Stats */}
            <div className="stats-grid">
              <div className="stat-card">
                <div className="stat-label">FTK Balance</div>
                <div className="stat-value">
                  {balance}<span>FTK</span>
                </div>
                <div className="stat-sublabel">Your wallet</div>
              </div>
              <div className="stat-card">
                <div className="stat-label">Remaining Allowance</div>
                <div className="stat-value">
                  {remaining}<span>FTK</span>
                </div>
                <div className="stat-sublabel">Lifetime cap</div>
              </div>
            </div>

            {/* Cooldown bar */}
            {cooldownSecs > 0 && (
              <div className="cooldown-bar-wrap">
                <div className="cooldown-label">
                  <span>Cooldown remaining</span>
                  <span className="cooldown-time">{fmtCountdown(cooldownSecs)}</span>
                </div>
                <div className="progress-track">
                  <div className="progress-fill" style={{ width: `${progressPct}%` }} />
                </div>
              </div>
            )}

            {/* Claim button */}
            <div className="claim-section">
              <button
                id="btn-claim"
                className="btn btn-primary btn-full btn-lg"
                onClick={handleClaim}
                disabled={!eligible || claiming || Number(remaining) === 0}
              >
                {claiming ? (
                  <><span className="spinner" /> Claiming…</>
                ) : (
                  "⚡ Claim 100 FTK"
                )}
              </button>
              <p className="claim-info">
                {Number(remaining) === 0
                  ? "You have reached the lifetime limit of 1,000 FTK."
                  : eligible
                  ? "You can claim 100 FTK right now."
                  : "Please wait for the cooldown to expire."}
              </p>
            </div>

            {/* Contract info */}
            <details style={{ marginTop: 8 }}>
              <summary style={{ fontSize: "0.78rem", color: "var(--text-dim)", cursor: "pointer", userSelect: "none" }}>
                Contract addresses
              </summary>
              <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 6 }}>
                {[
                  ["Token", tokenAddress],
                  ["Faucet", faucetAddress],
                ].map(([label, addr]) => (
                  <div key={label} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                    <span style={{ fontSize: "0.72rem", color: "var(--text-dim)" }}>{label}</span>
                    <span style={{ fontSize: "0.72rem", fontFamily: "monospace", color: "var(--text-muted)" }}>
                      {shortAddr(addr)}
                    </span>
                  </div>
                ))}
              </div>
            </details>
          </div>
        )}
      </main>

      {/* ── Footer ──────────────────────────────────────────────────── */}
      <footer className="footer">
        <p>ERC-20 Token Faucet · Sepolia Testnet · Built with React + Ethers.js</p>
      </footer>

      {/* ── Toast stack ─────────────────────────────────────────────── */}
      <div className="toast-stack">
        {toasts.map(({ id, msg, type }) => (
          <div key={id} className={`toast toast-${type}`}>{msg}</div>
        ))}
      </div>
    </div>
  );
}
