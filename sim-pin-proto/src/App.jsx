import React, { useEffect, useState, useRef } from "react";

/**
 * CONFIG - adjust gateway discovery / static link here
 */
const GATEWAY_LINK = "http://192.168.1.1/"; // change to https://... if gateway supports HTTPS
const POLL_INTERVAL_MS = 3000; // how often the app checks gateway status

/**
 * MOCK: Simulated gateway statuses.
 * Replace these functions with real API calls to the gateway.
 */
function createMockGateway() {
  // Internal simulated state: starts with PIN_REQUIRED, after some time becomes READY
  let state = { simStatus: "PIN_REQUIRED", connection: "DISCONNECTED" };

  // After 20 seconds the gateway "connects" to simulate the user entering PIN on WebUI
  setTimeout(() => {
    state.simStatus = "READY";
    state.connection = "CONNECTED";
  }, 20000);

  return {
    getStatus: async () => {
      // Simulate network latency
      await new Promise((r) => setTimeout(r, 200));
      return { simStatus: state.simStatus, connection: state.connection };
    },
    // Dummy unlock endpoint if you ever want to simulate in-app unlock
    unlockSim: async (pin) => {
      await new Promise((r) => setTimeout(r, 400));
      if (pin === "0000") {
        state.simStatus = "READY";
        state.connection = "CONNECTED";
        return { ok: true };
      } else {
        return { ok: false, error: "Wrong PIN" };
      }
    },
  };
}

const gateway = createMockGateway();

/* ---------- Modal component ---------- */
function SimWebUiModal({ open, onClose, onCheckConnection, gatewayLink }) {
  const linkRef = useRef(null);

  if (!open) return null;

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(gatewayLink);
      alert("Gateway link copied to clipboard");
    } catch {
      // fallback
      linkRef.current.select();
      document.execCommand("copy");
      alert("Gateway link copied (fallback)");
    }
  };

  const openWebUi = () => {
    window.open(gatewayLink, "_blank", "noopener,noreferrer");
  };

  return (
    <div className="modal-overlay" role="dialog" aria-modal="true">
      <div className="modal">
        <h2>SIM Card Locked</h2>
        <p>
          The SIM in your Gateway appears to be locked with a PIN. To continue,
          open the Gateway's web interface and enter the SIM PIN.
        </p>

        <div className="link-row">
          <input
            ref={linkRef}
            readOnly
            value={gatewayLink}
            className="link-input"
            aria-label="Gateway link"
          />
          <button className="btn" onClick={copyLink}>
            Copy Link
          </button>
        </div>

        <div className="actions">
          <button className="btn primary" onClick={openWebUi}>
            Open Gateway WebUI
          </button>

          <button
            className="btn"
            onClick={onCheckConnection}
            title="Tap after you enter the PIN in the Gateway WebUI"
          >
            I entered the PIN — Check connection
          </button>
        </div>

        <div className="note">
          Tip: After unlocking in the browser, return here and tap “Check
          connection.” The app will poll the gateway and resume when the SIM is
          ready.
        </div>

        <div style={{ textAlign: "right", marginTop: 12 }}>
          <button className="btn ghost" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

/* ---------- Main App ---------- */
export default function App() {
  const [simStatus, setSimStatus] = useState("UNKNOWN"); // UNKNOWN | PIN_REQUIRED | READY
  const [connected, setConnected] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const pollRef = useRef(null);

  // Poll function (replace gateway.getStatus with real fetch)
  const pollGatewayStatus = async () => {
    try {
      const status = await gateway.getStatus();
      setSimStatus(status.simStatus);
      setConnected(status.connection === "CONNECTED");
      // Automatically open modal when PIN required
      if (status.simStatus === "PIN_REQUIRED") {
        setModalOpen(true);
      }
    } catch (err) {
      console.error("Failed to poll gateway status:", err);
    }
  };

  useEffect(() => {
    // Start initial poll
    pollGatewayStatus();

    // Start interval polling
    pollRef.current = setInterval(pollGatewayStatus, POLL_INTERVAL_MS);
    return () => clearInterval(pollRef.current);
  }, []);

  useEffect(() => {
    // If connection becomes ready, close modal automatically
    if (simStatus === "READY") {
      setModalOpen(false);
    }
  }, [simStatus]);

  const manualCheck = async () => {
    await pollGatewayStatus();
    if (simStatus === "READY") {
      alert("SIM unlocked and connection established — continuing setup.");
    } else {
      alert("SIM still locked. Make sure you entered the PIN in the gateway WebUI.");
    }
  };

  return (
    <div className="app">
      <header>
        <h1>Nokia WiFi — SIM Unlock Flow Prototype</h1>
        <div className="status">
          <strong>SIM status:</strong> <span>{simStatus}</span>
          {" • "}
          <strong>Connection:</strong>{" "}
          <span>{connected ? "Connected" : "Disconnected"}</span>
        </div>
      </header>

      <main>
        <section className="card">
          <h3>Setup</h3>
          <p>
            This is a prototype demonstrating: detect SIM PIN requirement →
            popup → user opens Gateway WebUI to enter PIN → app resumes.
          </p>

          <div className="controls">
            <button
              className="btn primary"
              onClick={() => setModalOpen(true)}
              disabled={simStatus !== "PIN_REQUIRED"}
            >
              Show SIM unlock popup
            </button>

            <button className="btn" onClick={manualCheck}>
              Manual: Check connection
            </button>
          </div>
        </section>

        <section className="card">
          <h3>Notes</h3>
          <ul>
            <li>The Gateway link used: <code>{GATEWAY_LINK}</code></li>
            <li>No PIN is ever handled inside this prototype (WebUI only).</li>
            <li>Replace <code>gateway.getStatus()</code> with your actual API call.</li>
          </ul>
        </section>
      </main>

      <SimWebUiModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onCheckConnection={manualCheck}
        gatewayLink={GATEWAY_LINK}
      />

      <footer>Prototype — replace mock gateway code for production integration.</footer>
    </div>
  );
}
