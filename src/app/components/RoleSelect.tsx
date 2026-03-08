type RoleSelectProps = {
    role: string,
    onChange: (value: string) => void;
};

export default function RoleSelect({role, onChange}: RoleSelectProps) {
  return (
    <div className="mt-4 mb-4">
        <label 
        htmlFor="role" 
        className="mb-2 font-semibold text-white-700 tracking-wide" 
        >
        ロールを選択
        </label>
        <select
        id="role"
        value={role}
        onChange={(e) => onChange(e.target.value)}
        className="border border-gray-400 rounded-lg px-4 py-2 bg-white shadow-sm text-black focus:ring-2 focus:ring-blue-400 focus:border-blue-400 transition w-48 text-center"
        >
        <option value="Top">Top</option>
        <option value="Jungle">Jungle</option>
        <option value="Mid">Mid</option>
        <option value="ADC">ADC</option>
        <option value="Support">Support</option>
        </select>
        <p className="mt-3 text-sm text-gray-500">
            現在の選択: <span className="font-medium text-blue-600">{role}</span>

        </p>

    </div>
  )
}
