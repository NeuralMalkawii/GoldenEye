import { Navbar } from "@/components/Navbar";

const team = [
  {
    name:  "Omar Malkawi",
    role:  "Lead · Backend · DevOps",
    note:  "API, model inference, repo architecture.",
  },
  {
    name:  "Hamza Jad Allah",
    role:  "ML · Evaluation",
    note:  "Training pipeline, cross-dataset evaluation, W&B.",
  },
  {
    name:  "Suhaib Alajami",
    role:  "Infrastructure · Edge",
    note:  "Docker, CI/CD, Pi 5 + Hailo-8L deployment.",
  },
];


export default function AboutPage() {
  return (
    <>
      <Navbar />
      <main className="flex-1 page-enter max-w-7xl mx-auto px-6 py-12">
        <div className="mb-12">
          <p className="font-data mb-2" style={{ fontSize: "0.7rem", color: "var(--amber)", letterSpacing: "0.12em", textTransform: "uppercase" }}>
            About GoldenEye
          </p>
          <h1 className="font-display" style={{ fontSize: "clamp(2rem, 4vw, 3rem)", fontWeight: 300, color: "var(--sand)", fontOpticalSizing: "auto" }}>
            Edge-first SAR detection
          </h1>
        </div>

        <div className="grid lg:grid-cols-3 gap-10 mb-16">
          {/* Narrative */}
          <div className="lg:col-span-2">
            <p style={{ color: "var(--sand-dim)", lineHeight: 1.8, fontSize: "0.96rem", marginBottom: "1.2rem" }}>
              GoldenEye is a senior capstone project at the Hashemite University of Technology,
              supervised by Dr. Rami Al-Ouran. The goal is to build a production-grade,
              edge-deployable human-detection system for aerial Search &amp; Rescue in desert
              environments — specifically the UAE Empty Quarter and Jordan's Wadi Rum.
            </p>
            <p style={{ color: "var(--sand-dim)", lineHeight: 1.8, fontSize: "0.96rem", marginBottom: "1.2rem" }}>
              The detection model is a YOLOv8n trained first on the SARD dataset, then
              fine-tuned on the Shaheen UAE real-world dataset (contributed by the AUS Shaheen
              team). It achieves mAP@0.5 = 0.979 on the Shaheen held-out test set. The ONNX
              export runs at ~42 ms per frame on a standard CPU.
            </p>
            <p style={{ color: "var(--sand-dim)", lineHeight: 1.8, fontSize: "0.96rem", marginBottom: "1.2rem" }}>
              The novel scientific contributions are: (1) cross-environment generalization
              study (UAE → Wadi Rum red-sand domain), (2) altitude robustness curve, (3) degradation
              robustness evaluation. These experiments are what Shaheen — with only UAE data — could
              not run.
            </p>

            {/* Shaheen credit */}
            <div
              style={{
                background: "var(--surface)",
                border: "1px solid var(--amber-dim)",
                borderLeft: "3px solid var(--amber)",
                borderRadius: "0 6px 6px 0",
                padding: "1rem 1.25rem",
                marginTop: "1.5rem",
              }}
            >
              <p className="font-data mb-1" style={{ fontSize: "0.65rem", color: "var(--amber)", letterSpacing: "0.08em", textTransform: "uppercase" }}>
                Acknowledgment — Shaheen Project (AUS)
              </p>
              <p style={{ fontSize: "0.86rem", color: "var(--sand-dim)", lineHeight: 1.7 }}>
                The training data and pre-trained model weights were contributed by the Shaheen
                team at the American University of Sharjah: Yousef Irshaid, Malik Hader, Adham
                Elmosalamy, Ahmad Alsaleh, and Dr. Mohamed Alhajri. Their work is the foundation
                this project builds upon.
              </p>
            </div>
          </div>

          {/* Sidebar */}
          <div className="flex flex-col gap-4">
            <div className="ge-card" style={{ padding: "1.25rem" }}>
              <p className="font-data mb-4" style={{ fontSize: "0.65rem", color: "var(--amber)", letterSpacing: "0.1em", textTransform: "uppercase" }}>
                Project info
              </p>
              {[
                ["University",  "HTU — Al-Zarqa, Jordan"],
                ["Supervisor",  "Dr. Rami Al-Ouran"],
                ["Year",        "2025 / 2026"],
                ["Model",       "YOLOv8n · ONNX"],
                ["License",     "Academic use only"],
              ].map(([k, v]) => (
                <div key={k} style={{ display: "flex", justifyContent: "space-between", padding: "0.45rem 0", borderBottom: "1px solid var(--border)", fontSize: "0.82rem" }}>
                  <span style={{ color: "var(--sand-dim)" }}>{k}</span>
                  <span style={{ color: "var(--sand)" }}>{v}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Team */}
        <div style={{ borderTop: "1px solid var(--border)", paddingTop: "3rem", marginBottom: "3rem" }}>
          <p className="font-data mb-8" style={{ fontSize: "0.7rem", color: "var(--amber)", letterSpacing: "0.12em", textTransform: "uppercase" }}>
            Team
          </p>
          <div className="grid sm:grid-cols-3 gap-5">
            {team.map(({ name, role, note }) => (
              <div key={name} style={{ background: "var(--card-bg)", border: "1px solid var(--border)", borderRadius: 6, padding: "1.5rem" }}>
                {/* Abstract avatar */}
                <div
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: "50%",
                    background: "var(--amber-dim)",
                    border: "2px solid var(--amber)",
                    marginBottom: "1rem",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: "var(--amber-bright)",
                    fontFamily: "var(--font-fira-code)",
                    fontSize: "0.8rem",
                    fontWeight: 500,
                  }}
                >
                  {name.split(" ").map((p) => p[0]).join("")}
                </div>
                <h3 style={{ fontSize: "1rem", fontWeight: 600, color: "var(--sand)", marginBottom: "0.2rem" }}>
                  {name}
                </h3>
                <p className="font-data" style={{ fontSize: "0.68rem", color: "var(--amber)", letterSpacing: "0.05em", marginBottom: "0.6rem" }}>
                  {role}
                </p>
                <p style={{ fontSize: "0.82rem", color: "var(--sand-dim)", lineHeight: 1.5 }}>{note}</p>
              </div>
            ))}
          </div>
        </div>

      </main>
    </>
  );
}
