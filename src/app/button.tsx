type ButtonProps = {
  onClick?: () => void;
  children: React.ReactNode;
}

export default function Button({onClick, children}: ButtonProps) {
  return (
    <button onClick={onClick} className="bg-gray-200" style={{ backgroundColor: "white", border: "1px solid #000000ff", borderRadius: "4px", color: "#000000ff", width: "100px"}}>
      {children}
    </button>
  )
}