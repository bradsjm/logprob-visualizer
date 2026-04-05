import { useEffect, useMemo, useRef, useState } from "react";

import {
  formatProbabilityPercent,
  getTokenColorClass,
  tokenColorToTextClass,
} from "@/lib/utils";
import type { TokenLP } from "@/types/logprob";

interface LogprobChartProps {
  readonly tokens: readonly TokenLP[];
  readonly onTokenClick: (tokenIndex: number) => void;
  readonly onTokenHover?: (tokenIndex: number | null) => void;
}

interface ChartPoint {
  index: number;
  x: number;
  y: number;
  prob: number;
  logprob: number;
  token: string;
}

const CHART_HEIGHT = 256;
const CHART_WIDTH = 720;
const MARGIN = { top: 16, right: 24, bottom: 28, left: 44 };

function colorForToken(prob: number): string {
  switch (getTokenColorClass(prob)) {
    case "token-low-prob":
      return "hsl(var(--token-low))";
    case "token-med-low-prob":
      return "hsl(var(--token-med-low))";
    case "token-med-high-prob":
      return "hsl(var(--token-med-high))";
    case "token-high-prob":
      return "hsl(var(--token-high))";
  }
}

function useMeasuredWidth<T extends HTMLElement>() {
  const ref = useRef<T | null>(null);
  const [width, setWidth] = useState(CHART_WIDTH);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    const observer = new ResizeObserver((entries) => {
      const nextWidth = entries[0]?.contentRect.width;
      if (typeof nextWidth === "number" && nextWidth > 0) {
        setWidth(nextWidth);
      }
    });

    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  return { ref, width };
}

export function LogprobChart({
  tokens,
  onTokenClick,
  onTokenHover,
}: LogprobChartProps) {
  const { ref, width } = useMeasuredWidth<HTMLDivElement>();
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  const plotWidth = Math.max(width - MARGIN.left - MARGIN.right, 1);
  const plotHeight = CHART_HEIGHT - MARGIN.top - MARGIN.bottom;
  const denominator = Math.max(tokens.length - 1, 1);

  const points = useMemo<ChartPoint[]>(
    () =>
      tokens.map((token, index) => ({
        index,
        x: MARGIN.left + (plotWidth * index) / denominator,
        y: MARGIN.top + (1 - token.prob) * plotHeight,
        prob: token.prob,
        logprob: token.logprob,
        token: token.token,
      })),
    [tokens, plotHeight, plotWidth, denominator],
  );

  const hoveredPoint =
    hoveredIndex === null ? null : points.find((point) => point.index === hoveredIndex) ?? null;

  const linePath = points
    .map((point, index) => `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`)
    .join(" ");

  const bands = [
    { start: 0, end: 0.25, fill: "hsl(var(--token-low) / 0.12)" },
    { start: 0.25, end: 0.5, fill: "hsl(var(--token-med-low) / 0.12)" },
    { start: 0.5, end: 0.75, fill: "hsl(var(--token-med-high) / 0.12)" },
    { start: 0.75, end: 1, fill: "hsl(var(--token-high) / 0.12)" },
  ];

  const yTicks = [0, 0.25, 0.5, 0.75, 1];

  return (
    <div ref={ref} className="relative h-64 w-full">
      <svg
        className="h-full w-full"
        viewBox={`0 0 ${width} ${CHART_HEIGHT}`}
        role="img"
        aria-label="Token probability chart"
        onMouseLeave={() => {
          setHoveredIndex(null);
          onTokenHover?.(null);
        }}
      >
        {bands.map((band) => {
          const top = MARGIN.top + (1 - band.end) * plotHeight;
          const height = (band.end - band.start) * plotHeight;
          return (
            <rect
              key={`${band.start}-${band.end}`}
              x={MARGIN.left}
              y={top}
              width={plotWidth}
              height={height}
              fill={band.fill}
            />
          );
        })}

        {yTicks.map((tick) => {
          const y = MARGIN.top + (1 - tick) * plotHeight;
          return (
            <g key={tick}>
              <line
                x1={MARGIN.left}
                x2={MARGIN.left + plotWidth}
                y1={y}
                y2={y}
                stroke="hsl(var(--border))"
                strokeDasharray={tick === 0.5 ? "4 4" : "3 3"}
                strokeOpacity={tick === 0.5 ? 1 : 0.4}
              />
              <text
                x={MARGIN.left - 8}
                y={y + 4}
                fontSize="12"
                textAnchor="end"
                fill="hsl(var(--muted-foreground))"
              >
                {Math.round(tick * 100)}%
              </text>
            </g>
          );
        })}

        <line
          x1={MARGIN.left}
          x2={MARGIN.left}
          y1={MARGIN.top}
          y2={MARGIN.top + plotHeight}
          stroke="hsl(var(--border))"
        />
        <line
          x1={MARGIN.left}
          x2={MARGIN.left + plotWidth}
          y1={MARGIN.top + plotHeight}
          y2={MARGIN.top + plotHeight}
          stroke="hsl(var(--border))"
        />

        {points.length > 1 ? (
          <path
            d={linePath}
            fill="none"
            stroke="hsl(var(--accent))"
            strokeWidth="2"
          />
        ) : null}

        {points.map((point) => {
          const color = colorForToken(point.prob);
          return (
            <circle
              key={point.index}
              cx={point.x}
              cy={point.y}
              r={hoveredIndex === point.index ? 6 : 4}
              fill={color}
              stroke={color}
              className="cursor-pointer"
              onClick={() => onTokenClick(point.index)}
              onMouseEnter={() => {
                setHoveredIndex(point.index);
                onTokenHover?.(point.index);
              }}
            />
          );
        })}

        <text
          x={MARGIN.left + plotWidth / 2}
          y={CHART_HEIGHT - 4}
          fontSize="12"
          textAnchor="middle"
          fill="hsl(var(--muted-foreground))"
        >
          Token Index
        </text>
      </svg>

      {hoveredPoint ? (
        <div
          className="pointer-events-none absolute z-10 -translate-x-1/2 rounded-lg border bg-popover p-3 shadow-lg"
          style={{
            left: hoveredPoint.x,
            top: Math.max(hoveredPoint.y - 108, 8),
          }}
        >
          <p className="font-medium">Token #{hoveredPoint.index}</p>
          <p className="text-sm">
            <code
              className={`rounded bg-muted px-1 text-xs ${tokenColorToTextClass(
                getTokenColorClass(hoveredPoint.prob),
              )}`}
            >
              "{hoveredPoint.token}"
            </code>
          </p>
          <p className="text-sm text-muted-foreground">
            Probability:{" "}
            <span className="font-medium">
              {formatProbabilityPercent(hoveredPoint.prob)}
            </span>
          </p>
          <p className="text-sm text-muted-foreground">
            Log probability:{" "}
            <span className="font-medium">
              {hoveredPoint.logprob.toFixed(3)}
            </span>
          </p>
          <p className="pt-1 text-xs text-muted-foreground">
            Click to scroll to token
          </p>
        </div>
      ) : null}
    </div>
  );
}
