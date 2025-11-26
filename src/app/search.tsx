export default function Search() {
  return (
    <div>
      <label htmlFor="summoner-name" style={{ fontWeight: "bold", marginRight: "8px" }}>Summoner Name:</label>
      <input type="text" id="summoner-name" className="bg-gray-200" placeholder="Search for a summoner..."
        style={{ backgroundColor: "white", color: "#000000ff", width: "200px" }}
      />
    </div>
  )
}
