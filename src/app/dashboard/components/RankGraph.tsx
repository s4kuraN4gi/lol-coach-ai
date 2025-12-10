'use client'

import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

export default function RankGraph() {
    const data = [
        {date: "10/01", rank: 3, winRate: 51},
        {date: "10/05", rank: 2, winRate: 53},
        {date: "10/09", rank: 2, winRate: 55},
        {date: "10/13", rank: 1, winRate: 58},
        {date: "10/17", rank: 1, winRate: 60},
    ];
  return (
    <div className="glass-panel p-6 rounded-xl relative overflow-hidden">
        <h3 className="text-slate-200 text-lg font-bold mb-4 flex items-center gap-2">
            <span className="w-2 h-6 bg-blue-500 rounded-full"></span>
            ランク推移 & 勝率
        </h3>
        <ResponsiveContainer width="100%" height={250}>
        <LineChart data={data} margin={{top: 20, right: 30, left: 10, bottom: 0}}>
        <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
        <XAxis 
            dataKey="date" 
            stroke="#94a3b8" 
            tick={{fill: '#94a3b8', fontSize: 12}}
            tickLine={false}
            axisLine={false}
        />
        <YAxis 
            yAxisId="left"
            stroke="#94a3b8"
            tick={{fill: '#94a3b8', fontSize: 12}}
            fontFamily="monospace"
            domain={[4, 0]} // Mock 4(IV) to 0
            reversed
            tickFormatter={(value) => `T${value}`}
            hide
        />
        <YAxis 
            yAxisId="right"
            orientation="right"
            stroke="#94a3b8"
            tick={{fill: '#94a3b8', fontSize: 12}}
            domain={[40, 70]}
            tickLine={false}
            axisLine={false}
            unit="%"
        />
        <Tooltip 
            contentStyle={{backgroundColor: '#1e293b', borderColor: '#475569', color: '#f8fafc', borderRadius: '8px'}}
            itemStyle={{color: '#f8fafc'}}
        />
        <Line 
        yAxisId="left"
        type="monotone"
        dataKey="rank"
        stroke="#3b82f6"
        strokeWidth={3}
        dot={{r:6, fill: "#1e293b", strokeWidth: 2}}
        activeDot={{r:8, stroke: "#60a5fa"}}
        name="Rank Tier"
        />
        <Line 
        yAxisId="right"
        type="monotone"
        dataKey="winRate"
        stroke="#eab308"
        strokeWidth={3}
        dot={{r:0}}
        activeDot={{r:6}}
        name="Win Rate"
        />
        </LineChart>
        </ResponsiveContainer>
    </div>
  )
}


