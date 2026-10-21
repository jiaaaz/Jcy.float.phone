"use client";

import { useEffect, useState } from "react";

/**
 * 布局诊断面板（临时工具，定位完成后可整块删除）。
 *
 * 只在 URL 带 `?layoutdiag=1` 时渲染，正常使用完全不受影响。
 *
 * 为什么需要它：手机端「图标整体偏右、只能看到一小部分」这类问题，可能来自
 * 视口宽度、媒体查询命中、容器宽度、滑动层 transform、网格列宽中的任意一层。
 * 在拿不到真机实测数据前逐个改 CSS 只会反复试错，所以这里把每一层的关键
 * 数值一次性摊开，直接看是哪一层开始偏的。
 */

type Row = { label: string; value: string };

function px(value: number | undefined | null): string {
  if (value == null || !Number.isFinite(value)) return "-";
  return `${Math.round(value * 100) / 100}px`;
}

export function LayoutDiagnostic() {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (new URLSearchParams(window.location.search).get("layoutdiag") !== "1") return;

    const measure = () => {
      const q = (selector: string) => document.querySelector<HTMLElement>(selector);
      const box = (el: HTMLElement | null) => (el ? el.getBoundingClientRect() : null);
      const rootCs = getComputedStyle(document.documentElement);

      const wrap = q(".phone-shell-wrap");
      const caseEl = q(".phone-case");
      const shell = q(".phone-shell");
      const workspace = q(".phone-workspace");
      const swipe = q(".phone-swipe-layer");
      const grid = q(".icon-grid");
      const appRoot = q(".app-root");

      const wrapRect = box(wrap);
      const caseRect = box(caseEl);
      const shellRect = box(shell);
      const workspaceRect = box(workspace);
      const swipeRect = box(swipe);
      const gridRect = box(grid);
      const appRootRect = box(appRoot);

      const swipeCs = swipe ? getComputedStyle(swipe) : null;
      const gridCs = grid ? getComputedStyle(grid) : null;
      const workspaceCs = workspace ? getComputedStyle(workspace) : null;
      const shellCs = shell ? getComputedStyle(shell) : null;

      const viewport = window.visualViewport;

      setRows([
        { label: "innerWidth / clientWidth", value: `${window.innerWidth} / ${document.documentElement.clientWidth}` },
        { label: "visualViewport w / scale", value: viewport ? `${Math.round(viewport.width)} / ${viewport.scale}` : "-" },
        { label: "devicePixelRatio", value: String(window.devicePixelRatio) },
        { label: "html / body scrollLeft", value: `${document.documentElement.scrollLeft} / ${document.body.scrollLeft}` },
        { label: "media ≤500px", value: String(window.matchMedia("(max-width: 500px)").matches) },
        { label: "media hover:none", value: String(window.matchMedia("(hover: none)").matches) },
        { label: "media pointer:coarse", value: String(window.matchMedia("(pointer: coarse)").matches) },
        { label: "--phone-screen-width (root)", value: rootCs.getPropertyValue("--phone-screen-width").trim() || "(未定义)" },
        { label: "--phone-total-width (wrap)", value: wrap ? getComputedStyle(wrap).getPropertyValue("--phone-total-width").trim() || "(未定义)" : "-" },
        { label: "app-root", value: appRootRect ? `x=${px(appRootRect.left)} w=${px(appRootRect.width)}` : "-" },
        { label: "wrap", value: wrapRect ? `x=${px(wrapRect.left)} w=${px(wrapRect.width)}` : "-" },
        { label: "case", value: caseRect ? `x=${px(caseRect.left)} w=${px(caseRect.width)}` : "-" },
        { label: "shell", value: shellRect ? `x=${px(shellRect.left)} w=${px(shellRect.width)} h=${px(shellRect.height)}` : "-" },
        { label: "shell padding", value: shellCs ? shellCs.padding : "-" },
        { label: "workspace", value: workspaceRect ? `x=${px(workspaceRect.left)} w=${px(workspaceRect.width)}` : "-" },
        { label: "workspace margin/overflow", value: workspaceCs ? `${workspaceCs.marginLeft} / ${workspaceCs.overflowX}` : "-" },
        { label: "swipe", value: swipeRect ? `x=${px(swipeRect.left)} w=${px(swipeRect.width)}` : "-" },
        { label: "swipe transform", value: swipeCs?.transform ?? "-" },
        {
          label: "--swipe-page / --swipe-drag",
          value: swipeCs
            ? `${swipeCs.getPropertyValue("--swipe-page").trim() || "0"} / ${swipeCs.getPropertyValue("--swipe-drag").trim() || "0px"}`
            : "-",
        },
        { label: "grid", value: gridRect ? `x=${px(gridRect.left)} w=${px(gridRect.width)}` : "-" },
        { label: "grid --slot-size", value: gridCs?.getPropertyValue("--slot-size").trim() || "-" },
        { label: "grid columns", value: gridCs?.gridTemplateColumns || "-" },
        { label: "grid justify / gap", value: gridCs ? `${gridCs.justifyContent} / ${gridCs.columnGap}` : "-" },
      ]);
    };

    measure();
    // 首帧之后字体/主题变量可能再变一次，补测一次
    const timer = window.setTimeout(measure, 900);
    window.addEventListener("resize", measure);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("resize", measure);
    };
  }, []);

  if (!rows) return null;

  const plainText = rows.map((row) => `${row.label}: ${row.value}`).join("\n");

  return (
    <div
      style={{
        position: "fixed",
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 2147483000,
        maxHeight: "72vh",
        overflow: "auto",
        padding: "10px 12px 14px",
        background: "rgba(8, 10, 16, 0.95)",
        color: "#e8eefc",
        font: "11px/1.6 ui-monospace, SFMono-Regular, Menlo, monospace",
        borderTop: "1px solid rgba(255, 255, 255, 0.16)",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, marginBottom: 6 }}>
        <strong style={{ fontSize: 12 }}>布局诊断</strong>
        <button
          type="button"
          onClick={() => {
            void navigator.clipboard
              ?.writeText(plainText)
              .then(() => setCopied(true))
              .catch(() => undefined);
          }}
          style={{
            appearance: "none",
            border: "1px solid rgba(255,255,255,0.28)",
            background: "transparent",
            color: "inherit",
            borderRadius: 6,
            padding: "3px 10px",
            font: "inherit",
          }}
        >
          {copied ? "已复制" : "复制"}
        </button>
      </div>
      {rows.map((row) => (
        <div key={row.label} style={{ display: "flex", gap: 10, justifyContent: "space-between" }}>
          <span style={{ opacity: 0.66, flex: "0 0 auto" }}>{row.label}</span>
          <span style={{ textAlign: "right", wordBreak: "break-all" }}>{row.value}</span>
        </div>
      ))}
    </div>
  );
}
