import React, { useState, useEffect } from 'react';

const API_URL = import.meta.env.VITE_API_URL;

export default function App() {
  const [items, setItems] = useState([]);
  const [name, setName] = useState('');
  const [error, setError] = useState('');

  async function fetchItems() {
    try {
      const res = await fetch(`${API_URL}/items`);
      const data = await res.json();
      setItems(data);
    } catch (err) {
      setError('Failed to load items.');
    }
  }

  useEffect(() => {
    fetchItems();
  }, []);

  async function handleAdd() {
    if (!name.trim()) return;
    try {
      const res = await fetch(`${API_URL}/items`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim() }),
      });
      if (!res.ok) {
        const data = await res.json();
        setError(data.error || 'Failed to add item.');
        return;
      }
      setName('');
      setError('');
      fetchItems();
    } catch (err) {
      setError('Failed to add item.');
    }
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter') handleAdd();
  }

  return (
    <div style={{ maxWidth: '480px', margin: '60px auto', fontFamily: 'sans-serif', background: '#fff' }}>
      <h1 style={{ fontSize: '1.5rem', marginBottom: '24px' }}>Items (Flask)</h1>

      <div style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Item name"
          style={{ flex: 1, padding: '8px', fontSize: '1rem', border: '1px solid #ccc', borderRadius: '4px' }}
        />
        <button
          onClick={handleAdd}
          style={{ padding: '8px 16px', fontSize: '1rem', cursor: 'pointer', borderRadius: '4px', border: '1px solid #ccc' }}
        >
          Add Item
        </button>
      </div>

      {error && <p style={{ color: 'red', marginBottom: '8px' }}>{error}</p>}

      <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
        {items.map((item) => (
          <li
            key={item.id ?? item._id}
            style={{ padding: '8px 0', borderBottom: '1px solid #eee' }}
          >
            {item.name}
          </li>
        ))}
      </ul>
    </div>
  );
}
