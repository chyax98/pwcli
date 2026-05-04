"use client";

import { useState } from "react";
import { ShoppingBag, Search, RefreshCw, Trash2 } from "lucide-react";

interface Product {
  id: number;
  name: string;
  price: number;
  category: string;
  inStock: boolean;
}

interface FetchState {
  status: "idle" | "loading" | "success" | "error";
  products: Product[];
  raw: string;
  error: string;
  requestCount: number;
}

export default function RouteMockPage() {
  const [state, setState] = useState<FetchState>({
    status: "idle",
    products: [],
    raw: "",
    error: "",
    requestCount: 0,
  });

  async function fetchProducts(query?: string) {
    const url = query ? `/api/products?q=${encodeURIComponent(query)}` : "/api/products";
    setState((prev) => ({
      ...prev,
      status: "loading",
      error: "",
      requestCount: prev.requestCount + 1,
    }));

    try {
      const res = await fetch(url);
      const data = await res.json();
      if (!res.ok) {
        setState((prev) => ({
          ...prev,
          status: "error",
          error: data.error ?? `HTTP ${res.status}`,
          raw: JSON.stringify(data, null, 2),
        }));
        return;
      }
      setState((prev) => ({
        ...prev,
        status: "success",
        products: data.products ?? [],
        raw: JSON.stringify(data, null, 2),
        error: "",
      }));
    } catch (e) {
      setState((prev) => ({
        ...prev,
        status: "error",
        error: String(e),
        raw: "",
        products: [],
      }));
    }
  }

  function clearResults() {
    setState({
      status: "idle",
      products: [],
      raw: "",
      error: "",
      requestCount: 0,
    });
  }

  return (
    <div data-testid="route-mock-page" aria-label="Route mock test page">
      <h1 className="text-2xl font-bold text-zinc-100 mb-1">Route Mock</h1>
      <p className="text-sm text-zinc-500 mb-8">
        Test <code className="text-indigo-400">/api/products</code> endpoint.
        Use <code className="text-indigo-400">pw route</code> to intercept and mock responses.
      </p>

      {/* Controls */}
      <div className="bg-zinc-800 border border-zinc-700 rounded-xl p-6 mb-6">
        <h2 className="text-sm font-semibold text-zinc-200 mb-4">Request Controls</h2>

        <div className="flex flex-wrap gap-3 mb-4">
          <button
            data-testid="load-products"
            aria-label="Load all products from API"
            aria-busy={state.status === "loading"}
            onClick={() => fetchProducts()}
            disabled={state.status === "loading"}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-all duration-150"
          >
            {state.status === "loading"
              ? <RefreshCw size={14} className="animate-spin" aria-hidden="true" />
              : <ShoppingBag size={14} aria-hidden="true" />
            }
            Load Products
          </button>

          <button
            data-testid="search-products"
            aria-label="Search products with query laptop"
            aria-busy={state.status === "loading"}
            onClick={() => fetchProducts("laptop")}
            disabled={state.status === "loading"}
            className="flex items-center gap-2 px-4 py-2 bg-zinc-700 hover:bg-zinc-600 disabled:opacity-50 text-zinc-200 text-sm font-medium rounded-lg transition-all duration-150"
          >
            <Search size={14} aria-hidden="true" />
            Search &quot;laptop&quot;
          </button>

          <button
            data-testid="clear-results"
            aria-label="Clear all results"
            onClick={clearResults}
            className="flex items-center gap-2 px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-400 text-sm font-medium rounded-lg border border-zinc-700 transition-all duration-150"
          >
            <Trash2 size={14} aria-hidden="true" />
            Clear
          </button>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs text-zinc-500">Requests made:</span>
          <span
            data-testid="request-count"
            aria-label={`Request count: ${state.requestCount}`}
            aria-live="polite"
            className="px-2 py-0.5 text-xs font-mono font-bold text-indigo-400 bg-indigo-600/10 border border-indigo-600/20 rounded"
          >
            {state.requestCount}
          </span>
        </div>
      </div>

      {/* Error display */}
      {state.status === "error" && (
        <div
          data-testid="products-error"
          aria-label="Products fetch error"
          aria-live="assertive"
          className="bg-red-900/20 border border-red-700/40 rounded-xl p-4 mb-6 text-sm text-red-300"
        >
          <span className="font-semibold text-red-400">Error: </span>
          {state.error}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Product cards */}
        <div>
          <h2 className="text-sm font-semibold text-zinc-300 mb-3">
            Products ({state.products.length})
          </h2>
          <div
            data-testid="products-result"
            aria-label="Products result list"
            aria-live="polite"
            className="space-y-2"
          >
            {state.status === "idle" && state.products.length === 0 && (
              <div className="bg-zinc-800 border border-zinc-700 rounded-xl p-6 text-center">
                <p className="text-sm text-zinc-600">Click &quot;Load Products&quot; to fetch data.</p>
              </div>
            )}
            {state.status === "loading" && (
              <div className="bg-zinc-800 border border-zinc-700 rounded-xl p-6 text-center">
                <RefreshCw size={20} className="animate-spin text-indigo-400 mx-auto mb-2" aria-hidden="true" />
                <p className="text-sm text-zinc-500">Loading…</p>
              </div>
            )}
            {state.products.map((product) => (
              <div
                key={product.id}
                data-testid={`product-${product.id}`}
                aria-label={`Product: ${product.name}`}
                className="bg-zinc-800 border border-zinc-700 rounded-xl p-4 flex items-start justify-between"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-sm font-medium text-zinc-200 truncate">{product.name}</span>
                    {product.inStock
                      ? <span className="px-1.5 py-0.5 text-xs bg-green-600/20 text-green-400 border border-green-600/30 rounded-full">In Stock</span>
                      : <span className="px-1.5 py-0.5 text-xs bg-red-600/20 text-red-400 border border-red-600/30 rounded-full">Out</span>
                    }
                  </div>
                  <div className="flex items-center gap-3 text-xs text-zinc-500">
                    <span className="text-xs px-1.5 py-0.5 bg-zinc-700 rounded">{product.category}</span>
                    <span>ID: {product.id}</span>
                  </div>
                </div>
                <div className="text-sm font-bold text-indigo-400 ml-4">
                  ${product.price.toFixed(2)}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Raw response */}
        <div>
          <h2 className="text-sm font-semibold text-zinc-300 mb-3">Raw Response</h2>
          <div
            data-testid="products-raw"
            aria-label="Raw API response"
            aria-live="polite"
            className="bg-zinc-900 border border-zinc-700 rounded-xl p-4 min-h-[200px] max-h-[500px] overflow-auto"
          >
            {state.raw ? (
              <pre className="text-xs font-mono text-zinc-400 whitespace-pre-wrap">{state.raw}</pre>
            ) : (
              <p className="text-xs text-zinc-600">Raw response will appear here.</p>
            )}
          </div>
        </div>
      </div>

      <div className="mt-6 bg-zinc-800 border border-zinc-700 rounded-xl p-5">
        <h2 className="text-sm font-semibold text-zinc-200 mb-2">Route Mock Testing Notes</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs text-zinc-500">
          <div className="bg-zinc-900 rounded-lg p-3">
            <div className="text-zinc-300 font-medium mb-1">Mock entire response</div>
            Use <code className="text-indigo-400">pw route add /api/products --body &apos;{"{}"}&apos;</code> to replace
            the response with a mock.
          </div>
          <div className="bg-zinc-900 rounded-lg p-3">
            <div className="text-zinc-300 font-medium mb-1">Request counter</div>
            The request count shows how many times the fetch was triggered. After route mock,
            verify responses differ.
          </div>
        </div>
      </div>
    </div>
  );
}
