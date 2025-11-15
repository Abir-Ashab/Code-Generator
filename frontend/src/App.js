import React, { useState } from 'react';
import axios from 'axios';

function App() {
  const [query, setQuery] = useState('');
  const [response, setResponse] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await axios.post('http://localhost:5000/generate-code', { query });
      setResponse(res.data);
    } catch (error) {
      console.error('Error:', error);
      alert('Failed to generate code');
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center">
      <div className="bg-white p-8 rounded-lg shadow-md w-full max-w-md">
        <h1 className="text-2xl font-bold mb-4 text-center">AI Code Generator</h1>
        <form onSubmit={handleSubmit}>
          <textarea
            className="w-full p-2 border border-gray-300 rounded mb-4"
            rows="4"
            placeholder="Enter your code generation query..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            required
          />
          <button
            type="submit"
            className="w-full bg-blue-500 text-white p-2 rounded hover:bg-blue-600"
            disabled={loading}
          >
            {loading ? 'Generating...' : 'Generate Code'}
          </button>
        </form>
        {response && (
          <div className="mt-4">
            <h2 className="text-lg font-semibold">Generated Code:</h2>
            <pre className="bg-gray-200 p-2 rounded mt-2 overflow-x-auto">{response.code}</pre>
            <a
              href={response.fileUrl}
              download
              className="inline-block mt-2 bg-green-500 text-white px-4 py-2 rounded hover:bg-green-600"
            >
              Download .cpp File
            </a>
          </div>
        )}
      </div>
    </div>
  );
}

export default App;