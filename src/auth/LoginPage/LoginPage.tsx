import { useState, type FormEvent } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { login } from "@/auth/api";
import { useAuthStore } from "@/auth/authStore";
import LanguageSwitcher from "@/i18n/LanguageSwitcher";
import BrandLogo from "@components/BrandLogo";
import "./LoginPage.css";

type LocationState = { from?: { pathname: string } } | null;

function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { t } = useTranslation("login");
  const signIn = useAuthStore((s) => s.signIn);

  const [userName, setUserName] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Send the user back to where they were headed, or to the modeler.
  const from = (location.state as LocationState)?.from?.pathname ?? "/";

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (submitting) return;
    setError(null);
    setSubmitting(true);
    try {
      const { token, raw } = await login(userName.trim(), password);
      signIn(token, { userName: userName.trim(), raw });
      navigate(from, { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : t("failed"));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="login-page">
      <form className="login-card" onSubmit={handleSubmit}>
        <div className="login-brand">
          <span className="login-logo" aria-hidden="true">
            <BrandLogo />
          </span>
        </div>

        <div className="login-head">
          <h1>{t("title")}</h1>
          <p>{t("subtitle")}</p>
          <LanguageSwitcher />
        </div>

        <label className="login-field">
          <span>{t("username")}</span>
          <input
            type="text"
            name="username"
            autoComplete="username"
            value={userName}
            onChange={(e) => setUserName(e.target.value)}
            placeholder={t("usernamePlaceholder")}
            required
            autoFocus
          />
        </label>

        <label className="login-field">
          <span>{t("password")}</span>
          <input
            type="password"
            name="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder={t("passwordPlaceholder")}
            required
          />
        </label>

        {error && (
          <p className="login-error" role="alert">
            {error}
          </p>
        )}

        <button
          type="submit"
          className="login-submit"
          disabled={submitting || !userName || !password}
        >
          {submitting ? t("signingIn") : t("signIn")}
        </button>
      </form>
    </div>
  );
}

export default LoginPage;
