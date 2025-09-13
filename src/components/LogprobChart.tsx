import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import type { TokenLP } from "@/types/logprob";

interface LogprobChartProps {
  tokens: TokenLP[];
  onTokenClick: (tokenIndex: number) => void;
}

export const LogprobChart = ({ tokens, onTokenClick }: LogprobChartProps) => {
  const data = tokens.map((token, index) => ({
    index,
    logprob: token.logprob,
    prob: token.prob,
    token: token.token.length > 10 ? token.token.slice(0, 10) + "..." : token.token,
    fullToken: token.token
  }));

  const handlePointClick = (data: any) => {
    if (data && data.activePayload && data.activePayload[0]) {
      const tokenIndex = data.activePayload[0].payload.index;
      onTokenClick(tokenIndex);
    }
  };

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-popover border rounded-lg p-3 shadow-lg">
          <p className="font-medium">Token #{label}</p>
          <p className="text-sm">
            <code className="bg-muted px-1 rounded text-xs">"{data.fullToken}"</code>
          </p>
          <p className="text-sm text-muted-foreground">
            Probability: <span className="font-medium">{(data.prob * 100).toFixed(2)}%</span>
          </p>
          <p className="text-sm text-muted-foreground">
            Log probability: <span className="font-medium">{data.logprob.toFixed(3)}</span>
          </p>
          <p className="text-xs text-muted-foreground pt-1">Click to scroll to token</p>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart
          data={data}
          margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
          onClick={handlePointClick}
        >
          <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
          <XAxis 
            dataKey="index" 
            type="number"
            domain={["dataMin", "dataMax"]}
            tick={{ fontSize: 12 }}
          />
          <YAxis 
            domain={["dataMin", "dataMax"]}
            tick={{ fontSize: 12 }}
          />
          <Tooltip content={<CustomTooltip />} />
          <Line 
            type="monotone" 
            dataKey="logprob" 
            stroke="hsl(var(--accent))" 
            strokeWidth={2}
            dot={{ fill: "hsl(var(--accent))", strokeWidth: 2, r: 4 }}
            activeDot={{ r: 6, stroke: "hsl(var(--accent))", strokeWidth: 2 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
};