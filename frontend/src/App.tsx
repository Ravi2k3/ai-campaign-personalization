import { useEffect, useState } from "react"

export default function App() {
  const [data, setData] = useState<{ data: string[]; count: number; test: string } | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetch("http://localhost:8000/dummy")
      .then((res) => res.json())
      .then((json) => {
        setData(json)
        setLoading(false)
      })
      .catch((err) => {
        setError(err.message)
        setLoading(false)
      })
  }, [])

  if (loading) return <div className="p-4">Loading...</div>
  if (error) return <div className="p-4 text-red-500">Error: {error}</div>

  return (
    <div className="p-4">
      <h1 className="text-2xl font-bold mb-4">CORS Test</h1>
      <p className="text-green-500 mb-2">{data?.test}</p>
      <p>Count: {data?.count}</p>
      <ul className="list-disc pl-5">
        {data?.data.map((item, i) => (
          <li key={i}>{item}</li>
        ))}
      </ul>
    </div>
  )
}