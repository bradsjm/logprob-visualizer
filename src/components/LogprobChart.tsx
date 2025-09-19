/* eslint-disable import/order */
import { useMemo } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  ReferenceArea,
} from "recharts";

import type { TokenLP } from "@/types/logprob";
import {
  calculateQuantiles,
  getTokenColorClass,
  tokenColorToTextClass,
} from "@/lib/utils";

interface LogprobChartProps {
  readonly tokens: readonly TokenLP[];
  readonly onTokenClick: (tokenIndex: number) => void;
  readonly onTokenHover?: (tokenIndex: number | null) => void;
}

type ActivePayload = {
  payload: {
    index: number;
    logprob: number;
    prob: number;
    token: string;
    fullToken: string;
  };
};
type ChartClickEvent = { activePayload?: ActivePayload[] };

/**
 * Renders the token probability bar chart with interactive focus and streaming states.
 */
export const LogprobChart = ({
  tokens,
  onTokenClick,
  onTokenHover,
}: LogprobChartProps) => {
  const data = tokens.map((token, index) => ({
    index,
    logprob: token.logprob,
    prob: token.prob,
    token:
      token.token.length > 10 ? token.token.slice(0, 10) + "..." : token.token,
    fullToken: token.token,
  }));
  const { min, max } = useMemo(() => calculateQuantiles(tokens), [tokens]);

  const handlePointClick = (evt: unknown) => {
    const maybe = evt as ChartClickEvent;
    if (maybe && Array.isArray(maybe.activePayload) && maybe.activePayload[0]) {
      const tokenIndex = maybe.activePayload[0].payload.index;
      onTokenClick(tokenIndex);
    }
  };

  type TooltipPayloadItem = ActivePayload;
  type CustomTooltipProps = {
    active?: boolean;
    payload?: TooltipPayloadItem[];
    label?: number | string;
  };

  const CustomTooltip = ({ active, payload, label }: CustomTooltipProps) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      const tClass = tokenColorToTextClass(
        getTokenColorClass(data.logprob, min, max),
      );
      return (
        <div className="bg-popover border rounded-lg p-3 shadow-lg">
          <p className="font-medium">Token #{label}</p>
          <p className="text-sm">
            <code className={`bg-muted px-1 rounded text-xs ${tClass}`}>
              "{data.fullToken}"
            </code>
          </p>
          <p className="text-sm text-muted-foreground">
            Probability:{" "}
            <span className={`font-medium ${tClass}`}>
              {(data.prob * 100).toFixed(2)}%
            </span>
          </p>
          <p className="text-sm text-muted-foreground">
            Log probability:{" "}
            <span className={`font-medium ${tClass}`}>
              {data.logprob.toFixed(3)}
            </span>
          </p>
          <p className="text-xs text-muted-foreground pt-1">
            Click to scroll to token
          </p>
        </div>
      );
    }
    return null;
  };

  // Draw per-point dots using the token probability palette so dots match the legend.
  interface LineDotProps {
    readonly cx?: number;
    readonly cy?: number;
    readonly payload?: {
      readonly index: number;
      readonly logprob: number;
      readonly prob: number;
      readonly token: string;
      readonly fullToken: string;
    };
  }

  const colorForLogprob = (logprob: number): string => {
    const cls = getTokenColorClass(logprob, min, max);
    switch (cls) {
      case "token-low-prob":
        return "hsl(var(--token-low))";
      case "token-med-low-prob":
        return "hsl(var(--token-med-low))";
      case "token-med-high-prob":
        return "hsl(var(--token-med-high))";
      case "token-high-prob":
        return "hsl(var(--token-high))";
      default:
        return "hsl(var(--accent))";
    }
  };

  const ColoredDot: React.FC<LineDotProps> = ({ cx, cy, payload }) => {
    if (typeof cx !== "number" || typeof cy !== "number" || !payload)
      return null;
    const color = colorForLogprob(payload.logprob);
    return (
      <circle
        cx={cx}
        cy={cy}
        r={3}
        fill={color}
        stroke={color}
        strokeWidth={2}
      />
    );
  };

  const ColoredActiveDot: React.FC<LineDotProps> = ({ cx, cy, payload }) => {
    if (typeof cx !== "number" || typeof cy !== "number" || !payload)
      return null;
    const color = colorForLogprob(payload.logprob);
    // Slightly larger radius for active state to improve visibility
    return (
      <circle
        cx={cx}
        cy={cy}
        r={6}
        fill={color}
        stroke={color}
        strokeWidth={2}
      />
    );
  };

  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart
          data={data}
          margin={{ top: 16, right: 24, left: 30, bottom: 26 }}
          onClick={handlePointClick}
          onMouseMove={(evt) => {
            const maybe = evt as ChartClickEvent;
            const idx = maybe?.activePayload?.[0]?.payload?.index;
            if (typeof idx === "number") onTokenHover?.(idx);
          }}
          onMouseLeave={() => onTokenHover?.(null)}
        >
          <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
          <XAxis
            dataKey="index"
            type="number"
            domain={["dataMin", "dataMax"]}
            tick={{ fontSize: 12 }}
            tickMargin={6}
            label={{
              value: "Token Index",
              position: "insideBottom",
              dy: 10,
              style: { fontSize: 12, fill: "hsl(var(--muted-foreground))" },
            }}
          />
          <YAxis
            domain={[0, 1]}
            width={40}
            tick={{ fontSize: 12 }}
            tickFormatter={(v: number) => `${Math.round(v * 100)}%`}
            ticks={[0, 0.25, 0.5, 0.75, 1]}
            label={{
              value: "Probability (%)",
              angle: -90,
              position: "left",
              offset: 10,
              style: {
                fontSize: 12,
                fill: "hsl(var(--muted-foreground))",
                textAnchor: "middle",
              },
            }}
          />
          {/* Probability bands for quick reading */}
          <ReferenceArea
            y1={0}
            y2={0.25}
            fill="hsl(var(--token-low) / 0.12)"
            stroke="hsl(var(--token-low))"
            strokeOpacity={0.18}
          />
          <ReferenceArea
            y1={0.25}
            y2={0.5}
            fill="hsl(var(--token-med-low) / 0.12)"
            stroke="hsl(var(--token-med-low))"
            strokeOpacity={0.18}
          />
          <ReferenceArea
            y1={0.5}
            y2={0.75}
            fill="hsl(var(--token-med-high) / 0.12)"
            stroke="hsl(var(--token-med-high))"
            strokeOpacity={0.18}
          />
          <ReferenceArea
            y1={0.75}
            y2={1}
            fill="hsl(var(--token-high) / 0.12)"
            stroke="hsl(var(--token-high))"
            strokeOpacity={0.18}
          />
          <ReferenceLine
            y={0.5}
            stroke="hsl(var(--border))"
            strokeDasharray="4 4"
          />
          <Tooltip content={<CustomTooltip />} />
          <Line
            type="linear"
            dataKey="prob"
            stroke="hsl(var(--accent))"
            strokeWidth={2}
            dot={<ColoredDot />}
            activeDot={<ColoredActiveDot />}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
};
