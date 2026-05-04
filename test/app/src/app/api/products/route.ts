import { type NextRequest, NextResponse } from "next/server";

interface Product {
  id: number;
  name: string;
  price: number;
  category: string;
  inStock: boolean;
}

const PRODUCTS: Product[] = [
  { id: 1, name: 'MacBook Pro 16"', price: 2499.0, category: "laptop", inStock: true },
  { id: 2, name: "Dell XPS 15", price: 1899.99, category: "laptop", inStock: true },
  { id: 3, name: "Logitech MX Master 3", price: 99.99, category: "accessory", inStock: true },
  { id: 4, name: 'Samsung 27" 4K Monitor', price: 499.0, category: "monitor", inStock: false },
  { id: 5, name: "Sony WH-1000XM5", price: 349.99, category: "audio", inStock: true },
  { id: 6, name: "Keychron K3 Keyboard", price: 89.99, category: "accessory", inStock: true },
  { id: 7, name: "Lenovo ThinkPad X1 Carbon", price: 1599.0, category: "laptop", inStock: true },
  { id: 8, name: 'LG UltraWide 34"', price: 699.0, category: "monitor", inStock: true },
  { id: 9, name: "Anker USB-C Hub", price: 49.99, category: "accessory", inStock: false },
  { id: 10, name: "Rode NT-USB Microphone", price: 169.0, category: "audio", inStock: true },
];

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q");
  const delay = parseInt(searchParams.get("delay") ?? "0", 10);

  if (delay > 0 && delay <= 10000) {
    await new Promise((resolve) => setTimeout(resolve, delay));
  }

  let products = PRODUCTS;
  if (q) {
    const lower = q.toLowerCase();
    products = PRODUCTS.filter(
      (p) => p.name.toLowerCase().includes(lower) || p.category.toLowerCase().includes(lower),
    );
  }

  return NextResponse.json({
    products,
    total: products.length,
    query: q ?? null,
    timestamp: new Date().toISOString(),
  });
}
