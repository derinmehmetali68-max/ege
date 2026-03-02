import { Link, useLocation } from "react-router-dom";
import { BookOpen, Upload, BarChart3, Home, Moon, Sun, Settings } from "lucide-react";
import { useTheme } from "../../context/ThemeContext";

export default function Header() {
  const location = useLocation();
  const { theme, toggle } = useTheme();
  const isActive = (path: string) => location.pathname === path;

  const navLinkClass = (path: string) =>
    `flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
      isActive(path)
        ? "bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400"
        : "text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-gray-200"
    }`;

  return (
    <header className="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <div className="flex items-center justify-between h-16">
          <Link to="/" className="flex items-center gap-2">
            <BookOpen className="w-8 h-8 text-blue-600 dark:text-blue-400" />
            <span className="text-xl font-bold text-gray-900 dark:text-white">
              EGE Soru Bankası
            </span>
          </Link>

          <nav className="flex items-center gap-1">
            <Link to="/" className={navLinkClass("/")}>
              <Home className="w-4 h-4" />
              <span className="hidden sm:inline">Ana Sayfa</span>
            </Link>
            <Link to="/upload" className={navLinkClass("/upload")}>
              <Upload className="w-4 h-4" />
              <span className="hidden sm:inline">Soru Yükle</span>
            </Link>
            <Link to="/manage" className={navLinkClass("/manage")}>
              <Settings className="w-4 h-4" />
              <span className="hidden sm:inline">Soru Yönet</span>
            </Link>
            <Link to="/stats" className={navLinkClass("/stats")}>
              <BarChart3 className="w-4 h-4" />
              <span className="hidden sm:inline">İstatistikler</span>
            </Link>

            <button
              onClick={toggle}
              className="ml-2 p-2 rounded-lg text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
              aria-label={theme === "dark" ? "Açık moda geç" : "Koyu moda geç"}
            >
              {theme === "dark" ? (
                <Sun className="w-5 h-5" />
              ) : (
                <Moon className="w-5 h-5" />
              )}
            </button>
          </nav>
        </div>
      </div>
    </header>
  );
}
