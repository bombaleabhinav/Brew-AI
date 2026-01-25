import { Link, useLocation, useNavigate } from "react-router";
import { motion } from "motion/react";
import { auth } from "@/app/services/firebase";
import { onAuthStateChanged, signOut, User } from "firebase/auth";
import { useEffect, useState } from "react";

export function Navigation() {
  const location = useLocation();
  const navigate = useNavigate();
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
    });
    return () => unsubscribe();
  }, []);

  const handleLogout = async () => {
    try {
      await signOut(auth);
      navigate("/");
    } catch (error) {
      console.error("Logout error:", error);
    }
  };

  const links = [
    { to: "/", label: "Home" },
    { to: "/evaluate", label: "Evaluate" },
    { to: "/mock-pitch", label: "Mock Pitch" },
    { to: "/team-fit", label: "Team Fit" },
    { to: "/about", label: "About" },
    { to: "/contact", label: "Contact" },
  ];

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-white/80 backdrop-blur-sm border-b border-neutral-200">
      <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
        <Link to="/" className="text-2xl tracking-tight text-neutral-900 flex items-center gap-2">
          <img src="/media/logo.png" alt="Brew Logo" className="w-8 h-8" />
          Brew
        </Link>

        <div className="flex items-center gap-8">
          <div className="hidden md:flex items-center gap-6">
            {links.map((link) => (
              <Link
                key={link.to}
                to={link.to}
                className={`text-sm transition-colors ${location.pathname === link.to
                  ? "text-neutral-900"
                  : "text-neutral-600 hover:text-neutral-900"
                  }`}
              >
                {link.label}
              </Link>
            ))}
          </div>

          <div className="flex items-center gap-3">
            {user ? (
              <div className="flex items-center gap-4">
                <span className="text-sm text-neutral-600 border-r pr-4 border-neutral-200">
                  Hi, {user.displayName || user.email?.split('@')[0]}
                </span>
                <button
                  onClick={handleLogout}
                  className="text-sm text-neutral-600 hover:text-neutral-900 transition-colors"
                >
                  Logout
                </button>
              </div>
            ) : (
              <>
                <Link
                  to="/login"
                  className="text-sm text-neutral-600 hover:text-neutral-900 transition-colors"
                >
                  Login
                </Link>
                <Link
                  to="/signup"
                  className="text-sm bg-neutral-900 text-white px-4 py-2 rounded-md hover:bg-neutral-800 transition-colors"
                >
                  Sign up
                </Link>
              </>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
}
