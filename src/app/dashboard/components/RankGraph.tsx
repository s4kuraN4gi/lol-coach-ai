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
    <div className="p-6 bg-white rounded-xl shadow-sm border border-gray-200 text-center">
        <p className="text-gray-500">ランク推移グラフ</p>
        <ResponsiveContainer width="100%" height={250}>
        <LineChart data={data} margin={{top: 20, right: 30, left: 10, bottom: 0}}>
        <CartesianGrid strokeDasharray="3 3" stroke="#eee"/>
        <XAxis dataKey="date"/>
        <YAxis 
            yAxisId="left"
            label={{value: "ランク(Tier)", angle: -90, position:"insideLeft"}}
            domain={[4, 1]}
            reversed
        />
        <YAxis 
            yAxisId="right"
            orientation="right"
            label={{value: "勝率(%)", angle: -90, position: "insideRight"}}
        />
        <Tooltip />
        <Line 
        yAxisId="left"
        type="monotone"
        dataKey="rank"
        stroke="#3b82f6"
        strokeWidth={2}
        dot={{r:4}}
        name="ランク"
        />
        <Line 
        yAxisId="right"
        type="monotone"
        dataKey="winRate"
        stroke="#22c55e"
        strokeWidth={2}
        dot={{r:4}}
        name="勝率(%)"
        />
        </LineChart>
        </ResponsiveContainer>
    </div>
  )
}


