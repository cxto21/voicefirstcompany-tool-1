import { useEffect, useRef, useState } from "react";
import { defaultUniformSeed, webGpuShaderSource } from "../lib/shaderSource";
import { PreferencesStore, hexToRgb01 } from "../lib/preferencesStore";
import { OrbColorPalette, UserPreferences, VoiceState } from "../types";

interface LiquidOrbProps {
  voiceState: VoiceState;
  audioLevel: number;
  preferences?: UserPreferences;
  palette?: OrbColorPalette;
  onOrbClick?: () => void;
}

export function LiquidOrb({ voiceState, audioLevel, preferences, palette, onOrbClick }: LiquidOrbProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [useFallback, setUseFallback] = useState(false);
  const [isReady, setIsReady] = useState(false);
  const [currentPrefs, setCurrentPrefs] = useState<UserPreferences>(() =>
    preferences || PreferencesStore.getPreferences()
  );

  // Sync preferences from prop or store
  useEffect(() => {
    if (preferences) {
      setCurrentPrefs(preferences);
    }
  }, [preferences]);

  useEffect(() => {
    const unsub = PreferencesStore.subscribe((updated) => {
      setCurrentPrefs(updated);
    });
    return unsub;
  }, []);

  // Keep latest props in refs for animation loop
  const stateRef = useRef(voiceState);
  stateRef.current = voiceState;
  const levelRef = useRef(audioLevel);
  levelRef.current = audioLevel;
  const prefsRef = useRef(currentPrefs);
  prefsRef.current = currentPrefs;
  const paletteRef = useRef<OrbColorPalette | undefined>(palette);
  paletteRef.current = palette;

  // WebGPU renderer setup
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    let animationFrame = 0;
    let device: any = null;
    let stopped = false;

    async function initWebGPU() {
      if (!navigator.gpu) {
        setUseFallback(true);
        return;
      }

      try {
        const adapter = await navigator.gpu.requestAdapter({
          powerPreference: "high-performance",
        });
        if (!adapter) {
          setUseFallback(true);
          return;
        }

        device = await adapter.requestDevice();
        if (stopped) {
          device?.destroy();
          return;
        }

        const context = canvas?.getContext("webgpu");
        if (!context) {
          setUseFallback(true);
          return;
        }

        const format = navigator.gpu.getPreferredCanvasFormat();
        context.configure({ device, format, alphaMode: "premultiplied" });

        const shader = device.createShaderModule({ code: webGpuShaderSource });
        const compilation = await shader.getCompilationInfo();
        const errors = compilation.messages.filter((m: any) => m.type === "error");
        if (errors.length) {
          console.warn("WebGPU compilation errors:", errors);
          setUseFallback(true);
          return;
        }

        const pipeline = device.createRenderPipeline({
          layout: "auto",
          vertex: { module: shader, entryPoint: "vs_main" },
          fragment: { module: shader, entryPoint: "fs_main", targets: [{ format }] },
          primitive: { topology: "triangle-list" },
        });

        const uniformValues = new Float32Array(defaultUniformSeed);
        const uniformUsage =
          (typeof GPUBufferUsage !== "undefined" && GPUBufferUsage.UNIFORM && GPUBufferUsage.COPY_DST)
            ? (GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST)
            : 0x0040 | 0x0008;

        const uniformBuffer = device.createBuffer({
          size: uniformValues.byteLength,
          usage: uniformUsage,
        });

        const bindGroup = device.createBindGroup({
          layout: pipeline.getBindGroupLayout(0),
          entries: [{ binding: 0, resource: { buffer: uniformBuffer } }],
        });

        const startedAt = performance.now();
        setIsReady(true);

        device.lost.then(() => {
          if (!stopped) setUseFallback(true);
        });

        function renderFrame(now: number) {
          if (stopped || !canvas) return;
          try {
            const dpr = Math.min(window.devicePixelRatio || 1, 2);
            const width = Math.max(1, Math.floor(canvas.clientWidth * dpr));
            const height = Math.max(1, Math.floor(canvas.clientHeight * dpr));

            if (canvas.width !== width || canvas.height !== height) {
              canvas.width = width;
              canvas.height = height;
            }

            const elapsed = (now - startedAt) / 1000;
            const currentState = stateRef.current;
            const currentLevel = levelRef.current; // 0..1
            const userPrefs = prefsRef.current;
            const palette = paletteRef.current || PreferencesStore.getActivePalette(userPrefs);

            // Dynamic uniform parameter adjustment according to voice state and user preferences
            uniformValues[0] = width;
            uniformValues[1] = height;
            uniformValues[2] = elapsed;

            const speedFactor = userPrefs.speedMultiplier || 1.0;
            const warpFactor = userPrefs.fluidReactivity || 1.0;
            const glowFactor = userPrefs.glowIntensity || 1.0;
            const glassOn = userPrefs.glassRefraction !== false ? 1.0 : 0.0;

            uniformValues[19] = glassOn; // glassEnabled
            uniformValues[20] = glassOn * 0.45; // glassOpacity

            if (currentState === "listening") {
              // Reacting to user speech
              uniformValues[3] = (1.25 + currentLevel * 1.8) * speedFactor; // speed
              uniformValues[4] = 0.70 + currentLevel * 0.08; // radius
              uniformValues[6] = (2.7 + currentLevel * 1.8) * warpFactor; // warp
              uniformValues[7] = 0.5 + currentLevel * 0.45; // ridgeAmt
              uniformValues[17] = (0.35 + currentLevel * 0.85) * glowFactor; // edgeGlow
              uniformValues[21] = 0.12 + currentLevel * 0.5; // contourDeform
              uniformValues[14] = 1.38 + currentLevel * 0.25; // exposure
            } else if (currentState === "thinking") {
              // Rapid undulating computation pulse
              const pulse = (Math.sin(elapsed * 6.0) + 1) * 0.5;
              uniformValues[3] = 2.4 * speedFactor; // speed
              uniformValues[4] = 0.67 + pulse * 0.03; // radius
              uniformValues[6] = 3.6 * warpFactor; // warp
              uniformValues[7] = 0.75; // ridgeAmt
              uniformValues[17] = (0.6 + pulse * 0.3) * glowFactor; // edgeGlow
              uniformValues[21] = 0.22 + pulse * 0.15; // contourDeform
              uniformValues[14] = 1.45 + pulse * 0.2; // exposure
            } else if (currentState === "speaking") {
              // Cortex speaking back, rippling voice membrane
              uniformValues[3] = (1.5 + currentLevel * 2.2) * speedFactor; // speed
              uniformValues[4] = 0.72 + currentLevel * 0.09; // radius
              uniformValues[6] = (3.2 + currentLevel * 2.0) * warpFactor; // warp
              uniformValues[7] = 0.65 + currentLevel * 0.5; // ridgeAmt
              uniformValues[17] = (0.55 + currentLevel * 0.95) * glowFactor; // edgeGlow
              uniformValues[21] = 0.16 + currentLevel * 0.6; // contourDeform
              uniformValues[14] = 1.4 + currentLevel * 0.3; // exposure
            } else {
              // Idle: gentle hypnotic breathing
              const breath = (Math.sin(elapsed * 1.5) + 1) * 0.5;
              uniformValues[3] = 0.92 * speedFactor; // speed
              uniformValues[4] = 0.68 + breath * 0.02; // radius
              uniformValues[6] = 2.5 * warpFactor; // warp
              uniformValues[7] = 0.46; // ridgeAmt
              uniformValues[17] = (0.12 + breath * 0.08) * glowFactor; // edgeGlow
              uniformValues[21] = 0.08 + breath * 0.04; // contourDeform
              uniformValues[14] = 1.35; // exposure
            }

            // Apply selected color palette to shader uniforms
            // colorA (vec4) at 32
            uniformValues[32] = palette.colorA[0];
            uniformValues[33] = palette.colorA[1];
            uniformValues[34] = palette.colorA[2];
            uniformValues[35] = 1.0;

            // colorB (vec4) at 36
            uniformValues[36] = palette.colorB[0];
            uniformValues[37] = palette.colorB[1];
            uniformValues[38] = palette.colorB[2];
            uniformValues[39] = 1.0;

            // colorC (vec4) at 40
            uniformValues[40] = palette.colorC[0];
            uniformValues[41] = palette.colorC[1];
            uniformValues[42] = palette.colorC[2];
            uniformValues[43] = 1.0;

            // colorD (vec4) at 44
            uniformValues[44] = palette.colorD[0];
            uniformValues[45] = palette.colorD[1];
            uniformValues[46] = palette.colorD[2];
            uniformValues[47] = 1.0;

            // highlightColor (vec4) at 48
            uniformValues[48] = palette.highlightColor[0];
            uniformValues[49] = palette.highlightColor[1];
            uniformValues[50] = palette.highlightColor[2];
            uniformValues[51] = 1.0;

            // glowColor (vec4) at 76
            uniformValues[76] = palette.glowColor[0];
            uniformValues[77] = palette.glowColor[1];
            uniformValues[78] = palette.glowColor[2];
            uniformValues[79] = 1.0;

            device.queue.writeBuffer(uniformBuffer, 0, uniformValues);

            const encoder = device.createCommandEncoder();
            const pass = encoder.beginRenderPass({
              colorAttachments: [
                {
                  view: context.getCurrentTexture().createView(),
                  clearValue: { r: 0.008, g: 0.004, b: 0.02, a: 1 },
                  loadOp: "clear",
                  storeOp: "store",
                },
              ],
            });
            pass.setPipeline(pipeline);
            pass.setBindGroup(0, bindGroup);
            pass.draw(3);
            pass.end();
            device.queue.submit([encoder.finish()]);

            animationFrame = requestAnimationFrame(renderFrame);
          } catch (e) {
            console.warn("Render loop warning:", e);
            if (!stopped) {
              setUseFallback(true);
            }
          }
        }

        animationFrame = requestAnimationFrame(renderFrame);
      } catch (err) {
        console.warn("WebGPU initialization failed:", err);
        setUseFallback(true);
      }
    }

    initWebGPU();

    return () => {
      stopped = true;
      cancelAnimationFrame(animationFrame);
      device?.destroy();
    };
  }, [useFallback]);

  // WebGL / Canvas Fallback Renderer for environments without WebGPU
  useEffect(() => {
    if (!useFallback) return;
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animationFrame = 0;
    const startedAt = performance.now();
    setIsReady(true);

    function renderFallback(now: number) {
      if (!canvas || !ctx) return;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const w = canvas.clientWidth * dpr;
      const h = canvas.clientHeight * dpr;
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w;
        canvas.height = h;
      }

      ctx.clearRect(0, 0, w, h);

      const elapsed = (now - startedAt) / 1000;
      const cx = w / 2;
      const cy = h / 2;
      const baseRadius = Math.min(w, h) * 0.32;
      const level = levelRef.current;
      const state = stateRef.current;
      const userPrefs = prefsRef.current;
      const palette = paletteRef.current || PreferencesStore.getActivePalette(userPrefs);

      const glowFactor = userPrefs.glowIntensity || 1.0;
      const deformFactorMultiplier = userPrefs.fluidReactivity || 1.0;
      const deformSpeed = (state === "thinking" ? 4.0 : 1.5) * (userPrefs.speedMultiplier || 1.0);

      const dynamicRadius =
        state === "listening" || state === "speaking"
          ? baseRadius * (1 + level * 0.22)
          : state === "thinking"
          ? baseRadius * (0.95 + Math.sin(elapsed * 8) * 0.05)
          : baseRadius * (1 + Math.sin(elapsed * 2) * 0.03);

      const gRgb = palette.glowColor;
      const r255 = Math.round(gRgb[0] * 255);
      const g255 = Math.round(gRgb[1] * 255);
      const b255 = Math.round(gRgb[2] * 255);

      // Deep glowing aura with active palette color
      const auraGrad = ctx.createRadialGradient(
        cx,
        cy,
        dynamicRadius * 0.2,
        cx,
        cy,
        dynamicRadius * (1.4 + 0.3 * glowFactor)
      );
      auraGrad.addColorStop(0, `rgba(${r255}, ${g255}, ${b255}, ${0.45 * glowFactor})`);
      auraGrad.addColorStop(0.5, `rgba(${Math.round(r255 * 0.5)}, ${Math.round(g255 * 0.5)}, ${Math.round(b255 * 0.5)}, ${0.2 * glowFactor})`);
      auraGrad.addColorStop(1, "rgba(2, 1, 5, 0)");

      ctx.fillStyle = auraGrad;
      ctx.beginPath();
      ctx.arc(cx, cy, dynamicRadius * (1.4 + 0.3 * glowFactor), 0, Math.PI * 2);
      ctx.fill();

      // Deformed liquid orb perimeter
      ctx.save();
      ctx.beginPath();
      const points = 64;
      const deformFactor =
        (state === "listening" || state === "speaking"
          ? 0.08 + level * 0.18
          : state === "thinking"
          ? 0.12
          : 0.05) * deformFactorMultiplier;

      for (let i = 0; i <= points; i++) {
        const angle = (i / points) * Math.PI * 2;
        const wave =
          Math.sin(angle * 3 + elapsed * deformSpeed) * 0.6 +
          Math.sin(angle * 5 - elapsed * deformSpeed * 0.8) * 0.4;
        const r = dynamicRadius * (1 + wave * deformFactor);
        const px = cx + Math.cos(angle) * r;
        const py = cy + Math.sin(angle) * r;
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.closePath();

      // Liquid glass core gradient with user palette
      const orbGrad = ctx.createLinearGradient(
        cx - dynamicRadius,
        cy - dynamicRadius,
        cx + dynamicRadius,
        cy + dynamicRadius
      );
      orbGrad.addColorStop(0, palette.primaryHex);
      orbGrad.addColorStop(0.35, palette.secondaryHex);
      orbGrad.addColorStop(0.7, palette.accentHex);
      orbGrad.addColorStop(1, "#0a0218");

      ctx.fillStyle = orbGrad;
      ctx.fill();

      // Internal fluid ripples
      ctx.lineWidth = 3 * dpr;
      ctx.strokeStyle = `rgba(${r255}, ${g255}, ${b255}, 0.35)`;
      ctx.stroke();

      // Specular rim light
      const rimGrad = ctx.createRadialGradient(
        cx - dynamicRadius * 0.35,
        cy - dynamicRadius * 0.45,
        dynamicRadius * 0.1,
        cx,
        cy,
        dynamicRadius
      );
      rimGrad.addColorStop(0, "rgba(255, 255, 255, 0.45)");
      rimGrad.addColorStop(0.4, `rgba(${r255}, ${g255}, ${b255}, 0.15)`);
      rimGrad.addColorStop(1, "rgba(0, 0, 0, 0)");
      ctx.fillStyle = rimGrad;
      ctx.fill();

      ctx.restore();

      animationFrame = requestAnimationFrame(renderFallback);
    }

    animationFrame = requestAnimationFrame(renderFallback);

    return () => {
      cancelAnimationFrame(animationFrame);
    };
  }, [useFallback]);

  return (
    <div
      id="cortex-orb-container"
      onClick={onOrbClick}
      className="relative w-full h-full flex items-center justify-center cursor-pointer select-none touch-manipulation overflow-hidden"
    >
      <canvas
        ref={canvasRef}
        id="orb"
        className={`w-full h-full transition-opacity duration-700 ${
          isReady ? "opacity-100" : "opacity-0"
        }`}
        aria-label="Liquid Orb"
      />
    </div>
  );
}
