export default function Navbar() {
  return (
    <nav className="border-b border-white/10">
      <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
        <h1 className="font-bold text-xl">
          Neural Shield
        </h1>

        <button className="bg-blue-600 px-4 py-2 rounded-lg">
          Get Protected
        </button>
      </div>
    </nav>
  );
}