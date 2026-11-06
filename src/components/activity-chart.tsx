"use client";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { activity } from "@/lib/mock-data";
import { useDataset } from "./data-provider";
export function ActivityChart({ days }: { days: number }) {
  const { activity } = useDataset();
  return (
    <div
      className="chart"
      role="img"
      aria-label={`Flagged comments over the last ${days} days of the synthetic dataset`}
    >
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart
          data={activity.slice(-days)}
          margin={{ left: -22, right: 12, top: 16, bottom: 0 }}
        >
          <defs>
            <linearGradient id="areaFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#2dd4bf" stopOpacity={0.24} />
              <stop offset="100%" stopColor="#2dd4bf" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid
            stroke="#26303b"
            vertical={false}
            strokeDasharray="3 6"
          />
          <XAxis
            dataKey="label"
            tick={{ fill: "#8693a5", fontSize: 11 }}
            axisLine={false}
            tickLine={false}
            minTickGap={36}
          />
          <YAxis
            tick={{ fill: "#8693a5", fontSize: 11 }}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip
            contentStyle={{
              background: "#151c27",
              border: "1px solid #34414e",
              borderRadius: 8,
              color: "#f1f5f9",
            }}
          />
          <Area
            isAnimationActive={false}
            type="monotone"
            dataKey="flagged"
            name="Annotated comments"
            stroke="#2dd4bf"
            strokeWidth={2.5}
            fill="url(#areaFill)"
            activeDot={{ r: 5, fill: "#c5f277" }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
