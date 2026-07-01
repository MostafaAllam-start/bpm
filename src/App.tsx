import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import BrandLogo from "@components/BrandLogo";
import BPM from "@/BPM/index.ts";
import { useAuthStore } from "@/auth/authStore";
import LanguageSwitcher from "@/i18n/LanguageSwitcher";
import ThemeToggle from "@components/ThemeToggle";
import "./App.css";

function App() {
  const navigate = useNavigate();
  const { t } = useTranslation("studio");
  const user = useAuthStore((s) => s.user);
  const signOut = useAuthStore((s) => s.signOut);

  const handleSignOut = () => {
    signOut();
    navigate("/login", { replace: true });
  };

  return (
    <div className="app rtl:text-right ltr:text-left">
      <header className="app-header">
        <div className="app-brand">
          <span className="app-logo" aria-hidden="true">
            <BrandLogo />
          </span>
          <div className="app-title">
            <h1>{t("title")}</h1>
            <p>{t("subtitle")}</p>
          </div>
        </div>
        <div className="app-account">
          <ThemeToggle />
          <LanguageSwitcher />
          {user?.userName && (
            <span className="app-account-name">{user.userName}</span>
          )}
          <button type="button" className="app-signout" onClick={handleSignOut}>
            {t("signOut")}
          </button>
        </div>
      </header>

      <main className="app-main">
        <BPM />
      </main>
    </div>
  );
}

export default App;
