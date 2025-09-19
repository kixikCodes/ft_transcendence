import { ws } from "../services/ws.js";
import { navigate } from "../router/router.js";

export const TournamentController = async (root: HTMLElement) => {
    // Ensure user is authenticated, otherwise redirect to login
    try {
        const res = await fetch(`https://${location.host}/api/me`, { credentials: "include" });
        if (!res.ok) {
            navigate("/login");
            return;
        }
        const user = await res.json();
        if (!user || !user.id) {
            navigate("/login");
            return;
        }

        // Ensure websocket connection (Home.ts does this normally; safe to call here)
        try {
            if (typeof ws.connect === "function") ws.connect(user.id);
        } catch (err) {
            console.warn("WS connect failed:", err);
        }

        // Hook up UI controls (Tournament.html should provide these IDs/classes)
        const joinBtn = root.querySelector("#joinTournament") as HTMLButtonElement | null;
        const leaveBtn = root.querySelector("#leaveTournament") as HTMLButtonElement | null;
        const backBtn = root.querySelector("#backToHome") as HTMLButtonElement | null;
        const statusArea = root.querySelector("#tournamentStatus") as HTMLElement | null;

        const setStatus = (txt: string) => {
            if (statusArea) statusArea.textContent = txt;
        };

        if (joinBtn) {
            joinBtn.addEventListener("click", () => {
                try {
                    ws.send({ type: "joinTournament", userId: user.id });
                    setStatus("Join request sent...");
                } catch (err) {
                    console.error("Failed to send joinTournament:", err);
                    setStatus("Failed to send join request.");
                }
            });
        }

        if (leaveBtn) {
            leaveBtn.addEventListener("click", () => {
                try {
                    ws.send({ type: "leaveTournament", userId: user.id });
                    setStatus("Left tournament / cancel request.");
                } catch (err) {
                    console.error("Failed to send leaveTournament:", err);
                    setStatus("Failed to leave tournament.");
                }
            });
        }

        if (backBtn) {
            backBtn.addEventListener("click", () => {
                navigate("/");
            });
        }

        // Optional: listen for ws messages related to tournament updates
        const onMessage = (m: MessageEvent) => {
            try {
                const parsed = JSON.parse(m.data);
                if (parsed?.type === "tournamentUpdate") {
                    setStatus(parsed.payload?.message || "Tournament updated");
                } else if (parsed?.type === "tournamentEliminated") {
                    setStatus("You were eliminated from the tournament.");
                }
            } catch {}
        };

        // attach a temporary listener if ws exposes the raw socket
        if ((ws as any)._socket && typeof (ws as any)._socket.addEventListener === "function") {
            (ws as any)._socket.addEventListener("message", onMessage);
        }

        // Return teardown to be used by router when navigating away
        return () => {
            if ((ws as any)._socket && typeof (ws as any)._socket.removeEventListener === "function") {
                (ws as any)._socket.removeEventListener("message", onMessage);
            }
        };
    } catch (err) {
        console.error("TournamentController error:", err);
        navigate("/login");
    }
};